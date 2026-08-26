import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import "./min-vs-eff.css";

type FilterMeta = {
  min_date: string | null;
  max_date: string | null;
  factories: string[];
};

type HeatPoint = {
  factory: string;
  pd_type: string;
  min_produce: number | null;
  eff_pct: number | null;
};

type CustomerRow = {
  customer: string;
  eff_pct: number | null;
};

type DashboardData = {
  heatmap: HeatPoint[];
  vvic: CustomerRow[];
  normal: CustomerRow[];
  last_refresh: string;
};

const FACTORY_ORDER = ["EA", "G1", "G2", "G3", "G4", "TRM"];
const PRODUCT_ORDER = [
  "GLO", "HOME", "BOTTB", "ACC", "ELAST", "SHIRT",
  "UNDER", "OVS", "OTHER", "BOTTC", "POL", "JKT",
];

const pct = (v: number | null | undefined, digits = 0) =>
  v == null ? "-" : `${(Number(v) * 100).toFixed(digits)}%`;

const formatRefresh = (value?: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const buddhistYear = d.getFullYear() + 543;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${d.getDate()}/${d.getMonth() + 1}/${buddhistYear} ${hh}:${mm}:${ss}`;
};

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `API ${res.status}`);
  }
  return res.json();
}

function rankColor(valuePct: number) {
  if (valuePct >= 80) return "#10168f";
  if (valuePct >= 70) return "#5b0a9e";
  if (valuePct >= 60) return "#b0008f";
  if (valuePct >= 50) return "#ff4b35";
  return "#f0df00";
}

function CustomerBarChart({ rows }: { rows: CustomerRow[] }) {
  const safeRows = rows.filter((r) => r.eff_pct != null);
  const option = useMemo(() => ({
    animationDuration: 350,
    grid: { left: 12, right: 62, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "item",
      formatter: (p: any) => `<b>${p.name}</b><br/>MTD EFF%: ${Number(p.value).toFixed(2)}%`,
    },
    xAxis: { type: "value", min: 0, max: 110, show: false },
    yAxis: {
      type: "category",
      inverse: true,
      data: safeRows.map((r) => r.customer),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "#30384a",
        fontSize: 10,
        width: 220,
        overflow: "truncate",
      },
    },
    series: [{
      type: "bar",
      barWidth: 18,
      data: safeRows.map((r) => {
        const value = Number(r.eff_pct) * 100;
        return { value, itemStyle: { color: rankColor(value), borderRadius: [0, 5, 5, 0] } };
      }),
      label: {
        show: true,
        position: "right",
        color: "#20242c",
        fontWeight: 700,
        fontSize: 10,
        formatter: (p: any) => `${Number(p.value).toFixed(2)}%`,
      },
    }],
  }), [safeRows]);

  return (
    <div className="mve-scroll-chart">
      <ReactECharts
        option={option}
        notMerge
        style={{ height: Math.max(255, safeRows.length * 34), width: "100%" }}
      />
    </div>
  );
}

export default function MinVSEffDashboard() {
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-12-31");
  const [factory, setFactory] = useState("ALL");
  const [data, setData] = useState<DashboardData>({ heatmap: [], vvic: [], normal: [], last_refresh: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    getJSON<FilterMeta>("/api/min-vs-eff/filters", c.signal)
      .then((m) => setMeta(m))
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); });
    return () => c.abort();
  }, []);

  useEffect(() => {
    const c = new AbortController();
    const qs = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (factory !== "ALL") qs.set("factory", factory);
    setLoading(true);
    setError("");
    getJSON<DashboardData>(`/api/min-vs-eff/dashboard?${qs.toString()}`, c.signal)
      .then(setData)
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [startDate, endDate, factory]);

  const factories = useMemo(() => {
    const source = meta?.factories?.length ? meta.factories : FACTORY_ORDER;
    return [...source].sort((a, b) => {
      const ai = FACTORY_ORDER.indexOf(a);
      const bi = FACTORY_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
    });
  }, [meta]);

  const heatmapOption = useMemo(() => {
    const factorySet = new Set(data.heatmap.map((x) => x.factory));
    const x = FACTORY_ORDER.filter((f) => factorySet.has(f));
    for (const f of [...factorySet].sort()) if (!x.includes(f)) x.push(f);

    const productSet = new Set(data.heatmap.map((x) => x.pd_type));
    const y = PRODUCT_ORDER.filter((p) => productSet.has(p));
    for (const p of [...productSet].sort()) if (!y.includes(p)) y.push(p);

    const effValues = data.heatmap.map((d) => Number(d.eff_pct ?? 0) * 100).filter(Number.isFinite);
    const produceValues = data.heatmap.map((d) => Number(d.min_produce ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
    const minEff = effValues.length ? Math.min(...effValues) : 0;
    const maxEff = effValues.length ? Math.max(...effValues) : 100;
    const maxProduce = produceValues.length ? Math.max(...produceValues) : 1;

    const heat = data.heatmap.map((d) => [
      x.indexOf(d.factory), y.indexOf(d.pd_type), Number(d.eff_pct ?? 0) * 100,
    ]);
    const bubbles = data.heatmap.map((d) => [
      x.indexOf(d.factory), y.indexOf(d.pd_type), Number(d.min_produce ?? 0), Number(d.eff_pct ?? 0) * 100,
    ]);

    return {
      animationDuration: 350,
      grid: { left: 72, right: 130, top: 28, bottom: 50 },
      tooltip: {
        trigger: "item",
        formatter: (p: any) => {
          if (p.seriesType !== "scatter") return "";
          const v = p.value;
          return `<b>${x[v[0]]} · ${y[v[1]]}</b><br/>EFF%: ${Number(v[3]).toFixed(1)}%<br/>Min Produce: ${Number(v[2]).toLocaleString()}`;
        },
      },
      xAxis: {
        type: "category", data: x, name: "FACTORY", nameLocation: "middle", nameGap: 30,
        axisTick: { show: false }, axisLine: { lineStyle: { color: "#cfd9e5" } },
        axisLabel: { color: "#273246", fontSize: 12, fontWeight: 700 },
      },
      yAxis: {
        type: "category", data: y, inverse: true, axisTick: { show: false },
        axisLine: { lineStyle: { color: "#cfd9e5" } }, axisLabel: { color: "#273246", fontSize: 12 },
      },
      visualMap: {
        type: "continuous", seriesIndex: 0, min: Math.floor(minEff), max: Math.ceil(maxEff || 100),
        orient: "vertical", right: 20, top: 25, itemHeight: 120, itemWidth: 16,
        text: ["EFF % by FAC", ""], textGap: 8, precision: 0, calculable: false,
        inRange: { color: ["#fff7fb", "#efd5ee", "#d18bd1", "#ac4ab3"] },
      },
      series: [
        {
          type: "heatmap", data: heat,
          itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,.18)" } },
        },
        {
          type: "scatter", data: bubbles, z: 5,
          symbolSize: (v: number[]) => 8 + 30 * Math.sqrt(Math.max(0, v[2]) / maxProduce),
          itemStyle: { color: "rgba(255,255,255,.25)", borderColor: "#424242", borderWidth: 2 },
          label: {
            show: true, color: "#222", fontSize: 9, fontWeight: 700,
            formatter: (p: any) => `${Number(p.value[3]).toFixed(0)}%`,
          },
        },
      ],
    };
  }, [data.heatmap]);

  return (
    <main className="mve-page">
      <header className="mve-filter-row">
        <h1>MinVSEff</h1>
        <label className="mve-date-card"><span>START DATE</span><input type="date" value={startDate} min={meta?.min_date ?? undefined} max={endDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label className="mve-date-card"><span>END DATE</span><input type="date" value={endDate} min={startDate} max={meta?.max_date ?? undefined} onChange={(e) => setEndDate(e.target.value)} /></label>
        <div className="mve-factories">
          <button className={factory === "ALL" ? "active" : ""} onClick={() => setFactory("ALL")}>ALL</button>
          {factories.map((f) => <button key={f} className={factory === f ? "active" : ""} onClick={() => setFactory(f)}>{f}</button>)}
        </div>
        <div className="mve-refresh">REFRESH: {formatRefresh(data.last_refresh)}</div>
      </header>

      {error && <div className="mve-error">{error}</div>}

      <section className={`mve-grid ${loading ? "loading" : ""}`}>
        <article className="mve-card mve-heatmap-card">
          <div className="mve-card-kicker">EFFICIENCY MATRIX</div>
          <h2>EFF% VS Min Produe by Product Type &amp; Factory</h2>
          <ReactECharts option={heatmapOption} notMerge style={{ height: 585, width: "100%" }} />
        </article>

        <div className="mve-right-stack">
          <article className="mve-card mve-customer-card">
            <div className="mve-card-kicker">CUSTOMER RANKING</div>
            <h2>MTD EFF% By VVIC</h2>
            <CustomerBarChart rows={data.vvic} />
          </article>
          <article className="mve-card mve-customer-card">
            <div className="mve-card-kicker">CUSTOMER RANKING</div>
            <h2>MTD EFF% By Normal Customer</h2>
            <CustomerBarChart rows={data.normal} />
          </article>
        </div>
      </section>
    </main>
  );
}
