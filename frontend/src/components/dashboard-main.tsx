"use client";
import { useState } from "react";

export function DashboardMain() {
  const [activeTab, setActiveTab] = useState("Overview");
  const tabs = ["Overview", "Broker Flow", "Causality", "Validation", "Screener", "Raw"];

  return (
    <main className="main-area">
      <header className="top-bar">
        <div style={{display: "flex", alignItems: "center"}}>
          <span className="top-bar-title">BBCA</span>
          <span className="badge">Accumulation</span>
        </div>
        <div className="top-bar-meta">
          <span>Analysis: 2026-09-06</span>
          <span>|</span>
          <span>Window: 60D</span>
        </div>
      </header>

      <nav className="tabs-nav">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-btn ${activeTab === tab ? "active" : ""}`}>
            {tab}
          </button>
        ))}
      </nav>

      <div className="content-area">
        <div className="kpi-grid">
          <div className="kpi-card primary">
            <div className="kpi-label">Conviction</div>
            <div className="kpi-value">82.5<span className="kpi-sub">/100</span></div>
          </div>
          <div className="kpi-card foreign">
            <div className="kpi-label">Foreign Net (5D)</div>
            <div className="kpi-value text-foreign">+45.2B</div>
          </div>
          <div className="kpi-card acc">
            <div className="kpi-label">Top Buyer</div>
            <div className="kpi-value">YU</div>
          </div>
          <div className="kpi-card acc">
            <div className="kpi-label">5D Return</div>
            <div className="kpi-value text-acc">+3.68%</div>
          </div>
        </div>
      </div>
    </main>
  );
}
