// Live human-equivalent clock. Every interaction the agents actually perform adds the elapsed calendar time
// a human team typically takes for that same step (HUMAN_COST, sourced benchmarks). Buyer-side steps are
// sequential; each vendor's track, and the analyst's research, run in parallel, as they would for human teams.
// The 134-day industry average is shown only as a reference for the model, never added in.

export const HOUR = 3600, DAY = 86400, BENCHMARK_DAYS = 134, MEDIAN_DAYS = 84; // B2B SaaS sales cycle to signature: mean, median

// Elapsed calendar hours for ONE occurrence, from web research on 2023-2026 benchmarks (Vertice, Loopio/APMP, Whistic, EY,
// APQC, Ardent Partners, DocuSign, Microsoft Research, EmailAnalytics...). est: true marks splits or proxies with no direct measurement.
export const HUMAN_COST = {
  rfp:           { h: 336, why: "buyer drafts and issues the RFP", src: ["https://www.responsive.io/blog/rfp-timeline","https://www.vertice.one/insights/procurement-process-stage-completion-times"] },
  channel:       { h: 120, why: "intro call between counterpart teams gets scheduled and held", src: ["https://calendly.com/blog/find-a-meeting-time","https://newsletter.outbound.kitchen/p/your-show-rate-is-a-meeting-quality","https://arxiv.org/abs/1703.08428","https://emailanalytics.com/email-productivity-benchmark-report/"] },
  task:          { h: 24, why: "internal request fulfilled by a colleague", src: ["https://ciir-publications.cs.umass.edu/getpdf.php?id=1270","https://www.prnewswire.com/news-releases/inefficient-knowledge-sharing-costs-large-businesses-47-million-per-year-300681971.html"] },
  search:        { h: 8, why: "analyst researches one benchmark", est: true, src: ["https://www.vertice.one/insights/procurement-process-stage-completion-times","https://www.vertice.one/insights/procurement-cycle-time"] },
  read:          { h: 4, why: "analyst finds and reads an internal document", est: true, src: ["https://ciir-publications.cs.umass.edu/getpdf.php?id=1270","https://www.prnewswire.com/news-releases/inefficient-knowledge-sharing-costs-large-businesses-47-million-per-year-300681971.html"] },
  tool:          { h: 1, why: "analyst looks something up", est: true, src: ["https://ciir-publications.cs.umass.edu/getpdf.php?id=1270"] },
  brief:         { h: 80, why: "analyst writes the negotiation brief", est: true, src: ["https://www.vertice.one/insights/procurement-process-stage-completion-times"] },
  proposal:      { h: 264, why: "vendor prepares and submits a proposal", src: ["https://link.loopio.com/hubfs/Content%20Pieces/Reports/2024%20RFP%20Trends%20&%20Benchmarks%20Report%20%7C%20Loopio%20(Digital%20Copy).pdf","https://www.nfold.com/wp-content/uploads/2025/02/loopio-trends-report-2025-digital.pdf","https://loopio.com/blog/loopio-releases-sixth-annual-rfp-response-trends-and-benchmarks-report/"] },
  questionnaire: { h: 120, why: "vendor completes the security questionnaire", src: ["https://6236605.fs1.hubspotusercontent-na1.net/hubfs/6236605/Marketing%20Collateral/2024-TPRM-Report.pdf","https://www.whistic.com/uploads/documents/2023-State-of-Vendor-Security.pdf"] },
  grade:         { h: 170, why: "security team reviews the vendor", src: ["https://www.vertice.one/insights/procurement-process-stage-completion-times","https://www.ey.com/content/dam/ey-unified-site/ey-com/en-gl/insights/risk/documents/ey-global-third-party-risk-management-survey-v3.pdf","https://www.whistic.com/uploads/documents/2023-State-of-Vendor-Security.pdf"] },
  counter:       { h: 48, why: "one negotiation turn, including the wait", src: ["https://www.vertice.one/explore/saas-contract-negotiation","https://www.vertice.one/insights/procurement-process-stage-completion-times","https://www.tropicapp.io/glossary/negotiating-saas-contracts","https://emailanalytics.com/email-productivity-benchmark-report/"] },
  offer:         { h: 48, why: "one negotiation turn, including the wait", src: ["https://www.vertice.one/explore/saas-contract-negotiation","https://www.vertice.one/insights/procurement-process-stage-completion-times","https://www.saastr.com/how-long-does-it-take-to-close-an-average-deal-in-saas-43-days-per-vendr","https://emailanalytics.com/email-productivity-benchmark-report/"] },
  block:         { h: 24, why: "out-of-policy terms go to the deal desk for an exception", src: ["https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/","https://handbook.gitlab.com/handbook/sales/field-operations/order-processing/","https://www.business.com/articles/how-deal-desks-are-shaking-up-sales-organizations/"] },
  redline:       { h: 168, why: "legal reviews the contract and sends red lines", src: ["https://www.vertice.one/insights/procurement-process-stage-completion-times","https://www.spotdraft.com/benchmarking-report-2025","https://www.legalontech.com/press-releases/2025-survey"] },
  eliminate:     { h: 24, why: "buyer rules the vendor out", est: true, src: ["https://www.acquisition.gov/far/15.503","https://technologymatch.com/blog/rfp-process-timeline-how-long-should-an-it-vendor-rfp-take"] },
  award:         { h: 168, why: "award decision", src: ["https://technologymatch.com/blog/rfp-process-timeline-how-long-should-an-it-vendor-rfp-take","https://www.longbeach.gov/globalassets/edo/talent--workforce/policies/procurement-of-equipment/rfp-process-flow-chart-2016"] },
  debrief:       { h: 72, why: "losing vendor is notified and debriefed", src: ["https://www.acquisition.gov/far/15.503","https://www.longbeach.gov/globalassets/edo/talent--workforce/policies/procurement-of-equipment/rfp-process-flow-chart-2016"] },
  escalate:      { h: 24, why: "approval request reaches the next approver", src: ["https://ciir-publications.cs.umass.edu/getpdf.php?id=1270","https://www.vertice.one/insights/procurement-process-stage-completion-times"] },
  approve:       { h: 115, why: "executive sign-off", src: ["https://www.vertice.one/insights/procurement-process-stage-completion-times","https://cdn.prod.website-files.com/606c216edbb61dfa4fa2655a/63c0e4c063fad43157bb4655_2023-B2B-Purchasing-Trends.pdf"] },
  signature:     { h: 24, why: "contract countersigned", src: ["https://www.docusign.com/en-gb/blog/achieve-faster-contract-turnaround-docusign-esignature","https://www.vertice.one/insights/procurement-process-stage-completion-times"] },
  fraud:         { h: 24, why: "bank-detail change verified by callback", src: ["https://www.stampli.com/resources/vendor-bank-change-callback-protocol/","https://monitorpay.ai/supplier-bank-account-change-fraud-how-to-spot-it-stop-it-and-recover-lost-payments/","https://trustpair.com/ach-account-verification/"] },
  po:            { h: 24, why: "purchase order issued", src: ["https://invoicedataextraction.com/blog/purchase-order-process","https://planergy.com/blog/improve-purchase-order-cycle-time/","https://www.procurify.com/blog/procurement-benchmark-report/","https://www.procurify.com/blog/2026-mid-market-procurement-benchmark-report/"] },
  invoice:       { h: 24, why: "vendor issues the invoice", est: true, src: ["https://invoicedataextraction.com/blog/purchase-order-process"] },
  payment:       { h: 221, why: "accounts payable processes and pays", src: ["https://www.datocms-assets.com/80283/1744404602-ardent-partners-ap-metrics-that-matter-in-2025-pagero-final.pdf","https://www.cfo.com/news/top-organizations-record-accounts-payable-cycle-time-in-28-days-metric-of/654984/","https://www.apqc.org/resources/benchmarking/open-standards-benchmarking/measures/cycle-time-days-receipt-invoice-until-0"] },
  provision:     { h: 240, why: "vendor provisions the workspace and holds kickoff", src: ["https://www.rocketlane.com/blogs/sales-to-customer-success-handoff","https://handbook.gitlab.com/handbook/sales/field-operations/order-processing/","https://handbook.gitlab.com/handbook/customer-success/csm/onboarding/"] },
  handoff:       { h: 2, why: "internal handoff of a document", est: true, src: ["https://ciir-publications.cs.umass.edu/getpdf.php?id=1270"] },
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
    if (e.agent === "acme.analyst" || e.to === "acme.analyst") return "research"; // the analyst works alongside the vendors
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
