import React from "react";
import ReactDOM from "react-dom/client";
import * as echarts from "echarts";
import App from "./App";
import "./shell.css";
import "./vvic-overrides.css";
import "./easy-lean-overrides.css";
import "./easy-lean-title-position.css";
import "./dashboard-header-unified.css";

// Keep every ECharts Target reference visually consistent across all tabs.
// Some local chart options omitted label.color, so ECharts fell back to black.
const TARGET_LINE_BLUE = "#3f67d3";
const TARGET_TEXT_BLUE = "#2f57b7";

const normalizeTargetMarkLines = (option: any) => {
  if (!option || typeof option !== "object") return;

  const normalizeSeries = (series: any) => {
    const list = Array.isArray(series) ? series : series ? [series] : [];
    list.forEach((item: any) => {
      const markLine = item?.markLine;
      if (!markLine) return;

      const formatter = markLine?.label?.formatter;
      const isTarget = typeof formatter === "string" && /target/i.test(formatter);
      if (!isTarget) return;

      markLine.lineStyle = {
        ...(markLine.lineStyle ?? {}),
        color: TARGET_LINE_BLUE,
      };
      markLine.label = {
        ...(markLine.label ?? {}),
        show: true,
        color: TARGET_TEXT_BLUE,
        fontWeight: 700,
      };
    });
  };

  normalizeSeries(option.series);
  normalizeSeries(option.baseOption?.series);
  if (Array.isArray(option.options)) option.options.forEach((item: any) => normalizeSeries(item?.series));
  if (Array.isArray(option.media)) option.media.forEach((item: any) => normalizeSeries(item?.option?.series));
};

const EChartsCtor = (echarts as any).ECharts;
if (EChartsCtor?.prototype && !EChartsCtor.prototype.__nanyangTargetBluePatched) {
  const originalSetOption = EChartsCtor.prototype.setOption;
  EChartsCtor.prototype.setOption = function (option: any, ...args: any[]) {
    normalizeTargetMarkLines(option);
    return originalSetOption.call(this, option, ...args);
  };
  EChartsCtor.prototype.__nanyangTargetBluePatched = true;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
