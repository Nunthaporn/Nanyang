from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session


def build_overview02_router(get_db):
    router = APIRouter(prefix="/api/overview02", tags=["Overview02"])

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

    DATE_EXPR = r'''CASE
        WHEN BTRIM(e."Date"::text) ~ '^[0-9]+$'
            THEN DATE '1899-12-30' + BTRIM(e."Date"::text)::integer
        ELSE BTRIM(e."Date"::text)::date
    END'''

    def numeric_expr(column: str) -> str:
        return rf'''CASE
            WHEN REGEXP_REPLACE(BTRIM(e."{column}"::text), '[^0-9.-]', '', 'g') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
                THEN REGEXP_REPLACE(BTRIM(e."{column}"::text), '[^0-9.-]', '', 'g')::numeric
            ELSE NULL
        END'''

    MIN_OUTPUT = numeric_expr("Min Output")
    MIN_INPUT = numeric_expr("Min Input")
    OUTPUT_PCS = numeric_expr("Output pcs")
    MAN = numeric_expr("Man")

    FILTERS_SQL = text(f'''
        WITH parsed AS (
            SELECT {DATE_EXPR} AS produce_date
            FROM public.teffdata e
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
                COALESCE(NULLIF(BTRIM("BRAND_NAME"::text), ''), BTRIM("Cust"::text)) AS brand_name,
                UPPER(REPLACE(REPLACE(BTRIM("VVIC"::text), ' ', ''), '_', '-')) AS customer_type
            FROM public.mt_cus
            WHERE NULLIF(BTRIM("Cust"::text), '') IS NOT NULL
            ORDER BY UPPER(BTRIM("Cust"::text)), BTRIM("Cust"::text)
        ),
        so_dim AS (
            SELECT DISTINCT ON (UPPER(BTRIM("SO_8Digit"::text)))
                UPPER(BTRIM("SO_8Digit"::text)) AS so_key,
                NULLIF(BTRIM("GMT_TYPE"::text), '') AS gmt_type
            FROM public.mt_so
            WHERE NULLIF(BTRIM("SO_8Digit"::text), '') IS NOT NULL
            ORDER BY UPPER(BTRIM("SO_8Digit"::text)), BTRIM("SO_8Digit"::text)
        ),
        base AS (
            SELECT
                {DATE_EXPR} AS produce_date,
                fd.factory,
                cd.brand_name,
                cd.customer_type,
                sd.gmt_type,
                NULLIF(BTRIM(e."D_L"::text), '') AS d_l,
                {MIN_OUTPUT} AS min_output,
                {MIN_INPUT} AS min_input,
                {OUTPUT_PCS} AS output_pcs,
                {MAN} AS man
            FROM public.teffdata e
            INNER JOIN factory_dim fd
              ON fd.factory = UPPER(BTRIM(e."FACTORY"::text))
            LEFT JOIN customer_dim cd
              ON cd.cust_key = UPPER(BTRIM(e."Cust"::text))
            LEFT JOIN so_dim sd
              ON sd.so_key = UPPER(BTRIM(e."# SO 8digit"::text))
            WHERE {DATE_EXPR} BETWEEN :start_date AND :end_date
              AND (
                    CAST(:factory AS text) IS NULL
                    OR fd.factory = CAST(:factory AS text)
              )
        ),
        daily_factory AS (
            SELECT
                produce_date,
                factory,
                SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct
            FROM base
            GROUP BY produce_date, factory
            HAVING SUM(min_input) <> 0
        ),
        mtd AS (
            SELECT *
            FROM base
            WHERE produce_date BETWEEN
                GREATEST(:start_date, DATE_TRUNC('month', CAST(:end_date AS date))::date)
                AND :end_date
        ),
        vv_product_base AS (
            SELECT * FROM mtd
            WHERE customer_type = 'VVIC'
              AND gmt_type IS NOT NULL
        ),
        vv_product_unique_man AS (
            SELECT gmt_type, d_l, MIN(man) AS man
            FROM vv_product_base
            WHERE d_l IS NOT NULL
            GROUP BY gmt_type, d_l
        ),
        vv_product_agg AS (
            SELECT
                gmt_type,
                SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct,
                SUM(min_input) AS sum_inmin,
                SUM(output_pcs) AS sum_pcs
            FROM vv_product_base
            GROUP BY gmt_type
            HAVING SUM(min_input) <> 0
        ),
        vv_product_man AS (
            SELECT gmt_type, SUM(man) AS sum_unique_man
            FROM vv_product_unique_man
            GROUP BY gmt_type
        ),
        vv_product AS (
            SELECT
                a.gmt_type,
                a.eff_pct,
                CASE
                    WHEN m.sum_unique_man IS NULL OR m.sum_unique_man = 0 OR a.sum_inmin IS NULL OR a.sum_inmin = 0 THEN NULL
                    ELSE (a.sum_pcs / NULLIF((a.sum_inmin / m.sum_unique_man) / 60.0, 0)) / NULLIF(m.sum_unique_man, 0)
                END AS pph
            FROM vv_product_agg a
            LEFT JOIN vv_product_man m USING (gmt_type)
        ),
        vv_customer_base AS (
            SELECT * FROM mtd
            WHERE customer_type = 'VVIC'
              AND brand_name IS NOT NULL
        ),
        vv_customer_unique_man AS (
            SELECT brand_name, d_l, MIN(man) AS man
            FROM vv_customer_base
            WHERE d_l IS NOT NULL
            GROUP BY brand_name, d_l
        ),
        vv_customer_agg AS (
            SELECT
                brand_name,
                SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct,
                SUM(min_input) AS sum_inmin,
                SUM(output_pcs) AS sum_pcs
            FROM vv_customer_base
            GROUP BY brand_name
            HAVING SUM(min_input) <> 0
        ),
        vv_customer_man AS (
            SELECT brand_name, SUM(man) AS sum_unique_man
            FROM vv_customer_unique_man
            GROUP BY brand_name
        ),
        vv_customer AS (
            SELECT
                a.brand_name,
                a.eff_pct,
                CASE
                    WHEN m.sum_unique_man IS NULL OR m.sum_unique_man = 0 OR a.sum_inmin IS NULL OR a.sum_inmin = 0 THEN NULL
                    ELSE (a.sum_pcs / NULLIF((a.sum_inmin / m.sum_unique_man) / 60.0, 0)) / NULLIF(m.sum_unique_man, 0)
                END AS pph
            FROM vv_customer_agg a
            LEFT JOIN vv_customer_man m USING (brand_name)
        ),
        non_vvic AS (
            SELECT
                brand_name,
                SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct
            FROM mtd
            WHERE customer_type = 'NON-VVIC'
              AND brand_name IS NOT NULL
            GROUP BY brand_name
            HAVING SUM(min_input) <> 0
        )
        SELECT JSONB_BUILD_OBJECT(
            'daily_factory', COALESCE((
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'produce_date', produce_date,
                        'factory', factory,
                        'eff_pct', eff_pct
                    ) ORDER BY produce_date, factory
                ) FROM daily_factory
            ), '[]'::jsonb),
            'vvic_product', COALESCE((
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT('gmt_type', gmt_type, 'eff_pct', eff_pct, 'pph', pph)
                    ORDER BY eff_pct DESC NULLS LAST, gmt_type
                ) FROM vv_product
            ), '[]'::jsonb),
            'vvic_customer', COALESCE((
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT('brand_name', brand_name, 'eff_pct', eff_pct, 'pph', pph)
                    ORDER BY eff_pct DESC NULLS LAST, brand_name
                ) FROM vv_customer
            ), '[]'::jsonb),
            'non_vvic_customer', COALESCE((
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT('brand_name', brand_name, 'eff_pct', eff_pct)
                    ORDER BY eff_pct DESC NULLS LAST, brand_name
                ) FROM non_vvic
            ), '[]'::jsonb)
        ) AS payload
    ''')

    @router.get("/filters")
    def filters(db: Session = Depends(get_db)):
        try:
            row = db.execute(FILTERS_SQL).mappings().first()
            return {
                "min_date": row["min_date"] if row else None,
                "max_date": row["max_date"] if row else None,
                "factories": [x for x in ((row["factories"] if row else None) or []) if x],
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
                "daily_factory": [],
                "vvic_product": [],
                "vvic_customer": [],
                "non_vvic_customer": [],
            }
            payload["last_refresh"] = datetime.now().astimezone()
            return payload
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return router
