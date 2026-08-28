import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import "./executive.css";

type Filters = { min_date: string | null; max_date: string | null; factories: string[] };
type OverviewPayload = {
  kpi_details: Partial<Record<"YTD" | "QTD" | "MTD" | "LD", { eff_pct: number | null; min_produce: number | null; ptp_pct: number | null; pph: number | null }>>;
  factory_periods: { period: string; factory: string; eff_pct: number | null }[];
  monthly: { month: string; eff_pct: number | null }[];
  factory_monthly: { month: string; factory: string; eff_pct: number | null }[];
  latest_date: string | null;
  last_refresh: string;
};
type CustomerRow = { brand_name?: string; customer?: string; eff_pct: number | null; min_produce?: number | null; pph?: number | null };
type Overview02Payload = { vvic_customer: CustomerRow[]; non_vvic_customer: CustomerRow[] };
type MinVsEffPayload = { heatmap: { factory: string; pd_type: string; min_produce: number | null; eff_pct: number | null }[] };
type ModelSummary = { eff_pct: number | null; min_produce: number | null; pph: number | null; count_line: number | null; last_refresh: string };
type ModelLine = { model_line: string; line: string; latest_date: string; eff_pct: number | null };
type EasySummary = { data_as_of: string | null; eff_ezlcard: number | null; min_produce: number | null; pph: number | null; count_line: number | null; last_refresh: string };
type EasyLine = { factory: string; line: string; eff_pct: number | null; product_types?: { product_type: string; eff_pct: number | null }[] };
type VvicSummary = { data_as_of: string | null; ytd_eff_pct: number | null; qtd_eff_pct: number | null; mtd_eff_pct: number | null; last_refresh: string };
type VvicMonth = { month: string; vvic: number | null; non_vvic: number | null };
type VvicCustomer = { customer: string; eff_pct: number | null; min_produce?: number | null; target?: number };

const TARGET = 0.60;
const LINE_TARGET = 0.65;
const COLORS: Record<string, string> = { G1: "#f04486", G2: "#ffd126", G3: "#ff7917", G4: "#15b7c6", TRM: "#2889dc", EA: "#54df0b" };
const FACTORY_ORDER = ["G1", "G2", "G3", "G4", "TRM", "EA"];
const pct = (v: unknown, d = 1) => Number.isFinite(Number(v)) ? `${(Number(v) * 100).toFixed(d)}%` : "-";
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : null;
const compact = (v: unknown) => {
  const n = num(v);
  if (n == null) return "-";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};
const signedPct = (v: unknown, d = 1) => {
  const n = num(v);
  if (n == null) return "-";
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(d)} pts`;
};
const deltaTone = (v: unknown) => {
  const n = num(v);
  if (n == null) return "";
  return n >= 0 ? "good" : "bad";
};
const monthName = (value: string) => {
  const [y, m] = value.split("-");
  return y && m ? `${m}/${y.slice(2)}` : value;
};
const thaiRefresh = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const yearStartFor = (value: string, minDate?: string | null) => {
  const yearStart = `${value.slice(0, 4)}-01-01`;
  return minDate && minDate > yearStart ? minDate : yearStart;
};
async function getJSON<T>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params || {});
  const res = await fetch(`${path}${qs.size ? `?${qs.toString()}` : ""}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function KpiTile({ label, value, sub, status }: { label: string; value: string; sub: string; status?: "good" | "watch" | "bad" }) {
  return <article className={`ex-kpi ${status || ""}`}><span>{label}</span><b>{value}</b><small>{sub}</small></article>;
}

function RiskList({ title, rows, empty }: { title: string; rows: { name: string; meta: string; value: number | null; target: number }[]; empty: string }) {
  return <section className="ex-card ex-list"><h2>{title}</h2>{rows.length ? rows.map((r) => <div className="ex-risk-row" key={`${title}-${r.name}-${r.meta}`}><div><strong>{r.name}</strong><span>{r.meta}</span></div><b className={(r.value ?? 0) < r.target ? "bad" : "good"}>{pct(r.value)}</b></div>) : <div className="ex-empty">{empty}</div>}</section>;
}

function PriorityList({ title, rows, empty }: { title: string; rows: { name: string; meta: string; eff: number | null; valueLabel: string }[]; empty: string }) {
  return <section className="ex-card ex-list ex-priority"><h2>{title}</h2>{rows.length ? rows.map((r, i) => <div className="ex-priority-row" key={`${title}-${r.name}-${r.meta}`}><em>{i + 1}</em><div><strong>{r.name}</strong><span>{r.meta}</span></div><b>{r.valueLabel}</b><small>{pct(r.eff)}</small></div>) : <div className="ex-empty">{empty}</div>}</section>;
}

