import { lazy, Suspense, useEffect, useState } from "react";

const ExecutiveSummaryDashboard = lazy(() => import("./executive/ExecutiveSummaryDashboard"));
const OverviewDashboard = lazy(() => import("./overview/OverviewDashboard"));
const Overview02Dashboard = lazy(() => import("./overview02/Overview02Dashboard"));
const MinVSEffDashboard = lazy(() => import("./min-vs-eff/MinVSEffDashboard"));
const ModelLineDashboard = lazy(() => import("./model-line/ModelLineDashboard"));
const EasyLeanDashboard = lazy(() => import("./easy-lean/EasyLeanDashboard"));
const VVICDashboard = lazy(() => import("./vvic/VVICDashboard"));

type DashboardKey = "executive" | "overview" | "overview02" | "min-vs-eff" | "model-line" | "easy-lean" | "vvic";
type SharedDates = { startDate: string; endDate: string };

const DATE_STORAGE_KEY = "nanyang-shared-date-filter-v2";

function readSharedDates(): SharedDates {
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
}

function setReactDateInput(input: HTMLInputElement, value: string) {
  if (!value || input.value === value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function App() {
  const [active, setActive] = useState<DashboardKey>("executive");
  const [sharedDates, setSharedDates] = useState<SharedDates>(() => readSharedDates());

  useEffect(() => {
    if (!sharedDates.startDate || !sharedDates.endDate) return;
    sessionStorage.setItem(DATE_STORAGE_KEY, JSON.stringify(sharedDates));
  }, [sharedDates]);

  // Each dashboard loads its own filter metadata after mount and can briefly set its
  // own default dates. Re-apply the shared range only at a few fixed checkpoints.
  // No MutationObserver and no continuous polling are used.
  useEffect(() => {
    if (!sharedDates.startDate || !sharedDates.endDate) return;

    const apply = () => {
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(".nanyang-content input[type='date']"),
      );
      if (inputs.length < 2) return;
      setReactDateInput(inputs[0], sharedDates.startDate);
      setReactDateInput(inputs[1], sharedDates.endDate);
    };

    const delays = [0, 250, 700, 1500, 3000];
    const timers = delays.map((delay) => window.setTimeout(apply, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [active, sharedDates]);

  const captureTrustedDateChange = (event: React.ChangeEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "date") return;

    // Only a real user action is allowed to replace the shared range.
    // Programmatic changes dispatched while syncing have nativeEvent.isTrusted=false.
    if (!event.nativeEvent.isTrusted) return;

    const inputs = Array.from(
      event.currentTarget.querySelectorAll<HTMLInputElement>("input[type='date']"),
    );
    if (inputs.length < 2) return;

    const next = {
      startDate: inputs[0].value,
      endDate: inputs[1].value,
    };
    if (!next.startDate || !next.endDate) return;

    setSharedDates((current) =>
      current.startDate === next.startDate && current.endDate === next.endDate
        ? current
        : next,
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

      <main className="nanyang-content" onChangeCapture={captureTrustedDateChange}>
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
