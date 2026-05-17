import React, { useState, useEffect } from 'react';
import { Grid3x3, Pencil, Users } from 'lucide-react';
import LiveFloorView from './LiveFloorView';
import FloorDesigner from './FloorDesigner';
import ServersPanel from './ServersPanel';

const TABS = [
  { id: 'live',     label: 'Live View',  icon: Grid3x3 },
  { id: 'designer', label: 'Designer',   icon: Pencil },
  { id: 'servers',  label: 'Servers',    icon: Users },
];

const LS_KEY = 'floor_active_tab';

export default function FloorPage() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(LS_KEY) || 'live';
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, activeTab);
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Floor Plan</h1>
        <p className="text-sm text-foreground/50 mt-0.5">Live service view and floor layout management</p>
      </div>

      {/* Tab Strip */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-foreground/50 hover:text-foreground hover:border-border'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'live'     && <LiveFloorView />}
        {activeTab === 'designer' && <FloorDesigner />}
        {activeTab === 'servers'  && <ServersPanel />}
      </div>
    </div>
  );
}
