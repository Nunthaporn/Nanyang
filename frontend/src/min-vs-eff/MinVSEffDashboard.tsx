import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import "./min-vs-eff.css";

type FilterMeta = { min_date: string | null; max_date: string | null; factories: string[] };
type HeatPoint = { factory: string; pd_type: string; min_produce: number | null; eff_pct: number | null };
type CustomerRow = { customer: string; eff_pct: number | null };
type DashboardData = { heatmap: HeatPoint[]; vvic: CustomerRow[]; normal: CustomerRow[]; last_refresh: string };

const FACTORY_ORDER = ["G1", "G2", "G3", "G4", "TRM", "EA"];
const PRODUCT_ORDER = ["GLO", "HOME", "BOTTB", "ACC", "ELAST", "SHIRT", "UNDER", "OVS", "OTHER", "BOTTC", "POL", "JKT"];

const formatRefresh = (value?: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};
const yearStartFor = (value: string, minDate?: string | null) => {
  const yearStart = `${value.slice(0, 4)}-01-01`;
  return minDate && minDate > yearStart ? minDate : yearStart;
};

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error((await res.text()) || `API ${res.status}`);
  return res.json();
}

function rankColor(valuePct: number) {
  if (valuePct >= 80) return "#10168f";
  if (valuePct >= 70) return "#5b0a9e";
  if (valuePct >= 60) return "#b0008f";
  if (valuePct >= 50) return "#ff4b35";
  return "#f0df00";
}

