// Humans vs agents: time to close, updated live. Chart.js on a log time axis.
// Human benchmark: the 134-day median B2B SaaS sales cycle (2026 benchmarks), split across our stages.
// Security review gets 28 days, the midpoint of the published 2-6 week range. The split is illustrative; the total is sourced.

export const HUMAN_DAYS = {
  "Intake": 5, "Proposals": 18, "Security review": 28, "Negotiation": 18, "Legal review": 25,
  "Award": 7, "Approvals": 10, "Onboarding & PO": 8, "Invoice & payment": 10, "Provisioning": 5,
};
const DAY = 86400;
const STAGES = Object.keys(HUMAN_DAYS);

export function fmtDuration(sec) {
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${String(Math.round(sec % 60)).padStart(2, "0")}s`;
  if (sec < DAY) return `${(sec / 3600).toFixed(1)} h`;
  return `${Math.round(sec / DAY)} days`;
}
export function fmtX(x) {
  if (!isFinite(x) || x <= 1) return "—";
  if (x >= 1e6) return `${(x / 1e6).toFixed(1)}M×`;
  if (x >= 1e3) return `${Math.round(x / 1e3)}K×`;
  return `${Math.round(x)}×`;
}
const TICKS = [[1, "1s"], [60, "1m"], [3600, "1h"], [DAY, "1d"], [7 * DAY, "1w"], [30 * DAY, "30d"], [134 * DAY, "134d"]];

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Live deal: x = stages, human line is the cumulative benchmark, agent line is the real elapsed time per stage.
export function createDealChart(canvas) {
  const cumHuman = []; let acc = 0;
  for (const s of STAGES) { acc += HUMAN_DAYS[s] * DAY; cumHuman.push(acc); }
  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: STAGES,
      datasets: [
        { label: "Humans (134-day median)", data: cumHuman, borderDash: [6, 5], borderWidth: 2, pointRadius: 0, tension: 0.25 },
        { label: "Deal Room agents (live)", data: [], borderWidth: 3, pointRadius: 3, tension: 0.25 },
      ],
    },
    options: baseOptions(),
  });
  applyColors(chart);
  return {
    chart,
    // state: live deal state from the API
    update(state) {
      if (!state) return null;
      const stageTimes = {};
      for (const e of state.events) if (e.kind === "stage") { const name = e.text.replace(/^Stage \d+: /, ""); if (!(name in stageTimes)) stageTimes[name] = e.t; }
      const end = state.finishedAt || Date.now();
      const agent = [];
      STAGES.forEach((s, i) => {
        const next = STAGES[i + 1];
        const startNext = next ? stageTimes[next] : stageTimes["Closed"];
        if (startNext) agent.push(Math.max(1, (startNext - state.startedAt) / 1000));
        else if (stageTimes[s]) agent.push(Math.max(1, (end - state.startedAt) / 1000));
      });
      chart.data.datasets[1].data = agent;
      chart.update("none");
      const idx = Math.max(0, agent.length - 1);
      const agentSec = Math.max(1, (end - state.startedAt) / 1000);
      const humanSec = cumHuman[idx] ?? cumHuman[cumHuman.length - 1];
      return { agentSec, humanSec, speedup: humanSec / agentSec, stageIdx: idx };
    },
    recolor() { applyColors(chart); chart.update("none"); },
  };
}

// Scale view: x = messages exchanged; humans answer each message in one business day, agents in their measured latency,
// both with the same headcount working in parallel.
export function createScaleChart(canvas, { agentSecPerMsg = 1.5, humanSecPerMsg = DAY } = {}) {
  const chart = new Chart(canvas, {
    type: "line",
    data: { labels: [], datasets: [
      { label: "Humans (1 business day per reply)", data: [], borderDash: [6, 5], borderWidth: 2, pointRadius: 0, tension: 0.2 },
      { label: "Agents (≈1.5 s per reply, measured)", data: [], borderWidth: 3, pointRadius: 0, tension: 0.2 },
    ] },
    options: { ...baseOptions(), scales: { ...baseOptions().scales, x: { ...baseOptions().scales.x, type: "linear", title: { display: true, text: "messages exchanged" }, ticks: { maxTicksLimit: 6, callback: (v) => Number(v).toLocaleString() } } } },
  });
  applyColors(chart);
  let last = 0;
  return {
    chart,
    update(messages, agents) {
      const rounds = Math.max(1, Math.ceil(messages / Math.max(1, agents)));
      const human = rounds * humanSecPerMsg, agent = rounds * agentSecPerMsg;
      if (messages - last >= Math.max(10, messages * 0.02) || chart.data.labels.length === 0) {
        chart.data.labels.push(messages);
        chart.data.datasets[0].data.push({ x: messages, y: human });
        chart.data.datasets[1].data.push({ x: messages, y: agent });
        if (chart.data.labels.length > 120) { chart.data.labels.shift(); chart.data.datasets.forEach((d) => d.data.shift()); }
        last = messages;
        chart.update("none");
      }
      return { agentSec: agent, humanSec: human, speedup: human / agent };
    },
    reset() { last = 0; chart.data.labels = []; chart.data.datasets.forEach((d) => (d.data = [])); chart.update("none"); },
    recolor() { applyColors(chart); chart.update("none"); },
  };
}

function baseOptions() {
  return {
    responsive: true, maintainAspectRatio: false, animation: false, parsing: true,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: true, position: "bottom", labels: { boxWidth: 18, boxHeight: 2, usePointStyle: false, font: { size: 11 } } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtDuration(ctx.parsed.y)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
      y: {
        type: "logarithmic", min: 1, max: 200 * DAY,
        grid: { drawTicks: false },
        afterBuildTicks: (axis) => { axis.ticks = TICKS.map(([v]) => ({ value: v })); },
        ticks: { font: { size: 10 }, callback: (v) => (TICKS.find(([t]) => t === v) || [0, ""])[1] },
      },
    },
  };
}

function applyColors(chart) {
  const text = cssVar("--text", "#f2f2f2"), muted = cssVar("--muted", "#8a8a8a"), line = cssVar("--line", "#1f1f1f");
  chart.data.datasets[0].borderColor = muted;
  chart.data.datasets[1].borderColor = text;
  chart.data.datasets[1].pointBackgroundColor = text;
  const o = chart.options;
  o.plugins.legend.labels.color = muted;
  for (const k of ["x", "y"]) { o.scales[k].ticks.color = muted; o.scales[k].grid.color = line; if (o.scales[k].title) o.scales[k].title.color = muted; }
}
