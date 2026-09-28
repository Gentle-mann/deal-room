// Test: warm follow-up latency, qwen harness, cloudflare sandbox. node scripts/bb-test2.mjs <existing_thread_id>
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const BASE = "https://api.brainbaselabs.com/v2";
const H = { Authorization: `Bearer ${env.BRAINBASE_API_KEY}`, "Content-Type": "application/json" };
const j = (r) => r.json().catch(() => ({}));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ROLE = `You are the procurement agent for Acme Corp, a large enterprise buying analytics software.
Your job is to evaluate vendor offers against Acme's buying policy and respond with a short, professional decision.
Acme's buying policy: maximum $120,000 per year, SOC 2 Type II required, payment terms net 60 or better, no auto-renewal.
Always answer in 2-3 sentences, then end with a line starting "DECISION:" followed by ACCEPT, COUNTER, or REJECT.`;
const OFFER = `Vendor B offers: $135,000 per year for 250 seats, 24-month term, SOC 2 Type II available under NDA, net 30 payment terms, auto-renews annually with a 7% uplift. What is your response?`;

async function assistantCount(id) {
  const m = await fetch(`${BASE}/threads/${id}/messages`, { headers: H }).then(j);
  const a = (m.items ?? []).filter((x) => x.role === "assistant");
  return { n: a.length, last: a.at(-1)?.content ?? "" };
}
async function waitForReply(id, before, t0) {
  while (Date.now() - t0 < 300_000) {
    await sleep(1500);
    const s = await fetch(`${BASE}/threads/${id}`, { headers: H }).then(j);
    const c = await assistantCount(id);
    if (c.n > before && s.status !== "running") return { status: s.status, reply: c.last };
    if (s.status === "fail") return { status: "fail", reply: c.last };
  }
  return { status: "timeout", reply: "" };
}
async function newThread(label, agent) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/threads`, { method: "POST", headers: H, body: JSON.stringify({ agent, input: OFFER }) });
  const b = await j(res);
  if (!res.ok) return { label, error: `${res.status} ${JSON.stringify(b).slice(0, 250)}` };
  const r = await waitForReply(b.thread_id, 0, t0);
  return { label, thread: b.thread_id, status: r.status, total_s: ((Date.now() - t0) / 1000).toFixed(1), reply: r.reply.replace(/\s+/g, " ").slice(0, 200) };
}
async function followUp(label, id) {
  const t0 = Date.now();
  const before = (await assistantCount(id)).n;
  const inputs = await fetch(`${BASE}/tasks/${id}/inputs`, { headers: H }).then(j);
  const gen = inputs.generation ?? inputs.expected_generation ?? inputs.current_generation ?? 0;
  const res = await fetch(`${BASE}/tasks/${id}/inputs`, { method: "POST", headers: H,
    body: JSON.stringify({ input_id: randomUUID(), messages: [{ role: "user", content: `You are Acme Corp's procurement agent. ${OFFER}` }], expected_generation: gen }) });
  const b = await j(res);
  if (!res.ok) return { label, error: `${res.status} ${JSON.stringify(b).slice(0, 250)} | inputs=${JSON.stringify(inputs).slice(0, 200)}` };
  const r = await waitForReply(id, before, t0);
  return { label, thread: id, status: r.status, total_s: ((Date.now() - t0) / 1000).toFixed(1), reply: r.reply.replace(/\s+/g, " ").slice(0, 200) };
}

const results = await Promise.all([
  followUp("A warm follow-up (claude_code, same thread)", process.argv[2]),
  newThread("B qwen harness (default model)", { harness: "qwen", title: "acme-procurement-qwen", instructions: ROLE }),
  newThread("C claude_code on cloudflare sandbox", { harness: "claude_code", model: "claude-sonnet-5", machine_kind: "cloudflare", title: "acme-procurement-cf", instructions: ROLE }),
]);
for (const r of results) console.log(JSON.stringify(r, null, 1));
