import { useEffect, useMemo, useState } from "react";

import KpiCard from "./components/KpiCard";
import HorizontalEffChart from "./components/HorizontalEffChart";
import LatestLineChart from "./components/LatestLineChart";
import RibbonLikeChart from "./components/RibbonLikeChart";
import { getDashboard, getFilters, getHealth } from "./services/api";
import type { FactoryEff, FilterMeta, LatestLine, PeriodFactory, Summary } from "./types/dashboard";
import "./styles.css";

const fmtPct = (v: number | null | undefined, d = 2) =>
  v == null ? "-" : `${(v * 100).toFixed(d)}%`;

const fmtNum = (v: number | null | undefined, d = 0) =>
  v == null
    ? "-"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      }).format(v);

const fmtM = (v: number | null | undefined) =>
  v == null ? "-" : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : fmtNum(v);

export default function EasyLeanDashboard() {
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [factory, setFactory] = useState("ALL");
  const [selectedChartFactory, setSelectedChartFactory] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [selectedLineFactory, setSelectedLineFactory] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<FactoryEff[]>([]);
  const [latest, setLatest] = useState<LatestLine[]>([]);
  const [monthlyFactory, setMonthlyFactory] = useState<PeriodFactory[]>([]);
  const [last10, setLast10] = useState<PeriodFactory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dbStatus, setDbStatus] = useState("checking");

  useEffect(() => {
    let active = true;
    Promise.all([getFilters(), getHealth()])
      .then(([m, h]) => {
        if (!active) return;
        setMeta(m);
        setDbStatus(h.database);
        const fallbackEnd = m.max_date || new Date().toISOString().slice(0, 10);
        const year = fallbackEnd.slice(0, 4);
        setStartDate(`${year}-01-01`);
        setEndDate(fallbackEnd);
      })
      .catch((err) => {
        console.error(err);
        if (active) setError("Unable to connect to backend");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    let active = true;
    setLoading(true);
    setError("");

    getDashboard(
      startDate,
      endDate,
      factory,
      selectedChartFactory,
      selectedLine,
      selectedLineFactory,
    )
      .then((data) => {
        if (!active) return;
        setSummary(data.summary);
        setMonthly(data.monthly);
        setLatest(data.latest);
        setMonthlyFactory(data.monthlyFactory);
        setLast10(data.last10);
      })
      .catch((err) => {
        console.error(err);
        if (active) setError("Unable to load dashboard data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    startDate,
    endDate,
    factory,
    selectedChartFactory,
    selectedLine,
    selectedLineFactory,
  ]);

  const handleFactorySelect = (selected: string) => {
    if (selectedChartFactory === selected) {
      setSelectedChartFactory(null);
      setSelectedLine(null);
      setSelectedLineFactory(null);
      return;
    }
    setSelectedChartFactory(selected);
    setSelectedLine(null);
    setSelectedLineFactory(null);
  };

  const handleLineSelect = (line: string, lineFactory: string | null) => {
    const same = selectedLine === line && selectedLineFactory === lineFactory;
    if (same) {
      setSelectedLine(null);
      setSelectedLineFactory(null);
      return;
    }
    setSelectedLine(line);
    setSelectedLineFactory(lineFactory);
    if (lineFactory) setSelectedChartFactory(lineFactory);
  };

  const clearCrossFilter = () => {
    setSelectedChartFactory(null);
    setSelectedLine(null);
    setSelectedLineFactory(null);
  };

  const handleFactoryTab = (value: string) => {
    setFactory(value);
    clearCrossFilter();
  };

  const year = useMemo(() => (endDate ? endDate.slice(0, 4) : ""), [endDate]);
  const factories = ["ALL", ...(meta?.factories ?? [])];

  return (
    <main className="ez-page">
      <header className="ez-topbar">
        <h1>EASY LEAN-Line - {year || "Dashboard"}</h1>

        <div className="ez-date-group">
          <input
            type="date"
            value={startDate}
            min={meta?.min_date ?? undefined}
            max={endDate || undefined}
            onChange={(e) => {
              setStartDate(e.target.value);
              clearCrossFilter();
            }}
          />
          <input
            type="date"
            value={endDate}
            min={startDate || meta?.min_date || undefined}
            max={meta?.max_date ?? undefined}
            onChange={(e) => {
              setEndDate(e.target.value);
              clearCrossFilter();
            }}
          />
        </div>

        <div className="ez-tabs">
          {factories.map((f) => (
            <button
              key={f}
              type="button"
              className={factory === f ? "active" : ""}
              onClick={() => handleFactoryTab(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="ez-refresh">
          <strong>{summary ? new Date(summary.last_refresh).toLocaleString() : ""}</strong>
          <small>Latest Refresh Date</small>
          <span className={`ez-status ${dbStatus}`}>PostgreSQL {dbStatus}</span>
        </div>
      </header>

      <section className="ez-dashboard">
        {error && <div className="ez-error">{error}</div>}
        <div className={`ez-content ${loading ? "loading" : ""}`}>
          {(selectedChartFactory || selectedLine) && (
            <div className="ez-cross-filter-bar">
              <span>Selected:</span>
              {selectedChartFactory && <strong>Factory {selectedChartFactory}</strong>}
              {selectedLine && <strong>Line {selectedLine}</strong>}
              <button type="button" onClick={clearCrossFilter}>Clear</button>
            </div>
          )}

          <div className="ez-kpis">
            <KpiCard label="EFF% EZLcard" value={fmtPct(summary?.eff_ezlcard)} />
            <KpiCard label="Min Produce" value={fmtM(summary?.min_produce)} />
            <KpiCard label="PPH" value={fmtNum(summary?.pph, 2)} />
            <KpiCard label="SumPcs." value={fmtNum(summary?.sum_pcs)} />
            <KpiCard label="#Of Operator" value={fmtNum(summary?.operator_count)} />
            <KpiCard label="CountLine" value={fmtNum(summary?.count_line)} />
          </div>

          <div className="ez-grid ez-top-charts">
            <section className="ez-panel">
              <h2>%EFF Monthly by Line</h2>
              {monthly.length ? (
                <HorizontalEffChart
                  data={monthly}
                  selectedFactory={selectedChartFactory}
                  onSelect={handleFactorySelect}
                />
              ) : (
                <div className="ez-empty">No data</div>
              )}
            </section>

            <section className="ez-panel">
              <h2>EFF Last date by Line</h2>
              {latest.length ? (
                <LatestLineChart
                  data={latest}
                  selectedLine={selectedLine}
                  onSelect={handleLineSelect}
                />
              ) : (
                <div className="ez-empty">No data</div>
              )}
            </section>
          </div>

          <div className="ez-grid ez-bottom-charts">
            <section className="ez-panel">
              <h2>EFF% by Year, Month and EasyLean Fac</h2>
              {monthlyFactory.length ? (
                <RibbonLikeChart
                  data={monthlyFactory}
                  mode="monthly"
                  selectedFactory={selectedChartFactory}
                  onFactorySelect={handleFactorySelect}
                />
              ) : (
                <div className="ez-empty">No data</div>
              )}
            </section>

            <section className="ez-panel">
              <h2>Last 10Days EFF% of EasyLean by Factory</h2>
              {last10.length ? (
                <RibbonLikeChart
                  data={last10}
                  mode="daily"
                  selectedFactory={selectedChartFactory}
                  onFactorySelect={handleFactorySelect}
                />
              ) : (
                <div className="ez-empty">No data</div>
              )}
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
