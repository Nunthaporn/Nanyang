import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import "./overview.css";

type Filters = { min_date: string | null; max_date: string | null; factories: string[] };
type PeriodRow = { period: "YTD" | "QTD" | "MTD" | "LD"; factory: string; eff_pct: number };
type MonthRow = { month: string; eff_pct: number };
type DayRow = { produce_date: string; eff_pct: number };
type FactoryMonthRow = { month: string; factory: string; eff_pct: number };
type Payload = {
  kpis: Partial<Record<"YTD" | "QTD" | "MTD" | "LD", number>>;
  factory_periods: PeriodRow[];
  monthly: MonthRow[];
  last30: DayRow[];
  factory_monthly: FactoryMonthRow[];
  latest_date: string | null;
  last_refresh: string;
};

const FACTORY_ORDER = ["G1", "G2", "G3", "G4", "TRM", "EA"];
const COLORS: Record<string, string> = { G1: "#f04486", G2: "#ffd126", G3: "#ff7917", G4: "#15b7c6", TRM: "#2889dc", EA: "#54df0b" };
const PERIODS: Array<"YTD" | "QTD" | "MTD" | "LD"> = ["YTD", "QTD", "MTD", "LD"];

const pct = (v: unknown, digits = 2) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${(n * 100).toFixed(digits)}%` : "-";
};
const thaiRefresh = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};
async function getJSON<T>(path: string, params?: Record<string, string>) {
  const q = new URLSearchParams(params || {});
  const res = await fetch(`${path}${q.size ? `?${q}` : ""}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}
function KpiCard({ label, value }: { label: string; value: string }) {
  return <div className="ov-kpi"><span>{label}</span><b>{value}</b></div>;
}

