// Brainbase timing test: node scripts/bb-timing.mjs [count] [machine_kind]
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const KEY = env.BRAINBASE_API_KEY;
if (!KEY) throw new Error("BRAINBASE_API_KEY missing in .env");

const BASE = "https://api.brainbaselabs.com/v2";
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const count = Number(process.argv[2] ?? 1);
const machine = process.argv[3]; // optional: daytona | cloudflare | e2b ...

async function runOne(i) {
  const t0 = Date.now();
  const agent = {
    harness: "claude_code",
    model: "claude-sonnet-5",
    title: `timing-test-${i}`,
    instructions:
      "You are a procurement agent in a timing test. Do not use any tools. Reply with one line of JSON only.",
  };
  if (machine) agent.machine_kind = machine;
  const res = await fetch(`${BASE}/threads`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ agent, input: `Return {"agent":${i},"offer_usd":${1000 + i}} and nothing else.` }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { i, error: `${res.status} ${JSON.stringify(body).slice(0, 300)}` };
  const created = Date.now() - t0;
  const id = body.thread_id;
  let status = body.status;
  while (["running", "idle"].includes(status) && Date.now() - t0 < 300_000) {
    await new Promise((r) => setTimeout(r, 1500));
    const s = await fetch(`${BASE}/threads/${id}`, { headers: H }).then((r) => r.json());
    status = s.status;
    if (status === "idle") {
      // idle can mean the turn finished; check transcript for an assistant reply
      const m = await fetch(`${BASE}/threads/${id}/messages`, { headers: H }).then((r) => r.json());
      if ((m.items ?? []).some((x) => x.role === "assistant")) break;
    }
  }
  const msgs = await fetch(`${BASE}/threads/${id}/messages`, { headers: H }).then((r) => r.json());
  const reply = (msgs.items ?? []).filter((x) => x.role === "assistant").map((x) => x.content).join(" ").slice(0, 160);
  return { i, thread: id, status, created_ms: created, total_s: ((Date.now() - t0) / 1000).toFixed(1), reply };
}

const t0 = Date.now();
const results = await Promise.all(Array.from({ length: count }, (_, i) => runOne(i)));
console.table(results);
console.log(`wall clock for ${count}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
