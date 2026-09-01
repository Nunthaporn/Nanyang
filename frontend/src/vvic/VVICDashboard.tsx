import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { BarChart3 } from "lucide-react";
import { getJSON } from "./api";
import { customerOption, factoryOption, lineOption } from "./charts";
import type { Customer, CustomerFactory, Factory, FactoryProduct, Filters, Month, Summary } from "./types";
import "./styles.css";

const FACTORIES=["G1","G2","G3","G4","TRM","EA"];
const fmt=(x:number|null|undefined)=>x==null?"N/A":`${(x*100).toFixed(2)}%`;
type Cross={month:string|null;factory:string|null;customer:string|null};

export default function VVICDashboard(){
  const defaults:Filters={start_date:"2026-01-01",end_date:"2026-12-31",customer_type:"VVIC",factory:[],customer:null};
  const[f,setF]=useState<Filters>(defaults);
  const[cross,setCross]=useState<Cross>({month:null,factory:null,customer:null});
  const[summary,setSummary]=useState<Summary|null>(null);
  const[monthly,setMonthly]=useState<Month[]>([]);
  const[factory,setFactory]=useState<Factory[]>([]);
  const[factoryProducts,setFactoryProducts]=useState<FactoryProduct[]>([]);
  const[customers,setCustomers]=useState<Customer[]>([]);
  const[customerFactories,setCustomerFactories]=useState<CustomerFactory[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[refresh,setRefresh]=useState(0);
  const abort=useRef<AbortController|undefined>(undefined);
  const target=.60;

  const effective=useMemo<Filters>(()=>{
    const next:Filters={...f,factory:cross.factory?[cross.factory]:f.factory,customer:cross.customer??f.customer};
    if(cross.month){const[y,m]=cross.month.split("-").map(Number);next.start_date=`${y}-${String(m).padStart(2,"0")}-01`;next.end_date=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}
    return next;
  },[f,cross]);

  const trendFilters=useMemo<Filters>(()=>{
    const next:Filters={...f,customer_type:"ALL",factory:cross.factory?[cross.factory]:f.factory,customer:null};
    if(cross.month){const[y,m]=cross.month.split("-").map(Number);next.start_date=`${y}-${String(m).padStart(2,"0")}-01`;next.end_date=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}
    return next;
  },[f,cross.month,cross.factory]);

  const customerFilters=useMemo<Filters>(()=>cross.customer?f:effective,[f,effective,cross.customer]);

  useEffect(()=>{
    abort.current?.abort();const c=new AbortController();abort.current=c;setLoading(true);setError("");
    Promise.all([
      getJSON<Summary>("/api/dashboard/summary",effective,c.signal),
      getJSON<Month[]>("/api/dashboard/monthly-comparison",trendFilters,c.signal),
      getJSON<Factory[]>("/api/dashboard/factory-monthly",effective,c.signal),
      getJSON<FactoryProduct[]>("/api/dashboard/factory-product-breakdown",effective,c.signal),
      getJSON<Customer[]>("/api/dashboard/customer-mtd",customerFilters,c.signal,{target:String(target)}),
      getJSON<CustomerFactory[]>("/api/dashboard/customer-factory-mtd",customerFilters,c.signal),
    ]).then(([s,m,fa,fp,cu,cf])=>{setSummary(s);setMonthly(m);setFactory(fa);setFactoryProducts(fp);setCustomers(cu);setCustomerFactories(cf);})
      .catch(e=>{if(e.name!=="AbortError")setError(e.message);})
      .finally(()=>{if(!c.signal.aborted)setLoading(false);});
    return()=>c.abort();
  },[effective,trendFilters,customerFilters,refresh]);

  const clear=()=>setCross({month:null,factory:null,customer:null});
  const selectFactory=(x:string)=>{clear();setF(v=>({...v,factory:x==="ALL"?[]:[x]}));};
  const toggleMonth=(month:string)=>setCross(v=>v.month===month?{month:null,factory:null,customer:null}:{month,factory:null,customer:null});
  const toggleFactoryPoint=(month:string,name:string)=>setCross(v=>v.month===month&&v.factory===name?{month:null,factory:null,customer:null}:{month,factory:name,customer:null});
  const toggleCustomer=(name:string)=>setCross(v=>v.customer===name?{month:null,factory:null,customer:null}:{month:null,factory:null,customer:name});

  const filterLabel=[cross.month,cross.factory,cross.customer].filter(Boolean).join(" · ");

  return <div className="vvic-page"><main className="vvic-main">
    <header className="vvic-header">
      <div><h1>VVIC</h1></div>
      <label>CUSTOMER TYPE<select value={f.customer_type} onChange={e=>{clear();setF(v=>({...v,customer_type:e.target.value}));}}><option value="VVIC">VVIC</option><option value="NON-VVIC">NON-VVIC</option></select></label>
      <label>START DATE<input type="date" value={f.start_date} onChange={e=>{clear();setF(v=>({...v,start_date:e.target.value}));}}/></label>
      <label>END DATE<input type="date" value={f.end_date} onChange={e=>{clear();setF(v=>({...v,end_date:e.target.value}));}}/></label>
      <div className="vvic-factories"><button className={!f.factory.length?"sel":""} onClick={()=>selectFactory("ALL")}>ALL</button>{FACTORIES.map(x=><button key={x} className={f.factory[0]===x?"sel":""} onClick={()=>selectFactory(x)}>{x}</button>)}</div>
      <div className="vvic-refresh-time">REFRESH: {summary?new Intl.DateTimeFormat("th-TH",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(summary.last_refresh)):"—"}</div>
    </header>

    <div className="vvic-status">{filterLabel}{filterLabel&&<button className="vvic-clear-filter" onClick={clear}>CLEAR SELECTION</button>}</div>
    {error&&<div className="vvic-error"><b>{error}</b><button onClick={()=>setRefresh(x=>x+1)}>ลองใหม่</button></div>}

    <section className="vvic-grid-layout">
      <div className="vvic-left">
        <div className="vvic-kpis">{[["YTD EFF%",summary?.ytd_eff_pct],["QTD EFF%",summary?.qtd_eff_pct],["MTD EFF%",summary?.mtd_eff_pct]].map(([name,val])=><article className="vvic-kpi" key={name as string}><em/><span>{name as string}</span><b>{loading?<span className="vvic-skeleton vvic-wide"/>:fmt(val as number|null)}</b></article>)}</div>
        <article className="vvic-card vvic-trend vvic-clickable"><div className="vvic-card-title"><div><span>PERFORMANCE TREND</span><h2>EFF% by Month — VVIC vs Non-VVIC</h2></div></div>{loading?<div className="vvic-skeleton vvic-chart"/>:<ReactECharts option={lineOption(monthly,cross.month)} onEvents={{click:(p:any)=>p?.name&&toggleMonth(String(p.name))}} style={{height:420}}/>}</article>
      </div>

      <div className="vvic-right">
        <article className="vvic-card vvic-factory-card vvic-clickable"><div className="vvic-card-title"><div><span>FACTORY VIEW</span><h2>Monthly EFF% by FACTORY and by VVIC</h2></div></div>{loading?<div className="vvic-skeleton vvic-chart"/>:<ReactECharts option={factoryOption(factory,factoryProducts,cross.month?{month:cross.month,factory:cross.factory}:null)} onEvents={{click:(p:any)=>{const month=p?.value?.[0]??p?.name;const factoryName=p?.seriesName;if(month&&factoryName)toggleFactoryPoint(String(month),String(factoryName));}}} style={{height:265}}/>}</article>
        <article className="vvic-card vvic-customer-card vvic-clickable"><div className="vvic-card-title"><div><span>BRAND RANKING</span><h2>MTD EFF% by VVIC</h2></div></div>{!loading&&!customers.length?<div className="vvic-empty"><BarChart3/>ไม่พบข้อมูลในช่วงที่เลือก</div>:loading?<div className="vvic-skeleton vvic-chart"/>:<div className="vvic-customer-scroll"><ReactECharts option={customerOption(customers,customerFactories,target,cross.customer)} onEvents={{click:(p:any)=>p?.name&&toggleCustomer(String(p.name))}} style={{height:Math.max(310,customers.length*44),width:"100%"}}/></div>}</article>
      </div>
    </section>
  </main></div>;
}
