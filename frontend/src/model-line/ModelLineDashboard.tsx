import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import "./model-line.css";

type Filters = { min_date: string | null; max_date: string | null; factories: string[] };
type Summary = { eff_pct: number | null; min_produce: number | null; pph: number | null; count_style: number | null; operator_count: number | null; count_line: number | null; last_refresh: string };
type ModelEff = { model_line: string; eff_pct: number };
type ProductEff = { pd_type: string; model_line: string; eff_pct: number; sum_outmin?: number; sum_inmin?: number };
type ProductTypeEff = { product_type: string; eff_pct: number | null };
type LatestLine = { model_line: string; line: string; latest_date: string; eff_pct: number; product_types?: ProductTypeEff[] };
type DateModel = { produce_date: string; model_line: string; eff_pct: number; product_types?: ProductTypeEff[] };

const FACTORY_ORDER = ["G1", "G2", "G3", "G4", "TRM", "EA"];
const MODEL_COLORS: Record<string, string> = { G1: "#f04486", G2: "#ffd126", G3: "#ff7917", G4: "#15b7c6", TRM: "#2889dc", EA: "#54df0b" };
const PRODUCT_COLORS = ["#1812a8", "#ffd91a", "#ff8b2c", "#16b9c7", "#2c8ce5", "#5bdc20", "#ef4b87", "#8a63d2", "#00a67d", "#d6692f"];
const TARGET = 0.65;
const num = (v: unknown) => (v == null ? null : Number(v));
const pct = (v: unknown, digits = 1) => { const n = num(v); return n == null || Number.isNaN(n) ? "-" : `${(n * 100).toFixed(digits)}%`; };
const fmt = (v: unknown, digits = 0) => { const n = num(v); if (n == null || Number.isNaN(n)) return "-"; return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n); };
const fmtM = (v: unknown) => { const n = num(v); if (n == null || Number.isNaN(n)) return "-"; return Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : fmt(n); };
const thaiRefresh = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`; };
const yearStartFor = (value: string, minDate?: string | null) => { const yearStart = `${value.slice(0, 4)}-01-01`; return minDate && minDate > yearStart ? minDate : yearStart; };
const esc = (value: string) => value.replace(/[&<>"']/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[x]!));
const productColor = (name: string) => { let hash = 0; for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0; return PRODUCT_COLORS[Math.abs(hash) % PRODUCT_COLORS.length]; };

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
    chart.dispatchAction({ type: "dataZoom", dataZoomIndex: 0, startValue: nextStart, endValue: nextStart + visibleCount - 1 });
  };
  dom.addEventListener("wheel", handler, { passive: false });
  (dom as any).__horizontalTrackpadPan = handler;
};

async function getJSON<T>(path: string, startDate?: string, endDate?: string, factory?: string): Promise<T> {
  const params = new URLSearchParams(); if (startDate) params.set("start_date", startDate); if (endDate) params.set("end_date", endDate); if (factory && factory !== "ALL") params.set("factory", factory);
  const res = await fetch(`${path}${params.size ? `?${params.toString()}` : ""}`); if (!res.ok) throw new Error(await res.text()); return res.json();
}
function Kpi({ label, value }: { label: string; value: string }) { return <div className="ml-kpi"><span>{label}</span><b>{value}</b></div>; }

export default function ModelLineDashboard() {
  const [filters, setFilters] = useState<Filters>({ min_date: null, max_date: null, factories: [] });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filtersReady, setFiltersReady] = useState(false);
  const [factory, setFactory] = useState("ALL");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [modelEff, setModelEff] = useState<ModelEff[]>([]);
  const [product, setProduct] = useState<ProductEff[]>([]);
  const [latest, setLatest] = useState<LatestLine[]>([]);
  const [dateModel, setDateModel] = useState<DateModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getJSON<Filters>("/api/model-line/filters")
      .then((nextFilters) => {
        setFilters(nextFilters);
        const defaultEnd = nextFilters.max_date || new Date().toISOString().slice(0, 10);
        setEndDate(defaultEnd);
        setStartDate(yearStartFor(defaultEnd, nextFilters.min_date));
        setFiltersReady(true);
      })
      .catch((e) => setError(`Unable to load filters: ${e.message}`));
  }, []);
  useEffect(() => {
    if (!filtersReady || !startDate || !endDate) return;
    let active = true; setLoading(true); setError("");
    Promise.all([
      getJSON<Summary>("/api/model-line/summary", startDate, endDate, factory),
      getJSON<ModelEff[]>("/api/model-line/eff-by-model-line", startDate, endDate, factory),
      getJSON<ProductEff[]>("/api/model-line/product-table", startDate, endDate, factory),
      getJSON<LatestLine[]>("/api/model-line/latest-by-line", startDate, endDate, factory),
      getJSON<DateModel[]>("/api/model-line/date-model-line", startDate, endDate, factory),
    ]).then(([s, m, p, l, d]) => {
      if (!active) return; setSummary(s); setModelEff(m); setProduct(p); setLatest(l); setDateModel(d);
      setSelectedModel((current) => (current && m.some((x) => x.model_line === current) ? current : null));
    }).catch((e) => active && setError(`Unable to load Model-Line dashboard: ${e.message}`)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filtersReady, startDate, endDate, factory]);

  const factories = useMemo(() => {
    const values = filters.factories.length ? filters.factories : FACTORY_ORDER;
    return [...values].sort((a, b) => { const ai = FACTORY_ORDER.indexOf(a), bi = FACTORY_ORDER.indexOf(b); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b); });
  }, [filters.factories]);
  const year = endDate ? endDate.slice(0, 4) : "";
  const visibleModelEff = useMemo(() => selectedModel ? modelEff.filter((x) => x.model_line === selectedModel) : modelEff, [modelEff, selectedModel]);
  const visibleProduct = useMemo(() => selectedModel ? product.filter((x) => x.model_line === selectedModel) : product, [product, selectedModel]);
  const visibleLatest = useMemo(() => selectedModel ? latest.filter((x) => x.model_line === selectedModel) : latest, [latest, selectedModel]);
  const visibleDateModel = useMemo(() => selectedModel ? dateModel.filter((x) => x.model_line === selectedModel) : dateModel, [dateModel, selectedModel]);

  const modelBarOption = useMemo(() => ({
    animationDuration: 350, grid: { left: 45, right: 64, top: 44, bottom: 34 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (items: any[]) => { const p = items?.[0]; const r = visibleModelEff[p?.dataIndex]; if (!r) return ""; return `Model Line: ${esc(r.model_line)}<br/>EFF%: ${pct(r.eff_pct, 1)}`; } },
    xAxis: { type: "category", data: visibleModelEff.map((x) => x.model_line), axisTick: { show: false }, axisLine: { show: false } },
    yAxis: { type: "value", min: 0, max: 1.15, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: "#dce6f1", type: "dashed" } } },
    series: [{ type: "bar", barMaxWidth: 48, data: visibleModelEff.map((x) => ({ value: Number(x.eff_pct), itemStyle: { color: Number(x.eff_pct) >= TARGET ? "#22b956" : "#ef4760", borderRadius: [5, 5, 0, 0] } })), label: { show: true, position: "top", formatter: (p: any) => `${(Number(p.value) * 100).toFixed(1)}%`, fontSize: 11 }, markLine: { silent: true, symbol: "none", lineStyle: { color: "#6686cf", type: "dashed", width: 2 }, label: { formatter: "Target 65%", position: "end", distance: 2, offset: [-6, -9], color: "#3561b6", fontWeight: 700, fontSize: 10, padding: [1, 3], backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 3 }, data: [{ yAxis: TARGET }] } }],
  }), [visibleModelEff]);

  const productPivot = useMemo(() => {
    const models = Array.from(new Set(visibleProduct.map((x) => x.model_line))).sort((a, b) => { const ai = FACTORY_ORDER.indexOf(a), bi = FACTORY_ORDER.indexOf(b); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b); });
    const rows = Array.from(new Set(visibleProduct.map((x) => x.pd_type))).sort().map((pd) => {
      const byModel: Record<string, number | null> = {}; const source = visibleProduct.filter((x) => x.pd_type === pd);
      models.forEach((m) => { const r = source.find((x) => x.model_line === m); byModel[m] = r ? Number(r.eff_pct) : null; });
      const valid = source.map((x) => Number(x.eff_pct)).filter(Number.isFinite);
      return { pd, byModel, total: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null };
    });
    return { models, rows };
  }, [visibleProduct]);

  const makeLatestOption = (rows: LatestLine[], compact = false) => ({
    animationDuration: 350, grid: { left: 48, right: 64, top: 44, bottom: compact ? 52 : 62 },
    tooltip: { trigger: "axis", confine: true, backgroundColor: "#fff", borderColor: "#aeb8c6", borderWidth: 1, padding: 0, extraCssText: "box-shadow:0 8px 24px rgba(20,35,60,.22);border-radius:3px;", axisPointer: { type: "shadow" }, formatter: (items: any[]) => {
      const i = items[0]; const r = rows[i.dataIndex]; if (!r) return "";
      const products = (r.product_types ?? []).filter(x => x.eff_pct != null).sort((a, b) => Number(b.eff_pct) - Number(a.eff_pct));
      const maximum = Math.max(...products.map(x => Number(x.eff_pct) || 0), .01);
      const detail = products.length ? products.map(x => { const width = Math.max(5, (Number(x.eff_pct) / maximum) * 205); return `<div style="margin-top:10px"><div style="font-size:10px;color:#283247;margin-bottom:4px">${esc(x.product_type)}</div><div style="display:flex;align-items:center;gap:9px"><span style="display:block;width:${width}px;max-width:205px;height:15px;border-radius:2px;background:${productColor(x.product_type)}"></span><b style="font-size:11px;color:#172033">${pct(x.eff_pct,1)}</b></div></div>`; }).join("") : `<div style="margin-top:10px;color:#748196;font-size:11px">No Product Type data</div>`;
      return `<div style="padding:12px 14px;min-width:270px"><div style="font-size:12px;font-weight:700;color:#263145">EFF% by Product Type</div><div style="font-size:10px;color:#748196;margin-top:3px">${esc(r.model_line)} · Line ${esc(String(r.line))} · ${esc(String(r.latest_date ?? ""))}</div>${detail}</div>`;
    } },
    xAxis: { type: "category", data: rows.map((x) => `${x.line}\n${x.model_line}`), axisLabel: { interval: 0, fontSize: compact ? 10 : 9 }, axisTick: { show: false } },
    yAxis: { type: "value", min: 0, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: "#e3ebf4" } } },
    dataZoom: rows.length > 14 ? [{ type: "inside", startValue: 0, endValue: 13, zoomLock: true, zoomOnMouseWheel: false, moveOnMouseWheel: false, moveOnMouseMove: true }, { type: "slider", startValue: 0, endValue: 13, zoomLock: true, height: 12, bottom: 4, showDetail: false, brushSelect: false }] : [],
    series: [{ type: "bar", barMaxWidth: 42, data: rows.map((x) => ({ value: Number(x.eff_pct), itemStyle: { color: Number(x.eff_pct) >= TARGET ? "#22b956" : "#ef1760", borderRadius: [4, 4, 0, 0] } })), label: { show: true, position: "top", formatter: (p: any) => `${(Number(p.value) * 100).toFixed(1)}%`, fontSize: 10 }, markLine: { silent: true, symbol: "none", lineStyle: { color: "#6686cf", type: "dashed", width: 2 }, label: { formatter: "Target 65%", position: "end", distance: 2, offset: [-6, -9], color: "#3561b6", fontWeight: 700, fontSize: 10, padding: [1, 3], backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 3 }, data: [{ yAxis: TARGET }] } }],
  });

  const ribbonOption = useMemo(() => {
    const dates = Array.from(new Set(visibleDateModel.map((x) => x.produce_date))).sort();
    const visibleDates = dates.slice(Math.max(0, dates.length - 18));
    const models = Array.from(new Set(visibleDateModel.map((x) => x.model_line))).sort();
    const byDate = new Map<string, Map<string, DateModel>>();
    visibleDates.forEach((d) => byDate.set(d, new Map(visibleDateModel.filter((x) => x.produce_date === d).map((x) => [x.model_line, x]))));
    const values = visibleDateModel.filter((x) => visibleDates.includes(x.produce_date)).map((x) => Number(x.eff_pct)).filter(Number.isFinite);
    const minY = values.length ? Math.max(0, Math.floor((Math.min(...values) - 0.05) * 20) / 20) : 0;
    const maxY = values.length ? Math.min(1.15, Math.ceil((Math.max(...values) + 0.05) * 20) / 20) : 1;
    return {
      animationDuration: 450, color: models.map((m) => MODEL_COLORS[m] || "#64748b"), legend: { top: 0, data: models, icon: "circle", itemWidth: 9, itemHeight: 9 }, grid: { left: 48, right: 28, top: 42, bottom: 36 },
      tooltip: { trigger: "item", confine: true, backgroundColor: "#fff", borderColor: "#aeb8c6", borderWidth: 1, padding: 0, extraCssText: "box-shadow:0 8px 24px rgba(20,35,60,.22);border-radius:3px;", formatter: (p: any) => {
        const day = String(p.name ?? ""); const model = String(p.seriesName ?? ""); const r = byDate.get(day)?.get(model); if (!r) return "";
        const products = (r.product_types ?? []).filter(x => x.eff_pct != null).sort((a, b) => Number(b.eff_pct) - Number(a.eff_pct));
        const maximum = Math.max(...products.map(x => Number(x.eff_pct) || 0), .01);
        const detail = products.length ? products.map(x => { const width = Math.max(5, (Number(x.eff_pct) / maximum) * 205); return `<div style="margin-top:10px"><div style="font-size:10px;color:#283247;margin-bottom:4px">${esc(x.product_type)}</div><div style="display:flex;align-items:center;gap:9px"><span style="display:block;width:${width}px;max-width:205px;height:15px;border-radius:2px;background:${productColor(x.product_type)}"></span><b style="font-size:11px;color:#172033">${pct(x.eff_pct,1)}</b></div></div>`; }).join("") : `<div style="margin-top:10px;color:#748196;font-size:11px">No Product Type data</div>`;
        return `<div style="padding:12px 14px;min-width:270px"><div style="font-size:12px;font-weight:700;color:#263145">EFF% by Product Type</div><div style="font-size:10px;color:#748196;margin-top:3px">${esc(model)} · ${esc(day)}</div>${detail}</div>`;
      } },
      xAxis: { type: "category", data: visibleDates, boundaryGap: false, axisTick: { show: false }, axisLabel: { formatter: (v: string) => { const [y, m, d] = v.split("-"); return `${d}/${m}/${y.slice(2)}`; } } }, yAxis: { type: "value", min: minY, max: maxY, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: "#dce6f1", type: "dashed" } } },
      series: models.map((m) => ({ name: m, type: "line", smooth: 0.18, symbol: "circle", symbolSize: 5, connectNulls: true, lineStyle: { width: 2.6, opacity: 0.9 }, itemStyle: { color: MODEL_COLORS[m] || "#64748b" }, emphasis: { focus: "series", lineStyle: { opacity: 0.98 } }, data: visibleDates.map((d, i) => { const row = byDate.get(d)?.get(m); const value = row ? Number(row.eff_pct) : undefined; const showLabel = selectedModel ? true : i % 3 === 0 || i === visibleDates.length - 1; return Number.isFinite(value) ? { value, label: { show: showLabel, formatter: pct(value, 1), position: "top", distance: 5, color: MODEL_COLORS[m] || "#263446", fontWeight: 700, fontSize: 9, backgroundColor: "rgba(255,255,255,.86)", borderRadius: 3, padding: [1, 3] } } : null; }), labelLayout: { hideOverlap: true, moveOverlap: "shiftY" } })),
    };
  }, [visibleDateModel, selectedModel]);

  const toggleModel = (m: string) => setSelectedModel((v) => v === m ? null : m);

  return (
    <div className="ml-page">
      <div className="ml-header">
        <h1>Model-Line - {year || "Dashboard"}</h1>
        <label><span>START DATE</span><input type="date" value={startDate} min={filters.min_date || undefined} max={endDate} onChange={(e) => { setStartDate(e.target.value); setSelectedModel(null); }} /></label>
        <label><span>END DATE</span><input type="date" value={endDate} min={startDate} max={filters.max_date || undefined} onChange={(e) => { setEndDate(e.target.value); setSelectedModel(null); }} /></label>
        <div className="ml-factories">{["ALL", ...factories].map((f) => <button key={f} className={factory === f ? "active" : ""} onClick={() => { setFactory(f); setSelectedModel(null); }}>{f}</button>)}</div>
        <div className="ml-refresh">REFRESH: {thaiRefresh(summary?.last_refresh)}{selectedModel ? <button onClick={() => setSelectedModel(null)} style={{ marginLeft: 10 }}>CLEAR {selectedModel}</button> : null}</div>
      </div>
      {error && <div className="ml-error">{error}</div>}
      <div className={loading ? "ml-body loading" : "ml-body"}>
        <div className="ml-kpis"><Kpi label="EFF%" value={pct(summary?.eff_pct, 1)} /><Kpi label="Min Produce" value={fmtM(summary?.min_produce)} /><Kpi label="PPH" value={fmt(summary?.pph, 2)} /><Kpi label="CountStyle" value={fmt(summary?.count_style)} /><Kpi label="#Of Operator" value={fmt(summary?.operator_count)} /><Kpi label="CountLine" value={fmt(summary?.count_line)} /></div>
        <div className="ml-grid ml-top-grid">
          <section className="ml-card"><h2>EFF% by Model Line</h2><ReactECharts option={modelBarOption} style={{ height: 300 }} onEvents={{ click: (p: any) => p.name && toggleModel(p.name) }} /></section>
          <section className="ml-card ml-table-card"><h2>EFF% by PD_Type and Model Line</h2><div className="ml-table-scroll"><table><thead><tr><th>PD_Type</th>{productPivot.models.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead><tbody>{productPivot.rows.map((r) => <tr key={r.pd}><td>{r.pd}</td>{productPivot.models.map((m) => <td key={m}>{pct(r.byModel[m], 0)}</td>)}<td>{pct(r.total, 0)}</td></tr>)}</tbody></table></div></section>
          <section className="ml-card"><h2>Eff Latest date by Model Line and Line</h2><ReactECharts key={`latest-top-${visibleLatest.length}`} option={makeLatestOption(visibleLatest)} style={{ height: 300 }} onChartReady={(chart: any) => bindHorizontalTrackpadPan(chart, visibleLatest.length, 14)} onEvents={{ click: (p: any) => { const row = visibleLatest[p.dataIndex]; if (row) toggleModel(row.model_line); } }} /></section>
        </div>
        <div className="ml-grid ml-bottom-grid">
          <section className="ml-card"><div className="ml-title-row"><h2>EFF% by Date and Model Line</h2></div><ReactECharts option={ribbonOption} style={{ height: 310 }} onEvents={{ click: (p: any) => p.seriesName && toggleModel(p.seriesName) }} /></section>
          <section className="ml-card"><h2>Eff Latest date by Model Line and Line{selectedModel ? ` · ${selectedModel}` : ""}</h2><ReactECharts key={`latest-bottom-${visibleLatest.length}`} option={makeLatestOption(visibleLatest, true)} style={{ height: 310 }} onChartReady={(chart: any) => bindHorizontalTrackpadPan(chart, visibleLatest.length, 14)} onEvents={{ click: (p: any) => { const row = visibleLatest[p.dataIndex]; if (row) toggleModel(row.model_line); } }} /></section>
        </div>
      </div>
    </div>
  );
}