function CustomerBarChart({ rows, selected, onSelect }: { rows: CustomerRow[]; selected: string | null; onSelect: (name: string) => void }) {
  const safeRows = rows.filter((r) => r.eff_pct != null);
  const option = useMemo(() => ({
    animationDuration: 300,
    grid: { left: 12, right: 62, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "item",
      formatter: (p: any) => {
        const row = safeRows[p.dataIndex];
        return `<b>Cust: ${row?.customer ?? p.name ?? ""}</b><br/>MTD EFF%: ${Number(p.value).toFixed(2)}%`;
      },
    },
    xAxis: { type: "value", min: 0, max: 110, show: false },
    yAxis: { type: "category", inverse: true, data: safeRows.map((r) => r.customer), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#30384a", fontSize: 10, width: 220, overflow: "truncate" } },
    series: [{
      type: "bar", barWidth: 18,
      data: safeRows.map((r) => {
        const value = Number(r.eff_pct) * 100;
        return { value, itemStyle: { color: rankColor(value), opacity: selected && selected !== r.customer ? 0.25 : 1, borderRadius: [0, 5, 5, 0] } };
      }),
      label: { show: true, position: "right", color: "#20242c", fontWeight: 700, fontSize: 10, formatter: (p: any) => `${Number(p.value).toFixed(2)}%` },
    }],
  }), [safeRows, selected]);

  return (
    <div className="mve-scroll-chart">
      <ReactECharts option={option} notMerge style={{ height: Math.max(255, safeRows.length * 34), width: "100%" }} onEvents={{ click: (p: any) => { const r = safeRows[p.dataIndex]; if (r) onSelect(r.customer); } }} />
    </div>
  );
}

export default function MinVSEffDashboard() {
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filtersReady, setFiltersReady] = useState(false);
  const [factory, setFactory] = useState("ALL");
  const [crossFactory, setCrossFactory] = useState<string | null>(null);
  const [crossPdType, setCrossPdType] = useState<string | null>(null);
  const [crossCustomer, setCrossCustomer] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>({ heatmap: [], vvic: [], normal: [], last_refresh: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const clearCross = () => { setCrossFactory(null); setCrossPdType(null); setCrossCustomer(null); };

  useEffect(() => {
    const c = new AbortController();
    getJSON<FilterMeta>("/api/min-vs-eff/filters", c.signal)
      .then((nextMeta) => {
        setMeta(nextMeta);
        const defaultEnd = nextMeta.max_date || new Date().toISOString().slice(0, 10);
        setEndDate(defaultEnd);
        setStartDate(yearStartFor(defaultEnd, nextMeta.min_date));
        setFiltersReady(true);
      })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); });
    return () => c.abort();
  }, []);

  const effectiveFactory = crossFactory || factory;

  useEffect(() => {
    if (!filtersReady || !startDate || !endDate) return;
    const c = new AbortController();
    const qs = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (effectiveFactory !== "ALL") qs.set("factory", effectiveFactory);
    if (crossPdType) qs.set("pd_type", crossPdType);
    if (crossCustomer) qs.set("customer", crossCustomer);
    setLoading(true); setError("");
    getJSON<DashboardData>(`/api/min-vs-eff/dashboard?${qs.toString()}`, c.signal)
      .then((nextData) => setData((prevData) => {
        const keepMatrix = !!(crossFactory || crossPdType || crossCustomer) && prevData.heatmap.length > 0;
        return keepMatrix ? { ...nextData, heatmap: prevData.heatmap } : nextData;
      })).catch((e) => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [filtersReady, startDate, endDate, effectiveFactory, crossPdType, crossCustomer]);

  const factories = useMemo(() => {
    const source = meta?.factories?.length ? meta.factories : FACTORY_ORDER;
    return [...source].sort((a, b) => {
      const ai = FACTORY_ORDER.indexOf(a), bi = FACTORY_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
    });
  }, [meta]);

  const heatAxes = useMemo(() => {
    const factorySet = new Set(data.heatmap.map((x) => x.factory));
    const x = FACTORY_ORDER.filter((f) => factorySet.has(f));
    for (const f of [...factorySet].sort()) if (!x.includes(f)) x.push(f);
    const productSet = new Set(data.heatmap.map((x) => x.pd_type));
    const y = PRODUCT_ORDER.filter((p) => productSet.has(p));
    for (const p of [...productSet].sort()) if (!y.includes(p)) y.push(p);
    return { x, y };
  }, [data.heatmap]);

  const heatmapOption = useMemo(() => {
    const { x, y } = heatAxes;
    const effValues = data.heatmap.map((d) => Number(d.eff_pct ?? 0) * 100).filter(Number.isFinite);
    const produceValues = data.heatmap.map((d) => Number(d.min_produce ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
    const minEff = effValues.length ? Math.min(...effValues) : 0;
    const maxEff = effValues.length ? Math.max(...effValues) : 100;
    const maxProduce = produceValues.length ? Math.max(...produceValues) : 1;
    const pointOpacity = (d: HeatPoint) => crossFactory && crossPdType && (crossFactory !== d.factory || crossPdType !== d.pd_type) ? 0.24 : 1;
    const heat = data.heatmap.map((d) => ({
      value: [x.indexOf(d.factory), y.indexOf(d.pd_type), Number(d.eff_pct ?? 0) * 100],
      itemStyle: { opacity: pointOpacity(d) },
    }));
    const bubbles = data.heatmap.map((d) => ({
      value: [x.indexOf(d.factory), y.indexOf(d.pd_type), Number(d.min_produce ?? 0), Number(d.eff_pct ?? 0) * 100],
      itemStyle: { color: "rgba(255,255,255,.25)", borderColor: crossFactory === d.factory && crossPdType === d.pd_type ? "#0757d7" : "#424242", borderWidth: crossFactory === d.factory && crossPdType === d.pd_type ? 3 : 2, opacity: pointOpacity(d) },
    }));
    return {
      animationDuration: 300,
      grid: { left: 72, right: 130, top: 28, bottom: 50 },
      tooltip: { trigger: "item", formatter: (p: any) => { if (p.seriesType !== "scatter") return ""; const v = p.value; return `<b>${x[v[0]]} · ${y[v[1]]}</b><br/>EFF%: ${Number(v[3]).toFixed(1)}%<br/>Min Produce: ${Number(v[2]).toLocaleString()}`; } },
      xAxis: { type: "category", data: x, name: "FACTORY", nameLocation: "middle", nameGap: 30, axisTick: { show: false }, axisLine: { lineStyle: { color: "#cfd9e5" } }, axisLabel: { color: "#273246", fontSize: 12, fontWeight: 700 } },
      yAxis: { type: "category", data: y, inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: "#cfd9e5" } }, axisLabel: { color: "#273246", fontSize: 12 } },
      visualMap: { type: "continuous", seriesIndex: 0, min: Math.floor(minEff), max: Math.ceil(maxEff || 100), orient: "vertical", right: 20, top: 25, itemHeight: 120, itemWidth: 16, text: ["EFF % by FAC", ""], textGap: 8, precision: 0, calculable: false, inRange: { color: ["#fff7fb", "#efd5ee", "#d18bd1", "#ac4ab3"] } },
      series: [
        { type: "heatmap", data: heat, itemStyle: { borderColor: "#ffffff", borderWidth: 2 }, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,.18)" } } },
        { type: "scatter", data: bubbles, z: 5, symbolSize: (v: number[]) => 8 + 30 * Math.sqrt(Math.max(0, v[2]) / maxProduce), label: { show: true, color: "#222", fontSize: 9, fontWeight: 700, formatter: (p: any) => `${Number(p.value[3]).toFixed(0)}%` } },
      ],
    };
  }, [data.heatmap, heatAxes, crossFactory, crossPdType]);

  const selectHeat = (p: any) => {
    if (p.seriesType !== "scatter" && p.seriesType !== "heatmap") return;
    const [factoryIndex, productIndex] = Array.isArray(p.value) ? p.value : [];
    const f = heatAxes.x[factoryIndex];
    const pd = heatAxes.y[productIndex];
    if (!f || !pd) return;
    const same = crossFactory === f && crossPdType === pd;
    setCrossFactory(same ? null : f);
    setCrossPdType(same ? null : pd);
  };
  const toggleCustomer = (name: string) => setCrossCustomer((v) => v === name ? null : name);
  const hasCross = !!(crossFactory || crossPdType || crossCustomer);

  return (
    <main className="mve-page">
      <header className="mve-filter-row">
        <h1>MinVSEff</h1>
        <label className="mve-date-card"><span>START DATE</span><input type="date" value={startDate} min={meta?.min_date ?? undefined} max={endDate} onChange={(e) => { setStartDate(e.target.value); clearCross(); }} /></label>
        <label className="mve-date-card"><span>END DATE</span><input type="date" value={endDate} min={startDate} max={meta?.max_date ?? undefined} onChange={(e) => { setEndDate(e.target.value); clearCross(); }} /></label>
        <div className="mve-factories"><button className={factory === "ALL" ? "active" : ""} onClick={() => { setFactory("ALL"); clearCross(); }}>ALL</button>{factories.map((f) => <button key={f} className={factory === f ? "active" : ""} onClick={() => { setFactory(f); clearCross(); }}>{f}</button>)}</div>
        <div className="mve-refresh">REFRESH: {formatRefresh(data.last_refresh)}{hasCross ? <button onClick={clearCross} style={{ marginLeft: 10 }}>CLEAR FILTER</button> : null}</div>
      </header>

      {error && <div className="mve-error">{error}</div>}
      <section className={`mve-grid ${loading ? "loading" : ""}`}>
        <article className="mve-card mve-heatmap-card">
          <div className="mve-card-kicker">EFFICIENCY MATRIX</div><h2>EFF% VS Min Produce by Product Type &amp; Factory</h2>
          <ReactECharts option={heatmapOption} notMerge style={{ height: 585, width: "100%" }} onEvents={{ click: selectHeat }} />
        </article>
        <div className="mve-right-stack">
          <article className="mve-card mve-customer-card"><div className="mve-card-kicker">CUSTOMER RANKING</div><h2>MTD EFF% By VVIC</h2><CustomerBarChart rows={data.vvic} selected={crossCustomer} onSelect={toggleCustomer} /></article>
          <article className="mve-card mve-customer-card"><div className="mve-card-kicker">CUSTOMER RANKING</div><h2>MTD EFF% By Normal Customer</h2><CustomerBarChart rows={data.normal} selected={crossCustomer} onSelect={toggleCustomer} /></article>
        </div>
      </section>
    </main>
  );
}
