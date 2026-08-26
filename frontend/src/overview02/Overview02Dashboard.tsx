import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import "./overview02.css";

type Filters = { min_date: string | null; max_date: string | null; factories: string[] };
type DailyFactory = { produce_date: string; factory: string; eff_pct: number };
type Product = { gmt_type: string; eff_pct: number; pph: number | null };
type Customer = { brand_name: string; eff_pct: number; pph?: number | null };
type DashboardData = {
  daily_factory: DailyFactory[];
  vvic_product: Product[];
  vvic_customer: Customer[];
  non_vvic_customer: Customer[];
  last_refresh: string;
};

const FACTORY_ORDER = ["G1", "G2", "G3", "G4", "TRM", "EA"];
const COLORS: Record<string, string> = {
  G1: "#f04486",
  G2: "#ffd126",
  G3: "#ff7917",
  G4: "#15b7c6",
  TRM: "#2889dc",
  EA: "#54df0b",
};
const TARGET = 0.60;

const pct = (v: unknown, d = 1) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${(n * 100).toFixed(d)}%` : "-";
};
const thaiRefresh = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

async function getJSON<T>(path: string, startDate?: string, endDate?: string, factory?: string): Promise<T> {
  const qs = new URLSearchParams();
  if (startDate) qs.set("start_date", startDate);
  if (endDate) qs.set("end_date", endDate);
  if (factory && factory !== "ALL") qs.set("factory", factory);
  const res = await fetch(`${path}${qs.size ? `?${qs.toString()}` : ""}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function Overview02Dashboard() {
  const [filters, setFilters] = useState<Filters>({ min_date: null, max_date: null, factories: [] });
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-12-31");
  const [factory, setFactory] = useState("ALL");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getJSON<Filters>("/api/overview02/filters")
      .then(setFilters)
      .catch((e) => setError(`Unable to load filters: ${e.message}`));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getJSON<DashboardData>("/api/overview02/dashboard", startDate, endDate, factory)
      .then((x) => active && setData(x))
      .catch((e) => active && setError(`Unable to load Overview02: ${e.message}`))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [startDate, endDate, factory]);

  const factories = useMemo(() => {
    const f = filters.factories.length ? filters.factories : FACTORY_ORDER;
    return [...f].sort((a, b) => {
      const ai = FACTORY_ORDER.indexOf(a), bi = FACTORY_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
    });
  }, [filters.factories]);

  const ribbonOption = useMemo(() => {
    const rows = data?.daily_factory ?? [];
    const dates = Array.from(new Set(rows.map((x) => x.produce_date))).sort();
    const visibleDates = dates.slice(Math.max(0, dates.length - 16));
    const facs = FACTORY_ORDER.filter((f) => rows.some((x) => x.factory === f));
    const ranks = new Map<string, Map<string, { rank: number; eff: number }>>();
    visibleDates.forEach((d) => {
      const day = rows.filter((x) => x.produce_date === d).sort((a, b) => Number(b.eff_pct) - Number(a.eff_pct));
      const m = new Map<string, { rank: number; eff: number }>();
      day.forEach((x, i) => m.set(x.factory, { rank: day.length - i, eff: Number(x.eff_pct) }));
      ranks.set(d, m);
    });
    return {
      animationDuration: 600,
      color: facs.map((f) => COLORS[f]),
      legend: { top: 0, data: facs, icon: "roundRect", itemWidth: 12, itemHeight: 8 },
      grid: { left: 26, right: 18, top: 42, bottom: 38 },
      tooltip: { trigger: "item", formatter: (p: any) => `${p.seriesName}<br/>${p.data?.date ?? ""}<br/>EFF%: ${pct(p.data?.eff)}` },
      xAxis: {
        type: "category",
        data: visibleDates,
        boundaryGap: false,
        axisTick: { show: false },
        axisLabel: { fontSize: 10, formatter: (v: string) => { const [y, m, d] = v.split("-"); return `${d}/${m}/${y.slice(2)}`; } },
      },
      yAxis: { type: "value", min: 0.5, max: Math.max(1.5, facs.length + 0.5), show: false },
      series: facs.map((f) => ({
        name: f,
        type: "line",
        smooth: 0.42,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { width: 22, opacity: 0.78, cap: "round", join: "round" },
        emphasis: { focus: "series", lineStyle: { opacity: 0.98 } },
        data: visibleDates.map((d) => {
          const x = ranks.get(d)?.get(f);
          return x ? {
            value: x.rank,
            eff: x.eff,
            date: d,
            label: { show: true, formatter: pct(x.eff), position: "inside", color: "#111827", fontSize: 9, fontWeight: 700 },
          } : null;
        }),
      })),
    };
  }, [data]);

  const barOption = (rows: Array<{ name: string; eff: number; pph?: number | null }>, withPph: boolean, scroll = false) => ({
    animationDuration: 450,
    grid: { left: 54, right: 28, top: 35, bottom: scroll ? 72 : 62 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (items: any[]) => {
        const p = items[0];
        const r = rows[p.dataIndex];
        return `<b>${r?.name ?? ""}</b><br/>MTD EFF%: ${pct(r?.eff, 2)}${withPph && r?.pph != null ? `<br/>PPH: ${Number(r.pph).toFixed(2)}` : ""}`;
      },
    },
    xAxis: {
      type: "category",
      data: rows.map((x) => x.name),
      axisLabel: { interval: 0, rotate: rows.length > 8 ? 48 : 38, fontSize: 10, width: 80, overflow: "truncate" },
      axisTick: { show: false },
    },
    yAxis: { type: "value", min: 0, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: "#dce6f1", type: "dashed" } } },
    dataZoom: scroll && rows.length > 12 ? [{ type: "inside", startValue: 0, endValue: 11 }, { type: "slider", height: 11, bottom: 5, showDetail: false }] : [],
    series: [{
      type: "bar",
      barMaxWidth: 48,
      data: rows.map((x) => ({ value: x.eff, itemStyle: { color: x.eff >= TARGET ? "#22b957" : "#ef5560", borderRadius: [4, 4, 0, 0] } })),
      label: {
        show: true,
        position: "top",
        formatter: (p: any) => {
          const r = rows[p.dataIndex];
          const eff = pct(r?.eff, 2);
          return withPph && r?.pph != null ? `{eff|${eff}}\n{pph|${Number(r.pph).toFixed(2)}}` : `{eff|${eff}}`;
        },
        rich: { eff: { color: "#667085", fontSize: 10 }, pph: { color: "#0aa6a6", fontSize: 11, fontWeight: 700, lineHeight: 15 } },
      },
      markLine: { silent: true, symbol: "none", lineStyle: { color: "#6686cf", type: "dashed", width: 2 }, label: { formatter: "Target 60%", position: "insideEndTop", color: "#3561b6" }, data: [{ yAxis: TARGET }] },
    }],
  });

  const productRows = (data?.vvic_product ?? []).map((x) => ({ name: x.gmt_type, eff: Number(x.eff_pct), pph: x.pph == null ? null : Number(x.pph) }));
  const vvicRows = (data?.vvic_customer ?? []).map((x) => ({ name: x.brand_name, eff: Number(x.eff_pct), pph: x.pph == null ? null : Number(x.pph) }));
  const nonRows = (data?.non_vvic_customer ?? []).map((x) => ({ name: x.brand_name, eff: Number(x.eff_pct) }));

  return (
    <div className="ov02-page">
      <div className="ov02-header">
        <h1>OVERVIEW02</h1>
        <label><span>START DATE</span><input type="date" value={startDate} min={filters.min_date || undefined} max={endDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label><span>END DATE</span><input type="date" value={endDate} min={startDate} max={filters.max_date || undefined} onChange={(e) => setEndDate(e.target.value)} /></label>
        <div className="ov02-factories">{["ALL", ...factories].map((f) => <button key={f} className={factory === f ? "active" : ""} onClick={() => setFactory(f)}>{f}</button>)}</div>
        <div className="ov02-refresh">REFRESH: {thaiRefresh(data?.last_refresh)}</div>
      </div>

      {error && <div className="ov02-error">{error}</div>}
      <div className={loading ? "ov02-grid loading" : "ov02-grid"}>
        <section className="ov02-card"><h2>Daily EFF% by FACTORY</h2><ReactECharts option={ribbonOption} notMerge style={{ height: 295 }} /></section>
        <section className="ov02-card"><h2>MTD Eff% &amp; PPH by VVIC Product Type</h2><ReactECharts option={barOption(productRows, true)} notMerge style={{ height: 295 }} /></section>
        <section className="ov02-card"><h2>MTD Eff% &amp; PPH by VVIC Customer</h2><ReactECharts option={barOption(vvicRows, true, true)} notMerge style={{ height: 295 }} /></section>
        <section className="ov02-card"><h2>MTD Eff% by Non-VVIC Customer</h2><ReactECharts option={barOption(nonRows, false, true)} notMerge style={{ height: 295 }} /></section>
      </div>
    </div>
  );
}
