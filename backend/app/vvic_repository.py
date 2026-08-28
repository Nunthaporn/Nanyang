from sqlalchemy import text

DIMENSION_FILTER = """
(
    CAST(:factories AS text[]) IS NULL
    OR e."FACTORY" = ANY(CAST(:factories AS text[]))
)
AND (
    CAST(:customer AS text) IS NULL
    OR e."BRAND_NAME" = CAST(:customer AS text)
)
AND (
    CAST(:customer_type AS text) = 'ALL'
    OR EXISTS (
        SELECT 1
        FROM public.customer_vvic_map m
        WHERE TRIM(m.cust) = TRIM(e."Cust")
          AND TRIM(m.brand_name) = TRIM(e."BRAND_NAME")
          AND m.customer_type = CAST(:customer_type AS text)
    )
)
"""

DATE_FILTER = f"""
e."Date"::date BETWEEN :start_date AND :end_date
AND {DIMENSION_FILTER}
"""


def summary_query():
    return text(f"""
WITH latest AS (
    SELECT MAX(e."Date"::date) AS latest_date
    FROM public.teffdata e
    WHERE e."Date"::date <= CAST(:end_date AS date)
      AND {DIMENSION_FILTER}
),
periods AS (
    SELECT latest_date,
           date_trunc('year', latest_date)::date AS ytd_start,
           date_trunc('quarter', latest_date)::date AS qtd_start,
           date_trunc('month', latest_date)::date AS mtd_start
    FROM latest
)
SELECT
    p.latest_date AS data_as_of,
    (SUM(e."Min Output") FILTER (WHERE e."Date"::date BETWEEN p.ytd_start AND p.latest_date))::numeric
      / NULLIF(SUM(e."Min Input") FILTER (WHERE e."Date"::date BETWEEN p.ytd_start AND p.latest_date), 0) AS ytd_eff_pct,
    (SUM(e."Min Output") FILTER (WHERE e."Date"::date BETWEEN p.qtd_start AND p.latest_date))::numeric
      / NULLIF(SUM(e."Min Input") FILTER (WHERE e."Date"::date BETWEEN p.qtd_start AND p.latest_date), 0) AS qtd_eff_pct,
    (SUM(e."Min Output") FILTER (WHERE e."Date"::date BETWEEN p.mtd_start AND p.latest_date))::numeric
      / NULLIF(SUM(e."Min Input") FILTER (WHERE e."Date"::date BETWEEN p.mtd_start AND p.latest_date), 0) AS mtd_eff_pct
FROM public.teffdata e
CROSS JOIN periods p
WHERE p.latest_date IS NOT NULL
  AND e."Date"::date BETWEEN p.ytd_start AND p.latest_date
  AND {DIMENSION_FILTER}
GROUP BY p.latest_date, p.ytd_start, p.qtd_start, p.mtd_start
""")


def monthly_query():
    return text("""
WITH customer_map AS (
    SELECT TRIM("Cust") AS cust,
           CASE WHEN COUNT(DISTINCT TRIM("VVIC")) = 1 THEN MAX(TRIM("VVIC")) ELSE NULL END AS customer_type
    FROM public.mt_cus
    WHERE NULLIF(TRIM("Cust"), '') IS NOT NULL
    GROUP BY TRIM("Cust")
),
base AS (
    SELECT e."Date", e."Min Output", e."Min Input",
           COALESCE(cm.customer_type, NULLIF(TRIM(e."Cust_Type"), '')) AS customer_type
    FROM public.teffdata e
    LEFT JOIN customer_map cm ON cm.cust = TRIM(e."Cust")
    WHERE e."Date"::date BETWEEN :start_date AND :end_date
      AND (CAST(:factories AS text[]) IS NULL OR e."FACTORY" = ANY(CAST(:factories AS text[])))
      AND (CAST(:customer AS text) IS NULL OR e."BRAND_NAME" = CAST(:customer AS text))
)
SELECT to_char(date_trunc('month', "Date"::date), 'YYYY-MM') AS month,
       customer_type,
       SUM("Min Output")::numeric / NULLIF(SUM("Min Input"), 0) AS eff_pct
FROM base
WHERE customer_type IN ('VVIC', 'NON-VVIC')
GROUP BY 1, 2
ORDER BY 1, 2
""")


def factory_query():
    return text(f"""
SELECT to_char(date_trunc('month', e."Date"::date), 'YYYY-MM') AS month,
       TRIM(e."FACTORY") AS factory,
       SUM(e."Min Output")::numeric / NULLIF(SUM(e."Min Input"), 0) AS eff_pct
FROM public.teffdata e
WHERE {DATE_FILTER}
  AND NULLIF(TRIM(e."FACTORY"), '') IS NOT NULL
GROUP BY 1, TRIM(e."FACTORY")
ORDER BY 1, 2
""")


def factory_product_query():
    return text(f"""
SELECT to_char(date_trunc('month', e."Date"::date), 'YYYY-MM') AS month,
       TRIM(e."FACTORY") AS factory,
       COALESCE(NULLIF(TRIM(e."PD_Type"), ''), 'OTHER') AS product_type,
       SUM(e."Min Output")::numeric / NULLIF(SUM(e."Min Input"), 0) AS eff_pct
FROM public.teffdata e
WHERE {DATE_FILTER}
  AND NULLIF(TRIM(e."FACTORY"), '') IS NOT NULL
GROUP BY 1, TRIM(e."FACTORY"), COALESCE(NULLIF(TRIM(e."PD_Type"), ''), 'OTHER')
ORDER BY 1, 2, 4 DESC
""")


