from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session


def build_overview_router(get_db):
    router = APIRouter(prefix="/api/overview", tags=["Overview"])

    def validate_dates(start_date: date, end_date: date):
        if start_date > end_date:
            raise HTTPException(status_code=422, detail="start_date must be <= end_date")

    def params(start_date: date, end_date: date, factory: str | None):
        validate_dates(start_date, end_date)
        return {"start_date": start_date, "end_date": end_date,
                "factory": None if not factory or factory.upper() == "ALL" else factory.upper()}

    DATE_EXPR = r'''CASE
        WHEN BTRIM(e."Date"::text) ~ '^[0-9]+$' THEN DATE '1899-12-30' + BTRIM(e."Date"::text)::integer
        WHEN BTRIM(e."Date"::text) ~ '^\d{4}-\d{2}-\d{2}' THEN LEFT(BTRIM(e."Date"::text), 10)::date
        ELSE NULL END'''

    MGR_DATE_EXPR = r'''CASE
        WHEN NULLIF(BTRIM("Date"::text), '') IS NULL THEN NULL
        WHEN BTRIM("Date"::text) ~ '^[0-9]+$' THEN DATE '1899-12-30' + BTRIM("Date"::text)::integer
        WHEN BTRIM("Date"::text) ~ '^\d{4}-\d{2}-\d{2}' THEN LEFT(BTRIM("Date"::text), 10)::date
        ELSE NULL END'''

    def numeric_expr(column: str) -> str:
        return rf'''CASE WHEN REGEXP_REPLACE(BTRIM(e."{column}"::text), '[^0-9.-]', '', 'g') ~ '^-?[0-9]+([.][0-9]+)?$'
            THEN REGEXP_REPLACE(BTRIM(e."{column}"::text), '[^0-9.-]', '', 'g')::numeric ELSE NULL END'''

    MIN_OUTPUT = numeric_expr("Min Output")
    MIN_INPUT = numeric_expr("Min Input")
    OUTPUT_PCS = numeric_expr("Output pcs")

    FILTERS_SQL = text(f'''
        WITH parsed AS (SELECT {DATE_EXPR} AS produce_date FROM public.teffdata e)
        SELECT (SELECT MIN(produce_date) FROM parsed WHERE produce_date IS NOT NULL) AS min_date,
               (SELECT MAX(produce_date) FROM parsed WHERE produce_date IS NOT NULL) AS max_date,
               ARRAY(SELECT DISTINCT UPPER(BTRIM(mf."FACTORY"::text)) FROM public.mt_factory mf
                     WHERE NULLIF(BTRIM(mf."FACTORY"::text), '') IS NOT NULL ORDER BY 1) AS factories
    ''')

    DASHBOARD_SQL = text(f'''
        WITH factory_dim AS (
            SELECT DISTINCT UPPER(BTRIM("FACTORY"::text)) AS factory FROM public.mt_factory
            WHERE NULLIF(BTRIM("FACTORY"::text), '') IS NOT NULL
        ),
        raw_base AS (
            SELECT {DATE_EXPR} AS produce_date, fd.factory,
                   COALESCE(NULLIF(BTRIM(e."PD_Type"::text), ''), 'OTHER') AS product_type,
                   {MIN_OUTPUT} AS min_output, {MIN_INPUT} AS min_input, {OUTPUT_PCS} AS output_pcs
            FROM public.teffdata e
            INNER JOIN factory_dim fd ON fd.factory = UPPER(BTRIM(e."FACTORY"::text))
            WHERE {DATE_EXPR} <= :end_date
              AND (CAST(:factory AS text) IS NULL OR fd.factory = UPPER(BTRIM(CAST(:factory AS text))))
        ),
        base AS (
            SELECT * FROM raw_base
            WHERE produce_date BETWEEN :start_date AND :end_date
        ),
        mgr_parsed AS (
            SELECT {MGR_DATE_EXPR} AS mgr_date,
                   UPPER(BTRIM("BU"::text)) AS factory,
                   CASE WHEN REGEXP_REPLACE(BTRIM("Plan MGR"::text), '[^0-9.-]', '', 'g') ~ '^-?[0-9]+([.][0-9]+)?$'
                        THEN REGEXP_REPLACE(BTRIM("Plan MGR"::text), '[^0-9.-]', '', 'g')::numeric ELSE NULL END AS plan_mgr
            FROM public.tmgr
        ),
        mgr AS (
            SELECT mgr_date, factory, SUM(plan_mgr) AS plan_mgr
            FROM mgr_parsed
            WHERE mgr_date BETWEEN :start_date AND :end_date
              AND (CAST(:factory AS text) IS NULL OR factory = UPPER(BTRIM(CAST(:factory AS text))))
            GROUP BY mgr_date, factory
        ),
        bounds AS (
            SELECT CAST(:start_date AS date) AS selected_start, CAST(:end_date AS date) AS selected_end
        ),
        latest_date AS (SELECT MAX(produce_date) AS ld FROM raw_base),
        period_bounds AS (
            SELECT 'YTD' AS period, DATE_TRUNC('year', ld)::date AS p_start, ld AS p_end FROM latest_date UNION ALL
            SELECT 'QTD', DATE_TRUNC('quarter', ld)::date, ld FROM latest_date UNION ALL
            SELECT 'MTD', DATE_TRUNC('month', ld)::date, ld FROM latest_date UNION ALL
            SELECT 'LD', ld, ld FROM latest_date
        ),
        period_teff AS (
            SELECT p.period, SUM(b.min_output) AS sum_outmin, SUM(b.min_input) AS sum_inmin, SUM(b.output_pcs) AS sum_pcs
            FROM period_bounds p LEFT JOIN raw_base b ON b.produce_date BETWEEN p.p_start AND p.p_end GROUP BY p.period
        ),
        period_mgr AS (
            SELECT p.period, SUM(m.plan_mgr) AS sum_mgr
            FROM period_bounds p LEFT JOIN mgr_parsed m
              ON m.mgr_date BETWEEN p.p_start AND p.p_end
             AND (CAST(:factory AS text) IS NULL OR m.factory = UPPER(BTRIM(CAST(:factory AS text))))
            GROUP BY p.period
        ),
        overall_periods AS (
            SELECT t.period,
                   t.sum_outmin / NULLIF(t.sum_inmin,0) AS eff_pct,
                   t.sum_outmin AS min_produce,
                   t.sum_outmin / NULLIF(m.sum_mgr,0) AS ptp_pct,
                   (t.sum_pcs * 60.0) / NULLIF(t.sum_inmin,0) AS pph
            FROM period_teff t LEFT JOIN period_mgr m USING(period)
        ),
        factory_periods AS (
            SELECT p.period, b.factory, SUM(b.min_output)/NULLIF(SUM(b.min_input),0) AS eff_pct
            FROM period_bounds p JOIN raw_base b ON b.produce_date BETWEEN p.p_start AND p.p_end
            GROUP BY p.period,b.factory
        ),
        monthly AS (
            SELECT DATE_TRUNC('month',produce_date)::date AS month_date,
                   SUM(min_output)/NULLIF(SUM(min_input),0) AS eff_pct
            FROM base GROUP BY DATE_TRUNC('month',produce_date)::date HAVING SUM(min_input)<>0
        ),
        last30 AS (
            SELECT produce_date, SUM(min_output)/NULLIF(SUM(min_input),0) AS eff_pct
            FROM base CROSS JOIN bounds
            WHERE produce_date BETWEEN GREATEST(selected_start,selected_end-29) AND selected_end
            GROUP BY produce_date HAVING SUM(min_input)<>0
        ),
        last30_factory AS (
            SELECT produce_date, factory,
                   SUM(min_output)/NULLIF(SUM(min_input),0) AS eff_pct
            FROM base CROSS JOIN bounds
            WHERE produce_date BETWEEN GREATEST(selected_start,selected_end-29) AND selected_end
            GROUP BY produce_date, factory
            HAVING SUM(min_input)<>0
        ),
        factory_monthly AS (
            SELECT DATE_TRUNC('month',produce_date)::date AS month_date,
                   factory,
                   SUM(min_output)/NULLIF(SUM(min_input),0) AS eff_pct
            FROM base GROUP BY DATE_TRUNC('month',produce_date)::date, factory HAVING SUM(min_input)<>0
        ),
        factory_monthly_product AS (
            SELECT DATE_TRUNC('month',produce_date)::date AS month_date,
                   factory,
                   product_type,
                   SUM(min_output)/NULLIF(SUM(min_input),0) AS eff_pct
            FROM base
            GROUP BY DATE_TRUNC('month',produce_date)::date, factory, product_type
            HAVING SUM(min_input)<>0
        )
        SELECT JSONB_BUILD_OBJECT(
            'kpis', COALESCE((SELECT JSONB_OBJECT_AGG(period,eff_pct) FROM overall_periods),'{{}}'::jsonb),
            'kpi_details', COALESCE((SELECT JSONB_OBJECT_AGG(period,JSONB_BUILD_OBJECT(
                'eff_pct',eff_pct,'min_produce',min_produce,'ptp_pct',ptp_pct,'pph',pph)) FROM overall_periods),'{{}}'::jsonb),
            'factory_periods', COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('period',period,'factory',factory,'eff_pct',eff_pct)
                ORDER BY CASE period WHEN 'YTD' THEN 1 WHEN 'QTD' THEN 2 WHEN 'MTD' THEN 3 ELSE 4 END,eff_pct DESC NULLS LAST,factory) FROM factory_periods),'[]'::jsonb),
            'monthly', COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('month',month_date,'eff_pct',eff_pct) ORDER BY month_date) FROM monthly),'[]'::jsonb),
            'last30', COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('produce_date',produce_date,'eff_pct',eff_pct) ORDER BY produce_date) FROM last30),'[]'::jsonb),
            'last30_factory', COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('produce_date',produce_date,'factory',factory,'eff_pct',eff_pct) ORDER BY produce_date,factory) FROM last30_factory),'[]'::jsonb),
            'factory_monthly', COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('month',month_date,'factory',factory,'eff_pct',eff_pct) ORDER BY month_date,factory) FROM factory_monthly),'[]'::jsonb),
            'factory_monthly_product', COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('month',month_date,'factory',factory,'product_type',product_type,'eff_pct',eff_pct) ORDER BY month_date,factory,eff_pct DESC NULLS LAST,product_type) FROM factory_monthly_product),'[]'::jsonb),
            'latest_date',(SELECT ld FROM latest_date)
        ) AS payload
    ''')

    @router.get("/filters")
    def filters(db: Session = Depends(get_db)):
        try:
            row = db.execute(FILTERS_SQL).mappings().first()
            return {"min_date": row["min_date"] if row else None, "max_date": row["max_date"] if row else None,
                    "factories": [x for x in ((row["factories"] if row else None) or []) if x]}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.get("/dashboard")
    def dashboard(start_date: date, end_date: date, factory: str | None = Query(default=None), db: Session = Depends(get_db)):
        p = params(start_date,end_date,factory)
        try:
            row = db.execute(DASHBOARD_SQL,p).mappings().first()
            payload = dict(row["payload"]) if row and row["payload"] else {"kpis":{},"kpi_details":{},"factory_periods":[],"monthly":[],"last30":[],"last30_factory":[],"factory_monthly":[],"factory_monthly_product":[],"latest_date":None}
            payload["last_refresh"] = datetime.now().astimezone()
            return payload
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return router
