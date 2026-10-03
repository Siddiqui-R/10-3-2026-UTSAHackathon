import type { Analysis } from "./analysis";
import { EVIDENCE_WINDOW_MS, scoreSignals, SIGNAL_THRESHOLD, type ScamSignal } from "./scamSignals";

export interface Recognition {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null; start(): void; abort(): void;
}
export type ListeningState = {
  status: "off" | "starting" | "listening" | "checking" | "error";
  mode: "keywords" | "periodic"; score: number; signals: ScamSignal[];
  words: string; message: string; seconds: number;
  // Protection is still running but degraded (offline, muted mic, failing provider). Shown prominently.
  warning: string;
};
export const initialListeningState: ListeningState = {
  status: "off", mode: "keywords", score: 0, signals: [], words: "", message: "Protection is off", seconds: 0, warning: "",
};
export type ListeningDependencies = {
  getMedia: () => Promise<MediaStream>;
  makeRecorder: (stream: MediaStream) => MediaRecorder;
  makeRecognition?: () => Recognition;
  transcribe: (audio: Blob, signal: AbortSignal) => Promise<string>;
  analyze: (words: string, signal: AbortSignal) => Promise<Analysis>;
  update: (state: ListeningState) => void;
  verdict: (result: Analysis) => void;
};
export const ROTATION_MS = 20_000;
export const CHECK_GAP_MS = 8_000;
export const MAX_PROVIDER_FAILURES = 3;
const MAX_WORD_ENTRIES = 200;
const MAX_WORD_CHARS = 4_000;
const RESTART_WINDOW_MS = 30_000;
const MAX_QUIET_RESTARTS = 6;

