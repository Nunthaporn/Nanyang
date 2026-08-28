import type { EChartsOption } from "echarts";
import type { Customer, CustomerFactory, Factory, FactoryProduct, Month } from "./types";

export const colors:Record<string,string>={G1:"#f04486",G2:"#ffd126",G3:"#ff7917",G4:"#15b7c6",TRM:"#2889dc",EA:"#54df0b"};
const PRODUCT_COLORS=["#1812a8","#ffd91a","#ff8b2c","#16b9c7","#2c8ce5","#5bdc20","#ef4b87","#8a63d2","#00a67d","#d6692f"];
const pct=(v:number|null|undefined)=>v==null?"N/A":`${(v*100).toFixed(1)}%`;
const esc=(value:string)=>value.replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]!));
const productColor=(name:string)=>{let hash=0;for(let i=0;i<name.length;i++)hash=((hash<<5)-hash+name.charCodeAt(i))|0;return PRODUCT_COLORS[Math.abs(hash)%PRODUCT_COLORS.length]};

export const lineOption=(d:Month[],selectedMonth:string|null):EChartsOption=>({
  color:["#20b4d4","#2e5db2"],legend:{show:false},
  tooltip:{trigger:"axis",confine:true,axisPointer:{type:"line",lineStyle:{type:"dashed"}},formatter:(params:any)=>{
    const rows=Array.isArray(params)?params:[params];const month=rows[0]?.axisValueLabel??rows[0]?.name??"";
    const vv=rows.find((x:any)=>x.seriesName==="VVIC")?.value;const nv=rows.find((x:any)=>x.seriesName==="NON-VVIC")?.value;
    return `<div style="min-width:150px;padding:4px 2px"><div style="font-weight:700;margin-bottom:10px">${esc(String(month))}</div><div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:8px"><span>VVIC</span><b>${pct(vv==null?null:Number(vv))}</b></div><div style="display:flex;justify-content:space-between;gap:20px"><span>NON-VVIC</span><b>${pct(nv==null?null:Number(nv))}</b></div></div>`;
  }},
  grid:{left:65,right:25,top:35,bottom:82},xAxis:{type:"category",data:d.map(x=>x.month),axisLabel:{rotate:45}},
  yAxis:{type:"value",axisLabel:{formatter:(v:number)=>`${Math.round(v*100)}%`},splitLine:{lineStyle:{type:"dashed",color:"#d9e4f2"}}},
  dataZoom:[{type:"inside"},{type:"slider",height:13,bottom:8}],
  series:[
    {name:"VVIC",type:"line",smooth:true,connectNulls:false,symbolSize:10,lineStyle:{opacity:selectedMonth ? .28 : 1},data:d.map(x=>({value:x.vvic,itemStyle:{opacity:!selectedMonth||x.month===selectedMonth?1:.2}})),label:{show:true,formatter:(x:any)=>pct(x.value),fontWeight:"bold",color:"#0586a7"}},
    {name:"NON-VVIC",type:"line",smooth:true,connectNulls:false,symbolSize:9,lineStyle:{opacity:selectedMonth ? .28 : 1},data:d.map(x=>({value:x.non_vvic,itemStyle:{opacity:!selectedMonth||x.month===selectedMonth?1:.2}})),label:{show:true,formatter:(x:any)=>pct(x.value),color:"#2e5db2"}}
  ]
});

