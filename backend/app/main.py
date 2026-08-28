from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from . import vvic_config
from . import vvic_database
from . import vvic_mock_data as vvic_mock
from . import vvic_repository
from .easy_router import router as easy_router

ROOT = Path(__file__).resolve().parents[2]
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


# EASY LEAN routes live only in easy_router. Keeping one source of truth prevents
# legacy route definitions from shadowing the current EasyLean Line logic.
app.include_router(easy_router)


@app.get("/api")
def api_root():
    return {"name": "Nanyang Dashboard API", "vvic": "/api/dashboard/*", "easy_lean": "/api/easylean/*"}


frontend_dist = ROOT / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
