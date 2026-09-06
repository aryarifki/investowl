"use client";
import { CaretRight } from "@phosphor-icons/react";

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">Smart Money</div>
        <div className="sidebar-subtitle">IDX Broker Flow Research</div>
      </div>
      <div className="sidebar-body">
        <div className="form-group">
          <label className="form-label">Ticker</label>
          <input className="form-input" type="text" defaultValue="BBCA" />
        </div>
        <div className="form-group">
          <label className="form-label">Analysis Date</label>
          <select className="form-select"><option>Latest Available</option></select>
        </div>
        <div className="form-group">
          <label className="form-label">Broker Window</label>
          <select className="form-select"><option>60 calendar days</option></select>
        </div>
        <div className="form-group">
          <label className="form-label">Validation Horizon</label>
          <select className="form-select"><option>10 trading days</option></select>
        </div>
      </div>
      <div className="sidebar-footer">
        <button className="btn-primary">Run Pipeline <CaretRight size={16} weight="bold" /></button>
      </div>
    </aside>
  );
}
