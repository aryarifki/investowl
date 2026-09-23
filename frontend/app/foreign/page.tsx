import React from 'react';
import ForeignFlowDeepDiveTab from '@/app/components/ff/ForeignFlowDeepDiveTab';
import TickerSearch from '@/components/layout/TickerSearch';

export default function ForeignPage() {
  return (
    <main className="min-h-screen bg-[var(--md-sys-color-surface)] p-4 md:p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-4">
        <TickerSearch />
        
        <ForeignFlowDeepDiveTab />
      </div>
    </main>
  );
}
