import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import "./overview02.css";

type Filters = { min_date: string | null; max_date: string | null; factories: string[] };
type DailyFactory = { produce_date: string; factory: string; eff_pct: number };
type Product = { gmt_type: string; eff_pct: number; pph: number | null };
type Customer = { brand_name: string; eff_pct: number; min_produce?: number | null; pph?: number | null };
type DashboardData = {
  daily_factory: DailyFactory[];
  vvic_product: Product[];
  vvic_customer: Customer[];
  non_vvic_customer: Customer[];
  last_refresh: string;
};

const FACTORY_ORDER = ["G1", "G2", "G3", "G4", "TRM", "EA"];
const COLORS: Record<string, string> = { G1: "#f04486", G2: "#ffd126", G3: "#ff7917", G4: "#15b7c6", TRM: "#2889dc", EA: "#54df0b" };
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
const yearStartFor = (value: string, minDate?: string | null) => {
  const yearStart = `${value.slice(0, 4)}-01-01`;
  return minDate && minDate > yearStart ? minDate : yearStart;
};

const bindHorizontalTrackpadPan = (chart: any, itemCount: number, visibleCount: number) => {
  const dom = chart?.getDom?.();
  if (!dom || itemCount <= visibleCount) return;
  const previous = (dom as any).__horizontalTrackpadPan;
  if (previous) dom.removeEventListener("wheel", previous);

  const handler = (event: WheelEvent) => {
    if (Math.abs(event.deltaX) < 1 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();

    const zoom = chart.getOption()?.dataZoom?.[0] ?? {};
    const currentStart = Number(zoom.startValue ?? 0);
    const maxStart = Math.max(0, itemCount - visibleCount);
    const step = Math.max(1, Math.min(3, Math.round(Math.abs(event.deltaX) / 45)));
    const nextStart = Math.max(0, Math.min(maxStart, currentStart + (event.deltaX > 0 ? step : -step)));
    if (nextStart === currentStart) return;

    chart.dispatchAction({
      type: "dataZoom",
      dataZoomIndex: 0,
      startValue: nextStart,
      endValue: nextStart + visibleCount - 1,
    });
  };

  dom.addEventListener("wheel", handler, { passive: false });
  (dom as any).__horizontalTrackpadPan = handler;
};

async function getJSON<T>(path: string, startDate?: string, endDate?: string, factory?: string, gmtType?: string | null, brandName?: string | null): Promise<T> {
  const qs = new URLSearchParams();
  if (startDate) qs.set("start_date", startDate);
  if (endDate) qs.set("end_date", endDate);
  if (factory && factory !== "ALL") qs.set("factory", factory);
  if (gmtType) qs.set("gmt_type", gmtType);
  if (brandName) qs.set("brand_name", brandName);
  const res = await fetch(`${path}${qs.size ? `?${qs.toString()}` : ""}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function Overview02Dashboard() {
  const [filters, setFilters] = useState<Filters>({ min_date: null, max_date: null, factories: [] });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filtersReady, setFiltersReady] = useState(false);
  const [factory, setFactory] = useState("ALL");
  const [crossFactory, setCrossFactory] = useState<string | null>(null);
  const [crossGmtType, setCrossGmtType] = useState<string | null>(null);
  const [crossBrand, setCrossBrand] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getJSON<Filters>("/api/overview02/filters")
      .then((nextFilters) => {
        setFilters(nextFilters);
        const defaultEnd = nextFilters.max_date || new Date().toISOString().slice(0, 10);
        setEndDate(defaultEnd);
        setStartDate(yearStartFor(defaultEnd, nextFilters.min_date));
        setFiltersReady(true);
      })
      .catch((e) => setError(`Unable to load filters: ${e.message}`));
  }, []);

  const effectiveFactory = crossFactory || factory;

  useEffect(() => {
    if (!filtersReady || !startDate || !endDate) return;
    let active = true;
    setLoading(true);
    setError("");
    getJSON<DashboardData>("/api/overview02/dashboard", startDate, endDate, effectiveFactory, crossGmtType, crossBrand)
      .then((x) => active && setData(x))
      .catch((e) => active && setError(`Unable to load Overview02: ${e.message}`))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [startDate, endDate, effectiveFactory, crossGmtType, crossBrand]);

  const clearCross = () => { setCrossFactory(null); setCrossGmtType(null); setCrossBrand(null); };
  const toggleFactory = (value: string) => setCrossFactory((v) => v === value ? null : value);
  const toggleGmt = (value: string) => setCrossGmtType((v) => v === value ? null : value);
  const toggleBrand = (value: string) => setCrossBrand((v) => v === value ? null : value);

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
    const visibleDates = dates.slice(Math.max(0, dates.length - 18));
    const facs = FACTORY_ORDER.filter((f) => rows.some((x) => x.factory === f));
    const byDate = new Map<string, Map<string, number>>();
    visibleDates.forEach((d) => {
      byDate.set(d, new Map(rows.filter((x) => x.produce_date === d).map((x) => [x.factory, Number(x.eff_pct)])));
    });
    const values = rows
      .filter((x) => visibleDates.includes(x.produce_date))
      .map((x) => Number(x.eff_pct))
      .filter(Number.isFinite);
    const minY = values.length ? Math.max(0, Math.floor((Math.min(...values) - 0.05) * 20) / 20) : 0;
    const maxY = values.length ? Math.min(1, Math.ceil((Math.max(...values) + 0.05) * 20) / 20) : 1;
    return {
      animationDuration: 500,
      color: facs.map((f) => COLORS[f]),
      legend: { top: 0, data: facs, icon: "circle", itemWidth: 9, itemHeight: 9 },
      grid: { left: 48, right: 26, top: 42, bottom: 40 },
      tooltip: { trigger: "axis", valueFormatter: (v: number) => pct(v) },
      xAxis: { type: "category", data: visibleDates, boundaryGap: false, axisTick: { show: false }, axisLabel: { fontSize: 10, formatter: (v: string) => { const [y, m, d] = v.split("-"); return `${d}/${m}/${y.slice(2)}`; } } },
      yAxis: { type: "value", min: minY, max: maxY, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: "#dce6f1", type: "dashed" } } },
      series: facs.map((f) => ({
        name: f, type: "line", smooth: 0.18, symbol: "circle", symbolSize: 5, connectNulls: true,
        lineStyle: { width: 2.6, opacity: crossFactory && crossFactory !== f ? 0.16 : 0.9 },
        itemStyle: { color: COLORS[f] },
        emphasis: { focus: "series", lineStyle: { opacity: 0.98 } },
        data: visibleDates.map((d, i) => {
          const value = byDate.get(d)?.get(f);
          const showLabel = crossFactory ? crossFactory === f : i % 3 === 0 || i === visibleDates.length - 1;
          return Number.isFinite(value) ? { value, label: { show: showLabel, formatter: pct(value, 1), position: "top", distance: 5, color: COLORS[f], fontSize: 9, fontWeight: 700, backgroundColor: "rgba(255,255,255,.86)", borderRadius: 3, padding: [1, 3] } } : null;
        }),
        labelLayout: { hideOverlap: true, moveOverlap: "shiftY" },
      })),
    };
  }, [data, crossFactory]);

  const barOption = (rows: Array<{ name: string; eff: number; pph?: number | null }>, withPph: boolean, scroll = false, selected?: string | null) => ({
    animationDuration: 350,
    grid: { left: 54, right: 64, top: 46, bottom: scroll ? 72 : 62 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (items: any[]) => {
      const p = items[0]; const r = rows[p.dataIndex];
      return `<b>${r?.name ?? ""}</b><br/>MTD EFF%: ${pct(r?.eff, 2)}${withPph && r?.pph != null ? `<br/>PPH: ${Number(r.pph).toFixed(2)}` : ""}`;
    } },
    xAxis: { type: "category", data: rows.map((x) => x.name), axisLabel: { interval: 0, rotate: rows.length > 8 ? 48 : 38, fontSize: 10, width: 80, overflow: "truncate" }, axisTick: { show: false } },
    yAxis: { type: "value", min: 0, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: "#dce6f1", type: "dashed" } } },
    dataZoom: scroll && rows.length > 12 ? [{ type: "inside", startValue: 0, endValue: 11, zoomLock: true, zoomOnMouseWheel: false, moveOnMouseWheel: false, moveOnMouseMove: true }, { type: "slider", startValue: 0, endValue: 11, zoomLock: true, height: 11, bottom: 5, showDetail: false, brushSelect: false }] : [],
    series: [{
      type: "bar", barMaxWidth: 48,
      data: rows.map((x) => ({ value: x.eff, itemStyle: { color: x.eff >= TARGET ? "#22b957" : "#ef5560", opacity: selected && selected !== x.name ? 0.25 : 1, borderRadius: [4, 4, 0, 0] } })),
      label: { show: true, position: "top", formatter: (p: any) => { const r = rows[p.dataIndex]; const eff = pct(r?.eff, 2); return withPph && r?.pph != null ? `{eff|${eff}}\n{pph|${Number(r.pph).toFixed(2)}}` : `{eff|${eff}}`; }, rich: { eff: { color: "#667085", fontSize: 10 }, pph: { color: "#0aa6a6", fontSize: 11, fontWeight: 700, lineHeight: 15 } } },
      markLine: { silent: true, symbol: "none", lineStyle: { color: "#6686cf", type: "dashed", width: 2 }, label: { formatter: "Target 60%", position: "end", distance: 2, offset: [-6, -9], color: "#3561b6", fontWeight: 700, fontSize: 10, padding: [1, 3], backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 3 }, data: [{ yAxis: TARGET }] },
    }],
  });

  const productRows = (data?.vvic_product ?? []).map((x) => ({ name: x.gmt_type, eff: Number(x.eff_pct), pph: x.pph == null ? null : Number(x.pph) }));
  const vvicRows = (data?.vvic_customer ?? []).map((x) => ({ name: x.brand_name, eff: Number(x.eff_pct), pph: x.pph == null ? null : Number(x.pph) }));
  const nonRows = (data?.non_vvic_customer ?? []).map((x) => ({ name: x.brand_name, eff: Number(x.eff_pct) }));
  const hasCross = !!(crossFactory || crossGmtType || crossBrand);

  return (
    <div className="ov02-page">
      <div className="ov02-header">
        <h1>OVERVIEW02</h1>
        <label><span>START DATE</span><input type="date" value={startDate} min={filters.min_date || undefined} max={endDate} onChange={(e) => { setStartDate(e.target.value); clearCross(); }} /></label>
        <label><span>END DATE</span><input type="date" value={endDate} min={startDate} max={filters.max_date || undefined} onChange={(e) => { setEndDate(e.target.value); clearCross(); }} /></label>
        <div className="ov02-factories">{["ALL", ...factories].map((f) => <button key={f} className={factory === f ? "active" : ""} onClick={() => { setFactory(f); clearCross(); }}>{f}</button>)}</div>
        <div className="ov02-refresh">REFRESH: {thaiRefresh(data?.last_refresh)}{hasCross ? <button onClick={clearCross} style={{ marginLeft: 10 }}>CLEAR FILTER</button> : null}</div>
      </div>

      {error && <div className="ov02-error">{error}</div>}
      <div className={loading ? "ov02-grid loading" : "ov02-grid"}>
        <section className="ov02-card"><h2>Daily EFF% by FACTORY</h2><ReactECharts option={ribbonOption} notMerge style={{ height: 295 }} onEvents={{ click: (p: any) => p.seriesName && toggleFactory(p.seriesName) }} /></section>
        <section className="ov02-card"><h2>MTD Eff% &amp; PPH by VVIC Product Type</h2><ReactECharts option={barOption(productRows, true, false, crossGmtType)} notMerge style={{ height: 295 }} onEvents={{ click: (p: any) => { const r = productRows[p.dataIndex]; if (r) toggleGmt(r.name); } }} /></section>
        <section className="ov02-card"><h2>MTD Eff% &amp; PPH by VVIC Customer</h2><ReactECharts key={`vvic-${vvicRows.length}`} option={barOption(vvicRows, true, true, crossBrand)} notMerge style={{ height: 295 }} onChartReady={(chart: any) => bindHorizontalTrackpadPan(chart, vvicRows.length, 12)} onEvents={{ click: (p: any) => { const r = vvicRows[p.dataIndex]; if (r) toggleBrand(r.name); } }} /></section>
        <section className="ov02-card"><h2>MTD Eff% by Non-VVIC Customer</h2><ReactECharts key={`non-${nonRows.length}`} option={barOption(nonRows, false, true, crossBrand)} notMerge style={{ height: 295 }} onChartReady={(chart: any) => bindHorizontalTrackpadPan(chart, nonRows.length, 12)} onEvents={{ click: (p: any) => { const r = nonRows[p.dataIndex]; if (r) toggleBrand(r.name); } }} /></section>
      </div>
    </div>
  );
}