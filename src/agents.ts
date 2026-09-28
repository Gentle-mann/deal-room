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
  opts: { title: string; instructions: string; input: string; model: string; timeoutMs?: number },
): Promise<{ text: string; via: "Brainbase" | "fallback"; threadId?: string; seconds: number }> {
  const t0 = Date.now();
  const fallback = async () => {
    const text = await wai(env, "@cf/openai/gpt-oss-120b", opts.instructions, opts.input).catch(() =>
      wai(env, "@cf/meta/llama-3.3-70b-instruct-fp8-fast", opts.instructions, opts.input),
    );
    return { text, via: "fallback" as const, seconds: (Date.now() - t0) / 1000 };
  };
  if (env.BRAINBASE_OFF === "1" || !env.BRAINBASE_API_KEY) return fallback();
  const H = { Authorization: `Bearer ${env.BRAINBASE_API_KEY}`, "Content-Type": "application/json" };
  try {
    const res = await fetch(`${BB}/threads`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        agent: { harness: "claude_code", model: opts.model, machine_kind: "cloudflare", title: opts.title, instructions: opts.instructions },
        input: opts.input,
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.thread_id) return fallback();
    const id = body.thread_id as string;
    const deadline = t0 + (opts.timeoutMs ?? 150_000);
    while (Date.now() < deadline) {
      await sleep(2500);
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
