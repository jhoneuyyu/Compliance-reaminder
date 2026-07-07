import React from 'react';
import CompanyLogo from '../../assets/growth_partner_login.ico';

export default function Sidebar({ sidebarOpen, currentHash, currentUser, handleSignOut }) {
  const isAdmin = currentUser?.role === 'admin';

  return (
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <img src={CompanyLogo} alt="Growth Partners Logo" style={{ width: '28px', height: '28px' }} />
        <div className="brand-text">Growth Partners</div>
      </div>

      <nav className="sidebar-nav">
        {isAdmin ? (
          <div className="nav-section">
            <span className="nav-header">ADMIN PANEL</span>
            <ul className="nav-list">
              <li>
                <a href="#/admin" className={`nav-item ${currentHash === '#/admin' ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M120-520v-320h320v320H120Zm0 400v-320h320v320H120Zm400-400v-320h320v320H520Zm0 400v-320h320v320H520Z"/></svg>
                  <span>Admin Console</span>
                </a>
              </li>
              <li>
                <a href="#/admin/bulk-email" className={`nav-item ${currentHash === '#/admin/bulk-email' ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T920-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-660v420h640v-420L480-440Zm0-80 316-200H164l316 200ZM160-660v-60 480-420Z"/></svg>
                  <span>Bulk Email Automation</span>
                </a>
              </li>
            </ul>
          </div>
        ) : (
          <div className="nav-section">
            <span className="nav-header">MAIN WORKSPACE</span>
            <ul className="nav-list">
              <li>
                <a href="#/dashboard" className={`nav-item ${currentHash === '#/dashboard' ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M120-520v-320h320v320H120Zm0 400v-320h320v320H120Zm400-400v-320h320v320H520Zm0 400v-320h320v320H520Z"/></svg>
                  <span>Dashboard</span>
                </a>
              </li>
              <li>
                <a href="#/profile" className={`nav-item ${currentHash === '#/profile' ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Zm246-164q-59 0-99.5-40.5T340-580q0-59 40.5-99.5T480-720q59 0 99.5 40.5T620-580q0 59-40.5 99.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>
                  <span>Firm Profile</span>
                </a>
              </li>
              <li>
                <a href="#/history" className={`nav-item ${currentHash === '#/history' ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M480-80q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-440q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-800q71 0 135.5 25.5T727-704v-96h80v240H567v-80h108q-42-45-98.5-72.5T480-720q-116 0-198 82t-82 198q0 116 82 198t198 82q116 0 198-82t82-198h80q0 150-105 255T480-80Z"/></svg>
                  <span>Credit History</span>
                </a>
              </li>
            </ul>
          </div>
        )}
      </nav>

      <div className="user-summary">
        <div className="user-info">
          <span className="user-name">{currentUser.name}</span>
          <span className="user-role">{isAdmin ? 'Administrator' : 'Tax Practitioner'}</span>
        </div>
        {!isAdmin && (
          <>
            <div className="credit-badge">
              <span className="credit-label">Credits:</span>
              <span className="credit-count">{currentUser.credits}</span>
            </div>
            <div className="profile-meter">
              <div className="meter-text">Profile Completed: <span>{Math.round(currentUser.profile_completion || 0)}%</span></div>
              <div className="meter-bar"><div className="meter-fill" style={{ width: `${currentUser.profile_completion || 0}%` }}></div></div>
            </div>
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={handleSignOut}>
          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z"/></svg>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
