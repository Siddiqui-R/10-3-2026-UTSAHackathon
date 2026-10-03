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
};
export const initialListeningState: ListeningState = {
  status: "off", mode: "keywords", score: 0, signals: [], words: "", message: "Protection is off", seconds: 0,
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

// The current segment and one previous segment are independent, decodable files.
// Audio and text are bounded to 40 seconds; normal keyword-mode audio stays in memory.
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
  constructor(private readonly deps: ListeningDependencies) {}
  private publish(patch: Partial<ListeningState>) {
    this.state = { ...this.state, ...patch }; this.deps.update(this.state);
  }
  stop(message = "Protection is off") {
    this.active = false; this.checking = false; this.generation++;
    clearTimeout(this.trigger); clearTimeout(this.restart); clearInterval(this.rotation); clearInterval(this.clock);
    this.controller?.abort(); this.closeRecognition();
    if (this.recorder) {
      this.recorder.onstop = null; this.recorder.onerror = null;
      if (this.recorder.state !== "inactive") this.recorder.stop();
    }
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    this.stream = undefined; this.recorder = undefined; this.previous = undefined; this.finalWords = []; this.interim = { text: "", at: 0 }; this.cutPromise = undefined;
    this.publish({ ...initialListeningState, message });
  }
  private fail(message: string) { this.stop(message); this.publish({ status: "error" }); }
  async start() {
    if (this.active || this.state.status === "starting") return;
    this.stop(); const generation = this.generation;
    this.publish({ status: "starting", message: "Opening your microphone…" });
    try {
      const stream = await this.deps.getMedia();
      if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream; this.active = true; this.started = Date.now();
      stream.getTracks().forEach(track => { track.onended = () => this.fail("Microphone disconnected. Protection stopped."); });
      const mode = this.deps.makeRecognition ? "keywords" : "periodic";
      this.publish({ status: "listening", mode, message: mode === "keywords" ? "Listening for warning phrases" : "Checking short audio clips every 20 seconds" });
      this.record(); if (mode === "keywords") this.listen();
      this.rotation = setInterval(() => {
        if (!this.active || this.cutPromise) return;
        if (this.state.mode === "periodic" && !this.checking) { void this.checkNow(false); return; }
        void this.cut().then(blob => {
          if (!this.active || generation !== this.generation) return;
          this.previous = { blob, at: Date.now() }; this.record();
          if (!this.checking && this.state.mode === "keywords") { this.closeRecognition(); this.listen(); }
        }).catch(() => { if (generation === this.generation) this.fail("The microphone could not record. Please restart protection."); });
      }, 20_000);
      this.clock = setInterval(() => {
        if (!this.active) return;
        this.finalWords = this.finalWords.filter(w => Date.now() - w.at < EVIDENCE_WINDOW_MS);
        this.publish({ seconds: Math.floor((Date.now() - this.started) / 1000) });
        if (!this.checking) this.evaluate(this.finalWords.map(w => w.text).join(" ") + (Date.now() - this.interim.at < 8000 ? this.interim.text : ""), false);
      }, 1000);
    } catch { if (generation === this.generation) this.fail("Microphone unavailable. Allow microphone access, then start protection again."); }
  }
  private record() {
    if (!this.stream || !this.active) return;
    const recorder = this.deps.makeRecorder(this.stream); this.recorder = recorder;
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => { /* Replaced by cut(). */ };
    recorder.onerror = () => this.fail("The microphone recording failed. Protection stopped.");
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
    this.recognition.abort(); this.recognition = undefined;
  }
  private listen() {
    if (!this.active || this.checking || !this.deps.makeRecognition) return;
    const recognition = this.deps.makeRecognition(); this.recognition = recognition;
    const generation = this.generation;
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = "en-US";
    const finals = new Set<number>();
    recognition.onresult = event => {
      if (!this.active || this.checking || generation !== this.generation) return;
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal && !finals.has(i)) { finals.add(i); this.finalWords.push({ text: result[0].transcript, at: Date.now() }); }
        if (!result.isFinal) interim += " " + result[0].transcript;
      }
      this.finalWords = this.finalWords.filter(w => Date.now() - w.at < EVIDENCE_WINDOW_MS);
      this.interim = { text: interim, at: Date.now() };
      this.evaluate(this.finalWords.map(w => w.text).join(" ") + interim, true);
    };
    recognition.onerror = event => {
      if (generation !== this.generation || !this.active) return;
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
        this.fail("Speech listening is unavailable or permission was denied. Protection stopped."); return;
      }
      if (event.error === "network" || event.error === "language-not-supported") {
        this.closeRecognition(); clearTimeout(this.restart);
        this.publish({ mode: "periodic", message: "Speech listening unavailable. Checking audio every 20 seconds instead." });
      }
    };
    recognition.onend = () => {
      if (this.active && !this.checking && generation === this.generation && this.state.mode === "keywords")
        this.restart = setTimeout(() => this.listen(), 700);
    };
    try { recognition.start(); } catch { this.closeRecognition(); this.publish({ mode: "periodic", message: "Checking audio every 20 seconds instead." }); }
  }
  private evaluate(words: string, canTrigger: boolean) {
    const scored = scoreSignals(words);
    this.publish({ ...scored, words: words.trim().slice(-2500) });
    if (scored.score < SIGNAL_THRESHOLD) { clearTimeout(this.trigger); this.trigger = undefined; return; }
    if (canTrigger && !this.checking && !this.trigger) {
      this.trigger = setTimeout(() => { this.trigger = undefined; void this.checkNow(); }, 1000);
    }
  }
  async checkNow(force = true): Promise<void> {
    if (!this.active || this.checking) return;
    // Let an in-flight rotation install the next recorder before taking a snapshot.
    if (this.cutPromise) { try { await this.cutPromise; } catch { return; } return this.checkNow(force); }
    const generation = this.generation; this.checking = true;
    clearTimeout(this.trigger); this.trigger = undefined; clearTimeout(this.restart); this.closeRecognition();
    this.publish({ status: "checking", message: "ElevenLabs is transcribing the recent audio…" });
    const controller = new AbortController(); this.controller = controller;
    const timeout = setTimeout(() => { if (generation === this.generation) this.fail("The provider check timed out. Protection stopped. Please restart it."); }, 65_000);
    try {
      const previous = this.previous;
      const current = await this.cut();
      if (!this.active || generation !== this.generation) return;
      this.previous = undefined;
      this.record(); // Keep buffering while providers verify the captured snapshot.
      const clips = [previous && Date.now() - previous.at < 25_000 ? previous.blob : undefined, current]
        .filter((blob): blob is Blob => !!blob && blob.size > 0);
      if (!clips.length) throw new Error("No audio captured yet. Please restart protection.");
      const words = (await Promise.all(clips.map(clip => this.deps.transcribe(clip, controller.signal)))).join(" ").trim();
      if (!this.active || generation !== this.generation) return;
      const scored = scoreSignals(words); this.publish({ ...scored, words });
      if (words && (force || scored.score >= SIGNAL_THRESHOLD)) {
        this.publish({ message: "Gemini is checking the context…" });
        const verdict = await this.deps.analyze(words, controller.signal);
        if (!this.active || generation !== this.generation) return;
        if (verdict.level === "scam") {
          this.stop("Protection paused for the scam warning"); this.deps.verdict(verdict); return;
        }
        this.deps.verdict(verdict);
      }
      if (!this.active || generation !== this.generation) return;
      this.checking = false; this.finalWords = []; this.interim = { text: "", at: 0 };
      this.publish({ status: "listening", score: 0, signals: [], message: words ? "Check complete. Listening continues." : "No words heard. Listening continues." });
      if (this.state.mode === "keywords") this.listen();
    } catch (cause) {
      if (generation === this.generation && !controller.signal.aborted)
        this.fail(cause instanceof Error ? cause.message : "The safety check failed. Please restart protection.");
    } finally { clearTimeout(timeout); }
  }
}