function VolumeList({ title, rows, empty }: { title: string; rows: { name: string; meta: string; eff: number | null; volume: number | null }[]; empty: string }) {
  return <section className="ex-card ex-list ex-volume"><h2>{title}</h2>{rows.length ? rows.map((r, i) => <div className="ex-volume-row" key={`${title}-${r.name}-${r.meta}`}><em>{i + 1}</em><div><strong>{r.name}</strong><span>{r.meta}</span></div><b>{compact(r.volume)}</b><small>{pct(r.eff)}</small></div>) : <div className="ex-empty">{empty}</div>}</section>;
}

export default function ExecutiveSummaryDashboard() {
  const [filters, setFilters] = useState<Filters | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [overview02, setOverview02] = useState<Overview02Payload | null>(null);
  const [minVsEff, setMinVsEff] = useState<MinVsEffPayload | null>(null);
  const [modelSummary, setModelSummary] = useState<ModelSummary | null>(null);
  const [modelLines, setModelLines] = useState<ModelLine[]>([]);
  const [easySummary, setEasySummary] = useState<EasySummary | null>(null);
  const [easyLines, setEasyLines] = useState<EasyLine[]>([]);
  const [vvicSummary, setVvicSummary] = useState<VvicSummary | null>(null);
  const [vvicMonths, setVvicMonths] = useState<VvicMonth[]>([]);
  const [vvicCustomers, setVvicCustomers] = useState<VvicCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getJSON<Filters>("/api/overview/filters")
      .then((f) => {
        const end = f.max_date || new Date().toISOString().slice(0, 10);
        setFilters(f);
        setEndDate(end);
        setStartDate(yearStartFor(end, f.min_date));
      })
      .catch((e) => setError(`Unable to load executive filters: ${e.message}`));
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    let active = true;
    const params = { start_date: startDate, end_date: endDate };
    setLoading(true);
    setError("");
    Promise.all([
      getJSON<OverviewPayload>("/api/overview/dashboard", params),
      getJSON<Overview02Payload>("/api/overview02/dashboard", params),
      getJSON<MinVsEffPayload>("/api/min-vs-eff/dashboard", params),
      getJSON<ModelSummary>("/api/model-line/summary", params),
      getJSON<ModelLine[]>("/api/model-line/latest-by-line", params),
      getJSON<EasySummary>("/api/easylean/summary", params),
      getJSON<EasyLine[]>("/api/easylean/latest-by-line", params),
      getJSON<VvicSummary>("/api/dashboard/summary", { ...params, customer_type: "VVIC" }),
      getJSON<VvicMonth[]>("/api/dashboard/monthly-comparison", { ...params, customer_type: "ALL" }),
      getJSON<VvicCustomer[]>("/api/dashboard/customer-mtd", { ...params, customer_type: "VVIC", target: String(TARGET) }),
    ]).then(([ov, ov02, mve, ms, ml, es, el, vs, vm, vc]) => {
      if (!active) return;
      setOverview(ov); setOverview02(ov02); setMinVsEff(mve); setModelSummary(ms); setModelLines(ml); setEasySummary(es); setEasyLines(el); setVvicSummary(vs); setVvicMonths(vm); setVvicCustomers(vc);
    }).catch((e) => active && setError(`Unable to load Executive Summary: ${e.message}`)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [startDate, endDate]);

  const factoryMtd = useMemo(() => (overview?.factory_periods ?? [])
    .filter((x) => x.period === "MTD" && x.eff_pct != null)
    .sort((a, b) => FACTORY_ORDER.indexOf(a.factory) - FACTORY_ORDER.indexOf(b.factory)), [overview]);
  const weakFactories = useMemo(() => [...factoryMtd].sort((a, b) => Number(a.eff_pct) - Number(b.eff_pct)).slice(0, 3), [factoryMtd]);
  const weakCustomers = useMemo(() => [...(vvicCustomers ?? [])]
    .filter((x) => x.eff_pct != null)
    .sort((a, b) => Number(a.eff_pct) - Number(b.eff_pct))
    .slice(0, 5)
    .map((x) => ({ name: x.customer, meta: "VVIC customer MTD", value: x.eff_pct, target: TARGET })), [vvicCustomers]);
  const customerVolumes = useMemo(() => new Map((overview02?.vvic_customer ?? [])
    .filter((x) => x.brand_name && x.min_produce != null)
    .map((x) => [x.brand_name as string, Number(x.min_produce)])), [overview02]);
  const topCustomers = useMemo(() => [...(vvicCustomers ?? [])]
    .filter((x) => x.eff_pct != null || x.min_produce != null)
    .map((x) => ({ ...x, min_produce: x.min_produce ?? customerVolumes.get(x.customer) ?? null }))
    .sort((a, b) => {
      const av = num(a.min_produce);
      const bv = num(b.min_produce);
      if (av != null || bv != null) return (bv ?? -1) - (av ?? -1);
      return Number(a.eff_pct) - Number(b.eff_pct);
    })
    .slice(0, 5)
    .map((x) => ({
      name: x.customer,
      meta: x.min_produce == null ? "VVIC customer MTD · waiting for volume" : "VVIC customer MTD",
      eff: x.eff_pct,
      volume: x.min_produce ?? null,
    })), [customerVolumes, vvicCustomers]);
  const weakModelLines = useMemo(() => [...modelLines]
    .filter((x) => x.eff_pct != null)
    .sort((a, b) => Number(a.eff_pct) - Number(b.eff_pct))
    .slice(0, 5)
    .map((x) => ({ name: `${x.model_line} / Line ${x.line}`, meta: `Latest ${x.latest_date}`, value: x.eff_pct, target: LINE_TARGET })), [modelLines]);
  const weakEasyLines = useMemo(() => [...easyLines]
    .filter((x) => x.eff_pct != null)
    .sort((a, b) => Number(a.eff_pct) - Number(b.eff_pct))
    .slice(0, 5)
    .map((x) => ({ name: `${x.factory} / Line ${x.line}`, meta: "Easy Lean latest", value: x.eff_pct, target: TARGET })), [easyLines]);
  const monthlyDelta = useMemo(() => {
    const rows = [...(overview?.monthly ?? [])].filter((x) => x.eff_pct != null).sort((a, b) => a.month.localeCompare(b.month));
    const current = rows.at(-1);
    const previous = rows.at(-2);
    return {
      current: current?.eff_pct ?? null,
      previous: previous?.eff_pct ?? null,
      delta: current && previous ? Number(current.eff_pct) - Number(previous.eff_pct) : null,
      label: current && previous ? `${monthName(current.month)} vs ${monthName(previous.month)}` : "Latest month",
    };
  }, [overview]);
  const vvicDelta = useMemo(() => {
    const rows = [...vvicMonths].filter((x) => x.vvic != null).sort((a, b) => a.month.localeCompare(b.month));
    const current = rows.at(-1);
    const previous = rows.at(-2);
    return {
      current: current?.vvic ?? null,
      previous: previous?.vvic ?? null,
      delta: current && previous ? Number(current.vvic) - Number(previous.vvic) : null,
      label: current && previous ? `${monthName(current.month)} vs ${monthName(previous.month)}` : "Latest month",
    };
  }, [vvicMonths]);
  const factoryDrop = useMemo(() => {
    const rows = overview?.factory_monthly ?? [];
    const months = Array.from(new Set(rows.map((x) => x.month))).sort();
    const currentMonth = months.at(-1);
    const previousMonth = months.at(-2);
    if (!currentMonth || !previousMonth) return null;
    return FACTORY_ORDER.map((factory) => {
      const current = rows.find((x) => x.month === currentMonth && x.factory === factory)?.eff_pct;
      const previous = rows.find((x) => x.month === previousMonth && x.factory === factory)?.eff_pct;
      return current != null && previous != null ? { factory, current, previous, delta: Number(current) - Number(previous) } : null;
    }).filter(Boolean).sort((a: any, b: any) => a.delta - b.delta)[0] as { factory: string; current: number; previous: number; delta: number } | null;
  }, [overview]);
  const impactRows = useMemo(() => [...(minVsEff?.heatmap ?? [])]
    .map((x) => {
      const eff = num(x.eff_pct);
      const volume = num(x.min_produce) ?? 0;
      const gap = eff == null ? 0 : Math.max(0, TARGET - eff);
      return { name: `${x.factory} / ${x.pd_type}`, meta: `${pct(eff)} EFF · ${compact(volume)} min produce`, eff, impact: gap * volume };
    })
    .filter((x) => x.impact > 0)
    .sort((a, b) => b.impact - a.impact), [minVsEff]);
  const actionPriority = useMemo(() => {
    const maxImpact = Math.max(...impactRows.map((x) => x.impact), 1);
    return [
      ...weakFactories.map((x) => ({ name: `Factory ${x.factory}`, meta: "Factory MTD below target", eff: x.eff_pct, score: Math.max(0, TARGET - Number(x.eff_pct)) * 100, valueLabel: "Factory" })),
      ...weakCustomers.map((x) => ({ name: x.name, meta: x.meta, eff: x.value, score: Math.max(0, x.target - Number(x.value)) * 100, valueLabel: "Customer" })),
      ...weakModelLines.map((x) => ({ name: x.name, meta: x.meta, eff: x.value, score: Math.max(0, x.target - Number(x.value)) * 100, valueLabel: "Model" })),
      ...weakEasyLines.map((x) => ({ name: x.name, meta: x.meta, eff: x.value, score: Math.max(0, x.target - Number(x.value)) * 100, valueLabel: "Line" })),
      ...impactRows.slice(0, 5).map((x) => ({ name: x.name, meta: `Weighted by volume · ${x.meta}`, eff: x.eff, score: Math.max(0, TARGET - Number(x.eff)) * 100 + (x.impact / maxImpact) * 20, valueLabel: "Volume" })),
    ].filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  }, [impactRows, weakCustomers, weakEasyLines, weakFactories, weakModelLines]);
  const lossContributors = useMemo(() => impactRows.slice(0, 5).map((x) => ({ ...x, valueLabel: compact(x.impact) })), [impactRows]);

  const trendOption = useMemo(() => ({
    animationDuration: 350,
    color: ["#20b4d4", "#2e5db2"],
    legend: { top: 0, data: ["VVIC", "NON-VVIC"], icon: "circle", itemWidth: 9, itemHeight: 9 },
    grid: { left: 48, right: 20, top: 42, bottom: 42 },
    tooltip: { trigger: "axis", valueFormatter: (v: number) => pct(v) },
    xAxis: { type: "category", data: vvicMonths.map((x) => x.month), axisTick: { show: false }, axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", min: 0, max: 1, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: "#dce6f1", type: "dashed" } } },
    series: [
      { name: "VVIC", type: "line", smooth: 0.2, symbolSize: 6, data: vvicMonths.map((x) => x.vvic), label: { show: true, position: "top", formatter: (p: any) => pct(p.value, 0), fontSize: 9 } },
      { name: "NON-VVIC", type: "line", smooth: 0.2, symbolSize: 6, data: vvicMonths.map((x) => x.non_vvic), label: { show: true, position: "bottom", formatter: (p: any) => pct(p.value, 0), fontSize: 9 } },
    ],
  }), [vvicMonths]);

  const factoryOption = useMemo(() => ({
    animationDuration: 350,
    grid: { left: 42, right: 18, top: 22, bottom: 32 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number) => pct(v) },
    xAxis: { type: "category", data: factoryMtd.map((x) => x.factory), axisTick: { show: false }, axisLabel: { fontWeight: 700 } },
    yAxis: { type: "value", min: 0, max: 1, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: "#e3ebf4" } } },
    series: [{ type: "bar", barMaxWidth: 46, data: factoryMtd.map((x) => ({ value: x.eff_pct, itemStyle: { color: COLORS[x.factory] || "#64748b", borderRadius: [4, 4, 0, 0] } })), label: { show: true, position: "top", formatter: (p: any) => pct(p.value, 1), fontSize: 10, fontWeight: 700 } }],
  }), [factoryMtd]);

  const worstMatrix = useMemo(() => [...(minVsEff?.heatmap ?? [])].filter((x) => x.eff_pct != null).sort((a, b) => Number(a.eff_pct) - Number(b.eff_pct)).slice(0, 5), [minVsEff]);
  const mtd = overview?.kpi_details?.MTD;
  const ytd = overview?.kpi_details?.YTD;
  const latestDate = overview?.latest_date || easySummary?.data_as_of || vvicSummary?.data_as_of || endDate;

  return <main className="ex-page">
    <header className="ex-header">
      <div><h1>Executive Summary</h1><span>Data as of {latestDate}</span></div>
      <label><span>START DATE</span><input type="date" value={startDate} min={filters?.min_date || undefined} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} /></label>
      <label><span>END DATE</span><input type="date" value={endDate} min={startDate || undefined} max={filters?.max_date || undefined} onChange={(e) => setEndDate(e.target.value)} /></label>
      <div className="ex-refresh">REFRESH: {thaiRefresh(overview?.last_refresh || modelSummary?.last_refresh || easySummary?.last_refresh)}</div>
    </header>
    {error && <div className="ex-error">{error}</div>}
    <section className={loading ? "ex-body loading" : "ex-body"}>
      <div className="ex-kpi-grid">
        <KpiTile label="Company MTD EFF%" value={pct(mtd?.eff_pct)} sub={`YTD ${pct(ytd?.eff_pct)} · ${signedPct(monthlyDelta.delta)}`} status={num(mtd?.eff_pct)! >= TARGET ? "good" : "bad"} />
        <KpiTile label="MTD Min Produce" value={compact(mtd?.min_produce)} sub={`PTP ${pct(mtd?.ptp_pct)}`} />
        <KpiTile label="MTD PPH" value={num(mtd?.pph)?.toFixed(2) || "-"} sub="All factories" />
        <KpiTile label="Model-Line EFF%" value={pct(modelSummary?.eff_pct)} sub={`${compact(modelSummary?.min_produce)} min produce`} status={num(modelSummary?.eff_pct)! >= LINE_TARGET ? "good" : "watch"} />
        <KpiTile label="Easy Lean EFF%" value={pct(easySummary?.eff_ezlcard)} sub={`${easySummary?.count_line ?? "-"} active lines`} status={num(easySummary?.eff_ezlcard)! >= TARGET ? "good" : "watch"} />
        <KpiTile label="VVIC MTD EFF%" value={pct(vvicSummary?.mtd_eff_pct)} sub={`QTD ${pct(vvicSummary?.qtd_eff_pct)} · ${signedPct(vvicDelta.delta)}`} status={num(vvicSummary?.mtd_eff_pct)! >= TARGET ? "good" : "bad"} />
      </div>
      <div className="ex-grid">
        <section className="ex-card ex-wide"><h2>VVIC vs Non-VVIC Monthly Trend</h2><ReactECharts option={trendOption} notMerge style={{ height: 292 }} /></section>
        <section className="ex-card"><h2>Factory MTD EFF%</h2><ReactECharts option={factoryOption} notMerge style={{ height: 292 }} /></section>
        <section className="ex-card ex-movement"><h2>MTD vs Last Month</h2><div className="ex-move-grid"><div><span>Company EFF</span><b className={deltaTone(monthlyDelta.delta)}>{signedPct(monthlyDelta.delta)}</b><small>{monthlyDelta.label}</small></div><div><span>VVIC EFF</span><b className={deltaTone(vvicDelta.delta)}>{signedPct(vvicDelta.delta)}</b><small>{vvicDelta.label}</small></div><div><span>Largest Factory Drop</span><b className={factoryDrop ? deltaTone(factoryDrop.delta) : ""}>{factoryDrop ? `${factoryDrop.factory} ${signedPct(factoryDrop.delta)}` : "-"}</b><small>{factoryDrop ? `${pct(factoryDrop.previous)} to ${pct(factoryDrop.current)}` : "No comparable month"}</small></div></div></section>
        <PriorityList title="Executive Action Priority" empty="No weighted priority below target." rows={actionPriority} />
        <PriorityList title="Top Loss Contributors" empty="No loss contribution below target." rows={lossContributors} />
        <RiskList title="Factory Below Target" empty="No factory risk in MTD." rows={weakFactories.map((x) => ({ name: x.factory, meta: "Company MTD EFF%", value: x.eff_pct, target: TARGET }))} />
        <VolumeList title="Customer Attention" empty="No customer volume data." rows={topCustomers} />
        <RiskList title="Model-Line Attention" empty="No model-line risk." rows={weakModelLines} />
        <RiskList title="Easy Lean Line Attention" empty="No Easy Lean line risk." rows={weakEasyLines} />
        <section className="ex-card ex-list"><h2>Product Type / Factory Hotspots</h2>{worstMatrix.map((x) => <div className="ex-risk-row" key={`${x.factory}-${x.pd_type}`}><div><strong>{x.factory} / {x.pd_type}</strong><span>{compact(x.min_produce)} min produce</span></div><b className={(x.eff_pct ?? 0) < TARGET ? "bad" : "good"}>{pct(x.eff_pct)}</b></div>)}</section>
      </div>
    </section>
  </main>;
}