// The current segment and one previous segment are independent, decodable files.
// Audio and text are bounded to ~40 seconds; nothing is stored once a check finishes.
export class ListeningSession {
  private state = { ...initialListeningState };
  private generation = 0;
  private active = false;
  private checking = false;
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private recognition?: Recognition;
  private previous?: { blob: Blob; at: number };
  private finalWords: { text: string; at: number }[] = [];
  private interim = { text: "", at: 0 };
  private trigger?: ReturnType<typeof setTimeout>;
  private restart?: ReturnType<typeof setTimeout>;
  private rotation?: ReturnType<typeof setInterval>;
  private clock?: ReturnType<typeof setInterval>;
  private controller?: AbortController;
  private cutPromise?: Promise<Blob>;
  private started = 0;
  private lastCheck = 0;
  private holdUntil = 0;
  private failures = 0;
  private quietRestarts: number[] = [];
  private warnings = new Map<"offline" | "muted" | "provider" | "speech", string>();
  constructor(private readonly deps: ListeningDependencies) {}
  get status() { return this.state.status; }
  private publish(patch: Partial<ListeningState>) {
    this.state = { ...this.state, ...patch, warning: [...this.warnings.values()].join(" ") };
    this.deps.update(this.state);
  }
  private warn(kind: "offline" | "muted" | "provider" | "speech", message = "") {
    if (message) this.warnings.set(kind, message); else this.warnings.delete(kind);
    if (this.active) this.publish({});
  }
  stop(message = "Protection is off") {
    this.active = false; this.checking = false; this.generation++;
    clearTimeout(this.trigger); this.trigger = undefined; clearTimeout(this.restart); clearInterval(this.rotation); clearInterval(this.clock);
    this.controller?.abort(); this.closeRecognition();
    if (this.recorder) {
      this.recorder.onstop = null; this.recorder.onerror = null; this.recorder.ondataavailable = null;
      if (this.recorder.state !== "inactive") { try { this.recorder.stop(); } catch { /* already stopped */ } }
    }
    this.stream?.getTracks().forEach(track => { track.onended = null; track.onmute = null; track.onunmute = null; track.stop(); });
    this.stream = undefined; this.recorder = undefined; this.previous = undefined; this.finalWords = []; this.interim = { text: "", at: 0 };
    this.cutPromise = undefined; this.segment = () => new Blob(); this.failures = 0; this.quietRestarts = []; this.warnings.clear();
    this.publish({ ...initialListeningState, message });
  }
  private fail(message: string) { this.stop(message); this.publish({ status: "error" }); }
  /** Network state from the page. Offline protection keeps listening but cannot verify. */
  setOnline(online: boolean) {
    this.warn("offline", online ? "" : "No internet connection. CallCanary is still listening but cannot check calls until you reconnect.");
  }
  /** Ignore phrase triggers while CallCanary itself is talking, so its own explanation cannot trigger a check. */
  holdTriggers(ms: number) {
    this.holdUntil = Date.now() + ms; clearTimeout(this.trigger); this.trigger = undefined;
  }
  async start() {
    if (this.active || this.state.status === "starting") return;
    this.stop(); const generation = this.generation;
    this.publish({ status: "starting", message: "Opening your microphone…" });
    try {
      const stream = await this.deps.getMedia();
      if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream; this.active = true; this.started = Date.now();
      stream.getTracks().forEach(track => {
        track.onended = () => this.fail("Microphone disconnected. Protection stopped. Reconnect it, then start protection again.");
        track.onmute = () => this.warn("muted", "Your device muted the microphone. CallCanary can't hear until it is unmuted.");
        track.onunmute = () => this.warn("muted");
      });
      const mode = this.deps.makeRecognition ? "keywords" : "periodic";
      this.publish({ status: "listening", mode, message: mode === "keywords" ? "Listening for warning phrases" : "Checking short audio clips every 20 seconds" });
      this.record(); if (mode === "keywords") this.listen();
      this.rotation = setInterval(() => this.rotate(generation), ROTATION_MS);
      this.clock = setInterval(() => this.tick(), 1000);
    } catch { if (generation === this.generation) this.fail("Microphone unavailable. Allow microphone access, then start protection again."); }
  }
  private rotate(generation: number) {
    if (!this.active || this.cutPromise || generation !== this.generation) return;
    if (this.state.mode === "periodic") { if (!this.checking) void this.checkNow(false); return; }
    void this.cut().then(blob => {
      if (!this.active || generation !== this.generation) return;
      this.previous = { blob, at: Date.now() }; this.record();
    }).catch(() => { if (generation === this.generation) this.fail("The microphone stopped recording. Protection stopped. Please start it again."); });
  }
  private tick() {
    if (!this.active) return;
    // Silent failures: a track can end or a recorder can stop without firing events (e.g. after device sleep).
    const live = this.stream?.getTracks().some(track => (track as { readyState?: string }).readyState !== "ended");
    if (!live) { this.fail("Microphone disconnected. Protection stopped. Reconnect it, then start protection again."); return; }
    if (!this.cutPromise && this.recorder && this.recorder.state === "inactive") {
      this.fail("The microphone stopped recording. Protection stopped. Please start it again."); return;
    }
    const now = Date.now();
    this.finalWords = this.finalWords.filter(w => now - w.at < EVIDENCE_WINDOW_MS);
    this.publish({ seconds: Math.floor((now - this.started) / 1000) });
    if (!this.checking) this.evaluate(this.currentWords(), true);
  }
  private currentWords() {
    const recentInterim = Date.now() - this.interim.at < 8000 ? " " + this.interim.text : "";
    return (this.finalWords.map(w => w.text).join(" ") + recentInterim).slice(-MAX_WORD_CHARS);
  }
  private record() {
    if (!this.stream || !this.active) return;
    const recorder = this.deps.makeRecorder(this.stream); this.recorder = recorder;
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = null;
    recorder.onerror = () => this.fail("The microphone recording failed. Protection stopped. Please start it again.");
    // Kept on this recorder so cut() can finalize one valid file, never splice WebM containers.
    this.segment = () => new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    recorder.start(1000);
  }
  private segment: () => Blob = () => new Blob();
  private cut(): Promise<Blob> {
    if (this.cutPromise) return this.cutPromise;
    const recorder = this.recorder; const segment = this.segment;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(segment());
    const cut = new Promise<Blob>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Recorder did not stop")), 3000);
      recorder.onstop = () => { clearTimeout(timeout); recorder.onerror = null; recorder.onstop = null; resolve(segment()); };
      recorder.stop();
    }).finally(() => { if (this.cutPromise === cut) this.cutPromise = undefined; });
    this.cutPromise = cut;
    return this.cutPromise;
  }
  private closeRecognition() {
    clearTimeout(this.restart);
    if (!this.recognition) return;
    this.recognition.onend = null; this.recognition.onresult = null; this.recognition.onerror = null;
    try { this.recognition.abort(); } catch { /* already closed */ }
    this.recognition = undefined;
  }
  private toPeriodic(message: string) {
    this.closeRecognition();
    this.warn("speech", "Phrase listening is unavailable, so CallCanary is checking 20-second clips with ElevenLabs instead.");
    this.publish({ mode: "periodic", message });
  }
  private listen() {
    if (!this.active || this.checking || !this.deps.makeRecognition || this.state.mode !== "keywords") return;
    this.closeRecognition();
    const recognition = this.deps.makeRecognition(); this.recognition = recognition;
    const generation = this.generation;
    let heard = false;
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = "en-US";
    const finals = new Set<number>();
    recognition.onresult = event => {
      if (!this.active || this.checking || generation !== this.generation) return;
      heard = true; this.quietRestarts = [];
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal && !finals.has(i)) { finals.add(i); this.finalWords.push({ text: result[0].transcript.slice(0, 1000), at: Date.now() }); }
        if (!result.isFinal) interim += " " + result[0].transcript;
      }
      const now = Date.now();
      this.finalWords = this.finalWords.filter(w => now - w.at < EVIDENCE_WINDOW_MS).slice(-MAX_WORD_ENTRIES);
      this.interim = { text: interim.slice(-1000), at: now };
      this.evaluate(this.currentWords(), true);
    };
    recognition.onerror = event => {
      if (generation !== this.generation || !this.active) return;
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
        // Recording still works in many of these cases; fall back rather than drop protection.
        this.toPeriodic("Speech listening was blocked. Checking audio every 20 seconds instead."); return;
      }
      if (event.error === "network" || event.error === "language-not-supported")
        this.toPeriodic("Speech listening unavailable. Checking audio every 20 seconds instead.");
    };
    recognition.onend = () => {
      if (!this.active || this.checking || generation !== this.generation || this.state.mode !== "keywords") return;
      // Browsers end recognition after silence or ~60 seconds; restart, but detect a tight failure loop.
      const now = Date.now();
      if (!heard) this.quietRestarts = [...this.quietRestarts.filter(at => now - at < RESTART_WINDOW_MS), now];
      if (this.quietRestarts.length >= MAX_QUIET_RESTARTS) { this.toPeriodic("Speech listening keeps stopping. Checking audio every 20 seconds instead."); return; }
      this.restart = setTimeout(() => this.listen(), 300 + 300 * this.quietRestarts.length);
    };
    try { recognition.start(); } catch { this.toPeriodic("Checking audio every 20 seconds instead."); }
  }
  private evaluate(words: string, canTrigger: boolean) {
    const scored = scoreSignals(words);
    this.publish({ ...scored, words: words.trim().slice(-2500) });
    if (scored.score < SIGNAL_THRESHOLD) { clearTimeout(this.trigger); this.trigger = undefined; return; }
    if (!canTrigger || this.checking || this.trigger || Date.now() < this.holdUntil) return;
    // Wait a moment for the sentence to finish, and leave a gap between automatic provider checks.
    const wait = Math.max(1000, this.lastCheck + CHECK_GAP_MS - Date.now());
    this.trigger = setTimeout(() => { this.trigger = undefined; void this.checkNow(false); }, wait);
  }
  async checkNow(force = true): Promise<void> {
    if (!this.active || this.checking) return;
    // Let an in-flight rotation install the next recorder before taking a snapshot.
    if (this.cutPromise) { try { await this.cutPromise; } catch { return; } return this.checkNow(force); }
    if (!this.active) return;
    const generation = this.generation; this.checking = true;
    const triggerWords = this.currentWords();
    clearTimeout(this.trigger); this.trigger = undefined; this.closeRecognition();
    this.publish({ status: "checking", message: "ElevenLabs is transcribing the recent audio…" });
    const controller = new AbortController(); this.controller = controller;
    const timeout = setTimeout(() => controller.abort(new Error("timeout")), 65_000);
    try {
      const previous = this.previous;
      const current = await this.cut();
      if (!this.active || generation !== this.generation) return;
      this.previous = undefined;
      this.record(); // Keep buffering while providers verify the captured snapshot.
      const clips = [previous && Date.now() - previous.at < ROTATION_MS + 5_000 ? previous.blob : undefined, current]
        .filter((blob): blob is Blob => !!blob && blob.size > 0);
      let words = "";
      if (clips.length) words = (await Promise.all(clips.map(clip => this.deps.transcribe(clip, controller.signal)))).join(" ").trim();
      if (!this.active || generation !== this.generation) return;
      // The browser heard trigger words that may sit in a clip boundary; keep them as evidence for Gemini.
      const evidence = [words, triggerWords && !words.includes(triggerWords.trim()) && scoreSignals(triggerWords).score >= SIGNAL_THRESHOLD ? `(Live captions also heard: ${triggerWords.trim()})` : ""].filter(Boolean).join("\n");
      const scored = scoreSignals(evidence); this.publish({ ...scored, words: evidence.slice(-2500) });
      if (evidence && (force || scored.score >= SIGNAL_THRESHOLD)) {
        this.publish({ message: "Gemini is checking the context…" });
        const verdict = await this.deps.analyze(evidence, controller.signal);
        if (!this.active || generation !== this.generation) return;
        this.failures = 0; this.warn("provider");
        if (verdict.level === "scam") {
          this.stop("Protection paused for the scam warning"); this.deps.verdict(verdict); return;
        }
        this.deps.verdict(verdict);
      }
      this.failures = 0; this.warn("provider");
      this.resume(evidence ? "Check complete. Listening continues." : "No words heard. Listening continues.");
    } catch (cause) {
      if (generation !== this.generation || !this.active) return;
      this.failures++;
      const reason = controller.signal.aborted ? "The safety check timed out." : cause instanceof Error ? cause.message : "The safety check failed.";
      if (this.failures >= MAX_PROVIDER_FAILURES) { this.fail(`${reason} Checks failed ${this.failures} times in a row, so protection stopped. Please start it again.`); return; }
      this.warn("provider", `${reason} Still listening — CallCanary will try again (${this.failures} of ${MAX_PROVIDER_FAILURES}).`);
      this.resume("Listening continues. The last check did not finish.");
    } finally { clearTimeout(timeout); if (generation === this.generation) this.lastCheck = Date.now(); }
  }
  private resume(message: string) {
    this.checking = false; this.finalWords = []; this.interim = { text: "", at: 0 };
    this.publish({ status: "listening", score: 0, signals: [], words: "", message });
    if (this.state.mode === "keywords") this.listen();
  }
}
