import { lazy, Suspense, useState } from "react";

const VVICDashboard = lazy(() => import("../../apps/vvic/frontend/src/App"));
const EasyLeanDashboard = lazy(() => import("../../apps/easy-lean/frontend/src/App"));
const ModelLineDashboard = lazy(() => import("./model-line/ModelLineDashboard"));

type DashboardKey = "vvic" | "easy-lean" | "model-line";

export default function App() {
  const [active, setActive] = useState<DashboardKey>("vvic");

  return (
    <div className="nanyang-shell">
      <header className="nanyang-topbar">
        <div className="nanyang-brand">
          <strong>NANYANG</strong>
          <span>Dashboard Center</span>
        </div>
        <nav className="nanyang-tabs" aria-label="Dashboard selector">
          <button className={active === "vvic" ? "active" : ""} onClick={() => setActive("vvic")}>VVIC</button>
          <button className={active === "easy-lean" ? "active" : ""} onClick={() => setActive("easy-lean")}>EASY LEAN</button>
          <button className={active === "model-line" ? "active" : ""} onClick={() => setActive("model-line")}>MODEL-LINE</button>
        </nav>
      </header>

      <main className="nanyang-content">
        <Suspense fallback={<div className="nanyang-loading">Loading dashboard...</div>}>
          {active === "vvic" && <VVICDashboard />}
          {active === "easy-lean" && <EasyLeanDashboard />}
          {active === "model-line" && <ModelLineDashboard />}
        </Suspense>
      </main>
    </div>
  );
}
