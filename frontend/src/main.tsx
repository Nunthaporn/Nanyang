import React from "react";
import ReactDOM from "react-dom/client";
import * as echarts from "echarts";
import App from "./App";
import "./shell.css";
import "./vvic-overrides.css";
import "./easy-lean-overrides.css";
import "./easy-lean-title-position.css";
import "./dashboard-header-unified.css";
import "./vvic-header-fix.css";

// One visual standard for every Target reference line in every dashboard tab.
// This runs before ECharts renders each option, so local chart settings cannot
// leave Target lines/text with different thicknesses, font weights or colors.
const TARGET_LINE_BLUE = "#3f67d3";
const TARGET_TEXT_BLUE = "#2f57b7";

const isTargetMarkLine = (markLine: any) => {
  const formatter = markLine?.label?.formatter;
  if (typeof formatter === "string" && /target/i.test(formatter)) return true;

  const data = Array.isArray(markLine?.data) ? markLine.data : [];
  return data.some((item: any) => {
    const name = typeof item?.name === "string" ? item.name : "";
    const itemFormatter = item?.label?.formatter;
    return /target/i.test(name) || (typeof itemFormatter === "string" && /target/i.test(itemFormatter));
  });
};

const normalizeTargetSeries = (series: any) => {
  const list = Array.isArray(series) ? series : series ? [series] : [];
  list.forEach((item: any) => {
    const markLine = item?.markLine;
    if (!markLine || !isTargetMarkLine(markLine)) return;

    markLine.silent = true;
    markLine.symbol = "none";
    markLine.lineStyle = {
      ...(markLine.lineStyle ?? {}),
      color: TARGET_LINE_BLUE,
      type: "dashed",
      width: 2,
      opacity: 1,
    };
    markLine.label = {
      ...(markLine.label ?? {}),
      show: true,
      color: TARGET_TEXT_BLUE,
      fontSize: 10,
      fontWeight: 700,
      backgroundColor: "rgba(255,255,255,.96)",
      padding: [2, 5],
      borderRadius: 3,
    };

    // A data item can override markLine-level styles, so normalize Target data
    // items too when they contain their own lineStyle/label definitions.
    if (Array.isArray(markLine.data)) {
      markLine.data.forEach((dataItem: any) => {
        if (!dataItem || typeof dataItem !== "object") return;
        if (dataItem.lineStyle) {
          dataItem.lineStyle = {
            ...dataItem.lineStyle,
            color: TARGET_LINE_BLUE,
            type: "dashed",
            width: 2,
            opacity: 1,
          };
        }
        if (dataItem.label) {
          dataItem.label = {
            ...dataItem.label,
            color: TARGET_TEXT_BLUE,
            fontSize: 10,
            fontWeight: 700,
            backgroundColor: "rgba(255,255,255,.96)",
            padding: [2, 5],
            borderRadius: 3,
          };
        }
      });
    }
  });
};

// Supported ECharts hook: apply the same Target styling to every option,
// including options created later by filters/cross-filter interactions.
echarts.registerPreprocessor((option: any) => {
  if (!option || typeof option !== "object") return;
  normalizeTargetSeries(option.series);
  normalizeTargetSeries(option.baseOption?.series);
  if (Array.isArray(option.options)) {
    option.options.forEach((item: any) => normalizeTargetSeries(item?.series));
  }
  if (Array.isArray(option.media)) {
    option.media.forEach((item: any) => normalizeTargetSeries(item?.option?.series));
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
