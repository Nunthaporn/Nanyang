import ReactECharts from "echarts-for-react";

export interface FactoryEffRow {
  factory: string;
  eff_pct: number | null;
}

interface Props {
  data: FactoryEffRow[];
  selectedFactory?: string | null;
  onSelect?: (factory: string) => void;
}

const TARGET = 0.65;

export default function HorizontalEffChart({ data, selectedFactory, onSelect }: Props) {
  const option = {
    animationDuration: 250,
    tooltip: {
      trigger: "item",
      formatter: (params: any) => {
        const row = data[params.dataIndex];
        if (!row) return "";
        const eff = row.eff_pct ?? 0;
        const status = eff >= 0.8 ? "Excellent" : eff >= TARGET ? "Above Target" : "Below Target";
        return `<strong>${row.factory}</strong><br/>EFF: ${(eff * 100).toFixed(1)}%<br/>Target: 65.0%<br/>Status: ${status}`;
      },
    },
    grid: { left: 50, right: 55, top: 15, bottom: 35, containLabel: true },
    xAxis: {
      type: "value",
      min: 0,
      max: 1,
      axisLabel: { formatter: (value: number) => `${Math.round(value * 100)}%` },
      splitLine: { lineStyle: { color: "#e7ebf2" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: data.map((row) => row.factory),
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        name: "EFF%",
        type: "bar",
        barWidth: 24,
        data: data.map((row) => {
          const value = row.eff_pct ?? 0;
          const active = !selectedFactory || selectedFactory === row.factory;
          return {
            value,
            factory: row.factory,
            itemStyle: {
              borderRadius: [0, 6, 6, 0],
              opacity: active ? 1 : 0.25,
              color: value >= 0.8 ? "#46b96a" : value >= TARGET ? "#f1c75b" : "#f21d5b",
            },
          };
        }),
        label: {
          show: true,
          position: "right",
          formatter: (params: any) => `${(Number(params.value) * 100).toFixed(1)}%`,
        },
        markLine: {
          silent: true,
          symbol: "none",
          data: [{ xAxis: TARGET, label: { formatter: "Target 65%", position: "end" } }],
          lineStyle: { type: "dashed", width: 2, color: "#5275d5" },
        },
      },
    ],
  };

  const handleClick = (params: any) => {
    if (params.componentType !== "series" || params.seriesType !== "bar") return;
    const selected = params.data?.factory ?? data[params.dataIndex]?.factory;
    if (selected && onSelect) onSelect(String(selected));
  };

  return (
    <ReactECharts
      option={option}
      notMerge
      lazyUpdate
      style={{ width: "100%", height: "290px" }}
      onEvents={{ click: handleClick }}
    />
  );
}
