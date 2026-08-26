import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import "./overview.css";

type Filters={min_date:string|null;max_date:string|null;factories:string[]};
type Period="YTD"|"QTD"|"MTD"|"LD";
type PeriodRow={period:Period;factory:string;eff_pct:number};
type KpiDetail={eff_pct:number|null;min_produce:number|null;ptp_pct:number|null;pph:number|null};
type Payload={kpis:Partial<Record<Period,number>>;kpi_details:Partial<Record<Period,KpiDetail>>;factory_periods:PeriodRow[];monthly:{month:string;eff_pct:number}[];last30:{produce_date:string;eff_pct:number}[];factory_monthly:{month:string;factory:string;eff_pct:number}[];latest_date:string|null;last_refresh:string};

const ORDER=["G1","G2","G3","G4","TRM","EA"];
const COLORS:Record<string,string>={G1:"#f04486",G2:"#ffd126",G3:"#ff7917",G4:"#15b7c6",TRM:"#2889dc",EA:"#54df0b"};
const PERIODS:Period[]=["YTD","QTD","MTD","LD"];
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pct=(v:unknown,d=2)=>Number.isFinite(Number(v))?`${(Number(v)*100).toFixed(d)}%`:"-";
const compact=(v:unknown)=>{const n=Number(v);if(!Number.isFinite(n))return "-";if(Math.abs(n)>=1e9)return `${(n/1e9).toFixed(2)}B`;if(Math.abs(n)>=1e6)return `${(n/1e6).toFixed(2)}M`;if(Math.abs(n)>=1e3)return `${(n/1e3).toFixed(1)}K`;return n.toFixed(0)};
const thaiRefresh=(iso?:string)=>{if(!iso)return"";const d=new Date(iso);return Number.isNaN(d.getTime())?"":`${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()+543} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`};
const monthLabel=(v:string)=>{const[y,m]=v.split("-").map(Number);return y&&m?`${MONTHS[m-1]} ${y}`:v};
const dayLabel=(v:string)=>{const[y,m,d]=v.split("-").map(Number);return y&&m&&d?`${MONTHS[m-1]} ${String(d).padStart(2,"0")}`:v};
async function getJSON<T>(path:string,params?:Record<string,string>){const q=new URLSearchParams(params||{});const r=await fetch(`${path}${q.size?`?${q}`:""}`);if(!r.ok)throw new Error(await r.text());return r.json() as Promise<T>}

function KpiCard({period,detail}:{period:Period;detail?:KpiDetail}){
  return <div className="ov-kpi ov-kpi-detail">
    <div className="ov-kpi-top"><span className="ov-kpi-period">{period}</span><b>{pct(detail?.eff_pct)}</b></div>
    <div className="ov-kpi-divider" />
    <div className="ov-kpi-metrics">
      <div><span>{period} Min Produce</span><strong>{compact(detail?.min_produce)}</strong></div>
      <div><span>{period} PTP%</span><strong>{pct(detail?.ptp_pct)}</strong></div>
      <div><span>{period} PPH</span><strong>{Number.isFinite(Number(detail?.pph))?Number(detail?.pph).toFixed(2):"-"}</strong></div>
    </div>
  </div>
}

