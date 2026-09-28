// Probe Brainbase harness/model combos for the fastest small open-weight subagent. node scripts/bb-openweight-probe.mjs
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const BASE = "https://api.brainbaselabs.com/v2", H = { Authorization: `Bearer ${env.BRAINBASE_API_KEY}`, "Content-Type": "application/json" };
const j = (r) => r.json().catch(() => ({})), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROLE = "You are the deal desk at a SaaS vendor. List price $150,000/yr. Respond with a single JSON object only, no prose.";
const INPUT = 'Buyer asks $115,000/yr net 60. Reply {"message":"...","price":<number>,"paymentDays":<n>}';
const combos = JSON.parse(process.argv[2] || "[]");
async function run(c) {
  const t0 = Date.now();
  const agent = { harness: c.harness, machine_kind: c.mk || "cloudflare", title: "probe " + (c.model || c.harness), instructions: ROLE, ...(c.model ? { model: c.model } : {}) };
  const res = await fetch(`${BASE}/threads`, { method: "POST", headers: H, body: JSON.stringify({ agent, input: INPUT }) });
  const b = await j(res);
  if (!res.ok) return { ...c, error: `${res.status} ${JSON.stringify(b).slice(0, 220)}` };
  while (Date.now() - t0 < 150_000) {
    await sleep(2000);
    const s = await fetch(`${BASE}/threads/${b.thread_id}`, { headers: H }).then(j);
    if (s.status && s.status !== "running" && s.status !== "queued" && s.status !== "pending") {
      const m = await fetch(`${BASE}/threads/${b.thread_id}/messages`, { headers: H }).then(j);
      const a = (m.items ?? []).filter((x) => x.role === "assistant").at(-1);
      return { ...c, status: s.status, secs: ((Date.now() - t0) / 1000).toFixed(1), reply: String(a?.content ?? "").replace(/\s+/g, " ").slice(0, 160), model_used: s.agent?.model ?? s.model };
    }
  }
  return { ...c, status: "timeout", secs: ">150" };
}
for (const r of await Promise.all(combos.map(run))) console.log(JSON.stringify(r));
