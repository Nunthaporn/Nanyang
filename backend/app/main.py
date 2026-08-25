from __future__ import annotations

from datetime import date, datetime
import importlib
import importlib.util
from pathlib import Path
import sys

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]


def load_package(name: str, package_dir: Path):
    spec = importlib.util.spec_from_file_location(
        name,
        package_dir / "__init__.py",
        submodule_search_locations=[str(package_dir)],
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load package {name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


load_package("vvic_src", ROOT / "apps" / "vvic" / "backend" / "app")
load_package("easy_src", ROOT / "apps" / "easy-lean" / "backend" / "app")

vvic_config = importlib.import_module("vvic_src.config")
vvic_database = importlib.import_module("vvic_src.database")
vvic_mock = importlib.import_module("vvic_src.mock_data")
vvic_repository = importlib.import_module("vvic_src.repository")
easy_database = importlib.import_module("easy_src.database")
easy_router = importlib.import_module("easy_src.routers.easylean").router

settings = vvic_config.get_settings()
get_db = vvic_database.get_db

app = FastAPI(title="Nanyang Dashboard API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://172.16.88.141:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def params(start_date: date | None, end_date: date | None, customer_type: str, factory: list[str], customer: str | None):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(422, "start_date must be before end_date")
    return {
        "start_date": start_date or date(2023, 9, 1),
        "end_date": end_date or date.today(),
        "customer_type": customer_type.upper(),
        "factories": factory or None,
        "customer": customer,
    }


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    if settings.data_mode == "mock":
        return {"status": "ok", "database": "mock"}
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        raise HTTPException(503, "Database unavailable")


@app.get("/api/dashboard/summary")
def summary(start_date: date | None = None, end_date: date | None = None, customer_type: str = "ALL", factory: list[str] = Query(default=[]), customer: str | None = None, db: Session = Depends(get_db)):
    p = params(start_date, end_date, customer_type, factory, customer)
    if settings.data_mode == "mock":
        return vvic_mock.summary(p)
    row = db.execute(vvic_repository.summary_query(), p).mappings().first()
    return {**(dict(row) if row else {"data_as_of": None, "ytd_eff_pct": None, "qtd_eff_pct": None, "mtd_eff_pct": None}), "last_refresh": datetime.now().astimezone(), "active_filters": p}


@app.get("/api/dashboard/monthly-comparison")
def monthly_comparison(start_date: date | None = None, end_date: date | None = None, customer_type: str = "ALL", factory: list[str] = Query(default=[]), customer: str | None = None, db: Session = Depends(get_db)):
    p = params(start_date, end_date, customer_type, factory, customer)
    if settings.data_mode == "mock":
        return vvic_mock.monthly(factory, customer, p["start_date"], p["end_date"])
    rows = db.execute(vvic_repository.monthly_query(), p).mappings()
    out = {}
    for r in rows:
        out.setdefault(r["month"], {"month": r["month"], "vvic": None, "non_vvic": None})["vvic" if r["customer_type"] == "VVIC" else "non_vvic"] = r["eff_pct"]
    return list(out.values())


@app.get("/api/dashboard/factory-monthly")
def factory_monthly(start_date: date | None = None, end_date: date | None = None, customer_type: str = "ALL", factory: list[str] = Query(default=[]), customer: str | None = None, db: Session = Depends(get_db)):
    p = params(start_date, end_date, customer_type, factory, customer)
    return vvic_mock.factory_monthly(factory, customer, p["start_date"], p["end_date"]) if settings.data_mode == "mock" else [dict(x) for x in db.execute(vvic_repository.factory_query(), p).mappings()]


@app.get("/api/dashboard/factory-product-breakdown")
def factory_product_breakdown(start_date: date | None = None, end_date: date | None = None, customer_type: str = "ALL", factory: list[str] = Query(default=[]), customer: str | None = None, db: Session = Depends(get_db)):
    p = params(start_date, end_date, customer_type, factory, customer)
    return vvic_mock.factory_product_breakdown(factory, customer, p["start_date"], p["end_date"]) if settings.data_mode == "mock" else [dict(x) for x in db.execute(vvic_repository.factory_product_query(), p).mappings()]


@app.get("/api/dashboard/customer-mtd")
def customer_mtd(target: float = 0.60, start_date: date | None = None, end_date: date | None = None, customer_type: str = "VVIC", factory: list[str] = Query(default=[]), customer: str | None = None, db: Session = Depends(get_db)):
    p = params(start_date, end_date, customer_type, factory, customer)
    if settings.data_mode == "mock":
        return vvic_mock.customer_mtd(target, factory, customer, p["end_date"])
    return [{**dict(x), "target": target} for x in db.execute(vvic_repository.customer_mtd_query(), p).mappings()]


@app.get("/api/dashboard/customer-factory-mtd")
def customer_factory_mtd(start_date: date | None = None, end_date: date | None = None, customer_type: str = "VVIC", factory: list[str] = Query(default=[]), customer: str | None = None, db: Session = Depends(get_db)):
    p = params(start_date, end_date, customer_type, factory, customer)
    if settings.data_mode == "mock":
        return vvic_mock.customer_factory_mtd(factory, customer, p["end_date"])
    return [dict(x) for x in db.execute(vvic_repository.customer_factory_mtd_query(), p).mappings()]


@app.get("/api/dashboard/filters")
def filters():
    return {"customer_types": ["VVIC", "NON-VVIC"], "factories": ["G1", "G2", "G3", "G4", "TRM", "EA"], "default_target": settings.default_target}


@app.get("/api/dashboard/last-refresh")
def last_refresh():
    return {"last_refresh": vvic_mock.LAST_REFRESH if settings.data_mode == "mock" else datetime.now().astimezone()}


@app.get("/api/dashboard/details")
def details(page: int = 1, page_size: int = Query(50, le=200)):
    return {"items": [], "page": page, "page_size": page_size, "total": 0}


# EFF Last date by Line: use teffdata."EasyLean Line" for every factory,
# including EA. Latest date remains calculated per factory, matching the
# existing chart logic. Product Type tooltip comes from teffdata."PD_Type".
EASY_LATEST_BY_LINE_SQL = text(r'''
WITH prepared AS (
    SELECT
        e."FACTORY"::text AS factory,
        e."Date"::date AS produce_date,
        NULLIF(BTRIM(e."EasyLean Line"::text), '') AS display_line,
        COALESCE(NULLIF(BTRIM(e."PD_Type"::text), ''), 'UNKNOWN') AS product_type,
        NULLIF(REPLACE(BTRIM(e."Min Output"::text), ',', ''), '')::numeric AS min_output_num,
        NULLIF(REPLACE(BTRIM(e."Min Input"::text), ',', ''), '')::numeric AS min_input_num
    FROM public.teffdata e
    WHERE
        e."Date"::date BETWEEN :start_date AND :end_date
        AND (CAST(:factory AS text) IS NULL OR e."FACTORY"::text = CAST(:factory AS text))
        AND (CAST(:selected_factory AS text) IS NULL OR e."FACTORY"::text = CAST(:selected_factory AS text))
        AND (
            CAST(:selected_line AS text) IS NULL
            OR NULLIF(BTRIM(e."EasyLean Line"::text), '') = CAST(:selected_line AS text)
        )
        AND (
            CAST(:selected_line_factory AS text) IS NULL
            OR e."FACTORY"::text = CAST(:selected_line_factory AS text)
        )
        AND e."FACTORY" IS NOT NULL
        AND BTRIM(e."FACTORY"::text) <> ''
),
latest_by_factory AS (
    SELECT factory, MAX(produce_date) AS latest_date
    FROM prepared
    WHERE display_line IS NOT NULL
    GROUP BY factory
),
latest_data AS (
    SELECT p.*
    FROM prepared p
    INNER JOIN latest_by_factory l
        ON p.factory = l.factory
       AND p.produce_date = l.latest_date
    WHERE p.display_line IS NOT NULL
),
line_total AS (
    SELECT
        factory,
        display_line AS line,
        SUM(min_output_num) / NULLIF(SUM(min_input_num), 0) AS eff_pct
    FROM latest_data
    GROUP BY factory, display_line
),
product_type_eff AS (
    SELECT
        factory,
        display_line AS line,
        product_type,
        SUM(min_output_num) / NULLIF(SUM(min_input_num), 0) AS eff_pct
    FROM latest_data
    WHERE product_type <> 'UNKNOWN'
    GROUP BY factory, display_line, product_type
),
product_json AS (
    SELECT
        factory,
        line,
        JSONB_AGG(
            JSONB_BUILD_OBJECT('product_type', product_type, 'eff_pct', eff_pct)
            ORDER BY eff_pct DESC NULLS LAST, product_type
        ) AS product_types
    FROM product_type_eff
    GROUP BY factory, line
)
SELECT
    l.factory,
    l.line,
    l.eff_pct,
    COALESCE(p.product_types, '[]'::jsonb) AS product_types
FROM line_total l
LEFT JOIN product_json p
    ON p.factory = l.factory
   AND p.line = l.line
WHERE l.eff_pct IS NOT NULL
  AND l.eff_pct > 0
ORDER BY
    CASE l.factory
        WHEN 'G1' THEN 1
        WHEN 'G2' THEN 2
        WHEN 'G3' THEN 3
        WHEN 'G4' THEN 4
        WHEN 'TRM' THEN 5
        WHEN 'EA' THEN 6
        ELSE 99
    END,
    CASE WHEN l.line ~ '^[0-9]+$' THEN l.line::integer ELSE 999999 END,
    l.line
''')


@app.get("/api/easylean/latest-by-line")
def easy_latest_by_line(
    start_date: date,
    end_date: date,
    factory: str | None = Query(default=None),
    selected_factory: str | None = Query(default=None),
    selected_line: str | None = Query(default=None),
    selected_line_factory: str | None = Query(default=None),
):
    if start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be <= end_date")

    values = {
        "start_date": start_date,
        "end_date": end_date,
        "factory": factory or None,
        "selected_factory": selected_factory or None,
        "selected_line": selected_line or None,
        "selected_line_factory": selected_line_factory or None,
    }

    try:
        with easy_database.engine.connect() as conn:
            result = conn.execute(EASY_LATEST_BY_LINE_SQL, values)
            return [dict(row) for row in result.mappings().all()]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Include the original Easy Lean routes after the override above. FastAPI/Starlette
# resolves the first matching route, so the fixed latest-by-line endpoint wins.
app.include_router(easy_router)


@app.get("/api")
def api_root():
    return {"name": "Nanyang Dashboard API", "vvic": "/api/dashboard/*", "easy_lean": "/api/easylean/*"}


frontend_dist = ROOT / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
