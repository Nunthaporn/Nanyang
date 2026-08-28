import ReactECharts from "echarts-for-react";

export interface FactoryEffRow {
  factory: string;
  eff_pct: number | null;
  product_types?: Array<{ product_type: string; eff_pct: number | null }>;
}

interface Props { data: FactoryEffRow[]; selectedFactory?: string | null; onSelect?: (factory: string) => void; }
const TARGET = 0.65;
const COLORS = ["#1812a8", "#ffd91a", "#ff8b2c", "#16b9c7", "#2c8ce5", "#5bdc20", "#ef4b87", "#8a63d2", "#00a67d", "#d6692f"];
const esc = (v: string) => v.replace(/[&<>"']/g, x => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]!));
const colorFor = (name: string) => { let h=0; for(let i=0;i<name.length;i++) h=((h<<5)-h+name.charCodeAt(i))|0; return COLORS[Math.abs(h)%COLORS.length]; };

export default function HorizontalEffChart({ data, selectedFactory, onSelect }: Props) {
  const option = {
    animationDuration: 250,
    tooltip: {
      trigger: "item",
      confine: true,
      backgroundColor: "#fff",
      borderColor: "#d7dee8",
      borderWidth: 1,
      padding: 0,
      extraCssText: "box-shadow:0 8px 24px rgba(20,35,60,.18);border-radius:4px;max-width:420px;",
      position: (point: number[], _params: any, _dom: HTMLElement, _rect: any, size: any) => {
        const [x, y] = point;
        const contentWidth = Math.min(size.contentSize[0], 420);
        const contentHeight = size.contentSize[1];
        const viewWidth = size.viewSize[0];
        const viewHeight = size.viewSize[1];
        let left = x + 12;
        let top = y - contentHeight / 2;
        if (left + contentWidth > viewWidth - 8) left = x - contentWidth - 12;
        left = Math.max(8, Math.min(left, viewWidth - contentWidth - 8));
        top = Math.max(8, Math.min(top, viewHeight - contentHeight - 8));
        return [left, top];
      },
      formatter: (params: any) => {
        const row = data[params.dataIndex];
        if (!row) return "";
        const products = (row.product_types ?? [])
          .filter(x => x.eff_pct != null && Number.isFinite(Number(x.eff_pct)))
          .sort((a,b) => Number(b.eff_pct) - Number(a.eff_pct));

        if (!products.length) {
          return `<div style="padding:10px 12px;width:250px;box-sizing:border-box"><div style="font-size:12px;font-weight:700;color:#24324a">EFF% by Product Type</div><div style="font-size:10px;color:#7b8799;margin-top:3px">${esc(row.factory)}</div><div style="margin-top:8px;color:#94a3b8;font-size:11px">No Product Type data</div></div>`;
        }

        const columns = products.length > 12 ? 3 : products.length > 6 ? 2 : 1;
        const tooltipWidth = columns === 3 ? 408 : columns === 2 ? 336 : 250;
        const maximum = Math.max(...products.map(x => Number(x.eff_pct) || 0), .01);
        const barMax = columns === 1 ? 120 : columns === 2 ? 78 : 58;
        const detail = products.map(x => {
          const value = Number(x.eff_pct);
          const width = Math.max(6, Math.min(barMax, (value / maximum) * barMax));
          const name = x.product_type || "OTHER";
          return `<div style="min-width:0;padding:5px 6px;border-radius:4px;background:#f8fafc;box-sizing:border-box">
            <div style="font-size:9px;color:#536176;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px" title="${esc(name)}">${esc(name)}</div>
            <div style="display:flex;align-items:center;gap:5px;min-width:0">
              <span style="display:block;flex:0 0 auto;width:${width}px;height:9px;border-radius:2px;background:${colorFor(name)}"></span>
              <b style="font-size:9px;color:#172033;white-space:nowrap">${(value * 100).toFixed(1)}%</b>
            </div>
          </div>`;
        }).join("");

        return `<div style="padding:9px 10px;width:${tooltipWidth}px;max-width:420px;box-sizing:border-box">
          <div style="font-size:12px;font-weight:700;color:#24324a">EFF% by Product Type</div>
          <div style="font-size:10px;color:#7b8799;margin-top:2px;margin-bottom:7px">${esc(row.factory)}</div>
          <div style="display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:5px">${detail}</div>
        </div>`;
      },
    },
    grid: { left: 48, right: 58, top: 36, bottom: 24, containLabel: true },
    xAxis: { type: "value", min: 0, max: 1, axisLabel: { formatter: (value: number) => `${Math.round(value * 100)}%` }, splitLine: { lineStyle: { color: "#e7ebf2" } } },
    yAxis: { type: "category", inverse: true, data: data.map((row) => row.factory), axisTick: { show: false }, axisLine: { show: false } },
    series: [{
      name: "EFF%",
      type: "bar",
      barWidth: 24,
      data: data.map((row) => { const value=row.eff_pct??0; const active=!selectedFactory||selectedFactory===row.factory; return { value, factory:row.factory, itemStyle:{borderRadius:[0,6,6,0],opacity:active?1:.25,color:value>=.8?"#46b96a":value>=TARGET?"#f1c75b":"#f21d5b"}}; }),
      label:{show:true,position:"right",color:"#333",fontSize:10,formatter:(params:any)=>`${(Number(params.value)*100).toFixed(1)}%`},
      markLine:{
        silent:true,
        symbol:"none",
        z:100,
        lineStyle:{color:"#3f67d3",type:"dashed",width:2.5,opacity:1},
        label:{show:true,formatter:"Target 65%",position:"insideStartTop",rotate:0,offset:[0,-5],color:"#2f57b7",fontWeight:700,fontSize:10,padding:[2,5],backgroundColor:"rgba(255,255,255,.96)",borderRadius:3},
        data:[{xAxis:TARGET}]
      }
    }],
  };
  const handleClick=(params:any)=>{if(params.componentType!=="series"||params.seriesType!=="bar")return;const selected=params.data?.factory??data[params.dataIndex]?.factory;if(selected&&onSelect)onSelect(String(selected));};
  return <ReactECharts option={option} notMerge lazyUpdate style={{width:"100%",height:"290px"}} onEvents={{click:handleClick}}/>;
}
