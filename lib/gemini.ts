// Shared Gemini caller for every checker. Code-level resilience lives here so call and email checks behave the same.
const MAX_MODELS = 6;
const MAX_LITE_MODELS = 2;
const HEDGE_MS = 5_000;
const COOLDOWN_MS = 120_000;
let modelCache: { names: string[]; expires: number } | undefined;
// The model that last answered is tried first, so one overloaded or retired model doesn't slow every check.
let lastGood: string | undefined;
// Overloaded (503), rate-limited (429) or hanging models sit out briefly instead of costing every check a timeout.
const cooling = new Map<string, number>();
const version = (name: string) => Number(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || 0);
async function discoverModels(key: string) {
  if (modelCache && modelCache.expires > Date.now()) return modelCache.names;
  const models: { name: string; supportedGenerationMethods?: string[] }[] = [];
  let page = "";
  do {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models${page ? `?pageToken=${encodeURIComponent(page)}` : ""}`, {
      headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(8_000), cache: "no-store",
    });
    if (!response.ok) throw new Error("Model discovery failed");
    const data = await response.json();
    models.push(...(data.models || [])); page = data.nextPageToken || "";
  } while (page);
  const usable = models.filter(m => /gemini-\d+(?:\.\d+)?-flash(?:$|-)/.test(m.name) &&
    !/image|audio|tts|live|exp/.test(m.name) && m.supportedGenerationMethods?.includes("generateContent"));
  const byNewest = (a: { name: string }, b: { name: string }) => version(b.name) - version(a.name) || Number(/preview/.test(a.name)) - Number(/preview/.test(b.name)) || b.name.localeCompare(a.name);
  const flash = usable.filter(m => !/lite/.test(m.name)).sort(byNewest);
  // Flash-Lite is a last resort when every Flash model is overloaded.
  const lite = usable.filter(m => /lite/.test(m.name)).sort(byNewest);
  if (!flash.length && !lite.length) throw new Error("No Flash model available");
  modelCache = { names: [...flash.slice(0, MAX_MODELS), ...lite.slice(0, MAX_LITE_MODELS)].map(m => m.name), expires: Date.now() + 3_600_000 };
  return modelCache.names;
}
function modelOrder(discovered: string[]) {
  const pinned = process.env.GEMINI_MODEL ? `models/${process.env.GEMINI_MODEL.replace(/^models\//, "")}` : undefined;
  const order = [...new Set([pinned, lastGood, ...discovered].filter((name): name is string => !!name))];
  const ready = order.filter(name => (cooling.get(name) || 0) < Date.now());
  return ready.length ? [...ready, ...order.filter(name => !ready.includes(name))] : order;
}
/**
 * Ask Gemini for schema-constrained JSON and validate it with `parse`. Returns null when every model fails,
 * so callers can fall back to an inconclusive result — never to a safe one.
 */
export async function generateVerdict<T>(key: string, options: {
  systemPrompt: string; userText: string; schema: object; parse: (text: string) => T | null; deadlineMs?: number;
}): Promise<T | null> {
  const deadline = Date.now() + (options.deadlineMs ?? 50_000);
  let models: string[];
  try { models = modelOrder(await discoverModels(key)); } catch { return null; }
  const controllers: AbortController[] = [];
  // One model's attempt: a second try only when the answer was unreadable.
  async function attempt(model: string): Promise<T | null> {
    const controller = new AbortController(); controllers.push(controller);
    for (let tries = 0; tries < 2; tries++) {
      const remaining = deadline - Date.now();
      if (remaining < 1500 || controller.signal.aborted) return null;
      let response: Response;
      try { response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: options.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: options.userText }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: options.schema,
            // Low thinking keeps a verdict to a few seconds instead of 10+.
            ...(version(model) >= 3 ? { thinkingConfig: { thinkingLevel: "low" } } : {}) } }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(Math.min(remaining, 30_000))]),
      }); } catch { if (!controller.signal.aborted) cooling.set(model, Date.now() + COOLDOWN_MS); return null; }
      if (!response.ok) {
        if (response.status === 404) { modelCache = undefined; if (lastGood === model) lastGood = undefined; }
        if ([400, 404, 429].includes(response.status) || response.status >= 500) cooling.set(model, Date.now() + COOLDOWN_MS);
        return null;
      }
      const data = await response.json().catch(() => null);
      const text = data?.candidates?.[0]?.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || "").join("");
      const verdict = typeof text === "string" ? options.parse(text) : null;
      if (verdict) { lastGood = model; cooling.delete(model); return verdict; }
    }
    return null;
  }
  // Hedged requests: when Gemini is overloaded some models hang for 15-35 s before failing. If a model hasn't answered
  // within HEDGE_MS, the next one starts in parallel; the first valid verdict wins and the rest are cancelled.
  return new Promise<T | null>(resolve => {
    let next = 0; let running = 0; let done = false;
    let hedge: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: T | null) => {
      if (done) return; done = true; clearTimeout(hedge); clearTimeout(overall);
      controllers.forEach(controller => controller.abort()); resolve(value);
    };
    const overall = setTimeout(() => finish(null), Math.max(0, deadline - Date.now()));
    const launch = () => {
      if (done) return;
      if (next >= models.length) { if (running === 0) finish(null); return; }
      const model = models[next++]; running++;
      clearTimeout(hedge); hedge = setTimeout(launch, HEDGE_MS);
      void attempt(model).then(verdict => { running--; if (verdict) finish(verdict); else launch(); });
    };
    launch();
  });
}
