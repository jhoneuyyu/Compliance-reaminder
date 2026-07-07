import React, { useState, useEffect } from 'react';

export default function AdminPanelView({ currentUser, API_BASE, showToast }) {
  // Admin Console States

  const [adminStats, setAdminStats] = useState({ totalUsers: 0, activeUsers: 0, totalGenerated: 0, totalCreditsConsumed: 0 });
  const [adminTab, setAdminTab] = useState('users');
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminSettings, setAdminSettings] = useState({ trial_credits: 20, trial_days: 15, whatsapp_support: '919876543210' });
  const [adminPosters, setAdminPosters] = useState([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState([]);
  const [generationLogs, setGenerationLogs] = useState([]);

  // Load Admin Console Data
  const loadAdminData = async () => {
    try {
      const repRes = await fetch(`${API_BASE}/api/admin/reports`);
      if (repRes.ok) {
        const stats = await repRes.json();
        setAdminStats(stats);
      }

      if (adminTab === 'users') {
        const res = await fetch(`${API_BASE}/api/admin/users`);
        if (res.ok) setAdminUsers(await res.json());
      } else if (adminTab === 'settings') {
        const res = await fetch(`${API_BASE}/api/settings`);
        if (res.ok) setAdminSettings(await res.json());
      } else if (adminTab === 'posters') {
        const res = await fetch(`${API_BASE}/api/posters`);
        if (res.ok) setAdminPosters(await res.json());
      } else if (adminTab === 'audit') {
        const res = await fetch(`${API_BASE}/api/admin/audit-logs`);
        if (res.ok) setAdminAuditLogs(await res.json());
      } else if (adminTab === 'generation') {
        const res = await fetch(`${API_BASE}/api/admin/activity`, {
          headers: { 'Authorization': `Bearer admin-auth-token-123` }
        });
        if (res.ok) {
          const data = await res.json();
          setGenerationLogs(data.data || []);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadAdminData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role, adminTab]);

  const exportToExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,User Name,User Email,Poster Title,Credits Used\n";
    generationLogs.forEach(row => {
      const date = new Date(row.generated_date).toLocaleString().replace(/,/g, '');
      const name = `"${row.user_name}"`;
      const email = `"${row.user_email}"`;
      const title = `"${row.poster_title}"`;
      const credits = row.credits_used;
      csvContent += `${date},${name},${email},${title},${credits}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "poster_generation_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const adjustCredits = async (userId) => {
    const act = window.confirm('Click OK to ADD credits, CANCEL to DEDUCT credits.');
    const action = act ? 'add' : 'deduct';
    const amountStr = window.prompt(`Enter credit amount to ${action}:`, '10');
    if (!amountStr || isNaN(amountStr)) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(amountStr, 10), action })
      });
      if (!res.ok) throw new Error();
      showToast('Credits adjusted.', 'success');
      loadAdminData();
    } catch (e) {
      showToast('Credit adjustment failed.', 'error');
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    const val = currentStatus === 1 ? 0 : 1;
    if (!window.confirm(`Are you sure you want to toggle status for user ${userId}?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: val })
      });
      if (!res.ok) throw new Error();
      showToast('Status adjusted successfully.', 'success');
      loadAdminData();
    } catch (e) {
      showToast('Failed to toggle status.', 'error');
    }
  };

  const resetUserPassword = async (userId) => {
    const pwd = window.prompt('Enter new temporary password:', '12345678');
    if (!pwd) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: pwd })
      });
      if (!res.ok) throw new Error();
      showToast('Password reset success.', 'success');
      loadAdminData();
    } catch (e) {
      showToast('Password reset failed.', 'error');
    }
  };

  const handleAdminSettingsSubmit = async (e) => {
    e.preventDefault();
    const { trial_credits, trial_days, whatsapp_support } = e.target.elements;
    
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trial_credits: parseInt(trial_credits.value, 10),
          trial_days: parseInt(trial_days.value, 10),
          whatsapp_support: whatsapp_support.value
        })
      });
      if (!res.ok) throw new Error();
      showToast('Settings saved successfully.', 'success');
    } catch (err) {
      showToast('Failed to save settings.', 'error');
    }
  };

  const handleAdminPosterSubmit = async (e) => {
    e.preventDefault();
    const { ap_month, ap_category, ap_title, ap_url, ap_desc } = e.target.elements;

    try {
      const res = await fetch(`${API_BASE}/api/admin/posters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: ap_month.value,
          category: ap_category.value,
          title: ap_title.value,
          image_url: ap_url.value,
          description: ap_desc.value
        })
      });
      if (!res.ok) throw new Error();
      showToast('Poster layout added.', 'success');
      e.target.reset();
      loadAdminData();
    } catch (e) {
      showToast('Upload failed.', 'error');
    }
  };

  const handleDeletePoster = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/posters/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Poster template deleted.', 'success');
      loadAdminData();
    } catch (e) {
      showToast('Failed to delete.', 'error');
    }
  };

  const handleSendUpdateSubmit = async (e) => {
    e.preventDefault();
    const { subject, body } = e.target.elements;
    try {
      const res = await fetch(`${API_BASE}/api/admin/send-announcement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.value, body: body.value })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send update.');
      showToast(data.message || 'Announcement sent successfully.', 'success');
      e.target.reset();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };



  return (
    <section className="view-pane">
      <h1 className="headline-md">Administration Console</h1>
      <p className="body-sm text-secondary">Manage platform metrics, user credentials, credit adjustments, and verify audit trails.</p>

      <div className="admin-stats-grid">
        <div className="admin-stat-card card">
          <span className="stat-label">Total Users Onboarded</span>
          <span className="stat-value text-primary">{adminStats.totalUsers}</span>
        </div>
        <div className="admin-stat-card card">
          <span className="stat-label">Active Users</span>
          <span className="stat-value text-success">{adminStats.activeUsers}</span>
        </div>
        <div className="admin-stat-card card">
          <span className="stat-label">Posters Generated</span>
          <span className="stat-value text-primary">{adminStats.totalGenerated}</span>
        </div>
        <div className="admin-stat-card card">
          <span className="stat-label">Credits Consumed</span>
          <span className="stat-value text-warning">{adminStats.totalCreditsConsumed}</span>
        </div>
      </div>

      <div className="admin-tabs btn-group">
        <button className={`btn btn-sm btn-outline ${adminTab === 'users' ? 'active' : ''}`} onClick={() => setAdminTab('users')}>User Accounts</button>
        <button className={`btn btn-sm btn-outline ${adminTab === 'settings' ? 'active' : ''}`} onClick={() => setAdminTab('settings')}>System Constants</button>
        <button className={`btn btn-sm btn-outline ${adminTab === 'posters' ? 'active' : ''}`} onClick={() => setAdminTab('posters')}>Upload Templates</button>
        <button className={`btn btn-sm btn-outline ${adminTab === 'audit' ? 'active' : ''}`} onClick={() => setAdminTab('audit')}>System Audit Logs</button>
        <button className={`btn btn-sm btn-outline ${adminTab === 'generation' ? 'active' : ''}`} onClick={() => setAdminTab('generation')}>Generations Tracking</button>
        <button className={`btn btn-sm btn-outline ${adminTab === 'updates' ? 'active' : ''}`} onClick={() => setAdminTab('updates')}>Send Updates</button>
      </div>

      {/* Users Tab */}
      {adminTab === 'users' && (
        <div className="admin-tab-pane">
          <div className="table-header-action">
            <h3>Registered Professionals</h3>
            <button className="btn btn-sm btn-primary" onClick={() => window.alert('Onboard new users by registering them on the signup page.')}>Add New Professional</button>
          </div>
          <div className="card overflow-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Username</th>
                  <th>CA / Firm Name</th>
                  <th>Credits Balance</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Profile Pct</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map(u => (
                  <tr key={u.id}>
                    <td><code>{u.id}</code></td>
                    <td>{u.username}</td>
                    <td>{u.name || '-'}</td>
                    <td><strong className="text-primary">{u.credits}</strong></td>
                    <td>{u.expiry_date}</td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td>{Math.round(u.profile_completion || 0)}%</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn btn-xs btn-outline" onClick={() => adjustCredits(u.id)}>Credits</button>
                        <button className="btn btn-xs btn-outline" onClick={() => toggleUserStatus(u.id, u.is_active)}>{u.is_active ? 'Suspend' : 'Activate'}</button>
                        <button className="btn btn-xs btn-outline" onClick={() => resetUserPassword(u.id)}>Reset Pwd</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {adminTab === 'settings' && (
        <div className="admin-tab-pane">
          <h3>Global Platform Settings</h3>
          <div className="card max-w-lg">
            <form onSubmit={handleAdminSettingsSubmit}>
              <div className="form-group">
                <label>Trial Credits for New Users</label>
                <input type="number" name="trial_credits" defaultValue={adminSettings.trial_credits} required />
              </div>
              <div className="form-group">
                <label>Trial Days Validity</label>
                <input type="number" name="trial_days" defaultValue={adminSettings.trial_days} required />
              </div>
              <div className="form-group">
                <label>WhatsApp Support Number</label>
                <input type="text" name="whatsapp_support" defaultValue={adminSettings.whatsapp_support} placeholder="e.g. 919876543210" required />
              </div>
              <button type="submit" className="btn btn-primary">Save Settings Configuration</button>
            </form>
          </div>
        </div>
      )}

      {/* Posters Upload Tab */}
      {adminTab === 'posters' && (
        <div className="admin-tab-pane">
          <h3>Upload Monthly Compliance Poster Templates</h3>
          <div className="editor-workspace">
            <div className="col card">
              <form onSubmit={handleAdminPosterSubmit}>
                <div className="form-group">
                  <label>Filing Month</label>
                  <select name="ap_month" className="form-select">
                    <option value="July">July 2026</option>
                    <option value="August">August 2026</option>
                    <option value="September">September 2026</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Filing Category</label>
                  <input type="text" name="ap_category" placeholder="e.g. GSTR-1 Reminder, TDS Deadline" required />
                </div>
                <div className="form-group">
                  <label>Poster Title Name</label>
                  <input type="text" name="ap_title" placeholder="e.g. TDS Compliance Poster" required />
                </div>
                <div className="form-group">
                  <label>Template Image Layout (Demo Preset)</label>
                  <select name="ap_url" className="form-select">
                    <option value="gstr1_template">GSTR-1 Preset</option>
                    <option value="gstr3b_template">GSTR-3B Preset</option>
                    <option value="tds_template">TDS Preset</option>
                    <option value="calendar_template">Calendar Preset</option>
                    <option value="monthly_list_template">Monthly List Preset</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Description Notes</label>
                  <input type="text" name="ap_desc" placeholder="Details about filing dates..." />
                </div>
                <button type="submit" className="btn btn-primary">Upload to Dashboard Catalog</button>
              </form>
            </div>
            
            <div className="col card">
              <h3>Existing Active Catalogs</h3>
              <div className="overflow-y max-h-400">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Category / Title</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminPosters.map(post => (
                      <tr key={post.id}>
                        <td>{post.month}</td>
                        <td><strong>{post.category}</strong><br /><span style={{ fontSize: '11px', color: 'var(--secondary)' }}>{post.title}</span></td>
                        <td>
                          <button className="btn btn-outline btn-sm text-danger" onClick={() => handleDeletePoster(post.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {adminTab === 'audit' && (
        <div className="admin-tab-pane">
          <h3>System Audit Logs & IP Logs</h3>
          <div className="card overflow-x max-h-600">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Username / User ID</th>
                  <th>Action Category</th>
                  <th>Action Details</th>
                  <th>IP Location Log</th>
                </tr>
              </thead>
              <tbody>
                {adminAuditLogs.map(log => (
                  <tr key={log.id}>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td><strong>{log.username || `System (${log.user_id})`}</strong></td>
                    <td><span className="badge" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--primary)' }}>{log.action}</span></td>
                    <td>{log.details}</td>
                    <td><code>{log.ip_address || '127.0.0.1'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generations Tracking Tab */}
      {adminTab === 'generation' && (
        <div className="admin-tab-pane">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Poster Generations Tracking</h3>
            <button className="btn btn-sm btn-primary" onClick={exportToExcel}>Export to CSV (Excel)</button>
          </div>
          <div className="card overflow-x max-h-600">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>User</th>
                  <th>Email</th>
                  <th>Poster Template</th>
                  <th>Credits Used</th>
                </tr>
              </thead>
              <tbody>
                {generationLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>No generation activity found.</td>
                  </tr>
                ) : (
                  generationLogs.map(log => (
                    <tr key={log.id}>
                      <td>{new Date(log.generated_date).toLocaleString()}</td>
                      <td><strong>{log.user_name}</strong></td>
                      <td>{log.user_email}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {log.poster_image && (
                            <img 
                              src={`${API_BASE}/api/templates/thumbnail/${log.poster_image}`} 
                              alt="thumb" 
                              style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                            />
                          )}
                          <span>{log.poster_title}</span>
                        </div>
                      </td>
                      <td><span className="badge badge-danger">-{log.credits_used}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Send Updates Tab */}
      {adminTab === 'updates' && (
        <div className="admin-tab-pane">
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
            <h3>Send Email Updates to Users</h3>
            <p className="body-sm text-secondary" style={{ marginBottom: '20px' }}>
              Broadcast announcements or platform update notifications directly to all registered professionals' email logs.
            </p>
            <form onSubmit={handleSendUpdateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>Subject</label>
                <input type="text" name="subject" className="form-input" placeholder="e.g., Scheduled Platform Maintenance" required />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>Message Body</label>
                <textarea name="body" className="form-input" rows="6" placeholder="Write your announcement update here..." style={{ resize: 'vertical' }} required></textarea>
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Send Announcement</button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