export const factoryOption=(d:Factory[],products:FactoryProduct[],selected:{month:string;factory:string|null}|null):EChartsOption=>{
  const months=[...new Set(d.map(x=>x.month))].sort();const fs=Object.keys(colors);
  const rank=new Map<string,number>();months.forEach(m=>d.filter(x=>x.month===m&&x.eff_pct!=null).sort((a,b)=>(a.eff_pct??0)-(b.eff_pct??0)).forEach((x,i)=>rank.set(`${m}|${x.factory}`,i)));
  const series=fs.map(factory=>({name:factory,type:"custom",coordinateSystem:"cartesian2d",renderItem:(params:any,api:any)=>{
    const month=months[params.dataIndex],row=api.value(1),eff=api.value(2),nextRow=api.value(3);if(row==null)return null;
    const point=api.coord([month,row]),band=api.size([1,0])[0],width=band*.72,height=Math.min(25,Math.abs(api.size([0,1])[1])*.72),x=point[0]-width/2,y=point[1]-height/2;
    const active=!selected||(month===selected.month&&(!selected.factory||factory===selected.factory));const children:any[]=[];
    if(nextRow!=null&&params.dataIndex<months.length-1){const next=api.coord([months[params.dataIndex+1],nextRow]),x1=x+width,x2=next[0]-width/2,y2=next[1];children.push({type:"path",shape:{pathData:`M${x1},${point[1]-height/2} C${(x1+x2)/2},${point[1]-height/2} ${(x1+x2)/2},${y2-height/2} ${x2},${y2-height/2} L${x2},${y2+height/2} C${(x1+x2)/2},${y2+height/2} ${(x1+x2)/2},${point[1]+height/2} ${x1},${point[1]+height/2} Z`},style:{fill:colors[factory],opacity:selected ? (selected.factory&&selected.factory!==factory ? .14 : .35) : .72}});}
    children.push({type:"rect",shape:{x,y,width,height,r:2},style:{fill:colors[factory],opacity:active?1:.2}});
    if(eff!=null&&Number.isFinite(Number(eff)))children.push({type:"text",style:{x:point[0],y:point[1],text:pct(Number(eff)),fill:"#07162e",font:"700 11px Inter, Segoe UI, sans-serif",textAlign:"center",textVerticalAlign:"middle",opacity:active?1:.3}});
    return{type:"group",children};},data:months.map((m,i)=>{const item=d.find(x=>x.month===m&&x.factory===factory),next=months[i+1];return{name:m,value:[m,rank.get(`${m}|${factory}`)??null,item?.eff_pct??null,next?rank.get(`${next}|${factory}`)??null:null]};}),encode:{x:0,y:1}}));
  return{color:fs.map(x=>colors[x]),tooltip:{trigger:"item",confine:true,backgroundColor:"#fff",borderColor:"#aeb8c6",borderWidth:1,padding:0,extraCssText:"box-shadow:0 8px 24px rgba(20,35,60,.22);border-radius:3px;",formatter:(x:any)=>{
    const month=String(x?.value?.[0]??x?.name??""),factory=String(x?.seriesName??"");const rows=products.filter(p=>p.month===month&&p.factory===factory&&p.eff_pct!=null).sort((a,b)=>(b.eff_pct??0)-(a.eff_pct??0));const max=Math.max(...rows.map(r=>r.eff_pct??0),.01);
    const detail=rows.length?rows.map(r=>`<div style="margin-top:10px"><div style="font-size:10px;color:#283247;margin-bottom:4px">${esc(r.product_type)}</div><div style="display:flex;align-items:center;gap:9px"><span style="display:block;width:${Math.max(5,((r.eff_pct??0)/max)*205)}px;max-width:205px;height:15px;border-radius:2px;background:${productColor(r.product_type)}"></span><b style="font-size:11px;color:#172033">${pct(r.eff_pct)}</b></div></div>`).join(""):`<div style="margin-top:10px;color:#748196;font-size:11px">No Product Type data</div>`;
    return `<div style="padding:12px 14px;min-width:270px"><div style="font-size:12px;font-weight:700;color:#263145">EFF% by Product Type</div><div style="font-size:10px;color:#748196;margin-top:3px">${esc(factory)} · ${esc(month)}</div>${detail}</div>`;
  }},legend:{top:0,left:0,itemWidth:10,itemHeight:10},grid:{left:25,right:18,top:65,bottom:35},xAxis:{type:"category",data:months,boundaryGap:true,axisTick:{show:false},axisLine:{show:false}},yAxis:{type:"value",show:false,min:-.5,max:5.5,interval:1},series:series as any};
};

export const customerOption=(d:Customer[],factoryRows:CustomerFactory[],target:number,selectedCustomer:string|null):EChartsOption=>({
  tooltip:{trigger:"item",confine:true,backgroundColor:"#fff",borderColor:"#aeb8c6",borderWidth:1,padding:0,extraCssText:"box-shadow:0 8px 24px rgba(20,35,60,.22);border-radius:3px;",formatter:(x:any)=>{
    const brand=String(x?.name??"");const base=d.find(item=>item.customer===brand);const rows=factoryRows.filter(r=>r.customer===brand&&r.eff_pct!=null).sort((a,b)=>(b.eff_pct??0)-(a.eff_pct??0));
    const bars=rows.map(r=>`<div style="display:grid;grid-template-columns:60px 150px 48px;gap:8px;align-items:center;margin-top:9px"><span style="font-size:10px;color:#5f6878">${esc(r.factory)}</span><span style="height:20px;background:${colors[r.factory]??"#48bc67"};border-radius:3px"></span><b style="font-size:11px;color:#263145;text-align:right">${pct(r.eff_pct)}</b></div>`).join("");
    return `<div style="padding:12px 14px;min-width:300px"><div style="font-size:12px;font-weight:700;color:#263145">EFF% by FACTORY</div><div style="font-size:10px;color:#748196;margin-top:3px">${esc(brand)} · ${esc(base?.month??"")}</div>${bars||`<div style="margin-top:10px;color:#748196;font-size:11px">No Factory data</div>`}</div>`;
  }},
  grid:{left:175,right:75,top:25,bottom:40},xAxis:{type:"value",min:0,max:1,axisLabel:{formatter:(v:number)=>`${Math.round(v*100)}%`},splitLine:{lineStyle:{type:"dashed",color:"#d9e4f2"}},axisLine:{show:false},axisTick:{show:false}},
  yAxis:{type:"category",inverse:true,data:d.map(x=>x.customer),axisTick:{show:false},axisLine:{show:false},axisLabel:{fontSize:11,margin:12,width:150,overflow:"truncate"}},
  series:[{type:"bar",barWidth:20,data:d.map(x=>({name:x.customer,value:x.eff_pct,itemStyle:{color:(x.eff_pct??0)>=target?"#23df7a":"#df8396",borderRadius:[0,5,5,0],opacity:!selectedCustomer||x.customer===selectedCustomer?1:.2}})),label:{show:true,position:"right",formatter:(x:any)=>x.value==null?"":pct(Number(x.value)),fontWeight:"bold",fontSize:10,distance:8},markLine:{symbol:"none",silent:true,lineStyle:{color:"#7ba4ec",type:"dashed",width:2},label:{formatter:`Target: ${pct(target)}`,position:"end"},data:[{xAxis:target}]}}]
});
