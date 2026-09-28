// Model calls: Brainbase for frontier orchestrators, Workers AI for open-weight subagents.

export type AiEnv = { AI: any; BRAINBASE_API_KEY: string; BRAINBASE_OFF?: string };

const BB = "https://api.brainbaselabs.com/v2";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function extractJson<T = any>(text: string): T | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```json|```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function wai(env: AiEnv, model: string, system: string, user: string): Promise<string> {
  const res: any = await env.AI.run(model, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: 900,
    temperature: 0.4,
  });
  if (typeof res === "string") return res;
  if (typeof res?.response === "string") return res.response;
  if (res?.response && typeof res.response === "object") return JSON.stringify(res.response);
  const msg = res?.choices?.[0]?.message;
  if (typeof msg?.content === "string") return msg.content;
  return ""; // reasoning-only or empty reply: treat as no answer rather than parsing the envelope
}

export async function waiJson<T = any>(env: AiEnv, model: string, system: string, user: string): Promise<{ data: T | null; raw: string }> {
  let raw = await wai(env, model, system + "\nRespond with a single JSON object only. No prose outside the JSON.", user);
  let data = extractJson<T>(raw);
  if (!data) {
    raw = await wai(env, model, system + "\nYour previous reply was not valid JSON. Respond with ONE valid JSON object and nothing else.", user);
    data = extractJson<T>(raw);
  }
  return { data, raw };
}

// Runs one Brainbase agent turn (claude_code harness on a Cloudflare sandbox) and returns its reply.
// Falls back to a Workers AI model if Brainbase is off, fails, or is too slow, so the live demo never stalls.
export async function brainbaseDecide(
  env: AiEnv,
  opts: { title: string; instructions: string; input: string; model?: string; harness?: string; timeoutMs?: number; entrypoint?: string; onStart?: (threadId: string) => void; onTick?: (threadId: string) => Promise<void> },
): Promise<{ text: string; via: "Brainbase" | "fallback"; threadId?: string; seconds: number }> {
  const t0 = Date.now();
  const fallback = async () => {
    const text = await wai(env, "@cf/openai/gpt-oss-120b", opts.instructions, opts.input)
      .catch(() => wai(env, "@cf/meta/llama-3.3-70b-instruct-fp8-fast", opts.instructions, opts.input))
      .catch(() => ""); // Workers AI can be out of quota too: an empty reply falls back to each step's safe default
    return { text, via: "fallback" as const, seconds: (Date.now() - t0) / 1000 };
  };
  if (env.BRAINBASE_OFF === "1" || !env.BRAINBASE_API_KEY) return fallback();
  const H = { Authorization: `Bearer ${env.BRAINBASE_API_KEY}`, "Content-Type": "application/json" };
  try {
    const res = await fetch(`${BB}/threads`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        agent: { harness: opts.harness ?? "claude_code", ...(opts.model ? { model: opts.model } : {}), machine_kind: "cloudflare", title: opts.title, instructions: opts.instructions, ...(opts.entrypoint ? { entrypoint: opts.entrypoint } : {}) },
        input: opts.input,
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.thread_id) return fallback();
    const id = body.thread_id as string;
    try { opts.onStart?.(id); } catch {}
    const deadline = t0 + (opts.timeoutMs ?? 150_000);
    while (Date.now() < deadline) {
      await sleep(2500);
      if (opts.onTick) await opts.onTick(id).catch(() => {});
      const s: any = await fetch(`${BB}/threads/${id}`, { headers: H }).then((r) => r.json()).catch(() => ({}));
      if (s.status === "fail") break;
      if (s.status === "running") continue;
      const m: any = await fetch(`${BB}/threads/${id}/messages`, { headers: H }).then((r) => r.json()).catch(() => ({}));
      const replies = (m.items ?? []).filter((x: any) => x.role === "assistant");
      if (replies.length) {
        const text = replies.map((x: any) => (typeof x.content === "string" ? x.content : JSON.stringify(x.content))).join("\n");
        return { text, via: "Brainbase", threadId: id, seconds: (Date.now() - t0) / 1000 };
      }
    }
    const r = await fallback();
    return { ...r, threadId: id };
  } catch {
    return fallback();
  }
}

// The tool calls a Brainbase agent has made so far (web searches, page fetches, file reads), for the Spotlight
export type ToolStep = { id: string; name: string; title: string; status: "running" | "done"; t: number; ms?: number };
export async function brainbaseSteps(env: AiEnv, threadId: string): Promise<ToolStep[]> {
  const r: any = await fetch(`${BB}/threads/${threadId}/events?limit=200`, { headers: { Authorization: `Bearer ${env.BRAINBASE_API_KEY}` } }).then((x) => x.json()).catch(() => ({}));
  const steps = new Map<string, ToolStep>();
  for (const e of r.items ?? []) {
    if (!e.tool_id || !/^tool_call\./.test(e.type)) continue;
    const cur = steps.get(e.tool_id) ?? { id: e.tool_id, name: e.data?.name ?? "Tool", title: e.data?.name ?? "Tool", status: "running" as const, t: Date.parse(e.started_at || e.ts) || Date.now() };
    if (e.data?.title) cur.title = e.data.title;
    if (e.type === "tool_call.end") {
      cur.status = "done";
      const a = e.data?.args ?? {};
      if (!e.data?.title) cur.title = a.query ? `Search "${a.query}"` : a.url ? `Fetch ${a.url}` : a.file_path ? `Read ${String(a.file_path).replace("/workspace/", "")}` : cur.title;
      const t1 = Date.parse(e.ended_at || e.ts); if (t1) cur.ms = Math.max(0, t1 - cur.t);
    }
    steps.set(e.tool_id, cur);
  }
  return [...steps.values()].sort((a, b) => a.t - b.t);
}
