import ReactECharts from "echarts-for-react";

type Row = { period: string; factory: string; eff_pct: number | null };
type Props = { data: Row[]; mode?: "monthly" | "daily"; selectedFactory?: string | null; onFactorySelect?: (factory: string) => void };
const FACTORY_ORDER = ["G1","G2","G3","G4","TRM","EA"];
const COLORS: Record<string,string> = { G1:"#f04486",G2:"#ffd126",G3:"#ff7917",G4:"#15b7c6",TRM:"#2889dc",EA:"#54df0b" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pct=(value:number|null|undefined)=>value==null?"-":`${(value*100).toFixed(1)}%`;
const formatYearMonthTooltip=(period:string)=>{
  const [year,month]=period.split("-");
  const monthName=MONTHS[Math.max(0,Number(month)-1)] ?? month;
  return year&&month ? `${year} ${monthName} ${year}` : period;
};
const formatMonthDateTooltip=(period:string)=>{
  const [year,month,day]=period.split("-");
  if(!year||!month||!day) return period;
  const monthName=MONTHS[Math.max(0,Number(month)-1)] ?? month;
  return `${monthName} ${year} ${Number(day)}/${Number(month)}/${year.slice(-2)}`;
};

export default function RibbonLikeChart({data,mode="monthly",selectedFactory,onFactorySelect}:Props){
  const periods=Array.from(new Set(data.map(r=>r.period))).sort();
  const factories=FACTORY_ORDER.filter(f=>data.some(r=>r.factory===f));
  const valueMap=new Map<string,number|null>(); data.forEach(r=>valueMap.set(`${r.period}__${r.factory}`,r.eff_pct));
  const rankMap=new Map<string,number>();
  periods.forEach(period=>{
    factories.map(factory=>({factory,value:valueMap.get(`${period}__${factory}`)??null}))
      .filter(x=>x.value!=null).sort((a,b)=>Number(b.value)-Number(a.value))
      .forEach((x,i)=>rankMap.set(`${period}__${x.factory}`,i+1));
  });
  const series=factories.map(factory=>{
    const active=!selectedFactory||selectedFactory===factory; const color=COLORS[factory]??"#64748b";
    return {name:factory,type:"line",smooth:.48,connectNulls:true,symbol:"roundRect",symbolSize:[76,28],showSymbol:true,z:active?5:2,
      lineStyle:{width:20,color,opacity:active ? .58 : .12,cap:"round",join:"round"},itemStyle:{color,opacity:active?1:.2,borderWidth:0},
      label:{show:true,position:"inside",color:factory==="G2"||factory==="G3"||factory==="EA"?"#111827":"#fff",fontSize:10,fontWeight:700,formatter:(p:any)=>pct(p?.data?.eff)},
      data:periods.map(period=>{const eff=valueMap.get(`${period}__${factory}`)??null;const rank=rankMap.get(`${period}__${factory}`);return eff==null||rank==null?null:{value:rank,eff,period,factory};})};
  });
  const option={animationDuration:650,legend:{top:0,left:"center",data:factories,itemWidth:11,itemHeight:11,itemGap:14},grid:{left:16,right:16,top:42,bottom:34,containLabel:true},
    tooltip:{trigger:"item",confine:true,formatter:(param:any)=>{
      const row=param?.data; if(!row||row.eff==null)return "";
      if(mode==="monthly") return `<div style="min-width:210px;font-size:12px;line-height:1.8"><div>Year Month&nbsp;&nbsp;&nbsp;${formatYearMonthTooltip(String(row.period))}</div><div>EasyLean Fac&nbsp;&nbsp;&nbsp;${row.factory}</div><div>EFF%&nbsp;&nbsp;&nbsp;${pct(row.eff)}</div></div>`;
      return `<div style="min-width:225px;font-size:12px;line-height:1.8"><div>Month Date&nbsp;&nbsp;&nbsp;${formatMonthDateTooltip(String(row.period))}</div><div>EasyLean Fac&nbsp;&nbsp;&nbsp;${row.factory}</div><div>EFF%&nbsp;&nbsp;&nbsp;${pct(row.eff)}</div></div>`;
    }},
    xAxis:{type:"category",boundaryGap:true,data:periods,axisTick:{show:false},axisLabel:{fontSize:10,formatter:(v:string)=>mode==="monthly"?v:v.slice(5)}},
    yAxis:{type:"value",inverse:true,min:.45,max:Math.max(factories.length+.55,2),interval:1,axisLabel:{show:false},axisTick:{show:false},axisLine:{show:false},splitLine:{show:true,lineStyle:{color:"#edf1f5",type:"dashed"}}},series};
  return <ReactECharts option={option} notMerge lazyUpdate style={{width:"100%",height:"300px"}} onEvents={{click:(p:any)=>p.seriesName&&onFactorySelect?.(String(p.seriesName))}}/>;
}
