import React from 'react';
import ContactActivation from '../ContactActivation';

export default function DashboardView({ currentUser, dashboardStats, monthSelect, setMonthSelect, posters, openEditor, API_BASE }) {
  const getCardStyle = (imageUrl) => {
    switch (imageUrl) {
      case 'calendar_modern':
        return {
          card: { borderColor: '#19376D', borderTop: '4px solid #19376D', color: '#000000' },
          title: { color: '#000000' },
          badge: { backgroundColor: '#003366', color: 'white' }
        };
      case 'calendar_timeline':
        return {
          card: { borderColor: '#D4A843', borderLeft: '4px solid #D4A843', color: '#000000' },
          title: { color: '#000000' },
          badge: { backgroundColor: '#003366', color: 'white' }
        };
      case 'calendar_grid':
        return {
          card: { borderColor: '#2EC4B6', color: '#000000' },
          title: { color: '#000000' },
          badge: { backgroundColor: '#003366', color: 'white' }
        };
      case 'calendar_minimal':
        return {
          card: { borderColor: '#F5D5C8', borderRadius: '16px', color: '#000000' },
          title: { color: '#000000' },
          badge: { backgroundColor: '#003366', color: 'white' }
        };
      case 'calendar_dashboard':
        return {
          card: { border: 'none', color: '#000000' },
          title: { color: '#000000' },
          badge: { backgroundColor: '#003366', color: 'white' }
        };
      default:
        return {
          card: {}, title: {}, badge: {}
        };
    }
  };

  return (
    <section className="view-pane">
      <div className="dashboard-header">
        <div>
          <h1 className="headline-md">Compliance Dashboard</h1>
          <p className="body-sm text-secondary">FY 2026-27 | Subscription Expiry: {currentUser?.expiry_date || 'No Expiry'}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a href="https://growthpartners.in/solutions/" target="_blank" rel="noreferrer" className="btn btn-sm" style={{ backgroundColor: '#003366', color: 'white', border: 'none' }}>Explore Products : Solutions Page</a>
            <a href="https://growthpartners.in/partnerships/" target="_blank" rel="noreferrer" className="btn btn-sm" style={{ backgroundColor: '#003366', color: 'white', border: 'none' }}>Explore Partnership : Partnership Page</a>
          </div>
          <div className="credits-panel card" style={{ width: '100%', margin: 0 }}>
            <div className="credits-stat">
              <span className="stat-value text-primary">{currentUser?.credits}</span>
              <span className="stat-label">Balance</span>
            </div>
            <div className="credits-stat-small">
              <span>Credits Consumed: <strong>{dashboardStats.consumed}</strong></span>
              <span className="divider-v">|</span>
              <span>Free Credits: <strong>{dashboardStats.total}</strong></span>
            </div>
            <ContactActivation currentUser={currentUser} apiBase={API_BASE} />
          </div>
        </div>
      </div>

      <div className="month-filter">
        <label className="nav-header">SELECT MONTH</label>
        <select value={monthSelect} onChange={(e) => setMonthSelect(e.target.value)} className="form-select">
          <option value="July">July 2026</option>
          <option value="August">August 2026</option>
          <option value="September">September 2026</option>
        </select>
      </div>

      <div className="posters-grid">
        {posters.length === 0 ? (
          <div className="card w-full" style={{ gridColumn: '1/-1', textAlign: 'center' }}>
            <p className="text-secondary">No poster templates available yet.</p>
          </div>
        ) : (
          posters.map(poster => {
            const styles = getCardStyle(poster.image_url);
            return (
            <div key={poster.id} className="poster-card" style={styles.card}>
              <div className="poster-thumb-wrapper" style={{ borderBottom: styles.card.borderColor ? `1px solid ${styles.card.borderColor}` : '' }}>
                {/* key + pid in URL = unique per month, busts any stale browser cache */}
                <img
                  key={`${poster.id}-${monthSelect}`}
                  src={`${API_BASE}/api/templates/thumbnail/${poster.image_url}?month=${monthSelect}&pid=${poster.id}${currentUser?.id ? `&userId=${currentUser.id}` : ''}`}
                  alt={poster.title}
                  className="poster-thumb-canvas"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
              <div className="poster-info">
                <h4 className="poster-title" style={styles.title}>{poster.title}</h4>
                <p className="poster-description" style={{ color: styles.card.color || 'var(--secondary)' }}>{poster.description}</p>
                <div className="poster-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => openEditor(poster.id, 'preview', monthSelect)} style={styles.card.color ? { borderColor: styles.card.borderColor, color: styles.card.color } : {}}>Preview</button>
                  <button className="btn btn-primary btn-sm" onClick={() => openEditor(poster.id, 'generate', monthSelect)} style={styles.badge}>Personalise</button>
                </div>
              </div>
            </div>
          )})
        )}
      </div>
    </section>
  );
}

