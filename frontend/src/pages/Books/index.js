import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, Settings2, Receipt, FileText, BarChart3 } from 'lucide-react';
import Dashboard from './Dashboard';
import Ledger from './Ledger';
import Accounts from './Accounts';
import Bills from './Bills';
import Reports from './Reports';
import Settings from './Settings';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ledger',    label: 'Ledger',    icon: BookOpen },
  { id: 'accounts',  label: 'Accounts',  icon: Receipt },
  { id: 'bills',     label: 'Bills',     icon: FileText },
  { id: 'reports',   label: 'Reports',   icon: BarChart3 },
  { id: 'settings',  label: 'Settings',  icon: Settings2 },
];

const Books = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activated, setActivated] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Books</h1>
          <p className="text-sm text-foreground/50 mt-0.5">Double-entry accounting and financial management</p>
        </div>
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
      <div>
        {activeTab === 'dashboard' && (
          <Dashboard onActivate={() => setActivated(true)} />
        )}
        {activeTab === 'settings' && <Settings />}
        {['ledger', 'accounts', 'bills', 'reports'].includes(activeTab) && (
          activated
            ? (
              <>
                {activeTab === 'ledger' && <Ledger />}
                {activeTab === 'accounts' && <Accounts />}
                {activeTab === 'bills' && <Bills />}
                {activeTab === 'reports' && <Reports />}
              </>
            )
            : (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                <p className="text-sm text-foreground/60">Activate Books from the Dashboard tab to unlock this section.</p>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="text-sm font-medium text-foreground underline underline-offset-4"
                >
                  Go to Dashboard
                </button>
              </div>
            )
        )}
      </div>
    </div>
  );
};

export default Books;
