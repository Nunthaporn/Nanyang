export type ProductTypeEff = { product_type: string; eff_pct: number | null };
export type Summary = {
  data_as_of: string | null;
  eff_ezlcard: number | null;
  min_produce: number | null;
  pph: number | null;
  sum_pcs: number | null;
  operator_count: number | null;
  count_line: number;
  last_refresh: string;
};
export type FactoryEff = { factory: string; eff_pct: number | null; product_types?: ProductTypeEff[] };
export type LatestLine = { factory: string | null; line: string; eff_pct: number | null; product_types?: ProductTypeEff[] };
export type PeriodFactory = { period: string; factory: string; eff_pct: number | null };
export type FilterMeta = { min_date: string | null; max_date: string | null; factories: string[] };
export interface DashboardResponse {
  summary: Summary;
  monthly: FactoryEff[];
  latest: LatestLine[];
  monthlyFactory: PeriodFactory[];
  last10: PeriodFactory[];
}
