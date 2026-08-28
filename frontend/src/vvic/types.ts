export type Filters={start_date:string;end_date:string;customer_type:string;factory:string[];customer:string|null};
export type Summary={data_as_of:string|null;last_refresh:string;ytd_eff_pct:number|null;qtd_eff_pct:number|null;mtd_eff_pct:number|null};
export type Month={month:string;vvic:number|null;non_vvic:number|null};
export type Factory={month:string;factory:string;eff_pct:number|null};
export type FactoryProduct={month:string;factory:string;product_type:string;eff_pct:number|null};
export type Customer={customer:string;factory?:string;month:string;eff_pct:number|null;target:number};
export type CustomerFactory={customer:string;factory:string;month:string;eff_pct:number|null};
