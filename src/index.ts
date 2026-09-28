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
        const body = await req.json().catch(() => ({}));
        const id = crypto.randomUUID().slice(0, 6);
        await stub(env, id).start(id, body);
        return json({ id });
      }
      if (p[1] === "deals" && p[2]) {
        if (req.method === "GET" && p.length === 3) return json(await stub(env, p[2]).getState());
        if (req.method === "POST" && p[3] === "approve") {
          const { approve } = (await req.json().catch(() => ({}))) as { approve?: boolean };
          return json(await stub(env, p[2]).decide(!!approve));
        }
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
<style>body{font-family:system-ui,sans-serif;background:#0b1020;color:#e8ecf6;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
.card{max-width:560px;width:100%;background:#131a33;border:1px solid #2a3560;border-radius:16px;padding:28px}
h1{margin:0 0 6px;font-size:28px}.muted{color:#9aa6c7}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222b4d}
.ok{color:#5be49b;font-weight:600}</style></head><body><div class="card">
<div class="muted">${s.winner.name}</div><h1>Welcome, ${BUYER.name}</h1>
<p class="ok">Workspace live. Provisioned automatically at ${at} PT after payment cleared.</p>
<div class="row"><span>Seats</span><b>${o.seats}</b></div>
<div class="row"><span>Term</span><b>${o.termMonths} months</b></div>
<div class="row"><span>Annual price</span><b>$${fmt(o.price)}</b></div>
<div class="row"><span>Purchase order</span><b>${s.po ?? "-"}</b></div>
<div class="row"><span>Invoice</span><b>${s.invoice?.status ?? "-"}</b></div>
<p class="muted">Negotiated, approved, invoiced, paid and provisioned by AI agents in the Deal Room. Deal ${s.id}.</p>
</div></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    return env.ASSETS.fetch(req);
  },
};
