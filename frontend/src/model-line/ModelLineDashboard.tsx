import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import "./model-line.css";

type Filters = { min_date: string | null; max_date: string | null; factories: string[] };
type Summary = {
  eff_pct: number | null;
  min_produce: number | null;
  pph: number | null;
  count_style: number | null;
  operator_count: number | null;
  count_line: number | null;
  last_refresh: string;
};
type ModelEff = { model_line: string; eff_pct: number };
type ProductEff = { pd_type: string; model_line: string; eff_pct: number; sum_outmin?: number; sum_inmin?: number };
type LatestLine = { model_line: string; line: string; latest_date: string; eff_pct: number };
type DateModel = { produce_date: string; model_line: string; eff_pct: number };

const FACTORY_ORDER = ["G1", "G2", "G3", "G4", "TRM", "EA"];
const MODEL_COLORS: Record<string, string> = {
  G1: "#f04486",
  G2: "#ffd126",
  G3: "#ff7917",
  G4: "#15b7c6",
  TRM: "#2889dc",
  EA: "#54df0b",
};
const TARGET = 0.65;

const num = (v: unknown) => (v == null ? null : Number(v));
const pct = (v: unknown, digits = 1) => {
  const n = num(v);
  return n == null || Number.isNaN(n) ? "-" : `${(n * 100).toFixed(digits)}%`;
};
const fmt = (v: unknown, digits = 0) => {
  const n = num(v);
  if (n == null || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
};
const fmtM = (v: unknown) => {
  const n = num(v);
  if (n == null || Number.isNaN(n)) return "-";
  return Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : fmt(n);
};
const thaiRefresh = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = d.getDate();
  const mm = d.getMonth() + 1;
  const yyyy = d.getFullYear() + 543;
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
};

