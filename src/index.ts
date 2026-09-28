import { DealRoom } from "./deal";
import { BUYER, fmt } from "./companies";

export { DealRoom };

type Env = {
  AI: any;
  DEAL: DurableObjectNamespace<DealRoom>;
  ASSETS: Fetcher;
  BRAINBASE_API_KEY: string;
  BRAINBASE_OFF?: string;
  STRIPE_SECRET_KEY?: string;
  DEMO_PASSCODE?: string;
};

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const stub = (env: Env, id: string) => env.DEAL.get(env.DEAL.idFromName(id));

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname.split("/").filter(Boolean);

    if (p[0] === "api") {
      if (req.method === "POST" && p[1] === "deals" && p.length === 2) {
        // On the public deployment, starting a deal (which spends model credits) needs the demo passcode
        if (env.DEMO_PASSCODE && req.headers.get("x-demo-key") !== env.DEMO_PASSCODE) return json({ error: "passcode required" }, 401);
        const body = await req.json().catch(() => ({}));
        const id = crypto.randomUUID().slice(0, 6);
        await stub(env, id).start(id, body);
        return json({ id });
      }
      if (p[1] === "deals" && p[2]) {
        if (req.method === "GET" && p.length === 3) return json(await stub(env, p[2]).getState());
        if (req.method === "GET" && p[3] === "calls") return json(await stub(env, p[2]).getCalls());
      }
      // Dev-only: raw Workers AI output and latency for a model
      if (p[1] === "debug-ai" && url.hostname === "localhost") {
        const model = url.searchParams.get("model")!;
        const t0 = Date.now();
        const raw = await env.AI.run(model, { messages: [
          { role: "system", content: "You are the deal desk at a SaaS vendor. List price $150,000/yr. Respond with a single JSON object only." },
          { role: "user", content: 'Buyer asks $115,000/yr net 60. Reply {"message":"...","price":<number>,"paymentDays":<n>}' } ], max_tokens: 600 });
        return json({ model, ms: Date.now() - t0, raw });
      }
      return json({ error: "not found" }, 404);
    }

    // The winning vendor's provisioned tenant for the buyer
    if (p[0] === "t" && p[1]) {
      const s = await stub(env, p[1]).getState();
      if (!s?.tenant || !s.winner) return new Response("Workspace not provisioned yet.", { status: 404 });
      const o = s.winner.offer;
      const at = new Date(s.tenant.at).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles" });
      return new Response(
        `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${s.winner.name} workspace</title>
<script>try{if(localStorage.getItem("dealroom-theme")==="light")document.documentElement.dataset.theme="light";}catch(e){}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/tokens.css">
<style>html,body{height:auto;overflow:auto}
body{display:grid;grid-template-rows:none;place-items:center;min-height:100vh;margin:0;padding:16px;background:var(--bg);color:var(--text);font:400 14px/20px Inter,system-ui,sans-serif}
.card{max-width:560px;width:100%;background:var(--surface-1);border:1px solid var(--line-strong);border-radius:12px;padding:24px}
h1{margin:0 0 8px;font:700 28px/36px Inter,sans-serif;letter-spacing:-0.02em}.muted{color:var(--text-2)}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)}.row b{font-variant-numeric:tabular-nums}
.ok{color:var(--green);font-weight:600}</style></head><body><div class="card">
<div class="muted">${s.winner.name}</div><h1>Welcome, ${BUYER.name}</h1>
<p class="ok">Workspace live. Provisioned automatically at ${at} PT after payment cleared.</p>
<div class="row"><span>Seats</span><b>${o.seats}</b></div>
<div class="row"><span>Term</span><b>${o.termMonths} months</b></div>
<div class="row"><span>Annual price</span><b>$${fmt(o.price)}</b></div>
<div class="row"><span>Purchase order</span><b>${s.po ?? "-"}</b></div>
<div class="row"><span>Invoice</span><b>${s.invoice?.status ?? "-"}</b></div>
<p class="muted">Negotiated, approved, invoiced, paid and provisioned by AI agents with CounterAgent. Deal ${s.id}.</p>
</div></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    return env.ASSETS.fetch(req);
  },
};
