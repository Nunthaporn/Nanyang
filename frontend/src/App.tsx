import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

const ExecutiveSummaryDashboard = lazy(() => import("./executive/ExecutiveSummaryDashboard"));
const OverviewDashboard = lazy(() => import("./overview/OverviewDashboard"));
const Overview02Dashboard = lazy(() => import("./overview02/Overview02Dashboard"));
const MinVSEffDashboard = lazy(() => import("./min-vs-eff/MinVSEffDashboard"));
const ModelLineDashboard = lazy(() => import("./model-line/ModelLineDashboard"));
const EasyLeanDashboard = lazy(() => import("./easy-lean/EasyLeanDashboard"));
const VVICDashboard = lazy(() => import("./vvic/VVICDashboard"));

type DashboardKey = "executive" | "overview" | "overview02" | "min-vs-eff" | "model-line" | "easy-lean" | "vvic";
type SharedDates = { startDate: string; endDate: string };

const DATE_STORAGE_KEY = "nanyang-shared-date-filter";

const readStoredDates = (): SharedDates => {
  try {
    const raw = sessionStorage.getItem(DATE_STORAGE_KEY);
    if (!raw) return { startDate: "", endDate: "" };
    const parsed = JSON.parse(raw);
    return {
      startDate: typeof parsed?.startDate === "string" ? parsed.startDate : "",
      endDate: typeof parsed?.endDate === "string" ? parsed.endDate : "",
    };
  } catch {
    return { startDate: "", endDate: "" };
  }
};

const setNativeDateValue = (input: HTMLInputElement, value: string) => {
  if (!value || input.value === value) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
};

export default function App() {
  const [active, setActive] = useState<DashboardKey>("executive");
  const [sharedDates, setSharedDates] = useState<SharedDates>(() => readStoredDates());
  const syncingDatesRef = useRef(false);

  const applySharedDates = useCallback(() => {
    if (!sharedDates.startDate || !sharedDates.endDate) return false;
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(".nanyang-content input[type='date']"));
    if (inputs.length < 2) return false;

    const startNeedsChange = inputs[0].value !== sharedDates.startDate;
    const endNeedsChange = inputs[1].value !== sharedDates.endDate;
    if (!startNeedsChange && !endNeedsChange) return false;

    // Programmatic synchronization must not be captured as a new user filter.
    // Otherwise the first changed input can combine with the other dashboard's
    // default date and overwrite the shared range with a mixed pair.
    syncingDatesRef.current = true;
    try {
      // Set both controlled inputs during the same protected sync window.
      if (startNeedsChange) setNativeDateValue(inputs[0], sharedDates.startDate);
      if (endNeedsChange) setNativeDateValue(inputs[1], sharedDates.endDate);
    } finally {
      // React's synthetic change handlers run synchronously for these dispatched events.
      syncingDatesRef.current = false;
    }
    return true;
  }, [sharedDates]);

  useEffect(() => {
    if (!sharedDates.startDate || !sharedDates.endDate) return;
    sessionStorage.setItem(DATE_STORAGE_KEY, JSON.stringify(sharedDates));
  }, [sharedDates]);

  // A newly mounted dashboard first loads its own filter metadata and may briefly
  // write its default date range. Re-apply the shared range for a short bounded
  // window so the shared filter wins after initialization, without observing ECharts DOM.
  useEffect(() => {
    if (!sharedDates.startDate || !sharedDates.endDate) return;

    let attempts = 0;
    const maxAttempts = 16;

    const sync = () => {
      applySharedDates();
      attempts += 1;
      if (attempts >= maxAttempts) window.clearInterval(timer);
    };

    const first = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 150);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [active, sharedDates, applySharedDates]);

  const captureDateFilter = (event: React.ChangeEvent<HTMLElement>) => {
    if (syncingDatesRef.current) return;

    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "date") return;

    const root = event.currentTarget;
    const inputs = Array.from(root.querySelectorAll<HTMLInputElement>("input[type='date']"));
    if (inputs.length < 2) return;

    const next = { startDate: inputs[0].value, endDate: inputs[1].value };
    if (!next.startDate || !next.endDate) return;

    setSharedDates((current) =>
      current.startDate === next.startDate && current.endDate === next.endDate ? current : next,
    );
  };

  return (
    <div className="nanyang-shell">
      <header className="nanyang-topbar">
        <div className="nanyang-brand">
          <strong>NANYANG</strong>
          <span>Dashboard Center</span>
        </div>
        <nav className="nanyang-tabs" aria-label="Dashboard selector">
          <button className={active === "executive" ? "active" : ""} onClick={() => setActive("executive")}>Executive</button>
          <button className={active === "overview" ? "active" : ""} onClick={() => setActive("overview")}>Overview</button>
          <button className={active === "overview02" ? "active" : ""} onClick={() => setActive("overview02")}>Overview02</button>
          <button className={active === "min-vs-eff" ? "active" : ""} onClick={() => setActive("min-vs-eff")}>MinVSEff</button>
          <button className={active === "model-line" ? "active" : ""} onClick={() => setActive("model-line")}>Model-Line</button>
          <button className={active === "easy-lean" ? "active" : ""} onClick={() => setActive("easy-lean")}>EASY LEAN</button>
          <button className={active === "vvic" ? "active" : ""} onClick={() => setActive("vvic")}>VVIC</button>
        </nav>
      </header>

      <main className="nanyang-content" onChangeCapture={captureDateFilter}>
        <Suspense fallback={<div className="nanyang-loading">Loading dashboard...</div>}>
          {active === "executive" && <ExecutiveSummaryDashboard />}
          {active === "overview" && <OverviewDashboard />}
          {active === "overview02" && <Overview02Dashboard />}
          {active === "min-vs-eff" && <MinVSEffDashboard />}
          {active === "model-line" && <ModelLineDashboard />}
          {active === "easy-lean" && <EasyLeanDashboard />}
          {active === "vvic" && <VVICDashboard />}
        </Suspense>
      </main>
    </div>
  );
}
