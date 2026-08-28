import ReactECharts from "echarts-for-react";

interface ProductTypeEff {
  product_type: string;
  eff_pct: number | null;
}

export interface LatestLineRow {
  factory: string | null;
  line: string;
  eff_pct: number | null;
  product_types?: ProductTypeEff[];
}

interface Props {
  data: LatestLineRow[];
  selectedLine?: string | null;
  onSelect?: (line: string, factory: string | null) => void;
}

const TARGET = 0.65;
const FACTORY_ORDER = ["G1", "G2", "G3", "G4", "TRM", "EA"];
const PRODUCT_COLORS = ["#00a67d", "#5bdc20", "#2c8ce5", "#16b9c7", "#1812a8", "#ffd91a", "#ff8b2c", "#ef4b87", "#8a63d2", "#d6692f"];

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] ?? char));

const productColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return PRODUCT_COLORS[Math.abs(hash) % PRODUCT_COLORS.length];
};

function productTypeHtml(row: LatestLineRow) {
  const productTypes = (row.product_types ?? [])
    .filter((item) => item.eff_pct != null && Number.isFinite(Number(item.eff_pct)))
    .sort((a, b) => Number(b.eff_pct) - Number(a.eff_pct));

  const subtitle = `${esc(row.factory ?? "-")} · Line ${esc(String(row.line))}`;
  if (!productTypes.length) {
    return `<div style="padding:12px 14px;min-width:260px"><div style="font-size:12px;font-weight:700;color:#24324a">EFF% by Product Type</div><div style="font-size:10px;color:#7b8799;margin-top:5px">${subtitle}</div><div style="margin-top:12px;color:#94a3b8;font-size:11px">No Product Type data</div></div>`;
  }

  const maximum = Math.max(...productTypes.map((item) => Number(item.eff_pct) || 0), 0.01);
  const rows = productTypes.map((item) => {
    const value = Number(item.eff_pct);
    const width = Math.max(8, Math.min(205, (value / maximum) * 205));
    const name = item.product_type || "OTHER";
    return `<div style="margin-top:13px"><div style="font-size:10px;color:#536176;margin-bottom:6px">${esc(name)}</div><div style="display:flex;align-items:center;gap:9px"><span style="display:block;width:${width}px;max-width:205px;height:15px;border-radius:2px;background:${productColor(name)}"></span><b style="font-size:11px;color:#172033;white-space:nowrap">${(value * 100).toFixed(1)}%</b></div></div>`;
  }).join("");

  return `<div style="padding:12px 14px;min-width:270px"><div style="font-size:12px;font-weight:700;color:#24324a">EFF% by Product Type</div><div style="font-size:10px;color:#7b8799;margin-top:5px">${subtitle}</div>${rows}</div>`;
}

