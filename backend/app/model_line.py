from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session


def build_model_line_router(get_db):
    router = APIRouter(prefix="/api/model-line", tags=["Model-Line"])

    def validate_dates(start_date: date, end_date: date):
        if start_date > end_date:
            raise HTTPException(status_code=422, detail="start_date must be <= end_date")

    def common_params(start_date: date, end_date: date, factory: str | None):
        validate_dates(start_date, end_date)
        return {
            "start_date": start_date,
            "end_date": end_date,
            "factory": None if not factory or factory.upper() == "ALL" else factory.upper(),
        }

    FILTERS_SQL = text(r'''
        WITH date_bounds AS (
            SELECT MIN(e."Date"::date) AS min_date, MAX(e."Date"::date) AS max_date
            FROM public.teffdata e
            WHERE NULLIF(BTRIM(e."Model Line"::text), '') IS NOT NULL
        ),
        factory_list AS (
            SELECT ARRAY_AGG(factory ORDER BY
                CASE factory WHEN 'G1' THEN 1 WHEN 'G2' THEN 2 WHEN 'G3' THEN 3 WHEN 'G4' THEN 4 WHEN 'TRM' THEN 5 WHEN 'EA' THEN 6 ELSE 99 END,
                factory) AS factories
            FROM (
                SELECT DISTINCT UPPER(BTRIM(mf."FACTORY"::text)) AS factory
                FROM public.mt_factory mf
                WHERE NULLIF(BTRIM(mf."FACTORY"::text), '') IS NOT NULL
            ) x
        )
        SELECT d.min_date, d.max_date, f.factories FROM date_bounds d CROSS JOIN factory_list f
    ''')

    SUMMARY_SQL = text(r'''
        WITH base AS (
            SELECT
                e."D_L"::text AS d_l,
                NULLIF(REGEXP_REPLACE(BTRIM(e."Min Input"::text), '[^0-9.-]', '', 'g'), '')::numeric AS min_input,
                NULLIF(REGEXP_REPLACE(BTRIM(e."Min Output"::text), '[^0-9.-]', '', 'g'), '')::numeric AS min_output,
                NULLIF(REGEXP_REPLACE(BTRIM(e."Output pcs"::text), '[^0-9.-]', '', 'g'), '')::numeric AS output_pcs,
                NULLIF(REGEXP_REPLACE(BTRIM(e."Man"::text), '[^0-9.-]', '', 'g'), '')::numeric AS man,
                NULLIF(REGEXP_REPLACE(BTRIM(e."Man_%Out"::text), '[^0-9.-]', '', 'g'), '')::numeric AS man_out,
                NULLIF(BTRIM(e."FAC-LINE"::text), '') AS fac_line,
                NULLIF(BTRIM(e."Style"::text), '') AS style
            FROM public.teffdata e
            WHERE e."Date"::date BETWEEN :start_date AND :end_date
              AND NULLIF(BTRIM(e."Model Line"::text), '') IS NOT NULL
              AND (CAST(:factory AS text) IS NULL OR UPPER(BTRIM(e."FACTORY"::text)) = CAST(:factory AS text))
        ),
        unique_man AS (SELECT d_l, MIN(man) AS man FROM base WHERE d_l IS NOT NULL GROUP BY d_l),
        totals AS (
            SELECT SUM(min_input) AS sum_inmin, SUM(min_output) AS sum_outmin, SUM(output_pcs) AS sum_pcs,
                   SUM(man_out) AS sum_man, COUNT(DISTINCT fac_line) AS count_line, COUNT(DISTINCT style) AS count_style
            FROM base
        ),
        um AS (SELECT SUM(man) AS sum_unique_man FROM unique_man)
        SELECT
            t.sum_outmin / NULLIF(t.sum_inmin, 0) AS eff_pct,
            t.sum_outmin AS min_produce,
            CASE WHEN t.sum_inmin IS NULL OR t.sum_inmin = 0 OR um.sum_unique_man IS NULL OR um.sum_unique_man = 0 THEN NULL
                 ELSE (t.sum_pcs / NULLIF((t.sum_inmin / um.sum_unique_man) / 60.0, 0)) / NULLIF(um.sum_unique_man, 0) END AS pph,
            t.count_style, t.sum_man AS operator_count, t.count_line
        FROM totals t CROSS JOIN um
    ''')

    EFF_BY_MODEL_SQL = text(r'''
        SELECT BTRIM(e."Model Line"::text) AS model_line,
               SUM(NULLIF(REGEXP_REPLACE(BTRIM(e."Min Output"::text), '[^0-9.-]', '', 'g'), '')::numeric)
               / NULLIF(SUM(NULLIF(REGEXP_REPLACE(BTRIM(e."Min Input"::text), '[^0-9.-]', '', 'g'), '')::numeric), 0) AS eff_pct
        FROM public.teffdata e
        WHERE e."Date"::date BETWEEN :start_date AND :end_date
          AND NULLIF(BTRIM(e."Model Line"::text), '') IS NOT NULL
          AND (CAST(:factory AS text) IS NULL OR UPPER(BTRIM(e."FACTORY"::text)) = CAST(:factory AS text))
        GROUP BY BTRIM(e."Model Line"::text)
        HAVING SUM(NULLIF(REGEXP_REPLACE(BTRIM(e."Min Input"::text), '[^0-9.-]', '', 'g'), '')::numeric) <> 0
        ORDER BY eff_pct DESC NULLS LAST, model_line
    ''')

    PRODUCT_TABLE_SQL = text(r'''
        SELECT COALESCE(NULLIF(BTRIM(e."PD_Type"::text), ''), 'OTHER') AS pd_type,
               BTRIM(e."Model Line"::text) AS model_line,
               SUM(NULLIF(REGEXP_REPLACE(BTRIM(e."Min Output"::text), '[^0-9.-]', '', 'g'), '')::numeric)
               / NULLIF(SUM(NULLIF(REGEXP_REPLACE(BTRIM(e."Min Input"::text), '[^0-9.-]', '', 'g'), '')::numeric), 0) AS eff_pct
        FROM public.teffdata e
        WHERE e."Date"::date BETWEEN :start_date AND :end_date
          AND NULLIF(BTRIM(e."Model Line"::text), '') IS NOT NULL
          AND (CAST(:factory AS text) IS NULL OR UPPER(BTRIM(e."FACTORY"::text)) = CAST(:factory AS text))
        GROUP BY COALESCE(NULLIF(BTRIM(e."PD_Type"::text), ''), 'OTHER'), BTRIM(e."Model Line"::text)
        HAVING SUM(NULLIF(REGEXP_REPLACE(BTRIM(e."Min Input"::text), '[^0-9.-]', '', 'g'), '')::numeric) <> 0
        ORDER BY pd_type, model_line
    ''')

    LATEST_BY_LINE_SQL = text(r'''
        WITH prepared AS (
            SELECT
                e."Date"::date AS produce_date,
                BTRIM(e."Model Line"::text) AS model_line,
                COALESCE(NULLIF(BTRIM(ml."Line"::text), ''), NULLIF(BTRIM(e."Line"::text), '')) AS line,
                COALESCE(NULLIF(BTRIM(e."PD_Type"::text), ''), 'OTHER') AS product_type,
                NULLIF(REGEXP_REPLACE(BTRIM(e."Min Output"::text), '[^0-9.-]', '', 'g'), '')::numeric AS min_output,
                NULLIF(REGEXP_REPLACE(BTRIM(e."Min Input"::text), '[^0-9.-]', '', 'g'), '')::numeric AS min_input
            FROM public.teffdata e
            LEFT JOIN public.mt_line ml ON BTRIM(ml."Line"::text) = BTRIM(e."Line"::text)
            WHERE e."Date"::date BETWEEN :start_date AND :end_date
              AND NULLIF(BTRIM(e."Model Line"::text), '') IS NOT NULL
              AND NULLIF(BTRIM(e."Line"::text), '') IS NOT NULL
              AND (CAST(:factory AS text) IS NULL OR UPPER(BTRIM(e."FACTORY"::text)) = CAST(:factory AS text))
        ),
        latest AS (SELECT MAX(produce_date) AS latest_date FROM prepared),
        latest_data AS (SELECT p.* FROM prepared p CROSS JOIN latest l WHERE p.produce_date = l.latest_date),
        line_total AS (
            SELECT model_line, line, SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct
            FROM latest_data GROUP BY model_line, line HAVING SUM(min_input) <> 0
        ),
        product_type_eff AS (
            SELECT model_line, line, product_type, SUM(min_output) / NULLIF(SUM(min_input), 0) AS eff_pct
            FROM latest_data GROUP BY model_line, line, product_type HAVING SUM(min_input) <> 0
        ),
        product_json AS (
            SELECT model_line, line,
                   JSONB_AGG(JSONB_BUILD_OBJECT('product_type', product_type, 'eff_pct', eff_pct) ORDER BY eff_pct DESC NULLS LAST, product_type) AS product_types
            FROM product_type_eff GROUP BY model_line, line
        )
        SELECT l.model_line, l.line, x.latest_date, l.eff_pct, COALESCE(p.product_types, '[]'::jsonb) AS product_types
        FROM line_total l CROSS JOIN latest x
        LEFT JOIN product_json p ON p.model_line = l.model_line AND p.line = l.line
        ORDER BY l.model_line, CASE WHEN l.line ~ '^[0-9]+$' THEN l.line::integer ELSE 999999 END, l.line
    ''')

    DATE_MODEL_SQL = text(r'''
        SELECT e."Date"::date AS produce_date,
               BTRIM(e."Model Line"::text) AS model_line,
               SUM(NULLIF(REGEXP_REPLACE(BTRIM(e."Min Output"::text), '[^0-9.-]', '', 'g'), '')::numeric)
               / NULLIF(SUM(NULLIF(REGEXP_REPLACE(BTRIM(e."Min Input"::text), '[^0-9.-]', '', 'g'), '')::numeric), 0) AS eff_pct
        FROM public.teffdata e
        WHERE e."Date"::date BETWEEN :start_date AND :end_date
          AND NULLIF(BTRIM(e."Model Line"::text), '') IS NOT NULL
          AND (CAST(:factory AS text) IS NULL OR UPPER(BTRIM(e."FACTORY"::text)) = CAST(:factory AS text))
        GROUP BY e."Date"::date, BTRIM(e."Model Line"::text)
        HAVING SUM(NULLIF(REGEXP_REPLACE(BTRIM(e."Min Input"::text), '[^0-9.-]', '', 'g'), '')::numeric) <> 0
        ORDER BY produce_date, model_line
    ''')

    DATE_MODEL_PRODUCT_SQL = text(r'''
        SELECT e."Date"::date AS produce_date,
               BTRIM(e."Model Line"::text) AS model_line,
               COALESCE(NULLIF(BTRIM(e."PD_Type"::text), ''), 'OTHER') AS product_type,
               SUM(NULLIF(REGEXP_REPLACE(BTRIM(e."Min Output"::text), '[^0-9.-]', '', 'g'), '')::numeric)
               / NULLIF(SUM(NULLIF(REGEXP_REPLACE(BTRIM(e."Min Input"::text), '[^0-9.-]', '', 'g'), '')::numeric), 0) AS eff_pct
        FROM public.teffdata e
        WHERE e."Date"::date BETWEEN :start_date AND :end_date
          AND NULLIF(BTRIM(e."Model Line"::text), '') IS NOT NULL
          AND (CAST(:factory AS text) IS NULL OR UPPER(BTRIM(e."FACTORY"::text)) = CAST(:factory AS text))
        GROUP BY e."Date"::date, BTRIM(e."Model Line"::text), COALESCE(NULLIF(BTRIM(e."PD_Type"::text), ''), 'OTHER')
        HAVING SUM(NULLIF(REGEXP_REPLACE(BTRIM(e."Min Input"::text), '[^0-9.-]', '', 'g'), '')::numeric) <> 0
        ORDER BY produce_date, model_line, eff_pct DESC NULLS LAST, product_type
    ''')

    @router.get("/filters")
    def filters(db: Session = Depends(get_db)):
        row = db.execute(FILTERS_SQL).mappings().first()
        if not row:
            return {"min_date": None, "max_date": None, "factories": []}
        return {"min_date": row["min_date"], "max_date": row["max_date"], "factories": [x for x in (row["factories"] or []) if x]}

    @router.get("/summary")
    def summary(start_date: date, end_date: date, factory: str | None = Query(default=None), db: Session = Depends(get_db)):
        p = common_params(start_date, end_date, factory)
        row = db.execute(SUMMARY_SQL, p).mappings().first()
        return {**(dict(row) if row else {}), "last_refresh": datetime.now().astimezone()}

    @router.get("/eff-by-model-line")
    def eff_by_model_line(start_date: date, end_date: date, factory: str | None = Query(default=None), db: Session = Depends(get_db)):
        p = common_params(start_date, end_date, factory)
        return [dict(r) for r in db.execute(EFF_BY_MODEL_SQL, p).mappings().all()]

    @router.get("/product-table")
    def product_table(start_date: date, end_date: date, factory: str | None = Query(default=None), db: Session = Depends(get_db)):
        p = common_params(start_date, end_date, factory)
        return [dict(r) for r in db.execute(PRODUCT_TABLE_SQL, p).mappings().all()]

    @router.get("/latest-by-line")
    def latest_by_line(start_date: date, end_date: date, factory: str | None = Query(default=None), db: Session = Depends(get_db)):
        p = common_params(start_date, end_date, factory)
        return [dict(r) for r in db.execute(LATEST_BY_LINE_SQL, p).mappings().all()]

    @router.get("/date-model-line")
    def date_model_line(start_date: date, end_date: date, factory: str | None = Query(default=None), db: Session = Depends(get_db)):
        p = common_params(start_date, end_date, factory)
        totals = [dict(r) for r in db.execute(DATE_MODEL_SQL, p).mappings().all()]
        product_rows = [dict(r) for r in db.execute(DATE_MODEL_PRODUCT_SQL, p).mappings().all()]
        grouped: dict[tuple[date, str], list[dict]] = {}
        for row in product_rows:
            key = (row["produce_date"], row["model_line"])
            grouped.setdefault(key, []).append({
                "product_type": row["product_type"],
                "eff_pct": row["eff_pct"],
            })
        for row in totals:
            row["product_types"] = grouped.get((row["produce_date"], row["model_line"]), [])
        return totals

    return router