export default function OverviewDashboard(){
  const[filters,setFilters]=useState<Filters>({min_date:null,max_date:null,factories:[]});
  const[startDate,setStartDate]=useState("2026-01-01");const[endDate,setEndDate]=useState("2026-12-31");const[factory,setFactory]=useState("ALL");
  const[crossFactory,setCrossFactory]=useState<string|null>(null);const[crossStart,setCrossStart]=useState<string|null>(null);const[crossEnd,setCrossEnd]=useState<string|null>(null);
  const[data,setData]=useState<Payload|null>(null);const[error,setError]=useState("");const[loading,setLoading]=useState(false);
  const clearCross=()=>{setCrossFactory(null);setCrossStart(null);setCrossEnd(null)};
  const effectiveStart=crossStart||startDate,effectiveEnd=crossEnd||endDate,effectiveFactory=crossFactory||factory;
  useEffect(()=>{getJSON<Filters>("/api/overview/filters").then(setFilters).catch(e=>setError(`Unable to load Overview filters: ${e.message}`))},[]);
  useEffect(()=>{let active=true;setLoading(true);setError("");const p:Record<string,string>={start_date:effectiveStart,end_date:effectiveEnd};if(effectiveFactory!=="ALL")p.factory=effectiveFactory;getJSON<Payload>("/api/overview/dashboard",p).then(r=>active&&setData(r)).catch(e=>active&&setError(`Unable to load Overview: ${e.message}`)).finally(()=>active&&setLoading(false));return()=>{active=false}},[effectiveStart,effectiveEnd,effectiveFactory]);
  const factories=useMemo(()=>[...(filters.factories.length?filters.factories:ORDER)].sort((a,b)=>(ORDER.indexOf(a)<0?99:ORDER.indexOf(a))-(ORDER.indexOf(b)<0?99:ORDER.indexOf(b))),[filters.factories]);
  const periodRows=useMemo(()=>Object.fromEntries(PERIODS.map(p=>[p,(data?.factory_periods||[]).filter(x=>x.period===p).sort((a,b)=>Number(b.eff_pct)-Number(a.eff_pct))])),[data]);
  const lineOption=(rows:{x:string;y:number}[],kind:"month"|"day")=>{const vals=rows.map(x=>Number(x.y)).filter(Number.isFinite);const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;return{grid:{left:48,right:24,top:34,bottom:44},tooltip:{trigger:"axis",valueFormatter:(v:number)=>pct(v)},xAxis:{type:"category",boundaryGap:false,data:rows.map(x=>x.x),axisLabel:{fontSize:10,formatter:(v:string)=>kind==="month"?monthLabel(v):dayLabel(v)}},yAxis:{type:"value",axisLabel:{formatter:(v:number)=>`${Math.round(v*100)}%`},splitLine:{show:false}},series:[{type:"line",smooth:.22,symbol:"circle",symbolSize:6,lineStyle:{width:2.5,color:"#2864d7"},itemStyle:{color:"#18b56a"},data:rows.map(x=>x.y),label:{show:true,position:"top",fontSize:9,formatter:(p:any)=>p.dataIndex===0||p.dataIndex===rows.length-1?pct(p.value,0):""},markLine:{silent:true,symbol:"none",lineStyle:{color:"#aaa",type:"dashed"},label:{show:false},data:[{yAxis:avg}]}}]}};
  const monthly=data?.monthly||[],last30=data?.last30||[];
  const monthlyOption=useMemo(()=>lineOption(monthly.map(x=>({x:x.month,y:Number(x.eff_pct)})),"month"),[monthly]);
  const last30Option=useMemo(()=>lineOption(last30.map(x=>({x:x.produce_date,y:Number(x.eff_pct)})),"day"),[last30]);
  const ribbonOption=useMemo(()=>{const src=data?.factory_monthly||[];const months=Array.from(new Set(src.map(x=>x.month))).sort();const facs=Array.from(new Set(src.map(x=>x.factory))).sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b));const rank=new Map<string,Map<string,{r:number;e:number}>>();months.forEach(m=>{const rs=src.filter(x=>x.month===m).sort((a,b)=>Number(b.eff_pct)-Number(a.eff_pct));rank.set(m,new Map(rs.map((x,i)=>[x.factory,{r:rs.length-i,e:Number(x.eff_pct)}])))});return{legend:{top:0,data:facs,icon:"circle",itemWidth:9,itemHeight:9},grid:{left:24,right:22,top:40,bottom:38},tooltip:{trigger:"item",formatter:(p:any)=>p.data?`${p.seriesName}<br/>${monthLabel(p.data.month)}<br/>EFF%: ${pct(p.data.e)}`:""},xAxis:{type:"category",data:months,axisLabel:{formatter:(v:string)=>monthLabel(v),fontSize:9}},yAxis:{type:"value",min:.5,max:Math.max(1.5,facs.length+.5),show:false},series:facs.map(f=>({name:f,type:"line",smooth:.42,symbol:"roundRect",symbolSize:[58,18],lineStyle:{width:16,color:COLORS[f],opacity:crossFactory&&crossFactory!==f?.14:.72},itemStyle:{color:COLORS[f]},data:months.map(m=>{const x=rank.get(m)?.get(f);return x?{value:x.r,e:x.e,month:m,label:{show:true,position:"inside",formatter:`${(x.e*100).toFixed(1)}%`,fontSize:8,fontWeight:700}}:null})}))}},[data,crossFactory]);
  const selectMonth=(i:number)=>{const r=monthly[i];if(!r)return;const[y,m]=r.month.split("-").map(Number);const s=`${y}-${String(m).padStart(2,"0")}-01`,e=`${y}-${String(m).padStart(2,"0")}-${String(new Date(y,m,0).getDate()).padStart(2,"0")}`;const ss=s<startDate?startDate:s,ee=e>endDate?endDate:e;if(crossStart===ss&&crossEnd===ee){setCrossStart(null);setCrossEnd(null)}else{setCrossStart(ss);setCrossEnd(ee)}};
  const selectDay=(i:number)=>{const d=last30[i]?.produce_date;if(!d)return;if(crossStart===d&&crossEnd===d){setCrossStart(null);setCrossEnd(null)}else{setCrossStart(d);setCrossEnd(d)}};
  const toggleFactory=(f:string)=>setCrossFactory(v=>v===f?null:f);const hasCross=!!(crossFactory||crossStart||crossEnd);
  return <div className="ov-page">
    <section className="ov-header"><h1>OVERVIEW</h1>
      <label><span>START DATE</span><input type="date" value={startDate} min={filters.min_date||undefined} max={endDate} onChange={e=>{setStartDate(e.target.value);clearCross()}}/></label>
      <label><span>END DATE</span><input type="date" value={endDate} min={startDate} max={filters.max_date||undefined} onChange={e=>{setEndDate(e.target.value);clearCross()}}/></label>
      <div className="ov-factories">{["ALL",...factories].map(f=><button key={f} className={factory===f?"active":""} onClick={()=>{setFactory(f);clearCross()}}>{f}</button>)}</div>
      <div className="ov-refresh">REFRESH: {thaiRefresh(data?.last_refresh)}{hasCross?<button onClick={clearCross} style={{marginLeft:10}}>CLEAR FILTER</button>:null}</div>
    </section>
    {error&&<div className="ov-error">{error}</div>}
    <main className={loading?"ov-body loading":"ov-body"}>
      <section className="ov-kpis">{PERIODS.map(p=><KpiCard key={p} period={p} detail={data?.kpi_details?.[p]}/>)}</section>
      <section className="ov-grid">
        <article className="ov-card ov-period-card"><div className="ov-section-title">EFF% by FACTORY — YTD / QTD / MTD / LD</div><div className="ov-period-table">{PERIODS.map(p=><div className="ov-period-row" key={p}><strong>{p}</strong><div className="ov-period-cells">{(periodRows[p]||[]).map((r:PeriodRow)=><button className="ov-period-cell" key={`${p}-${r.factory}`} onClick={()=>toggleFactory(r.factory)} style={{background:COLORS[r.factory]||"#dbe5f0",opacity:crossFactory&&crossFactory!==r.factory?.25:1}}><span>{r.factory}</span><b>{pct(r.eff_pct)}</b></button>)}</div></div>)}</div></article>
        <article className="ov-card"><div className="ov-section-title">Overall monthly EFF% trend</div><ReactECharts option={monthlyOption} style={{height:265}} notMerge onEvents={{click:(p:any)=>selectMonth(p.dataIndex)}}/></article>
        <article className="ov-card"><div className="ov-section-title">Overall last 30Days EFF%</div><ReactECharts option={last30Option} style={{height:265}} notMerge onEvents={{click:(p:any)=>selectDay(p.dataIndex)}}/></article>
        <article className="ov-card"><div className="ov-section-title">Monthly EFF% by FACTORY</div><ReactECharts option={ribbonOption} style={{height:265}} notMerge onEvents={{click:(p:any)=>p.seriesName&&toggleFactory(p.seriesName)}}/></article>
      </section>
    </main>
  </div>
}
