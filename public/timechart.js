// Humans vs agents: time to close, updated live (Chart.js 4, log time axis).
// The human line is modeled live from the deal's own interactions (humanclock.js); the 134-day industry average is a reference tick.
import { humanClock, STAGE_NAMES } from "./humanclock.js";

export const STAGES = STAGE_NAMES;
export const DAY = 86400;
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const px = (n) => parseInt(css(n), 10) || 0;

export function fmtDuration(sec) {
  if (!isFinite(sec)) return "—";
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  if (sec < DAY) return `${(sec / 3600).toFixed(1)} h`;
  if (sec < 365 * DAY) { const d = Math.round(sec / DAY); return d === 1 ? "1 day" : `${d} days`; }
  return `${(sec / (365 * DAY)).toFixed(1)} years`;
}

if (window.Chart) { Chart.defaults.font.family = "Inter, system-ui, sans-serif"; Chart.defaults.animation = false; }

// ---------- the race plugin: current-stage band, gap bracket, end labels, live head ----------
function racePlugin(headEl, mode) {
  return {
    id: "race",
    beforeDatasetsDraw(chart) {
      const r = chart.$race; if (!r || mode !== "deal" || r.cur < 0) return;
      const a = chart.chartArea, w = (a.right - a.left) / STAGES.length, ctx = chart.ctx;
      ctx.save(); ctx.fillStyle = css("--chart-band"); ctx.fillRect(a.left + r.cur * w, a.top, w, a.bottom - a.top); ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const r = chart.$race; if (!r) return;
      const a = chart.chartArea, ctx = chart.ctx, x = chart.scales.x, y = chart.scales.y;
      ctx.save();
      // corner note
      ctx.font = "500 12px Inter, system-ui, sans-serif"; ctx.fillStyle = css("--text-3");
      if (mode === "deal") { ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("Humans modeled live from each interaction · log scale", a.right - 8, a.bottom - 4); ctx.textAlign = "left"; }
      else { ctx.textBaseline = "top"; ctx.fillText("Time to finish the same messages · log scales", a.left + 8, a.top + 4); }
      // gap bracket
      if (r.bracket) {
        const { xv, agent, human } = r.bracket;
        let bx = x.getPixelForValue(xv) + 14, left = false;
        if (bx + 150 > a.right) { bx -= 28; left = true; }
        const y1 = y.getPixelForValue(agent), y2 = y.getPixelForValue(human);
        ctx.strokeStyle = css("--text-2"); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(bx, y1); ctx.lineTo(bx, y2); ctx.moveTo(bx - 3, y1); ctx.lineTo(bx + 3, y1); ctx.moveTo(bx - 3, y2); ctx.lineTo(bx + 3, y2); ctx.stroke();
        const label = `${Math.round(r.speedup).toLocaleString("en-US")}× faster`;
        ctx.font = "700 14px Inter, system-ui, sans-serif";
        const tw = ctx.measureText(label).width, my = (y1 + y2) / 2, lx = left ? bx - 8 - tw - 12 : bx + 8;
        ctx.fillStyle = css("--chart-knockout"); roundRect(ctx, lx, my - 11, tw + 12, 22, 4); ctx.fill();
        ctx.fillStyle = css("--text"); ctx.textBaseline = "middle"; ctx.fillText(label, lx + 6, my);
      }
      // end labels in the right margin
      const ex = a.right + 12; ctx.textBaseline = "middle";
      const hy = y.getPixelForValue(r.humanEnd);
      ctx.fillStyle = css("--text-3");
      ctx.font = "600 12px Inter, system-ui, sans-serif"; ctx.fillText("Humans", ex, hy - 8);
      ctx.font = "500 12px JetBrains Mono, monospace"; ctx.fillText(r.humanLabel, ex, hy + 8);
      const ay = Math.min(a.bottom - 8, Math.max(y.getPixelForValue(r.agentLive), hy + 40));
      ctx.fillStyle = r.blocked ? css("--red") : r.closed ? css("--green-text") : css("--text");
      ctx.font = "600 12px Inter, system-ui, sans-serif"; ctx.fillText("Agents", ex, ay - 8);
      ctx.font = "500 12px JetBrains Mono, monospace"; ctx.fillText(r.agentLabel, ex, ay + 8);
      // growth markers (scale view)
      for (const m of r.markers || []) {
        const mx = x.getPixelForValue(m.x); if (mx < a.left || mx > a.right) continue;
        ctx.strokeStyle = css("--line-strong"); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(mx, a.top + 18); ctx.lineTo(mx, a.bottom); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = css("--text-3"); ctx.font = "500 12px JetBrains Mono, monospace"; ctx.textBaseline = "top"; ctx.fillText(m.label, mx + 4, a.top + 18);
      }
      ctx.restore();
      // live head
      if (headEl && r.head) headEl.style.transform = `translate(${x.getPixelForValue(r.head.x) - 6}px, ${y.getPixelForValue(r.head.y) - 6}px)`;
    },
  };
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

const Y_TICKS_DEAL = [[1, "1s"], [60, "1m"], [3600, "1h"], [DAY, "1d"], [134 * DAY, "134d"]];
const Y_TICKS_SCALE = [[1, "1s"], [60, "1m"], [3600, "1h"], [DAY, "1d"], [30 * DAY, "30d"], [365 * DAY, "1y"]];
function yScale(ticks, max) {
  return {
    type: "logarithmic", min: 1, max,
    afterBuildTicks: (axis) => { axis.ticks = ticks.map(([v]) => ({ value: v })); },
    afterFit: (s) => { s.width = px("--race-l"); },
    ticks: { font: { family: "JetBrains Mono", size: 12, weight: 500 }, padding: 8, callback: (v) => (ticks.find(([t]) => t === v) || [0, ""])[1] },
    border: { display: false },
  };
}
function colorize(chart) {
  const grid = css("--chart-grid"), t3 = css("--text-3");
  const [h, a] = chart.data.datasets;
  h.borderColor = css("--chart-human"); a.borderColor = css("--chart-agent"); a.pointBackgroundColor = css("--chart-agent");
  for (const k of ["x", "y"]) { const s = chart.options.scales[k]; if (s.grid) s.grid.color = grid; if (s.ticks) s.ticks.color = t3; }
}

// ---------- live deal: x = stages ----------
export function createDealChart(canvas, headEl) {
  const chart = new Chart(canvas, {
    type: "line",
    data: { labels: STAGES, datasets: [
      { label: "Humans", data: [], borderWidth: 2.5, borderDash: [6, 5], pointRadius: 0, tension: 0 },
      { label: "Agents", data: [], borderWidth: 3, tension: 0, pointRadius: (c) => (c.dataIndex === c.dataset.data.length - 1 ? 0 : 3.5) },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, events: [],
      layout: { padding: () => ({ top: 12, right: px("--race-r"), bottom: 0, left: 0 }) },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { type: "category", offset: true, grid: { offset: true, lineWidth: 1, drawTicks: false }, ticks: { display: false }, border: { display: false } },
        y: yScale(Y_TICKS_DEAL, 200 * DAY),
      },
    },
    plugins: [racePlugin(headEl, "deal")],
  });
  colorize(chart);
  let lastSpeedup = null, lastId = null;
  return {
    chart,
    update(state, blocked) {
      if (!state) { chart.data.datasets[0].data = []; chart.data.datasets[1].data = []; chart.$race = { cur: -1, humanEnd: 1, humanLabel: "—", agentLive: 1, agentLabel: "—" }; chart.update("none"); return null; }
      if (state.id !== lastId) { lastId = state.id; lastSpeedup = null; }
      const stageTimes = {};
      for (const e of state.events) if (e.kind === "stage") { const n = e.text.replace(/^Stage \d+: /, ""); if (!(n in stageTimes)) stageTimes[n] = e.t; }
      // A deal can end early (walked, stopped, error): only plot stages that actually started
      const closed = !!state.done && (state.outcome ? state.outcome === "closed" : !!state.winner && !!state.finishedAt);
      const end = state.finishedAt || (state.done ? state.events.at(-1)?.t : 0) || Date.now();
      const starts = STAGES.map((s) => stageTimes[s]), last = starts.reduce((m, t, i) => (t ? i : m), -1), agent = [];
      for (let i = 0; i <= last; i++) {
        const next = starts.slice(i + 1).find(Boolean) ?? stageTimes["Closed"] ?? end;
        agent.push(Math.max(1, (next - state.startedAt) / 1000));
      }
      const cur = agent.length - 1, done = state.done ? cur : cur - 1;
      const agentSec = Math.max(1, (end - state.startedAt) / 1000);
      const hc = humanClock(state), human = hc.cum.slice(0, agent.length).map((x) => Math.max(1, x));
      let speedup = null;
      if (closed) speedup = Math.round(hc.total / agentSec);
      else if (!state.done && done >= 1) speedup = Math.round(hc.cum[done] / agent[done]);
      if (speedup) lastSpeedup = speedup;
      if (state.done && !closed) lastSpeedup = null; // no deal, no speedup claim
      chart.data.datasets[0].data = human;
      chart.data.datasets[1].data = agent;
      chart.$race = {
        cur: state.done ? -1 : cur, closed, blocked, speedup: lastSpeedup,
        bracket: done >= 1 && lastSpeedup ? { xv: done, agent: agent[done], human: hc.cum[done] } : null,
        humanEnd: human[cur] || 1, humanLabel: fmtDuration(hc.total), agentLive: agent[cur] || 1, agentLabel: fmtDuration(agentSec),
        head: cur >= 0 ? { x: cur, y: agent[cur] } : null,
      };
      chart.update("none");
      return { agentSec, humanSec: hc.total, humanDoneDays: hc.total / DAY, counted: hc.counted, speedup: lastSpeedup, cur, done, closed };
    },
    recolor() { colorize(chart); chart.update("none"); },
  };
}

// ---------- scale view: x = messages; same headcount for humans and agents ----------
export function createScaleChart(canvas, headEl, { agentSecPerMsg = 1.5, humanSecPerMsg = DAY } = {}) {
  const X_TICKS = [[10, "10"], [100, "100"], [1000, "1K"], [10000, "10K"], [100000, "100K"], [1000000, "1M"]];
  const chart = new Chart(canvas, {
    type: "line",
    data: { datasets: [
      { label: "Humans", data: [], borderWidth: 2.5, borderDash: [6, 5], pointRadius: 0, tension: 0 },
      { label: "Agents", data: [], borderWidth: 3, pointRadius: 0, tension: 0 },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, events: [], parsing: false,
      layout: { padding: () => ({ top: 12, right: px("--race-r"), bottom: 0, left: 0 }) },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { type: "logarithmic", min: 10, max: 1e6, grid: { drawTicks: false }, border: { display: false },
          afterBuildTicks: (axis) => { axis.ticks = X_TICKS.map(([v]) => ({ value: v })); },
          ticks: { font: { family: "JetBrains Mono", size: 12, weight: 500 }, callback: (v) => (X_TICKS.find(([t]) => t === v) || [0, ""])[1] } },
        y: yScale(Y_TICKS_SCALE, 3 * 365 * DAY),
      },
    },
    plugins: [racePlugin(headEl, "scale")],
  });
  colorize(chart);
  let last = 0; const markers = [];
  return {
    chart,
    marker(messages, label) { markers.push({ x: Math.max(10, messages), label }); },
    update(messages, agents) {
      const m = Math.max(10, messages), rounds = Math.max(1, Math.ceil(m / Math.max(1, agents)));
      const human = rounds * humanSecPerMsg, agent = rounds * agentSecPerMsg;
      const [h, a] = chart.data.datasets;
      if (m - last >= Math.max(1, last * 0.02) || !h.data.length) { h.data.push({ x: m, y: human }); a.data.push({ x: m, y: agent }); last = m; }
      else { h.data[h.data.length - 1] = { x: m, y: human }; a.data[a.data.length - 1] = { x: m, y: agent }; }
      chart.$race = { markers, speedup: human / agent, bracket: { xv: m, agent, human }, humanEnd: human, humanLabel: fmtDuration(human), agentLive: agent, agentLabel: fmtDuration(agent), head: { x: m, y: agent } };
      chart.update("none");
      return { agentSec: agent, humanSec: human, speedup: human / agent };
    },
    recolor() { colorize(chart); chart.update("none"); },
  };
}