export default function LatestLineChart({ data, selectedLine, onSelect }: Props) {
  const sortedData = [...data]
    .filter((row) => {
      const factory = String(row.factory ?? "").trim().toUpperCase();
      return FACTORY_ORDER.includes(factory)
        && row.eff_pct != null
        && Number.isFinite(Number(row.eff_pct))
        && Number(row.eff_pct) > 0
        && String(row.line ?? "").trim() !== "";
    })
    .map((row) => ({ ...row, factory: String(row.factory ?? "").trim().toUpperCase() }))
    .sort((a, b) => {
      const ai = FACTORY_ORDER.indexOf(a.factory ?? "");
      const bi = FACTORY_ORDER.indexOf(b.factory ?? "");
      if (ai !== bi) return ai - bi;
      return String(a.line).localeCompare(String(b.line), undefined, { numeric: true });
    });

  const categoryKeys = sortedData.map((row, index) => `${row.factory ?? "-"}|${row.line}|${index}`);
  const factoryAxisLabels = sortedData.map(() => "");
  FACTORY_ORDER.forEach((factory) => {
    const indexes = sortedData
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => (row.factory ?? "-") === factory)
      .map(({ index }) => index);
    if (indexes.length) factoryAxisLabels[indexes[Math.floor(indexes.length / 2)]] = factory;
  });

  const boundaries = sortedData
    .map((row, index) => {
      if (index >= sortedData.length - 1) return null;
      return (row.factory ?? "-") !== (sortedData[index + 1]?.factory ?? "-") ? index + 0.5 : null;
    })
    .filter((value): value is number => value != null);

  const option = {
    animationDuration: 250,
    tooltip: {
      trigger: "item",
      confine: true,
      backgroundColor: "#fff",
      borderColor: "#d7dee8",
      borderWidth: 1,
      padding: 0,
      extraCssText: "box-shadow:0 8px 24px rgba(20,35,60,.18);border-radius:4px;",
      formatter: (params: any) => {
        if (params.seriesName === "__factory_separator__") return "";
        const row = sortedData[params.dataIndex];
        return row ? productTypeHtml(row) : "";
      },
    },
    grid: { left: 48, right: 22, top: 48, bottom: 62, containLabel: true },
    xAxis: [
      {
        type: "category",
        data: categoryKeys,
        boundaryGap: true,
        axisTick: { show: false },
        axisLine: { show: true, lineStyle: { color: "#cfd6e2" } },
        axisLabel: { interval: 0, fontSize: 10, color: "#555", margin: 7, formatter: (value: string) => value.split("|")[1] ?? value },
      },
      {
        type: "category",
        data: factoryAxisLabels,
        position: "bottom",
        offset: 25,
        boundaryGap: true,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { interval: 0, fontSize: 11, fontWeight: 600, color: "#606773", margin: 3 },
      },
      {
        type: "value",
        min: -0.5,
        max: sortedData.length > 0 ? sortedData.length - 0.5 : 0.5,
        show: false,
      },
    ],
    yAxis: {
      type: "value",
      min: 0,
      max: (value: any) => value.max <= 1 ? 1 : Math.ceil(value.max * 10) / 10,
      axisLabel: { formatter: (value: number) => `${Math.round(value * 100)}%` },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: "#e8ecf2", width: 1 } },
    },
    series: [
      {
        name: "EFF%",
        type: "bar",
        xAxisIndex: 0,
        barMaxWidth: 28,
        barCategoryGap: "20%",
        data: sortedData.map((row) => {
          const value = Number(row.eff_pct);
          const active = !selectedLine || selectedLine === row.line;
          return {
            value,
            itemStyle: {
              borderRadius: [5, 5, 0, 0],
              opacity: active ? 1 : 0.3,
              color: value >= 0.8 ? "#45bd69" : value >= TARGET ? "#f4cc73" : "#f31b58",
            },
          };
        }),
        label: {
          show: true,
          position: "top",
          distance: 3,
          fontSize: 10,
          color: "#333",
          formatter: (params: any) => `${Math.round(Number(params.value) * 100)}%`,
        },
        markLine: {
          silent: true,
          symbol: "none",
          z: 100,
          lineStyle: { color: "#3f67d3", type: "dashed", width: 2.5, opacity: 1 },
          label: { show: true, formatter: "Target 65%", position: "insideEndTop", distance: 4, color: "#2f57b7", fontWeight: 700, fontSize: 10, padding: [2, 5], backgroundColor: "rgba(255,255,255,.96)", borderRadius: 3 },
          data: [{ yAxis: TARGET }],
        },
      },
      {
        name: "__factory_separator__",
        type: "line",
        xAxisIndex: 2,
        silent: true,
        symbol: "none",
        lineStyle: { opacity: 0 },
        data: [],
        markLine: {
          silent: true,
          symbol: "none",
          label: { show: false },
          data: boundaries.map((x) => ({
            xAxis: x,
            lineStyle: { color: "#b8c1cd", type: "dashed", width: 1, opacity: 0.65 },
          })),
        },
      },
    ],
  };

  const handleClick = (params: any) => {
    if (params.componentType !== "series" || params.seriesType !== "bar") return;
    const row = sortedData[params.dataIndex];
    if (row && onSelect) onSelect(String(row.line), row.factory);
  };

  return <ReactECharts option={option} notMerge lazyUpdate style={{ width: "100%", height: "290px" }} onEvents={{ click: handleClick }} />;
}