export default function OverviewDashboard() {
  const [filters, setFilters] = useState<Filters>({ min_date: null, max_date: null, factories: [] });
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-12-31");
  const [factory, setFactory] = useState("ALL");
  const [crossFactory, setCrossFactory] = useState<string | null>(null);
  const [crossStart, setCrossStart] = useState<string | null>(null);
  const [crossEnd, setCrossEnd] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const clearCross = () => { setCrossFactory(null); setCrossStart(null); setCrossEnd(null); };
  const effectiveStart = crossStart || startDate;
  const effectiveEnd = crossEnd || endDate;
  const effectiveFactory = crossFactory || factory;

  useEffect(() => {
    getJSON<Filters>("/api/overview/filters").then(setFilters).catch((e) => setError(`Unable to load Overview filters: ${e.message}`));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const params: Record<string, string> = { start_date: effectiveStart, end_date: effectiveEnd };
    if (effectiveFactory !== "ALL") params.factory = effectiveFactory;
    getJSON<Payload>("/api/overview/dashboard", params)
      .then((r) => active && setData(r))
      .catch((e) => active && setError(`Unable to load Overview: ${e.message}`))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [effectiveStart, effectiveEnd, effectiveFactory]);

  const factories = useMemo(() => {
    const values = filters.factories.length ? filters.factories : FACTORY_ORDER;
    return [...values].sort((a, b) => {
      const ai = FACTORY_ORDER.indexOf(a), bi = FACTORY_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
    });
  }, [filters.factories]);

  const periodRows = useMemo(() => {
    const src = data?.factory_periods || [];
    const out: Record<string, PeriodRow[]> = {};
    PERIODS.forEach((p) => { out[p] = src.filter((x) => x.period === p).sort((a, b) => Number(b.eff_pct) - Number(a.eff_pct)); });
    return out;
  }, [data]);

  const monthlyRows = data?.monthly || [];
  const monthlyOption = useMemo(() => ({
    animationDuration: 350,
    grid: { left: 48, right: 24, top: 34, bottom: 42 },
    tooltip: { trigger: "axis", valueFormatter: (v: number) => `${(v * 100).toFixed(1)}%` },
    xAxis: { type: "category", boundaryGap: false, data: monthlyRows.map((x) => x.month), axisTick: { show: false }, axisLabel: { formatter: (v: string) => { const [y, m] = v.split("-"); return `${m}/${y.slice(2)}`; } } },
    yAxis: { type: "value", min: (value: any) => Math.max(0, value.min - 0.05), max: (value: any) => value.max + 0.05, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: "#dbe5f0", type: "dashed" } } },
    series: [{ type: "line", smooth: 0.35, symbolSize: 7, lineStyle: { width: 3, color: "#2864d7" }, itemStyle: { color: "#15b7c6" }, data: monthlyRows.map((x) => Number(x.eff_pct)), label: { show: true, position: "top", formatter: (p: any) => `${(Number(p.value) * 100).toFixed(0)}%`, fontSize: 10, color: "#536173" } }],
  }), [monthlyRows]);

  const last30Rows = data?.last30 || [];
  const last30Option = useMemo(() => ({
    animationDuration: 350,
    grid: { left: 48, right: 24, top: 30, bottom: 48 },
    tooltip: { trigger: "axis", valueFormatter: (v: number) => `${(v * 100).toFixed(1)}%` },
    xAxis: { type: "category", boundaryGap: false, data: last30Rows.map((x) => x.produce_date), axisTick: { show: false }, axisLabel: { interval: Math.max(0, Math.ceil(last30Rows.length / 6) - 1), formatter: (v: string) => { const [, m, d] = v.split("-"); return `${d}/${m}`; } } },
    yAxis: { type: "value", axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: "#dbe5f0", type: "dashed" } } },
    series: [{ type: "line", smooth: 0.28, symbolSize: 6, lineStyle: { width: 3, color: "#2864d7" }, itemStyle: { color: "#15b7c6" }, data: last30Rows.map((x) => Number(x.eff_pct)), label: { show: last30Rows.length <= 18, position: "top", formatter: (p: any) => `${(Number(p.value) * 100).toFixed(0)}%`, fontSize: 9 } }],
  }), [last30Rows]);

  const ribbonOption = useMemo(() => {
    const source = data?.factory_monthly || [];
    const months = Array.from(new Set(source.map((x) => x.month))).sort();
    const facs = Array.from(new Set(source.map((x) => x.factory))).sort((a, b) => {
      const ai = FACTORY_ORDER.indexOf(a), bi = FACTORY_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
    });
    const ranks = new Map<string, Map<string, { rank: number; eff: number }>>();
    months.forEach((month) => {
      const rows = source.filter((x) => x.month === month).sort((a, b) => Number(b.eff_pct) - Number(a.eff_pct));
      const map = new Map<string, { rank: number; eff: number }>();
      rows.forEach((x, i) => map.set(x.factory, { rank: rows.length - i, eff: Number(x.eff_pct) })); ranks.set(month, map);
    });
    return {
      animationDuration: 450,
      legend: { top: 0, data: facs, icon: "roundRect", itemWidth: 12, itemHeight: 8 },
      grid: { left: 24, right: 24, top: 42, bottom: 36 },
      tooltip: { trigger: "item", formatter: (p: any) => `${p.seriesName}<br/>${p.data.month}<br/>EFF%: ${(p.data.eff * 100).toFixed(1)}%` },
      xAxis: { type: "category", boundaryGap: false, data: months, axisTick: { show: false }, axisLabel: { formatter: (v: string) => { const [y, m] = v.split("-"); return `${m}/${y.slice(2)}`; } } },
      yAxis: { type: "value", min: 0.5, max: Math.max(1.5, facs.length + 0.5), show: false },
      series: facs.map((fac) => ({ name: fac, type: "line", smooth: 0.42, symbol: "none", lineStyle: { width: 22, opacity: crossFactory && crossFactory !== fac ? 0.18 : 0.78, color: COLORS[fac] || "#64748b", cap: "round", join: "round" }, itemStyle: { color: COLORS[fac] || "#64748b" }, emphasis: { focus: "series", lineStyle: { opacity: 0.98 } }, data: months.map((month) => { const r = ranks.get(month)?.get(fac); return r ? { value: r.rank, eff: r.eff, month, label: { show: true, position: "inside", formatter: `${(r.eff * 100).toFixed(1)}%`, color: "#111827", fontSize: 9, fontWeight: 700 } } : null; }) })),
    };
  }, [data, crossFactory]);

  const selectMonth = (index: number) => {
    const row = monthlyRows[index]; if (!row) return;
    const [y, m] = row.month.split("-").map(Number);
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const last = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const s = first < startDate ? startDate : first; const e = last > endDate ? endDate : last;
    if (crossStart === s && crossEnd === e) { setCrossStart(null); setCrossEnd(null); } else { setCrossStart(s); setCrossEnd(e); }
  };
  const selectDay = (index: number) => {
    const d = last30Rows[index]?.produce_date; if (!d) return;
    if (crossStart === d && crossEnd === d) { setCrossStart(null); setCrossEnd(null); } else { setCrossStart(d); setCrossEnd(d); }
  };
  const toggleFactory = (f: string) => setCrossFactory((v) => v === f ? null : f);
  const hasCross = !!(crossFactory || crossStart || crossEnd);

  return (
    <div className="ov-page">
      <section className="ov-header">
        <h1>OVERVIEW</h1>
        <label><span>START DATE</span><input type="date" value={startDate} min={filters.min_date || undefined} max={endDate} onChange={(e) => { setStartDate(e.target.value); clearCross(); }} /></label>
        <label><span>END DATE</span><input type="date" value={endDate} min={startDate} max={filters.max_date || undefined} onChange={(e) => { setEndDate(e.target.value); clearCross(); }} /></label>
        <div className="ov-factories">{["ALL", ...factories].map((f) => <button key={f} className={factory === f ? "active" : ""} onClick={() => { setFactory(f); clearCross(); }}>{f}</button>)}</div>
        <div className="ov-refresh">REFRESH: {thaiRefresh(data?.last_refresh)}{hasCross ? <button onClick={clearCross} style={{ marginLeft: 10 }}>CLEAR FILTER</button> : null}</div>
      </section>
      {error && <div className="ov-error">{error}</div>}
      <main className={loading ? "ov-body loading" : "ov-body"}>
        <section className="ov-kpis"><KpiCard label="YTD EFF%" value={pct(data?.kpis?.YTD)} /><KpiCard label="QTD EFF%" value={pct(data?.kpis?.QTD)} /><KpiCard label="MTD EFF%" value={pct(data?.kpis?.MTD)} /><KpiCard label="LD EFF%" value={pct(data?.kpis?.LD)} /></section>
        <section className="ov-grid">
          <article className="ov-card ov-period-card"><div className="ov-section-title">EFF% by FACTORY — YTD / QTD / MTD / LD</div><div className="ov-period-table">{PERIODS.map((period) => <div className="ov-period-row" key={period}><strong>{period}</strong><div className="ov-period-cells">{(periodRows[period] || []).map((row) => <button className="ov-period-cell" key={`${period}-${row.factory}`} onClick={() => toggleFactory(row.factory)} style={{ background: COLORS[row.factory] || "#dbe5f0", opacity: crossFactory && crossFactory !== row.factory ? .25 : 1 }}><span>{row.factory}</span><b>{pct(row.eff_pct, 2)}</b></button>)}</div></div>)}</div></article>
          <article className="ov-card"><div className="ov-section-title">Overall monthly EFF% trend</div><ReactECharts option={monthlyOption} style={{ height: 265 }} notMerge onEvents={{ click: (p: any) => selectMonth(p.dataIndex) }} /></article>
          <article className="ov-card"><div className="ov-section-title">Overall last 30Days EFF%</div><ReactECharts option={last30Option} style={{ height: 265 }} notMerge onEvents={{ click: (p: any) => selectDay(p.dataIndex) }} /></article>
          <article className="ov-card"><div className="ov-section-title">Monthly EFF% by FACTORY</div><ReactECharts option={ribbonOption} style={{ height: 265 }} notMerge onEvents={{ click: (p: any) => p.seriesName && toggleFactory(p.seriesName) }} /></article>
        </section>
      </main>
    </div>
  );
}
