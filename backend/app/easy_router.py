from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .vvic_database import engine
from .easy_queries import (
    FILTERS_SQL,
    LAST_10_DAYS_SQL,
    LATEST_BY_LINE_SQL,
    MONTHLY_BY_LINE_SQL,
    MONTHLY_FACTORY_SQL,
    SCHEMA_SQL,
    SUMMARY_SQL,
)

router = APIRouter(prefix="/api/easylean", tags=["EasyLean"])


def make_params(
    start_date: date,
    end_date: date,
    factory: str | None,
    selected_factory: str | None,
    selected_line: str | None,
    selected_line_factory: str | None,
):
    if start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be <= end_date")
    return {
        "start_date": start_date,
        "end_date": end_date,
        "factory": factory or None,
        "selected_factory": selected_factory or None,
        "selected_line": selected_line or None,
        "selected_line_factory": selected_line_factory or None,
    }


def rows(sql, values):
    try:
        with engine.connect() as conn:
            return [dict(row) for row in conn.execute(sql, values).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/health")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"database": "connected"}
    except SQLAlchemyError:
        return {"database": "disconnected"}


@router.get("/schema")
def schema():
    return rows(SCHEMA_SQL, {})


@router.get("/filters")
def filters():
    result = rows(FILTERS_SQL, {})
    if not result:
        return {"min_date": None, "max_date": None, "factories": []}
    row = result[0]
    preferred = ["G1", "G2", "G3", "G4", "TRM", "EA"]
    found = [x for x in (row.get("factories") or []) if x]
    ordered = [x for x in preferred if x in found] + [x for x in found if x not in preferred]
    return {
        "min_date": row.get("min_date"),
        "max_date": row.get("max_date"),
        "factories": ordered,
    }


def filter_values(
    start_date: date,
    end_date: date,
    factory: str | None,
    selected_factory: str | None,
    selected_line: str | None,
    selected_line_factory: str | None,
):
    return make_params(
        start_date,
        end_date,
        factory,
        selected_factory,
        selected_line,
        selected_line_factory,
    )


@router.get("/summary")
def summary(
    start_date: date,
    end_date: date,
    factory: str | None = Query(default=None),
    selected_factory: str | None = Query(default=None),
    selected_line: str | None = Query(default=None),
    selected_line_factory: str | None = Query(default=None),
):
    values = filter_values(
        start_date,
        end_date,
        factory,
        selected_factory,
        selected_line,
        selected_line_factory,
    )
    result = rows(SUMMARY_SQL, values)
    if not result:
        return {
            "data_as_of": None,
            "eff_ezlcard": None,
            "min_produce": None,
            "pph": None,
            "sum_pcs": None,
            "operator_count": None,
            "count_line": 0,
            "last_refresh": datetime.now().astimezone(),
        }
    return {**result[0], "last_refresh": datetime.now().astimezone()}


@router.get("/monthly-by-line")
def monthly_by_line(
    start_date: date,
    end_date: date,
    factory: str | None = Query(default=None),
    selected_factory: str | None = Query(default=None),
    selected_line: str | None = Query(default=None),
    selected_line_factory: str | None = Query(default=None),
):
    return rows(
        MONTHLY_BY_LINE_SQL,
        filter_values(start_date, end_date, factory, selected_factory, selected_line, selected_line_factory),
    )


@router.get("/latest-by-line")
def latest_by_line(
    start_date: date,
    end_date: date,
    factory: str | None = Query(default=None),
    selected_factory: str | None = Query(default=None),
    selected_line: str | None = Query(default=None),
    selected_line_factory: str | None = Query(default=None),
):
    return rows(
        LATEST_BY_LINE_SQL,
        filter_values(start_date, end_date, factory, selected_factory, selected_line, selected_line_factory),
    )


@router.get("/monthly-by-factory")
def monthly_by_factory(
    start_date: date,
    end_date: date,
    factory: str | None = Query(default=None),
    selected_factory: str | None = Query(default=None),
    selected_line: str | None = Query(default=None),
    selected_line_factory: str | None = Query(default=None),
):
    return rows(
        MONTHLY_FACTORY_SQL,
        filter_values(start_date, end_date, factory, selected_factory, selected_line, selected_line_factory),
    )


@router.get("/last-10-days")
def last_10_days(
    start_date: date,
    end_date: date,
    factory: str | None = Query(default=None),
    selected_factory: str | None = Query(default=None),
    selected_line: str | None = Query(default=None),
    selected_line_factory: str | None = Query(default=None),
):
    return rows(
        LAST_10_DAYS_SQL,
        filter_values(start_date, end_date, factory, selected_factory, selected_line, selected_line_factory),
    )
