import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AssistantProvider, useAssistant } from './contexts/AssistantContext';
import { AnalyticsProvider } from './contexts/AnalyticsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import AIAssistant from './components/AIAssistant';
import AgentSidebar from './components/analytics/AgentSidebar'; // Reusing the Analytics sidebar
import { MessageSquare } from 'lucide-react';
import AIAnalytics from './pages/AIAnalytics';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import SmartAnalytics from './pages/SmartAnalytics';
import MyWorkspace from './pages/MyWorkspace';
import Bookings from './pages/Bookings';
import SlotManagement from './pages/SlotManagement';
import Outlets from './pages/Outlets';
import Services from './pages/Services';
import Finance from './pages/Finance';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Customers from './pages/Customers';
import Support from './pages/Support';
import AdminConsole from './pages/AdminConsole';
import PublicBooking from './pages/PublicBooking';
import AIAgent from './pages/AIAgent';
import Inventory from './pages/Inventory';
import CustomerFeedback from './pages/CustomerFeedback';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminCompanies from './pages/SuperAdminCompanies';
import SuperAdminUsers from './pages/SuperAdminUsers';
import CompanyDetail from './pages/CompanyDetail';
import AuditLogs from './pages/AuditLogs';
import ProfileSettings from './pages/ProfileSettings';
import Flow from './pages/Flow';
import FlowList from './pages/FlowList';
import Onboarding from './pages/Onboarding';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AssistantProvider>
          <AnalyticsProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignupWrapper />} />
                <Route path="/try" element={<SignupWrapper />} />
                <Route path="/book/:token" element={<PublicBooking />} />
                <Route path="/b/:token" element={<PublicBooking />} />
                <Route path="/rate/:bookingId" element={<CustomerFeedback />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </BrowserRouter>
          </AnalyticsProvider>
        </AssistantProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

function SignupWrapper() {
  const { theme } = useTheme();
  const { login } = useAuth();
  return <Signup theme={theme} onLogin={login} />;
}

function MainLayout() {
  const { theme } = useTheme();
  const { isOpen, closeAssistant, mode, isFloatingChatOpen, closeFloatingChat, openFloatingChat } = useAssistant();
  const { user } = useAuth();
  const location = useLocation();

  // Check if user is Super Admin
  const isSuperAdmin = user?.role === 'SuperAdmin';

  // Hide FAB on AI Agent page
  const hideFloatingFAB = location.pathname === '/ai-agent';

  // Check if currently impersonating
  const isImpersonating = localStorage.getItem('ridn_impersonating') === 'true';
  const impersonatedCompany = localStorage.getItem('ridn_impersonated_company') || 'Company';

  const handleExitImpersonation = () => {
    const originalToken = localStorage.getItem('ridn_original_token');
    if (originalToken) {
      localStorage.setItem('ridn_token', originalToken);
      localStorage.removeItem('ridn_original_token');
      localStorage.removeItem('ridn_impersonating');
      localStorage.removeItem('ridn_impersonated_company');
      window.location.href = '/super-admin';
    }
  };

  // Global Agent State
  const [isGlobalAgentOpen, setIsGlobalAgentOpen] = React.useState(false);

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-[#0B0D10]' : 'bg-[#F6F7F9]'}`}>
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="font-medium">
              Impersonating: <strong>{impersonatedCompany}</strong>
            </span>
            <span className="text-amber-100 text-sm ml-2">
              You are viewing this company as their admin
            </span>
          </div>
          <button
            onClick={handleExitImpersonation}
            className="flex items-center gap-2 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Exit to Super Admin
          </button>
        </div>
      )}

      <div className="flex-1 flex relative min-h-0">
        <Sidebar />
        <div className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ${isGlobalAgentOpen ? 'mr-[320px]' : 'mr-0'}`}>
          <Topbar onToggleAgent={() => setIsGlobalAgentOpen(!isGlobalAgentOpen)} />
          <main className={`flex-1 p-8 min-h-0 ${hideFloatingFAB ? 'overflow-hidden h-full' : 'overflow-auto'}`}>
            <Routes>
              <Route path="/" element={isSuperAdmin ? <SuperAdminDashboard theme={theme} /> : <Dashboard />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/smart-analytics" element={<ProtectedRoute><SmartAnalytics /></ProtectedRoute>} />
              <Route path="/my-workspace" element={<ProtectedRoute><MyWorkspace /></ProtectedRoute>} />
              <Route path="/ai-analytics" element={<ProtectedRoute><AIAnalytics /></ProtectedRoute>} />
              <Route path="/slots" element={<SlotManagement />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/outlets" element={<Outlets />} />
              <Route path="/services" element={<Services />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/users" element={<Users />} /> {/* Admin Users */}
              <Route path="/customers" element={<Customers />} /> {/* SaaS Customers */}
              <Route path="/admin" element={<AdminConsole />} />
              <Route path="/support" element={<Support />} />
              <Route path="/ai-agent" element={<AIAgent />} />
              <Route path="/flow" element={<FlowList />} />
              <Route path="/flow/builder" element={<Flow />} />
              <Route path="/flow/builder/:flowId" element={<Flow />} />
              <Route path="/profile" element={<ProfileSettings />} />
              {/* Super Admin Routes */}
              <Route path="/super-admin" element={<SuperAdminDashboard theme={theme} />} />
              <Route path="/super-admin/companies" element={<SuperAdminCompanies theme={theme} />} />
              <Route path="/super-admin/companies/:companyId" element={<CompanyDetail theme={theme} />} />
              <Route path="/super-admin/audit" element={<AuditLogs theme={theme} />} />
              <Route path="/super-admin/users" element={<SuperAdminUsers theme={theme} />} />
            </Routes>
          </main>
        </div>

        {/* Global Agent Sidebar - Fixed right, pushes content via margin */}
        <div className={`fixed inset-y-0 right-0 z-[60] shadow-2xl transition-transform duration-300 ${isGlobalAgentOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <AgentSidebar isOpen={isGlobalAgentOpen} toggleSidebar={() => setIsGlobalAgentOpen(false)} />
        </div>
      </div>

      {/* AI Assistant Panel */}
      <AIAssistant isOpen={isOpen} onClose={closeAssistant} mode={mode} />
    </div>
  );
}

export default App;