def customer_mtd_query():
    return text(f"""
WITH customer_map AS (
    SELECT TRIM("Cust") AS cust,
           CASE WHEN COUNT(DISTINCT TRIM("VVIC")) = 1 THEN MAX(TRIM("VVIC")) ELSE NULL END AS customer_type
    FROM public.mt_cus
    WHERE NULLIF(TRIM("Cust"), '') IS NOT NULL
    GROUP BY TRIM("Cust")
),
latest AS (
    SELECT MAX(e."Date"::date) AS latest_date
    FROM public.teffdata e
    LEFT JOIN customer_map cm ON cm.cust = TRIM(e."Cust")
    WHERE e."Date"::date <= CAST(:end_date AS date)
      AND (CAST(:factories AS text[]) IS NULL OR e."FACTORY" = ANY(CAST(:factories AS text[])))
      AND (CAST(:customer AS text) IS NULL OR e."BRAND_NAME" = CAST(:customer AS text))
      AND (
        CAST(:customer_type AS text) = 'ALL'
        OR COALESCE(cm.customer_type, NULLIF(TRIM(e."Cust_Type"), '')) = CAST(:customer_type AS text)
      )
),
period AS (
    SELECT latest_date, date_trunc('month', latest_date)::date AS mtd_start
    FROM latest
)
SELECT TRIM(e."BRAND_NAME") AS customer,
       to_char(p.latest_date, 'YYYY-MM') AS month,
       SUM(e."Min Output")::numeric / NULLIF(SUM(e."Min Input"), 0) AS eff_pct
FROM public.teffdata e
LEFT JOIN customer_map cm ON cm.cust = TRIM(e."Cust")
CROSS JOIN period p
WHERE p.latest_date IS NOT NULL
  AND e."Date"::date BETWEEN p.mtd_start AND p.latest_date
  AND (CAST(:factories AS text[]) IS NULL OR e."FACTORY" = ANY(CAST(:factories AS text[])))
  AND (CAST(:customer AS text) IS NULL OR e."BRAND_NAME" = CAST(:customer AS text))
  AND (
    CAST(:customer_type AS text) = 'ALL'
    OR COALESCE(cm.customer_type, NULLIF(TRIM(e."Cust_Type"), '')) = CAST(:customer_type AS text)
  )
  AND NULLIF(TRIM(e."BRAND_NAME"), '') IS NOT NULL
GROUP BY TRIM(e."BRAND_NAME"), p.latest_date
ORDER BY eff_pct DESC
""")


def customer_factory_mtd_query():
    return text(f"""
WITH customer_map AS (
    SELECT TRIM("Cust") AS cust,
           CASE WHEN COUNT(DISTINCT TRIM("VVIC")) = 1 THEN MAX(TRIM("VVIC")) ELSE NULL END AS customer_type
    FROM public.mt_cus
    WHERE NULLIF(TRIM("Cust"), '') IS NOT NULL
    GROUP BY TRIM("Cust")
),
latest AS (
    SELECT MAX(e."Date"::date) AS latest_date
    FROM public.teffdata e
    LEFT JOIN customer_map cm ON cm.cust = TRIM(e."Cust")
    WHERE e."Date"::date <= CAST(:end_date AS date)
      AND (CAST(:factories AS text[]) IS NULL OR e."FACTORY" = ANY(CAST(:factories AS text[])))
      AND (CAST(:customer AS text) IS NULL OR e."BRAND_NAME" = CAST(:customer AS text))
      AND (
        CAST(:customer_type AS text) = 'ALL'
        OR COALESCE(cm.customer_type, NULLIF(TRIM(e."Cust_Type"), '')) = CAST(:customer_type AS text)
      )
),
period AS (
    SELECT latest_date, date_trunc('month', latest_date)::date AS mtd_start
    FROM latest
)
SELECT TRIM(e."BRAND_NAME") AS customer,
       TRIM(e."FACTORY") AS factory,
       to_char(p.latest_date, 'YYYY-MM') AS month,
       SUM(e."Min Output")::numeric / NULLIF(SUM(e."Min Input"), 0) AS eff_pct
FROM public.teffdata e
LEFT JOIN customer_map cm ON cm.cust = TRIM(e."Cust")
CROSS JOIN period p
WHERE p.latest_date IS NOT NULL
  AND e."Date"::date BETWEEN p.mtd_start AND p.latest_date
  AND (CAST(:factories AS text[]) IS NULL OR e."FACTORY" = ANY(CAST(:factories AS text[])))
  AND (CAST(:customer AS text) IS NULL OR e."BRAND_NAME" = CAST(:customer AS text))
  AND (
    CAST(:customer_type AS text) = 'ALL'
    OR COALESCE(cm.customer_type, NULLIF(TRIM(e."Cust_Type"), '')) = CAST(:customer_type AS text)
  )
  AND NULLIF(TRIM(e."BRAND_NAME"), '') IS NOT NULL
  AND NULLIF(TRIM(e."FACTORY"), '') IS NOT NULL
GROUP BY TRIM(e."BRAND_NAME"), TRIM(e."FACTORY"), p.latest_date
ORDER BY customer, eff_pct DESC
""")
