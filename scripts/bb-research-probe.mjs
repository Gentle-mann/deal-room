// Probe: can a Brainbase claude_code agent use web search + read files written by the entrypoint, and what do its events look like?
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const BB = "https://api.brainbaselabs.com/v2", H = { Authorization: `Bearer ${env.BRAINBASE_API_KEY}`, "Content-Type": "application/json" };
const t0 = Date.now();
const entrypoint = `mkdir -p acme && cat > acme/pilot-usage.md <<'DOC'
# Acme analytics pilot (internal, sample data)
Licensed seats: 250. Weekly active analysts in the pilot: 212.
DOC`;
const res = await fetch(`${BB}/threads`, { method: "POST", headers: H, body: JSON.stringify({
  agent: { harness: "claude_code", model: "claude-sonnet-5", machine_kind: "cloudflare", title: "research-probe", entrypoint,
    instructions: "You are a procurement analyst in a live demo with fictional companies. Use your web search tool and read local files when asked. Be brief." },
  input: "1) Do one web search for 'average SaaS multi-year contract discount 2026' and note one source URL. 2) Read acme/pilot-usage.md. 3) Reply with one line of JSON: {\"source\":\"<url>\",\"activeSeats\":<n>}." }) });
const b = await res.json(); console.log("create", res.status, JSON.stringify(b).slice(0, 200));
const id = b.thread_id;
let status = "running";
while (["running", "idle"].includes(status) && Date.now() - t0 < 240000) {
  await new Promise((r) => setTimeout(r, 4000));
  const s = await fetch(`${BB}/threads/${id}`, { headers: H }).then((r) => r.json());
  status = s.status;
  if (status === "idle") { const m = await fetch(`${BB}/threads/${id}/messages`, { headers: H }).then((r) => r.json()); if ((m.items || []).some((x) => x.role === "assistant")) break; }
}
console.log("status", status, "after", Math.round((Date.now() - t0) / 1000), "s");
const ev = await fetch(`${BB}/threads/${id}/events?limit=200`, { headers: H }).then((r) => r.json());
const items = ev.items || ev.events || ev.data || [];
console.log("events:", items.length, "keys:", Object.keys(ev));
const types = {}; for (const e of items) types[e.type] = (types[e.type] || 0) + 1; console.log(types);
for (const e of items.filter((e) => /tool/.test(e.type)).slice(0, 8)) console.log(JSON.stringify(e).slice(0, 700));
const m = await fetch(`${BB}/threads/${id}/messages`, { headers: H }).then((r) => r.json());
console.log("REPLY:", (m.items || []).filter((x) => x.role === "assistant").map((x) => typeof x.content === "string" ? x.content : JSON.stringify(x.content)).join("\n").slice(0, 600));