async function getJSON<T>(path: string, startDate?: string, endDate?: string, factory?: string): Promise<T> {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  if (factory && factory !== "ALL") params.set("factory", factory);
  const res = await fetch(`${path}${params.size ? `?${params.toString()}` : ""}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="ml-kpi">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export default function ModelLineDashboard() {
  const [filters, setFilters] = useState<Filters>({ min_date: null, max_date: null, factories: [] });
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-12-31");
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
      .then(setFilters)
      .catch((e) => setError(`Unable to load filters: ${e.message}`));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      getJSON<Summary>("/api/model-line/summary", startDate, endDate, factory),
      getJSON<ModelEff[]>("/api/model-line/eff-by-model-line", startDate, endDate, factory),
      getJSON<ProductEff[]>("/api/model-line/product-table", startDate, endDate, factory),
      getJSON<LatestLine[]>("/api/model-line/latest-by-line", startDate, endDate, factory),
      getJSON<DateModel[]>("/api/model-line/date-model-line", startDate, endDate, factory),
    ])
      .then(([s, m, p, l, d]) => {
        if (!active) return;
        setSummary(s);
        setModelEff(m);
        setProduct(p);
        setLatest(l);
        setDateModel(d);
        setSelectedModel((current) => (current && m.some((x) => x.model_line === current) ? current : null));
      })
      .catch((e) => active && setError(`Unable to load Model-Line dashboard: ${e.message}`))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [startDate, endDate, factory]);

  const factories = useMemo(() => {
    const values = filters.factories.length ? filters.factories : FACTORY_ORDER;
    return [...values].sort((a, b) => {
      const ai = FACTORY_ORDER.indexOf(a);
      const bi = FACTORY_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
    });
  }, [filters.factories]);

  const year = endDate ? endDate.slice(0, 4) : "";

  const modelBarOption = useMemo(() => ({
    animationDuration: 450,
    grid: { left: 45, right: 20, top: 28, bottom: 34 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number) => `${(v * 100).toFixed(1)}%` },
    xAxis: { type: "category", data: modelEff.map((x) => x.model_line), axisTick: { show: false }, axisLine: { show: false } },
    yAxis: { type: "value", min: 0, max: 1.15, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: "#dce6f1", type: "dashed" } } },
    series: [{
      type: "bar",
      barMaxWidth: 48,
      data: modelEff.map((x) => ({ value: Number(x.eff_pct), itemStyle: { color: Number(x.eff_pct) >= TARGET ? "#22b956" : "#ef4760", borderRadius: [5, 5, 0, 0] } })),
      label: { show: true, position: "top", formatter: (p: any) => `${(Number(p.value) * 100).toFixed(1)}%`, fontSize: 11 },
      markLine: { silent: true, symbol: "none", lineStyle: { color: "#6686cf", type: "dashed", width: 2 }, label: { formatter: "Target 65%", position: "insideEndTop", color: "#3561b6" }, data: [{ yAxis: TARGET }] },
    }],
  }), [modelEff]);

  const productPivot = useMemo(() => {
    const models = Array.from(new Set(product.map((x) => x.model_line))).sort((a, b) => {
      const ai = FACTORY_ORDER.indexOf(a), bi = FACTORY_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
    });
    const rows = Array.from(new Set(product.map((x) => x.pd_type))).sort().map((pd) => {
      const byModel: Record<string, number | null> = {};
      const source = product.filter((x) => x.pd_type === pd);
      models.forEach((m) => {
        const r = source.find((x) => x.model_line === m);
        byModel[m] = r ? Number(r.eff_pct) : null;
      });
      const valid = source.map((x) => Number(x.eff_pct)).filter(Number.isFinite);
      return { pd, byModel, total: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null };
    });
    return { models, rows };
  }, [product]);

  const makeLatestOption = (rows: LatestLine[], compact = false) => {
    const shown = rows.filter((x) => !selectedModel || !compact || x.model_line === selectedModel);
    return {
      animationDuration: 450,
      grid: { left: 48, right: 20, top: 30, bottom: compact ? 52 : 62 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (items: any[]) => {
        const i = items[0];
        const r = shown[i.dataIndex];
        return `<b>${r?.model_line ?? ""} · Line ${r?.line ?? ""}</b><br/>EFF%: ${(Number(i.value) * 100).toFixed(1)}%<br/>Latest date: ${r?.latest_date ?? ""}`;
      } },
      xAxis: { type: "category", data: shown.map((x) => `${x.line}\n${x.model_line}`), axisLabel: { interval: 0, fontSize: compact ? 10 : 9 }, axisTick: { show: false } },
      yAxis: { type: "value", min: 0, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: "#e3ebf4" } } },
      dataZoom: shown.length > 14 ? [{ type: "inside", startValue: 0, endValue: 13 }, { type: "slider", height: 12, bottom: 4, showDetail: false }] : [],
      series: [{
        type: "bar",
        barMaxWidth: 42,
        data: shown.map((x) => ({ value: Number(x.eff_pct), itemStyle: { color: Number(x.eff_pct) >= TARGET ? "#22b956" : "#ef1760", borderRadius: [4, 4, 0, 0] } })),
        label: { show: true, position: "top", formatter: (p: any) => `${(Number(p.value) * 100).toFixed(1)}%`, fontSize: 10 },
        markLine: { silent: true, symbol: "none", lineStyle: { color: "#6686cf", type: "dashed", width: 2 }, label: { formatter: "Target 65%", position: "insideEndTop", color: "#3561b6" }, data: [{ yAxis: TARGET }] },
      }],
    };
  };

  const ribbonOption = useMemo(() => {
    const dates = Array.from(new Set(dateModel.map((x) => x.produce_date))).sort();
    const visibleDates = dates.slice(Math.max(0, dates.length - 12));
    const models = Array.from(new Set(dateModel.map((x) => x.model_line))).sort();
    const ranks = new Map<string, Map<string, { rank: number; eff: number }>>();
    visibleDates.forEach((d) => {
      const day = dateModel.filter((x) => x.produce_date === d).sort((a, b) => Number(b.eff_pct) - Number(a.eff_pct));
      const map = new Map<string, { rank: number; eff: number }>();
      day.forEach((x, i) => map.set(x.model_line, { rank: day.length - i, eff: Number(x.eff_pct) }));
      ranks.set(d, map);
    });
    return {
      animationDuration: 650,
      color: models.map((m) => MODEL_COLORS[m] || "#64748b"),
      legend: { top: 0, data: models, icon: "roundRect", itemWidth: 12, itemHeight: 8 },
      grid: { left: 28, right: 24, top: 42, bottom: 34 },
      tooltip: { trigger: "item", formatter: (p: any) => `${p.seriesName}<br/>${p.data.date}<br/>EFF%: ${(p.data.eff * 100).toFixed(1)}%` },
      xAxis: { type: "category", data: visibleDates, boundaryGap: false, axisTick: { show: false }, axisLabel: { formatter: (v: string) => { const [y, m, d] = v.split("-"); return `${d}/${m}/${y.slice(2)}`; } } },
      yAxis: { type: "value", min: 0.5, max: Math.max(1.5, models.length + 0.5), show: false },
      series: models.map((m) => ({
        name: m,
        type: "line",
        smooth: 0.42,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { width: 24, opacity: selectedModel && selectedModel !== m ? 0.18 : 0.78, cap: "round", join: "round" },
        itemStyle: { opacity: selectedModel && selectedModel !== m ? 0.18 : 1 },
        emphasis: { focus: "series", lineStyle: { opacity: 0.95 } },
        data: visibleDates.map((d) => {
          const x = ranks.get(d)?.get(m);
          return x ? { value: x.rank, eff: x.eff, date: d, label: { show: true, formatter: `${(x.eff * 100).toFixed(1)}%`, color: "#111827", fontWeight: 700, fontSize: 10, position: "inside" } } : null;
        }),
      })),
    };
  }, [dateModel, selectedModel]);

  return (
    <div className="ml-page">
      <div className="ml-header">
        <h1>Model-Line - {year || "Dashboard"}</h1>
        <label><span>START DATE</span><input type="date" value={startDate} min={filters.min_date || undefined} max={endDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label><span>END DATE</span><input type="date" value={endDate} min={startDate} max={filters.max_date || undefined} onChange={(e) => setEndDate(e.target.value)} /></label>
        <div className="ml-factories">
          {["ALL", ...factories].map((f) => <button key={f} className={factory === f ? "active" : ""} onClick={() => { setFactory(f); setSelectedModel(null); }}>{f}</button>)}
        </div>
        <div className="ml-refresh">REFRESH: {thaiRefresh(summary?.last_refresh)}</div>
      </div>

      {error && <div className="ml-error">{error}</div>}
      <div className={loading ? "ml-body loading" : "ml-body"}>
        <div className="ml-kpis">
          <Kpi label="EFF%" value={pct(summary?.eff_pct, 1)} />
          <Kpi label="Min Produce" value={fmtM(summary?.min_produce)} />
          <Kpi label="PPH" value={fmt(summary?.pph, 2)} />
          <Kpi label="CountStyle" value={fmt(summary?.count_style)} />
          <Kpi label="#Of Operator" value={fmt(summary?.operator_count)} />
          <Kpi label="CountLine" value={fmt(summary?.count_line)} />
        </div>

        <div className="ml-grid ml-top-grid">
          <section className="ml-card">
            <h2>EFF% by Model Line</h2>
            <ReactECharts option={modelBarOption} style={{ height: 300 }} onEvents={{ click: (p: any) => setSelectedModel((v) => v === p.name ? null : p.name) }} />
          </section>

          <section className="ml-card ml-table-card">
            <h2>EFF% by PD_Type and Model Line</h2>
            <div className="ml-table-scroll">
              <table>
                <thead><tr><th>PD_Type</th>{productPivot.models.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
                <tbody>
                  {productPivot.rows.map((r) => <tr key={r.pd}><td>{r.pd}</td>{productPivot.models.map((m) => <td key={m}>{pct(r.byModel[m], 0)}</td>)}<td>{pct(r.total, 0)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ml-card">
            <h2>Eff Latest date by Model Line and Line</h2>
            <ReactECharts option={makeLatestOption(latest)} style={{ height: 300 }} onEvents={{ click: (p: any) => { const row = latest[p.dataIndex]; if (row) setSelectedModel((v) => v === row.model_line ? null : row.model_line); } }} />
          </section>
        </div>

        <div className="ml-grid ml-bottom-grid">
          <section className="ml-card">
            <div className="ml-title-row"><h2>EFF% by Date and Model Line</h2>{selectedModel && <button onClick={() => setSelectedModel(null)}>Clear {selectedModel}</button>}</div>
            <ReactECharts option={ribbonOption} style={{ height: 310 }} onEvents={{ click: (p: any) => p.seriesName && setSelectedModel((v) => v === p.seriesName ? null : p.seriesName) }} />
          </section>
          <section className="ml-card">
            <h2>Eff Latest date by Model Line and Line{selectedModel ? ` · ${selectedModel}` : ""}</h2>
            <ReactECharts option={makeLatestOption(latest, true)} style={{ height: 310 }} />
          </section>
        </div>
      </div>
    </div>
  );
}
