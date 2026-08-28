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
    tooltip: { trigger: "item", confine: true, formatter: (params: any) => {
      const row = data[params.dataIndex]; if (!row) return "";
      const products=(row.product_types??[]).filter(x=>x.eff_pct!=null).sort((a,b)=>Number(b.eff_pct)-Number(a.eff_pct));
      const maximum=Math.max(...products.map(x=>Number(x.eff_pct)||0),.01);
      const detail=products.length?products.map(x=>{const width=Math.max(5,(Number(x.eff_pct)/maximum)*205);return `<div style="margin-top:9px"><div style="font-size:10px">${esc(x.product_type)}</div><div style="display:flex;align-items:center;gap:9px"><span style="display:block;width:${width}px;max-width:205px;height:15px;background:${colorFor(x.product_type)}"></span><span>${(Number(x.eff_pct)*100).toFixed(1)}%</span></div></div>`}).join(""):"<div style=\"margin-top:8px\">No Product Type data</div>";
      return `<div style="padding:10px;min-width:260px"><div>EFF% by Product Type</div><div style="font-size:10px;margin-top:3px">${esc(row.factory)}</div>${detail}</div>`;
    }},
    grid: { left: 48, right: 58, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: "value", min: 0, max: 1, axisLabel: { formatter: (value: number) => `${Math.round(value * 100)}%` }, splitLine: { lineStyle: { color: "#e7ebf2" } } },
    yAxis: { type: "category", inverse: true, data: data.map((row) => row.factory), axisTick: { show: false }, axisLine: { show: false } },
    series: [{ name: "EFF%", type: "bar", barWidth: 24, data: data.map((row) => { const value=row.eff_pct??0; const active=!selectedFactory||selectedFactory===row.factory; return { value, factory:row.factory, itemStyle:{borderRadius:[0,6,6,0],opacity:active?1:.25,color:value>=.8?"#46b96a":value>=TARGET?"#f1c75b":"#f21d5b"}}; }), label:{show:true,position:"right",color:"#333",fontSize:10,formatter:(params:any)=>`${(Number(params.value)*100).toFixed(1)}%`} }],
  };
  const handleClick=(params:any)=>{if(params.componentType!=="series"||params.seriesType!=="bar")return;const selected=params.data?.factory??data[params.dataIndex]?.factory;if(selected&&onSelect)onSelect(String(selected));};
  return <ReactECharts option={option} notMerge lazyUpdate style={{width:"100%",height:"290px"}} onEvents={{click:handleClick}}/>;
}
