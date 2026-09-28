# CounterAgent

Company orchestrator agents negotiate, approve, invoice, pay and provision a B2B software deal end to end.

- **Frontier orchestrators** (one per company) run on [Brainbase](https://brainbaselabs.com) (Claude Sonnet 5).
- **Open-weight department subagents** (procurement, security, legal, finance, deal desk) run on Cloudflare Workers AI.
- **Charters** (price floors, discount caps, red lines, approval thresholds) are enforced in code, not by the model.
- **Money** moves through Stripe (test mode). **Provisioning** happens on Cloudflare.

Built at the Startup Speedrun Hackathon (Cloudflare HQ, Sep 28 2026).

## Run

```bash
npm install
cp .env .dev.vars   # BRAINBASE_API_KEY, optional STRIPE_SECRET_KEY (test)
npx wrangler dev
```

## Human clock

The "humans" line is not a fixed number. Every interaction the agents perform adds the typical elapsed time a human team takes for that step, from published benchmarks, with vendor tracks in parallel. A full deal comes to about 85 days to signature (industry median: 84) and about 106 days end to end. Values and sources: [docs/HUMAN-CLOCK.md](docs/HUMAN-CLOCK.md).
