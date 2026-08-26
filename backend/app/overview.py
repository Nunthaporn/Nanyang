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
        return {
            "start_date": start_date,
            "end_date": end_date,
            "factory": None if not factory or factory.upper() == "ALL" else factory.upper(),
        }

    DATE_EXPR = r'''CASE
        WHEN BTRIM(e."Date"::text) ~ '^[0-9]+$'
            THEN DATE '1899-12-30' + BTRIM(e."Date"::text)::integer
        WHEN BTRIM(e."Date"::text) ~ '^\d{4}-\d{2}-\d{2}'
            THEN LEFT(BTRIM(e."Date"::text), 10)::date
        ELSE NULL
    END'''

    def numeric_expr(column: str) -> str:
        return rf'''CASE
            WHEN REGEXP_REPLACE(BTRIM(e."{column}"::text), '[^0-9.-]', '', 'g') ~ '^-?[0-9]+([.][0-9]+)?$'
                THEN REGEXP_REPLACE(BTRIM(e."{column}"::text), '[^0-9.-]', '', 'g')::numeric
            ELSE NULL
        END'''

    MIN_OUTPUT = numeric_expr("Min Output")
    MIN_INPUT = numeric_expr("Min Input")

    FILTERS_SQL = text(f'''
        WITH parsed AS (
            SELECT {DATE_EXPR} AS produce_date
            FROM public.teffdata e
        )
        SELECT
            (SELECT MIN(produce_date) FROM parsed WHERE produce_date IS NOT NULL) AS min_date,
            (SELECT MAX(produce_date) FROM parsed WHERE produce_date IS NOT NULL) AS max_date,
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
        base AS (
            SELECT
                {DATE_EXPR} AS produce_date,
                fd.factory,
                {MIN_OUTPUT} AS min_output,
                {MIN_INPUT} AS min_input
            FROM public.teffdata e
            INNER JOIN factory_dim fd
              ON fd.factory = UPPER(BTRIM(e."FACTORY"::text))
            WHERE {DATE_EXPR} BETWEEN :start_date AND :end_date
              AND (
                    CAST(:factory AS text) IS NULL
                    OR fd.factory = UPPER(BTRIM(CAST(:factory AS text)))
                  )
        ),
        bounds AS (
            SELECT
                CAST(:start_date AS date) AS selected_start,
                CAST(:end_date AS date) AS selected_end,
                GREATEST(
                    CAST(:start_date AS date),
                    DATE_TRUNC('year', CAST(:end_date AS date))::date
                ) AS ytd_start,
                GREATEST(
                    CAST(:start_date AS date),
                    (DATE_TRUNC('quarter', CAST(:end_date AS date)))::date
                ) AS qtd_start,
                GREATEST(
                    CAST(:start_date AS date),
                    DATE_TRUNC('month', CAST(:end_date AS date))::date
                ) AS mtd_start
        ),
        latest_date AS (
            SELECT MAX(produce_date) AS ld
            FROM base
        ),
        overall_periods AS (
            SELECT 'YTD' AS period,
                   SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct
            FROM base CROSS JOIN bounds
            WHERE produce_date BETWEEN ytd_start AND selected_end
            UNION ALL
            SELECT 'QTD',
                   SUM(min_output) / NULLIF(SUM(min_input), 0)
            FROM base CROSS JOIN bounds
            WHERE produce_date BETWEEN qtd_start AND selected_end
            UNION ALL
            SELECT 'MTD',
                   SUM(min_output) / NULLIF(SUM(min_input), 0)
            FROM base CROSS JOIN bounds
            WHERE produce_date BETWEEN mtd_start AND selected_end
            UNION ALL
            SELECT 'LD',
                   SUM(b.min_output) / NULLIF(SUM(b.min_input), 0)
            FROM base b CROSS JOIN latest_date l
            WHERE b.produce_date = l.ld
        ),
        factory_periods AS (
            SELECT 'YTD' AS period, factory,
                   SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct
            FROM base CROSS JOIN bounds
            WHERE produce_date BETWEEN ytd_start AND selected_end
            GROUP BY factory
            UNION ALL
            SELECT 'QTD', factory,
                   SUM(min_output) / NULLIF(SUM(min_input), 0)
            FROM base CROSS JOIN bounds
            WHERE produce_date BETWEEN qtd_start AND selected_end
            GROUP BY factory
            UNION ALL
            SELECT 'MTD', factory,
                   SUM(min_output) / NULLIF(SUM(min_input), 0)
            FROM base CROSS JOIN bounds
            WHERE produce_date BETWEEN mtd_start AND selected_end
            GROUP BY factory
            UNION ALL
            SELECT 'LD', b.factory,
                   SUM(b.min_output) / NULLIF(SUM(b.min_input), 0)
            FROM base b CROSS JOIN latest_date l
            WHERE b.produce_date = l.ld
            GROUP BY b.factory
        ),
        monthly AS (
            SELECT
                DATE_TRUNC('month', produce_date)::date AS month,
                SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct
            FROM base
            GROUP BY DATE_TRUNC('month', produce_date)::date
            HAVING SUM(min_input) <> 0
        ),
        last30 AS (
            SELECT
                produce_date,
                SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct
            FROM base CROSS JOIN bounds
            WHERE produce_date BETWEEN GREATEST(selected_start, selected_end - 29) AND selected_end
            GROUP BY produce_date
            HAVING SUM(min_input) <> 0
        ),
        factory_monthly AS (
            SELECT
                DATE_TRUNC('month', produce_date)::date AS month,
                factory,
                SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct
            FROM base
            GROUP BY DATE_TRUNC('month', produce_date)::date, factory
            HAVING SUM(min_input) <> 0
        )
        SELECT JSONB_BUILD_OBJECT(
            'kpis', COALESCE((
                SELECT JSONB_OBJECT_AGG(period, eff_pct)
                FROM overall_periods
            ), '{{}}'::jsonb),
            'factory_periods', COALESCE((
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT('period', period, 'factory', factory, 'eff_pct', eff_pct)
                    ORDER BY
                        CASE period WHEN 'YTD' THEN 1 WHEN 'QTD' THEN 2 WHEN 'MTD' THEN 3 ELSE 4 END,
                        eff_pct DESC NULLS LAST,
                        factory
                ) FROM factory_periods
            ), '[]'::jsonb),
            'monthly', COALESCE((
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT('month', month, 'eff_pct', eff_pct)
                    ORDER BY month
                ) FROM monthly
            ), '[]'::jsonb),
            'last30', COALESCE((
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT('produce_date', produce_date, 'eff_pct', eff_pct)
                    ORDER BY produce_date
                ) FROM last30
            ), '[]'::jsonb),
            'factory_monthly', COALESCE((
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT('month', month, 'factory', factory, 'eff_pct', eff_pct)
                    ORDER BY month, factory
                ) FROM factory_monthly
            ), '[]'::jsonb),
            'latest_date', (SELECT ld FROM latest_date)
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
                "kpis": {},
                "factory_periods": [],
                "monthly": [],
                "last30": [],
                "factory_monthly": [],
                "latest_date": None,
            }
            payload["last_refresh"] = datetime.now().astimezone()
            return payload
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return router
