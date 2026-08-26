from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session


def build_min_vs_eff_router(get_db):
    router = APIRouter(prefix="/api/min-vs-eff", tags=["MinVSEff"])

    def validate_dates(start_date: date, end_date: date):
        if start_date > end_date:
            raise HTTPException(status_code=422, detail="start_date must be <= end_date")

    def params(start_date: date, end_date: date, factory: str | None):
        validate_dates(start_date, end_date)
        return {
            "start_date": start_date,
            "end_date": end_date,
            "factory": None if not factory or factory.upper() == "ALL" else factory.upper(),
        }

    # Safe parsing keeps this dashboard resilient if a CSV import stores Date as
    # an Excel serial number and keeps malformed numeric cells from causing 500s.
    DATE_EXPR = r'''CASE
        WHEN BTRIM(e."Date"::text) ~ '^[0-9]+$'
            THEN DATE '1899-12-30' + BTRIM(e."Date"::text)::integer
        ELSE BTRIM(e."Date"::text)::date
    END'''

    MIN_OUTPUT_EXPR = r'''CASE
        WHEN REGEXP_REPLACE(BTRIM(e."Min Output"::text), '[^0-9.-]', '', 'g') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
            THEN REGEXP_REPLACE(BTRIM(e."Min Output"::text), '[^0-9.-]', '', 'g')::numeric
        ELSE NULL
    END'''

    MIN_INPUT_EXPR = r'''CASE
        WHEN REGEXP_REPLACE(BTRIM(e."Min Input"::text), '[^0-9.-]', '', 'g') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
            THEN REGEXP_REPLACE(BTRIM(e."Min Input"::text), '[^0-9.-]', '', 'g')::numeric
        ELSE NULL
    END'''

    FILTERS_SQL = text(f'''
        WITH parsed AS (
            SELECT {DATE_EXPR} AS produce_date
            FROM public.teffdata e
            WHERE NULLIF(BTRIM(e."PD_Type"::text), '') IS NOT NULL
        )
        SELECT
            (SELECT MIN(produce_date) FROM parsed) AS min_date,
            (SELECT MAX(produce_date) FROM parsed) AS max_date,
            ARRAY(
                SELECT DISTINCT UPPER(BTRIM(mf."FACTORY"::text))
                FROM public.mt_factory mf
                WHERE NULLIF(BTRIM(mf."FACTORY"::text), '') IS NOT NULL
                ORDER BY 1
            ) AS factories
    ''')

    DASHBOARD_SQL = text(f'''
        WITH factory_dim AS (
            SELECT DISTINCT UPPER(BTRIM("FACTORY"::text)) AS factory
            FROM public.mt_factory
            WHERE NULLIF(BTRIM("FACTORY"::text), '') IS NOT NULL
        ),
        customer_dim AS (
            SELECT DISTINCT ON (UPPER(BTRIM("Cust"::text)))
                UPPER(BTRIM("Cust"::text)) AS cust_key,
                BTRIM("Cust"::text) AS customer,
                UPPER(BTRIM("VVIC"::text)) AS customer_type
            FROM public.mt_cus
            WHERE NULLIF(BTRIM("Cust"::text), '') IS NOT NULL
            ORDER BY UPPER(BTRIM("Cust"::text)), BTRIM("Cust"::text)
        ),
        base AS (
            SELECT
                {DATE_EXPR} AS produce_date,
                fd.factory,
                COALESCE(NULLIF(BTRIM(e."PD_Type"::text), ''), 'UNKNOWN') AS pd_type,
                cd.customer,
                cd.customer_type,
                {MIN_OUTPUT_EXPR} AS min_output,
                {MIN_INPUT_EXPR} AS min_input
            FROM public.teffdata e
            INNER JOIN factory_dim fd
                ON fd.factory = UPPER(BTRIM(e."FACTORY"::text))
            LEFT JOIN customer_dim cd
                ON cd.cust_key = UPPER(BTRIM(e."Cust"::text))
            WHERE {DATE_EXPR} BETWEEN :start_date AND :end_date
              AND (:factory IS NULL OR fd.factory = :factory)
        ),
        heatmap AS (
            SELECT
                factory,
                pd_type,
                SUM(min_output) AS min_produce,
                SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct
            FROM base
            WHERE pd_type <> 'UNKNOWN'
            GROUP BY factory, pd_type
            HAVING SUM(min_input) <> 0
        ),
        mtd AS (
            SELECT *
            FROM base
            WHERE produce_date BETWEEN
                GREATEST(:start_date, DATE_TRUNC('month', CAST(:end_date AS date))::date)
                AND :end_date
              AND customer IS NOT NULL
        ),
        customer_mtd AS (
            SELECT
                customer,
                CASE
                    WHEN REPLACE(REPLACE(customer_type, ' ', ''), '_', '-') = 'VVIC' THEN 'VVIC'
                    ELSE 'NON-VVIC'
                END AS customer_group,
                SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct
            FROM mtd
            GROUP BY customer,
                CASE
                    WHEN REPLACE(REPLACE(customer_type, ' ', ''), '_', '-') = 'VVIC' THEN 'VVIC'
                    ELSE 'NON-VVIC'
                END
            HAVING SUM(min_input) <> 0
        )
        SELECT JSONB_BUILD_OBJECT(
            'heatmap', COALESCE((
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'factory', factory,
                        'pd_type', pd_type,
                        'min_produce', min_produce,
                        'eff_pct', eff_pct
                    )
                    ORDER BY pd_type, factory
                ) FROM heatmap
            ), '[]'::jsonb),
            'vvic', COALESCE((
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT('customer', customer, 'eff_pct', eff_pct)
                    ORDER BY eff_pct DESC NULLS LAST, customer
                ) FROM customer_mtd WHERE customer_group = 'VVIC'
            ), '[]'::jsonb),
            'normal', COALESCE((
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT('customer', customer, 'eff_pct', eff_pct)
                    ORDER BY eff_pct DESC NULLS LAST, customer
                ) FROM customer_mtd WHERE customer_group = 'NON-VVIC'
            ), '[]'::jsonb)
        ) AS payload
    ''')

    @router.get("/filters")
    def filters(db: Session = Depends(get_db)):
        try:
            row = db.execute(FILTERS_SQL).mappings().first()
            if not row:
                return {"min_date": None, "max_date": None, "factories": []}
            return {
                "min_date": row["min_date"],
                "max_date": row["max_date"],
                "factories": [x for x in (row["factories"] or []) if x],
            }
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.get("/dashboard")
    def dashboard(
        start_date: date,
        end_date: date,
        factory: str | None = Query(default=None),
        db: Session = Depends(get_db),
    ):
        p = params(start_date, end_date, factory)
        try:
            row = db.execute(DASHBOARD_SQL, p).mappings().first()
            payload = dict(row["payload"]) if row and row["payload"] else {
                "heatmap": [], "vvic": [], "normal": []
            }
            payload["last_refresh"] = datetime.now().astimezone()
            return payload
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return router
