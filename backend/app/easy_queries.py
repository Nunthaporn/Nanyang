from sqlalchemy import text


def numeric_expr(column: str) -> str:
    return f"""
    NULLIF(
        REPLACE(
            BTRIM({column}::text),
            ',',
            ''
        ),
        ''
    )::numeric
    """


MIN_OUTPUT = numeric_expr('e."Min Output"')
MIN_INPUT = numeric_expr('e."Min Input"')
OUTPUT_PCS = numeric_expr('e."Output pcs"')
MAN_OUT = numeric_expr('e."Man_%Out"')

# EASY LEAN charts must consistently use EasyLean Line for every factory.
# Do not switch EA back to the raw Line column; that was the old logic and
# changes the categories/values shown by EFF Last date by Line.
DISPLAY_LINE = """
NULLIF(BTRIM(e."EasyLean Line"::text), '')
"""

BASE_FILTER = f"""
    e."Date"::date BETWEEN :start_date AND :end_date
    AND (CAST(:factory AS text) IS NULL OR e."FACTORY"::text = CAST(:factory AS text))
    AND (CAST(:selected_factory AS text) IS NULL OR e."FACTORY"::text = CAST(:selected_factory AS text))
    AND (CAST(:selected_line AS text) IS NULL OR ({DISPLAY_LINE} = CAST(:selected_line AS text)))
    AND (CAST(:selected_line_factory AS text) IS NULL OR e."FACTORY"::text = CAST(:selected_line_factory AS text))
"""

SUMMARY_SQL = text(f"""
WITH filtered AS (
    SELECT e.*, {MIN_OUTPUT} AS min_output_num, {MIN_INPUT} AS min_input_num,
           {OUTPUT_PCS} AS output_pcs_num, {MAN_OUT} AS man_out_num, {DISPLAY_LINE} AS display_line
    FROM public.teffdata e WHERE {BASE_FILTER}
), latest AS (SELECT MAX("Date"::date) AS data_as_of FROM filtered)
SELECT latest.data_as_of,
       SUM(filtered.min_output_num) FILTER (WHERE filtered.display_line IS NOT NULL) / NULLIF(SUM(filtered.min_input_num) FILTER (WHERE filtered.display_line IS NOT NULL), 0) AS eff_ezlcard,
       SUM(filtered.min_output_num) AS min_produce,
       (SUM(filtered.output_pcs_num) * 60.0) / NULLIF(SUM(filtered.min_input_num), 0) AS pph,
       SUM(filtered.output_pcs_num) AS sum_pcs, SUM(filtered.man_out_num) AS operator_count,
       COUNT(DISTINCT NULLIF(BTRIM(filtered."FAC-LINE"::text), '')) AS count_line
FROM filtered CROSS JOIN latest GROUP BY latest.data_as_of
""")

MONTHLY_BY_LINE_SQL = text(f"""
WITH base AS (
    SELECT UPPER(BTRIM(e."FACTORY"::text)) AS factory,
           COALESCE(NULLIF(BTRIM(e."PD_Type"::text), ''), 'OTHER') AS product_type,
           {MIN_OUTPUT} AS min_output_num, {MIN_INPUT} AS min_input_num
    FROM public.teffdata e
    WHERE {BASE_FILTER} AND NULLIF(BTRIM(e."FACTORY"::text), '') IS NOT NULL
), factory_total AS (
    SELECT factory, SUM(min_output_num) / NULLIF(SUM(min_input_num), 0) AS eff_pct
    FROM base GROUP BY factory
), product_type_eff AS (
    SELECT factory, product_type, SUM(min_output_num) / NULLIF(SUM(min_input_num), 0) AS eff_pct
    FROM base GROUP BY factory, product_type
), product_json AS (
    SELECT factory, JSONB_AGG(JSONB_BUILD_OBJECT('product_type', product_type, 'eff_pct', eff_pct) ORDER BY eff_pct DESC NULLS LAST, product_type) AS product_types
    FROM product_type_eff GROUP BY factory
)
SELECT f.factory, f.eff_pct, COALESCE(p.product_types, '[]'::jsonb) AS product_types
FROM factory_total f LEFT JOIN product_json p ON p.factory = f.factory
ORDER BY f.eff_pct DESC NULLS LAST, f.factory
""")

