// node scripts/watch.mjs <dealId> [seconds]  — prints deal events as they happen
const id = process.argv[2], limit = Number(process.argv[3] ?? 280) * 1000, base = process.env.BASE ?? "http://localhost:8787";
let seen = 0; const t0 = Date.now();
while (Date.now() - t0 < limit) {
  const s = await fetch(`${base}/api/deals/${id}`).then((r) => r.json()).catch(() => null);
  if (s) {
    for (const e of s.events.slice(seen)) console.log(`[${((e.t - s.startedAt) / 1000).toFixed(0).padStart(3)}s] ${e.kind.padEnd(8)} ${e.company}${e.agent ? " / " + e.agent : ""}: ${e.text}`.slice(0, 400));
    seen = s.events.length;
    if (s.approval?.status === "pending" && !globalThis.approved) { console.log(">>> approval pending (auto-approving from watcher)"); await fetch(`${base}/api/deals/${id}/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"approve":true}' }); globalThis.approved = true; }
    if (s.done) { console.log("DONE", JSON.stringify({ winner: s.winner?.name, price: s.winner?.offer?.price, invoice: s.invoice, tenant: s.tenant })); break; }
  }
  await new Promise((r) => setTimeout(r, 3000));
}
