import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import CreateAccount from './components/CreateAccount';
import ForgotPassword from './components/ForgotPassword';
import SetNewPassword from './components/SetNewPassword';
import ContactActivation from './components/ContactActivation';
import FirmProfileView from './components/views/FirmProfileView';
import DashboardView from './components/views/DashboardView';
import PosterEditorView from './components/views/PosterEditorView';
import AdminPanelView from './components/views/AdminPanelView';
import Sidebar from './components/views/Sidebar';
import ProductsView from './components/views/ProductsView';
import PartnershipsView from './components/views/PartnershipsView';
import CreditHistory from './components/CreditHistory';
import AdminCreationsTracker from './components/views/AdminCreationsTracker';
import BulkEmailPanel from './components/admin/BulkEmail/BulkEmailPanel';
import CompanyLogo from './assets/growth_partner_login.ico';

// API URL helper for CORS support
const API_BASE = window.location.hostname === 'localhost' && window.location.port !== '3000' ? 'http://localhost:3000' : '';

export default function App() {
  // App States
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('gp_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentHash, setCurrentHash] = useState(window.location.hash || '#/login');
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dashboard & Catalog States
  const [monthSelect, setMonthSelect] = useState('July');
  const [posters, setPosters] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({ consumed: 0, total: 20 });
  const [posterRefreshKey, setPosterRefreshKey] = useState(0);

  // Editor States
  const [selectedPosterId, setSelectedPosterId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('July');

  // Debug SMTP Logs States
  const [emails, setEmails] = useState([]);
  const [debugPaneOpen, setDebugPaneOpen] = useState(false);
  const [unreadEmailsCount, setUnreadEmailsCount] = useState(0);
  const [prevEmailLen, setPrevEmailLen] = useState(0);



  // Toast Helper
  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 6000);
  };

  // Synchronize localStorage with state
  const handleSetUser = (user) => {
    if (user) {
      localStorage.setItem('gp_user', JSON.stringify(user));
      setCurrentUser(user);
    } else {
      localStorage.removeItem('gp_user');
      setCurrentUser(null);
    }
  };

  // Hash Routing
  useEffect(() => {
    const handleHash = () => {
      setCurrentHash(window.location.hash || '#/login');
      setSidebarOpen(false);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Auth Guard Routing logic
  useEffect(() => {
    const hash = currentHash;
    const isAuthRoute = ['#/login', '#/register', '#/forgot', '#/reset'].some(route => hash.startsWith(route));

    if (!currentUser) {
      if (!isAuthRoute) {
        window.location.hash = '#/login';
      }
    } else {
      const isAdmin = currentUser.role === 'admin';
      if (isAuthRoute) {
        window.location.hash = isAdmin ? '#/admin' : '#/dashboard';
      } else if (isAdmin && (hash === '#/dashboard' || hash === '#/' || hash === '')) {
        window.location.hash = '#/admin';
      } else if (!isAdmin && (hash.startsWith('#/admin') || hash === '#/admin')) {
        window.location.hash = '#/dashboard';
      }
    }
  }, [currentUser, currentHash]);

  // Load Dashboard Data (credits + stats) — runs on login and page visit
  useEffect(() => {
    if (currentUser?.id && currentHash === '#/dashboard') {
      loadDashboard();
      setPosterRefreshKey(k => k + 1); // force poster re-fetch on every dashboard visit
    }
  }, [currentUser?.id, currentHash]);

  // Fetch posters for selected month — runs whenever month changes or dashboard is visited
  useEffect(() => {
    if (currentUser?.id && currentHash === '#/dashboard') {
      fetch(`${API_BASE}/api/posters?month=${monthSelect}`)
        .then(r => r.ok ? r.json() : [])
        .then(list => setPosters(list.slice(0, 5)))
        .catch(() => { });
    }
  }, [currentUser?.id, currentHash, monthSelect, posterRefreshKey]);


  // Periodically fetch mock emails for debug console
  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sync email read badge
  useEffect(() => {
    if (debugPaneOpen) {
      setUnreadEmailsCount(0);
    }
  }, [debugPaneOpen, emails]);

  // Fetch debug mail logger
  const fetchEmails = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/debug/emails`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data);
        if (data.length > prevEmailLen) {
          setUnreadEmailsCount(prev => prev + (data.length - prevEmailLen));
          setPrevEmailLen(data.length);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Dashboard Fetch Catalog
  const loadDashboard = async () => {
    try {
      // Refresh credit counts
      const userRes = await fetch(`${API_BASE}/api/user/profile/${currentUser.id}`);
      if (userRes.ok) {
        const u = await userRes.json();
        handleSetUser(u);
      }

      // Usage Stats
      const histRes = await fetch(`${API_BASE}/api/credits/history/${currentUser.id}`);
      if (histRes.ok) {
        const history = await histRes.json();
        const consumed = history.filter(h => h.type === 'generation').length;
        setDashboardStats({
          consumed,
          total: currentUser.credits + consumed
        });
      }

      // Posters are fetched separately via the monthSelect useEffect above

    } catch (err) {
      showToast('Error syncing dashboard metrics.', 'error');
    }
  };



  // Route to Canvas Editor
  const openEditor = (posterId, mode, month) => {
    setSelectedPosterId(posterId);
    setSelectedMonth(month || monthSelect);
    window.location.hash = `#/editor?posterId=${posterId}&mode=${mode}`;
  };

  // Submit Logic: Register
  const handleRegisterSubmit = async (fields) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      showToast(data.message, 'success');
      window.location.hash = '#/login';
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Submit Logic: Login
  const handleLoginSubmit = async (username, password) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      handleSetUser(data);
      showToast(`Welcome back, ${data.name}!`, 'success');
      window.location.hash = '#/dashboard';
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Submit Logic: Forgot Password request
  const handleForgotSubmit = async (email) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');

      showToast(data.message, 'success');
      window.location.hash = '#/reset';
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Submit Logic: Set New Password
  const handleResetSubmit = async (token, new_password) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Update password failed');

      showToast(data.message, 'success');
      window.location.hash = '#/login';
    } catch (err) {
      showToast(err.message, 'error');
    }
  };



  // Admin adjustments


  const handleSignOut = () => {
    window.location.hash = '#/login';
    setCurrentHash('#/login');
    handleSetUser(null);
    showToast('Signed out successfully.', 'success');
  };

  // RENDER PATH 1: GUEST / UNAUTHENTICATED
  if (!currentUser) {
    return (
      <div className="guest-layout" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--surface)'
      }}>
        {toast.show && (
          <div className={`notification-bar ${toast.type}`}>
            <span>{toast.message}</span>
            <button
              style={{ background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer' }}
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
            >
              &times;
            </button>
          </div>
        )}

        {/* Dynamic Auth Views */}
        {currentHash === '#/login' && (
          <Login
            onLoginSubmit={handleLoginSubmit}
            onNavigateToRegister={() => window.location.hash = '#/register'}
            onNavigateToForgot={() => window.location.hash = '#/forgot'}
            onNavigateToReset={() => window.location.hash = '#/reset'}
          />
        )}

        {currentHash === '#/register' && (
          <CreateAccount
            onRegisterSubmit={handleRegisterSubmit}
            onNavigateToLogin={() => window.location.hash = '#/login'}
          />
        )}

        {currentHash === '#/forgot' && (
          <ForgotPassword
            onForgotSubmit={handleForgotSubmit}
            onNavigateToLogin={() => window.location.hash = '#/login'}
          />
        )}

        {currentHash.startsWith('#/reset') && (
          <SetNewPassword
            onResetSubmit={handleResetSubmit}
            onNavigateToLogin={() => window.location.hash = '#/login'}
          />
        )}

        {/* SMTP Debug Intercept Panel (Allows guests to inspect temporary recovery codes) */}
        <div className={`debug-pane ${debugPaneOpen ? 'open' : ''}`}>
          <div className="debug-header">
            <h3>Mock SMTP Notifier Logs</h3>
            <button className="icon-btn" onClick={() => setDebugPaneOpen(false)}>&times;</button>
          </div>
          <div className="debug-emails-list">
            {emails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No mails triggered yet.</div>
            ) : (
              emails.map((mail, idx) => (
                <div key={idx} className="debug-mail-card">
                  <div className="debug-mail-meta">
                    <strong>TO:</strong> {mail.to}<br />
                    <strong>SUBJECT:</strong> {mail.subject}<br />
                    <strong>TIME:</strong> {new Date(mail.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="debug-mail-body">{mail.body}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <button className="debug-toggle-btn" title="View Mail Notifications" onClick={() => setDebugPaneOpen(!debugPaneOpen)}>
          <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T920-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-660v420h640v-420L480-440Zm0-80 316-200H164l316 200ZM160-660v-60 480-420Z" /></svg>
          {unreadEmailsCount > 0 && (
            <span className="debug-badge">{unreadEmailsCount}</span>
          )}
        </button>
      </div>
    );
  }

  // RENDER PATH 2: LOGGED IN WORKSPACE LAYOUT
  return (
    <div className="app-layout">
      {/* Toast Alert */}
      {toast.show && (
        <div className={`notification-bar ${toast.type}`}>
          <span>{toast.message}</span>
          <button
            style={{ background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer' }}
            onClick={() => setToast(prev => ({ ...prev, show: false }))}
          >
            &times;
          </button>
        </div>
      )}

      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="mobile-brand">GP Personalise</div>
        <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z" /></svg>
        </button>
      </header>

      {/* Navigation Sidebar */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        currentHash={currentHash}
        currentUser={currentUser}
        handleSignOut={handleSignOut}
      />

      {/* Main Container Views */}
      <main className="main-content">

        {/* VIEW: DASHBOARD */}
        {currentHash === '#/dashboard' && (
          <DashboardView
            currentUser={currentUser}
            dashboardStats={dashboardStats}
            monthSelect={monthSelect}
            setMonthSelect={setMonthSelect}
            posters={posters}
            openEditor={openEditor}
            API_BASE={API_BASE}
          />
        )}

        {/* VIEW: POSTER EDITOR */}
        {currentHash.startsWith('#/editor') && (
          <PosterEditorView
            currentUser={currentUser}
            posters={posters}
            selectedPosterId={selectedPosterId}
            setSelectedPosterId={setSelectedPosterId}
            selectedMonth={selectedMonth}
            API_BASE={API_BASE}
            showToast={showToast}
            handleSetUser={handleSetUser}
            fetchEmails={fetchEmails}
          />
        )}

        {/* VIEW: FIRM PROFILE */}
        {currentHash === '#/profile' && (
          <FirmProfileView
            currentUser={currentUser}
            API_BASE={API_BASE}
            showToast={showToast}
            handleSetUser={handleSetUser}
          />
        )}

        {/* VIEW: CREDIT HISTORY */}
        {currentHash === '#/history' && (
          <CreditHistory currentUser={currentUser} apiBase={API_BASE} showToast={showToast} />
        )}

        {/* VIEW: PRODUCTS */}
        {currentHash === '#/products' && <ProductsView />}

        {/* VIEW: PARTNERSHIPS */}
        {currentHash === '#/partnership' && <PartnershipsView />}

        {/* VIEW: ADMIN PANEL */}
        {currentHash === '#/admin' && currentUser?.role === 'admin' && (
          <AdminPanelView currentUser={currentUser} API_BASE={API_BASE} showToast={showToast} />
        )}

        {/* VIEW: ADMIN CREATIONS TRACKER */}
        {currentHash === '#/admin/creations' && currentUser?.role === 'admin' && (
          <AdminCreationsTracker API_BASE={API_BASE} showToast={showToast} />
        )}

        {/* VIEW: BULK EMAIL AUTOMATION */}
        {currentHash === '#/admin/bulk-email' && currentUser?.role === 'admin' && (
          <BulkEmailPanel currentUser={currentUser} API_BASE={API_BASE} showToast={showToast} />
        )}

      </main>

      {/* DEVELOPER LOGS DEBUG INTERCEPT PANEL */}
      {currentUser?.role === 'admin' && (
        <>
          <div className={`debug-pane ${debugPaneOpen ? 'open' : ''}`}>
            <div className="debug-header">
              <h3>Mock SMTP Notifier Logs</h3>
              <button className="icon-btn" onClick={() => setDebugPaneOpen(false)}>&times;</button>
            </div>
            <div className="debug-emails-list">
              {emails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No mails triggered yet.</div>
              ) : (
                emails.map((mail, idx) => (
                  <div key={idx} className="debug-mail-card">
                    <div className="debug-mail-meta">
                      <strong>TO:</strong> {mail.to}<br />
                      <strong>SUBJECT:</strong> {mail.subject}<br />
                      <strong>TIME:</strong> {new Date(mail.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="debug-mail-body">{mail.body}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Floating toggle button for SMTP debugging logs */}
          <button className="debug-toggle-btn" title="View Mail Notifications" onClick={() => setDebugPaneOpen(!debugPaneOpen)}>
            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T920-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-660v420h640v-420L480-440Zm0-80 316-200H164l316 200ZM160-660v-60 480-420Z" /></svg>
            {unreadEmailsCount > 0 && (
              <span className="debug-badge">{unreadEmailsCount}</span>
            )}
          </button>
        </>
      )}
    </div>
  );
}