LATEST_BY_LINE_SQL = text(f"""
WITH prepared AS (
    SELECT UPPER(BTRIM(e."FACTORY"::text)) AS factory, e."Date"::date AS produce_date,
           {DISPLAY_LINE} AS display_line, COALESCE(NULLIF(BTRIM(e."PD_Type"::text), ''), 'OTHER') AS product_type,
           {MIN_OUTPUT} AS min_output_num, {MIN_INPUT} AS min_input_num
    FROM public.teffdata e WHERE {BASE_FILTER} AND NULLIF(BTRIM(e."FACTORY"::text), '') IS NOT NULL
), latest_by_factory AS (
    SELECT factory, MAX(produce_date) AS latest_date FROM prepared WHERE display_line IS NOT NULL GROUP BY factory
), latest_data AS (
    SELECT p.* FROM prepared p INNER JOIN latest_by_factory l ON p.factory = l.factory AND p.produce_date = l.latest_date WHERE p.display_line IS NOT NULL
), line_total AS (
    SELECT factory, display_line AS line, SUM(min_output_num) / NULLIF(SUM(min_input_num), 0) AS eff_pct FROM latest_data GROUP BY factory, display_line
), product_type_eff AS (
    SELECT factory, display_line AS line, product_type, SUM(min_output_num) / NULLIF(SUM(min_input_num), 0) AS eff_pct FROM latest_data GROUP BY factory, display_line, product_type
), product_json AS (
    SELECT factory, line, JSONB_AGG(JSONB_BUILD_OBJECT('product_type', product_type, 'eff_pct', eff_pct) ORDER BY eff_pct DESC NULLS LAST, product_type) AS product_types
    FROM product_type_eff GROUP BY factory, line
)
SELECT l.factory, l.line, l.eff_pct, COALESCE(p.product_types, '[]'::jsonb) AS product_types
FROM line_total l LEFT JOIN product_json p ON p.factory = l.factory AND p.line = l.line
WHERE l.eff_pct IS NOT NULL AND l.eff_pct > 0
ORDER BY CASE l.factory WHEN 'G1' THEN 1 WHEN 'G2' THEN 2 WHEN 'G3' THEN 3 WHEN 'G4' THEN 4 WHEN 'TRM' THEN 5 WHEN 'EA' THEN 6 ELSE 99 END,
         CASE WHEN l.line ~ '^[0-9]+$' THEN l.line::integer ELSE 999999 END, l.line
""")

MONTHLY_FACTORY_SQL = text(f"""
SELECT TO_CHAR(DATE_TRUNC('month', e."Date"::date), 'YYYY-MM') AS period,
       UPPER(BTRIM(e."FACTORY"::text)) AS factory,
       SUM({MIN_OUTPUT}) / NULLIF(SUM({MIN_INPUT}), 0) AS eff_pct
FROM public.teffdata e
WHERE {BASE_FILTER} AND NULLIF(BTRIM(e."FACTORY"::text), '') IS NOT NULL
GROUP BY DATE_TRUNC('month', e."Date"::date), UPPER(BTRIM(e."FACTORY"::text))
ORDER BY DATE_TRUNC('month', e."Date"::date), CASE UPPER(BTRIM(e."FACTORY"::text)) WHEN 'G1' THEN 1 WHEN 'G2' THEN 2 WHEN 'G3' THEN 3 WHEN 'G4' THEN 4 WHEN 'TRM' THEN 5 WHEN 'EA' THEN 6 ELSE 99 END
""")

LAST_10_DAYS_SQL = text(f"""
WITH filtered_dates AS (
    SELECT DISTINCT e."Date"::date AS d FROM public.teffdata e WHERE {BASE_FILTER} ORDER BY d DESC LIMIT 10
)
SELECT TO_CHAR(e."Date"::date, 'YYYY-MM-DD') AS period,
       UPPER(BTRIM(e."FACTORY"::text)) AS factory,
       SUM({MIN_OUTPUT}) / NULLIF(SUM({MIN_INPUT}), 0) AS eff_pct
FROM public.teffdata e
WHERE {BASE_FILTER} AND e."Date"::date IN (SELECT d FROM filtered_dates) AND NULLIF(BTRIM(e."FACTORY"::text), '') IS NOT NULL
GROUP BY e."Date"::date, UPPER(BTRIM(e."FACTORY"::text))
ORDER BY e."Date"::date, CASE UPPER(BTRIM(e."FACTORY"::text)) WHEN 'G1' THEN 1 WHEN 'G2' THEN 2 WHEN 'G3' THEN 3 WHEN 'G4' THEN 4 WHEN 'TRM' THEN 5 WHEN 'EA' THEN 6 ELSE 99 END
""")

FILTERS_SQL = text("""
SELECT MIN(e."Date"::date) AS min_date, MAX(e."Date"::date) AS max_date,
       ARRAY_AGG(DISTINCT UPPER(BTRIM(e."FACTORY"::text)) ORDER BY UPPER(BTRIM(e."FACTORY"::text))) FILTER (WHERE NULLIF(BTRIM(e."FACTORY"::text), '') IS NOT NULL) AS factories
FROM public.teffdata e
""")

SCHEMA_SQL = text("""
SELECT ordinal_position, column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'teffdata' ORDER BY ordinal_position
""")
