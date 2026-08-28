import type { Filters } from "./types";

const qs=(f:Filters,extra:Record<string,string>={})=>{
  const p=new URLSearchParams({start_date:f.start_date,end_date:f.end_date,customer_type:f.customer_type,...extra});
  f.factory.forEach(x=>p.append("factory",x));
  if(f.customer)p.set("customer",f.customer);
  return p;
};

export async function getJSON<T>(path:string,f:Filters,signal:AbortSignal,extra:Record<string,string>={}):Promise<T>{
  const r=await fetch(`${path}?${qs(f,extra)}`,{signal});
  if(!r.ok)throw new Error(r.status===503?"ไม่สามารถเชื่อมต่อฐานข้อมูลได้":`API error ${r.status}`);
  return r.json();
}
