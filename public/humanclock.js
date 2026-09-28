// Live human-equivalent clock. Every interaction the agents actually perform adds the elapsed calendar time
// a human team typically takes for that same step (HUMAN_COST, sourced benchmarks). Buyer-side steps are
// sequential; each vendor's track runs in parallel with the others, as it would for human teams.
// The 134-day industry average is shown only as a reference for the model, never added in.

export const HOUR = 3600, DAY = 86400, BENCHMARK_DAYS = 134;

// Elapsed calendar hours for ONE occurrence. `why` is shown in the UI; `src` lists the benchmark sources.
export const HUMAN_COST = {
  rfp:           { h: 96,  why: "buyer drafts and issues the RFP", src: [] },
  channel:       { h: 48,  why: "intro call between counterpart teams gets scheduled", src: [] },
  task:          { h: 8,   why: "internal handoff to a colleague", src: [] },
  handoff:       { h: 8,   why: "internal handoff to a colleague", src: [] },
  search:        { h: 1,   why: "analyst runs a search and reads the results", src: [] },
  read:          { h: 0.5, why: "analyst reads an internal document", src: [] },
  tool:          { h: 0.25, why: "analyst looks something up", src: [] },
  brief:         { h: 16,  why: "analyst writes the negotiation brief", src: [] },
  proposal:      { h: 168, why: "vendor prepares a proposal", src: [] },
  questionnaire: { h: 168, why: "vendor completes the security questionnaire", src: [] },
  grade:         { h: 120, why: "security team reviews the vendor", src: [] },
  counter:       { h: 48,  why: "one negotiation turn by email", src: [] },
  offer:         { h: 48,  why: "one negotiation turn by email", src: [] },
  block:         { h: 48,  why: "out-of-policy terms go to the deal desk for an exception", src: [] },
  redline:       { h: 120, why: "legal reviews the contract and sends red lines", src: [] },
  eliminate:     { h: 24,  why: "buyer rules the vendor out", src: [] },
  award:         { h: 72,  why: "award decision meeting", src: [] },
  debrief:       { h: 24,  why: "losing vendor is debriefed", src: [] },
  escalate:      { h: 24,  why: "approval request goes up the chain", src: [] },
  approve:       { h: 72,  why: "executive approval", src: [] },
  signature:     { h: 48,  why: "contract countersigned", src: [] },
  fraud:         { h: 24,  why: "bank-detail change verified by callback", src: [] },
  po:            { h: 72,  why: "purchase order issued", src: [] },
  invoice:       { h: 24,  why: "vendor issues the invoice", src: [] },
  payment:       { h: 216, why: "accounts payable processes and pays", src: [] },
  provision:     { h: 72,  why: "vendor provisions the workspace", src: [] },
};

export const STAGE_NAMES = ["Intake", "Proposals", "Security review", "Negotiation", "Legal review", "Award", "Approvals", "Onboarding & PO", "Invoice & payment", "Provisioning"];

// Which cost an event carries (null = no human-equivalent work, e.g. system notices)
function costKey(e, state) {
  if (!e.agent || !state.agents[e.agent] || e.kind === "stage") return null; // only real agents' actions count
  if (e.art === "proposal" && e.agent.startsWith("acme.")) return "handoff"; // buyer routing a proposal internally
  return HUMAN_COST[e.art] ? e.art : null;
}

// Returns per-stage human seconds, the running total, and each event's cost (aligned with state.events)
export function humanClock(state) {
  const vendorKeys = Object.values(state.tracks || {}).map((t) => ({ key: t.key, name: t.name }));
  const trackOf = (e) => {
    for (const v of vendorKeys) if ((e.agent || "").startsWith(v.key + ".") || (e.to || "").startsWith(v.key + ".")) return v.key;
    for (const v of vendorKeys) if ((e.text || "").includes(v.name)) return v.key;
    return "buyer";
  };
  const stages = STAGE_NAMES.map(() => ({ buyer: 0, vendors: {} }));
  const costs = new Array(state.events.length).fill(0);
  let stage = 0, lastBlock = {};
  state.events.forEach((e, i) => {
    if (e.kind === "stage") { const n = STAGE_NAMES.indexOf(e.text.replace(/^Stage \d+: /, "")); if (n >= 0) stage = n; return; }
    const k = costKey(e, state); if (!k) return;
    // Several charter blocks on one proposed offer are one exception request for a human deal desk
    if (k === "block") { if (lastBlock[e.agent] && e.t - lastBlock[e.agent] < 2500) { lastBlock[e.agent] = e.t; return; } lastBlock[e.agent] = e.t; }
    const sec = HUMAN_COST[k].h * HOUR, tr = trackOf(e), s = stages[stage];
    if (tr === "buyer") s.buyer += sec; else s.vendors[tr] = (s.vendors[tr] || 0) + sec;
    costs[i] = sec;
  });
  const perStage = stages.map((s) => s.buyer + Math.max(0, ...Object.values(s.vendors)));
  const cum = []; let acc = 0; for (const x of perStage) { acc += x; cum.push(acc); }
  return { perStage, cum, total: acc, costs, counted: costs.filter(Boolean).length };
}
