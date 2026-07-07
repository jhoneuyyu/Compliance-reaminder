import React, { useState, useEffect } from 'react';

export default function CreditHistory({ currentUser, apiBase, showToast }) {
  const [historyLogs, setHistoryLogs] = useState([]);

  useEffect(() => {
    const loadHistoryData = async () => {
      try {
        const res = await fetch(`${apiBase}/api/credits/history/${currentUser.id}`);
        if (res.ok) {
          const data = await res.json();
          setHistoryLogs(data);
        }
      } catch (e) {
        if (showToast) showToast('Failed to load transaction list.', 'error');
      }
    };

    if (currentUser) {
      loadHistoryData();
    }
  }, [currentUser, apiBase, showToast]);

  return (
    <section className="view-pane">
      <h1 className="headline-md">Credit Balance & Transaction History</h1>
      <p className="body-sm text-secondary">Monitor your credit consumption logs and audit events.</p>
      <div className="history-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Description</th>
              <th>Type</th>
              <th>Credit Adjustment</th>
            </tr>
          </thead>
          <tbody>
            {historyLogs.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center' }} className="text-secondary">No credit usage logs recorded.</td></tr>
            ) : (
              historyLogs.map((log, i) => (
                <tr key={i}>
                  <td>{new Date(log.date).toLocaleString()}</td>
                  <td>{log.description}</td>
                  <td><span className="badge">{log.type.toUpperCase()}</span></td>
                  <td className={log.change_amt > 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: 700 }}>
                    {log.change_amt > 0 ? '+' : ''}{log.change_amt}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
