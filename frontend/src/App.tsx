import { lazy, Suspense, useState } from "react";

const ExecutiveSummaryDashboard = lazy(() => import("./executive/ExecutiveSummaryDashboard"));
const OverviewDashboard = lazy(() => import("./overview/OverviewDashboard"));
const Overview02Dashboard = lazy(() => import("./overview02/Overview02Dashboard"));
const MinVSEffDashboard = lazy(() => import("./min-vs-eff/MinVSEffDashboard"));
const ModelLineDashboard = lazy(() => import("./model-line/ModelLineDashboard"));
const EasyLeanDashboard = lazy(() => import("../../apps/easy-lean/frontend/src/App"));
const VVICDashboard = lazy(() => import("../../apps/vvic/frontend/src/App"));

type DashboardKey = "executive" | "overview" | "overview02" | "min-vs-eff" | "model-line" | "easy-lean" | "vvic";

export default function App() {
  const [active, setActive] = useState<DashboardKey>("executive");

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

      <main className="nanyang-content">
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
