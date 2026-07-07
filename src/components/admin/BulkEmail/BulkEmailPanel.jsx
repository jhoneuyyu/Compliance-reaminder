import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function BulkEmailPanel({ currentUser, API_BASE, showToast }) {
  const [posters, setPosters] = useState([]);
  const [selectedPoster, setSelectedPoster] = useState(null);
  const [uploadMonth, setUploadMonth] = useState('July');
  const [uploadTitle, setUploadTitle] = useState('Compliance 2026 July');
  const [imageVersion, setImageVersion] = useState(Date.now());
  const [dbRecipients, setDbRecipients] = useState([]);
  const [uploadedRecipients, setUploadedRecipients] = useState([]);
  const [subjectTemplate, setSubjectTemplate] = useState('Compliance Calendar Reminder - {name}');
  const [bodyTemplate, setBodyTemplate] = useState(
    "Hi {name},<br><br>Please find attached your personalized Compliance Calendar poster for {month}.<br>We have customized it with your branding and contact details.<br><br>Best regards,<br>Growth Partners<br><br>---<br><a href=\"https://growthpartners.in/\">Visit Website</a><br>Contact Us: +91 90199 46181<br><a href=\"https://www.linkedin.com/company/82536477\">LinkedIn</a><br><a href=\"https://www.youtube.com/@GrowthPartners\">YouTube</a>"
  );
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [themeSelect] = useState('light');
  const [sendingStates, setSendingStates] = useState({});
  const [rawExcelData, setRawExcelData] = useState(null);
  const [excelFileName, setExcelFileName] = useState('');
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const editorRef = React.useRef(null);

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/campaign-template`);
      if (res.ok) {
        const data = await res.json();
        if (data.subject) setSubjectTemplate(data.subject);
        if (data.body) {
          setBodyTemplate(data.body);
          if (editorRef.current) editorRef.current.innerHTML = data.body;
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/campaign-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subjectTemplate, body: bodyTemplate })
      });
      if (res.ok) showToast('Templates saved securely.', 'success');
      else throw new Error();
    } catch (e) {
      showToast('Failed to save templates.', 'error');
    }
  };

  const loadInitialData = async () => {
    try {
      const postersRes = await fetch(`${API_BASE}/api/posters`);
      if (postersRes.ok) {
        const list = await postersRes.json();
        setPosters(list);
        const custom = list.find(p => p.image_url === 'custom_uploaded');
        if (custom) {
          setSelectedPoster(custom);
        } else if (list.length > 0) {
          setSelectedPoster(list[0]);
        }
      }
      await refreshRecipients();
    } catch (e) {
      console.error(e);
      showToast('Error loading active poster template.', 'error');
    }
  };

  const refreshRecipients = async () => {
    try {
      const recRes = await fetch(`${API_BASE}/api/admin/bulk-recipients`);
      if (recRes.ok) setDbRecipients(await recRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadInitialData();
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let interval;
    const hasActiveSending = dbRecipients.some(r => r.status === 'Sending');
    if (isSending || hasActiveSending) {
      interval = setInterval(async () => {
        await refreshRecipients();
        const stillSending = dbRecipients.some(r => r.status === 'Sending');
        const stillPending = dbRecipients.some(r => r.status === 'Pending');
        if (!stillSending && !stillPending && isSending) {
          setIsSending(false);
          showToast('Bulk campaign dispatch complete!', 'success');
        }
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [dbRecipients, isSending]);

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
        setRawExcelData(rawData);

        // Filter out completely empty rows
        const jsonData = rawData.filter(row => Array.isArray(row) && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''));

        if (jsonData.length === 0) { showToast('Sheet is completely empty.', 'error'); return; }
        if (jsonData.length === 1) { showToast('Sheet has headers but no data rows.', 'error'); return; }

        const headers = jsonData[0].map(h => String(h || '').trim().toLowerCase());
        const rows = jsonData.slice(1);
        const firmNameIdx = headers.findIndex(h => h.includes('firm') || h.includes('company'));
        const nameIdx = headers.findIndex(h => h.includes('name') && !h.includes('firm') && !h.includes('company'));
        const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
        const cityIdx = headers.findIndex(h => h.includes('city'));
        const addressIdx = headers.findIndex(h => h.includes('address') || h.includes('addr'));
        const logoIdx = headers.findIndex(h => h.includes('logo'));

        if (nameIdx === -1) {
          showToast('Headers must include "Name" column.', 'error');
          return;
        }

        const parsed = rows.map(row => {
          const nameVal = row[nameIdx] ? String(row[nameIdx]).trim() : '';
          if (!nameVal) return null;
          const emailVal    = emailIdx    !== -1 && row[emailIdx]    ? String(row[emailIdx]).trim()    : '';
          const phoneVal    = phoneIdx    !== -1 && row[phoneIdx]    ? String(row[phoneIdx]).trim()    : '';
          const firmNameVal = firmNameIdx !== -1 && row[firmNameIdx] ? String(row[firmNameIdx]).trim() : '';
          const addressVal  = addressIdx  !== -1 && row[addressIdx]  ? String(row[addressIdx]).trim()  : '';
          const logoVal     = logoIdx     !== -1 && row[logoIdx]     ? String(row[logoIdx]).trim()     : '';

          // If no dedicated City column, extract last word of address as city fallback
          let cityVal = cityIdx !== -1 && row[cityIdx] ? String(row[cityIdx]).trim() : '';
          if (!cityVal && addressVal) {
            const parts = addressVal.split(/[\s,]+/).filter(Boolean);
            cityVal = parts[parts.length - 1] || '';
          }

          return {
            name:      nameVal,
            email:     emailVal,
            firm_name: firmNameVal,
            phone:     phoneVal,
            city:      cityVal,
            address:   addressVal,
            firm_logo: logoVal,
            status:    'Pending'
          };
        }).filter(Boolean);

        if (parsed.length === 0) {
          showToast('No valid records with Name found.', 'warning');
        } else {
          setUploadedRecipients(parsed);
          showToast(`Imported ${parsed.length} recipients. Click Save to store.`, 'success');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to parse file.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCustomPosterUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target.result;
      try {
        const res = await fetch(`${API_BASE}/api/admin/posters/custom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customImageBase64: base64, month: uploadMonth, category: 'Custom Calendar', title: uploadTitle })
        });
        if (res.ok) {
          const data = await res.json();
          setSelectedPoster(data.poster);
          setImageVersion(Date.now());
          showToast('Campaign poster uploaded & saved to database!', 'success');
        } else throw new Error();
      } catch (err) {
        showToast('Failed to save poster to DB.', 'error');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input to allow re-uploading the same file
  };

  const saveRecipientsToDb = async () => {
    if (uploadedRecipients.length === 0) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/bulk-recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: uploadedRecipients })
      });
      if (res.ok) {
        showToast(`Stored ${uploadedRecipients.length} recipients.`, 'success');
        setUploadedRecipients([]);
        await refreshRecipients();
      } else throw new Error();
    } catch (e) {
      showToast('Failed to save list to DB.', 'error');
    }
  };

  const clearDbList = async () => {
    if (!window.confirm('Delete all stored recipients? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/bulk-recipients`, { method: 'DELETE' });
      if (res.ok) { setDbRecipients([]); showToast('Recipient database cleared.', 'success'); }
    } catch (e) {
      showToast('Failed to clear list.', 'error');
    }
  };

  const triggerBulkCampaign = async () => {
    if (!selectedPoster) { showToast('No active poster template loaded.', 'warning'); return; }
    if (dbRecipients.length === 0) { showToast('Import recipients first.', 'warning'); return; }
    const pending = dbRecipients.filter(r => r.status !== 'Sent');
    if (pending.length === 0) { showToast('All recipients already Sent. Clear list to re-send.', 'info'); return; }

    setIsSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/bulk-recipients/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: selectedPoster._id || selectedPoster.id, month: selectedPoster.month, theme: themeSelect, subjectTemplate, bodyTemplate })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Bulk campaign started!', 'success');
        await refreshRecipients();
      } else throw new Error(data.error);
    } catch (e) {
      setIsSending(false);
      showToast(e.message || 'Failed to start campaign.', 'error');
    }
  };

  const sendSingleCampaign = async (recId, email) => {
    if (!selectedPoster) { showToast('No active poster template loaded.', 'warning'); return; }
    setSendingStates(prev => ({ ...prev, [recId]: true }));
    setDbRecipients(prev => prev.map(r => r._id === recId ? { ...r, status: 'Sending' } : r));
    try {
      const res = await fetch(`${API_BASE}/api/admin/bulk-recipients/${recId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: selectedPoster._id || selectedPoster.id, month: selectedPoster.month, theme: themeSelect, subjectTemplate, bodyTemplate })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Email sent to: ${email}`, 'success');
        await refreshRecipients();
      } else throw new Error(data.error);
    } catch (e) {
      showToast(e.message || 'Failed to send.', 'error');
      await refreshRecipients();
    } finally {
      setSendingStates(prev => ({ ...prev, [recId]: false }));
    }
  };

  const filteredRecipients = dbRecipients.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.city && r.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalCount = dbRecipients.length;
  const sentCount = dbRecipients.filter(r => r.status === 'Sent').length;
  const sendingCount = dbRecipients.filter(r => r.status === 'Sending').length;
  const pendingCount = dbRecipients.filter(r => r.status === 'Pending').length;
  const failedCount = dbRecipients.filter(r => r.status === 'Failed').length;
  const deliveryPct = totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;

  return (
    <section className="view-pane">

      {/* ── Page Header ───────────────────────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="headline-md">Bulk Email Campaign Automation</h1>
        <p className="body-sm text-secondary" style={{ marginTop: '4px' }}>
          Generate and email compliance calendar posters. Footer logo and contact cards update dynamically for each client row.
        </p>
      </div>

      {/* ── Campaign Setup Toolbar ────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto',
        gap: '0',
        alignItems: 'stretch',
        background: 'var(--surface-container-lowest)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
      }}>

        {/* Template Preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
          <div style={{
            width: '56px', height: '80px', borderRadius: '6px', overflow: 'hidden',
            border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-container-high)',
            flexShrink: 0
          }}>
            {selectedPoster ? (
              <img
                src={`${API_BASE}/api/templates/thumbnail/${selectedPoster.image_url}?month=${selectedPoster.month}&v=${imageVersion}`}
                alt={selectedPoster?.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--secondary)' }}>
                No<br />Image
              </div>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            {selectedPoster ? (
              <>
                <div style={{
                  display: 'inline-block', fontSize: '9px', fontWeight: '700', letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--accent-line)',
                  background: 'var(--accent-active-bg)', padding: '2px 8px', borderRadius: '99px',
                  marginBottom: '5px'
                }}>
                  {selectedPoster.image_url === 'custom_uploaded' ? 'Custom Uploaded' : selectedPoster.category}
                </div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--on-surface)', lineHeight: '1.2', marginBottom: '3px' }}>
                  {selectedPoster.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--secondary)' }}>
                  Month: <strong>{selectedPoster.month}</strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
                  {selectedPoster.image_url === 'custom_uploaded'
                    ? 'Custom background campaign template'
                    : selectedPoster.description}
                </div>
              </>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--secondary)' }}>No active template loaded.</span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', background: 'var(--border-color)' }} />

        {/* Upload Campaign Poster */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', padding: '16px 24px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Upload Campaign Poster
          </span>

          <select
            value={uploadMonth}
            onChange={e => setUploadMonth(e.target.value)}
            style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none' }}
          >
            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <input
            type="text"
            value={uploadTitle}
            onChange={e => setUploadTitle(e.target.value)}
            placeholder="Campaign Title"
            style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none' }}
          />

          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button type="button" className="btn btn-sm btn-outline" style={{ pointerEvents: 'none' }}>
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Upload Image
            </button>
            <input type="file" accept="image/*" onChange={handleCustomPosterUpload}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', background: 'var(--border-color)' }} />

        {/* Excel + Send */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', padding: '16px 24px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Excel Recipient List
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button type="button" className="btn btn-sm btn-outline" style={{ pointerEvents: 'none' }}>
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                </svg>
                Choose Sheet
              </button>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
            </div>
            {rawExcelData && (
              <button 
                type="button" 
                className="btn btn-sm btn-secondary" 
                onClick={() => setShowExcelPreview(true)}
              >
                Preview Sheet
              </button>
            )}
          </div>
          {excelFileName && <div style={{ fontSize: '11px', color: 'var(--secondary)' }}>File: {excelFileName}</div>}

          <div style={{ marginTop: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
              Campaign Dispatch
            </span>
            <button
              className="btn btn-sm btn-primary"
              type="button"
              onClick={triggerBulkCampaign}
              disabled={isSending || dbRecipients.length === 0 || !selectedPoster}
              style={{ width: '100%' }}
            >
              {isSending ? (
                <><span className="spinner-mini" style={{ width: '10px', height: '10px', marginRight: '6px', display: 'inline-block' }} />Sending...</>
              ) : (
                <>
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Send Bulk Emails
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* ── Preview Uploaded Sheet ────────────────────────────── */}
      {uploadedRecipients.length > 0 && (
        <div style={{
          background: 'var(--surface-container-lowest)',
          border: '1px solid var(--accent-line)',
          borderRadius: '12px',
          overflow: 'hidden',
          marginBottom: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--accent-active-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-line)', margin: 0 }}>Preview Uploaded Sheet</h3>
              <p style={{ fontSize: '11px', color: 'var(--secondary)', margin: '2px 0 0 0' }}>{uploadedRecipients.length} rows imported. Review columns below before saving.</p>
            </div>
            <button type="button" className="btn btn-sm btn-success animate-pulse" onClick={saveRecipientsToDb} style={{ whiteSpace: 'nowrap' }}>
              Confirm & Save {uploadedRecipients.length} Recipients
            </button>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '250px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-container-low)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--secondary)' }}>Firm Name</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--secondary)' }}>Contact Name</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--secondary)' }}>Email</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--secondary)' }}>Phone</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--secondary)' }}>City</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: 'var(--secondary)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {uploadedRecipients.slice(0, 50).map((rec, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px 14px' }}>{rec.firm_name || '—'}</td>
                    <td style={{ padding: '8px 14px', fontWeight: '600' }}>{rec.name}</td>
                    <td style={{ padding: '8px 14px' }}>{rec.email || '—'}</td>
                    <td style={{ padding: '8px 14px' }}>{rec.phone || '—'}</td>
                    <td style={{ padding: '8px 14px' }}>{rec.city || '—'}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                      <button 
                        type="button" 
                        onClick={() => setUploadedRecipients(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '12px', padding: '4px' }}
                        title="Remove row"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {uploadedRecipients.length > 50 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: 'var(--secondary)', fontSize: '11px', fontStyle: 'italic' }}>
                      ...and {uploadedRecipients.length - 50} more rows hidden in preview.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Email Content Customization ───────────────────────── */}
      <div style={{
        background: 'var(--surface-container-lowest)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-container-low)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--on-surface)', margin: 0 }}>Email Content Customization</h3>
          <button type="button" className="btn btn-xs btn-outline" onClick={saveTemplates}>Save as Default</button>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Email Subject</label>
            <input 
              type="text" 
              value={subjectTemplate} 
              onChange={e => setSubjectTemplate(e.target.value)} 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', background: 'transparent', color: 'var(--on-surface)' }} 
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--secondary)', textTransform: 'uppercase' }}>Email Body</label>
              <button type="button" className="btn btn-xs btn-outline" onMouseDown={(e) => e.preventDefault()} onClick={() => {
                const selection = window.getSelection();
                if (!selection || !selection.toString().trim()) {
                  const text = prompt('Enter text to display:');
                  if (!text) return;
                  const url = prompt('Enter hyperlink URL (e.g. https://growthpartners.in):');
                  if (url) {
                    document.execCommand('insertHTML', false, `<a href="${url}">${text}</a>`);
                    if (editorRef.current) setBodyTemplate(editorRef.current.innerHTML);
                  }
                } else {
                  const url = prompt('Enter hyperlink URL for the selected text:');
                  if (url) {
                    document.execCommand('createLink', false, url);
                    if (editorRef.current) setBodyTemplate(editorRef.current.innerHTML);
                  }
                }
              }}>
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                Insert Link
              </button>
            </div>
            <div 
              ref={editorRef}
              contentEditable 
              suppressContentEditableWarning
              onBlur={e => setBodyTemplate(e.currentTarget.innerHTML)}
              dangerouslySetInnerHTML={{ __html: bodyTemplate }}
              style={{ width: '100%', minHeight: '120px', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', lineHeight: '1.5', background: 'var(--surface-container-low)', color: 'var(--on-surface)' }} 
            />
            <p style={{ fontSize: '11px', color: 'var(--secondary)', marginTop: '6px', marginBottom: 0 }}>
              Supported variables: {'{name}, {firm_name}, {month}, {city}, {phone}, {email}'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Content: Table + Stats ───────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Progress Stats Panel */}
        <div style={{
          background: 'var(--surface-container-lowest)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          {/* Panel header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-container-low)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--on-surface)', margin: 0 }}>Progress Stats</h3>
          </div>

          <div style={{ padding: '16px' }}>
            {/* Stat rows */}
            {[
              { label: 'Total', value: totalCount, color: 'var(--on-surface)' },
              { label: 'Sent', value: sentCount, color: 'var(--success)' },
              { label: 'Sending', value: sendingCount, color: 'var(--accent-line)' },
              { label: 'Pending', value: pendingCount, color: 'var(--warning)' },
              { label: 'Failed', value: failedCount, color: 'var(--error)' },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : 'none'
              }}>
                <span style={{ fontSize: '12px', color: i === 0 ? 'var(--secondary)' : color, fontWeight: i === 0 ? '400' : '500' }}>
                  {label}
                </span>
                <span style={{ fontSize: '14px', fontWeight: '700', color }}>
                  {value}
                </span>
              </div>
            ))}

            {/* Campaign Delivery progress bar */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--secondary)' }}>Campaign Delivery</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: deliveryPct === 100 ? 'var(--success)' : 'var(--accent-line)' }}>
                  {deliveryPct}%
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--surface-container-high)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${deliveryPct}%`,
                  background: deliveryPct === 100
                    ? 'var(--success)'
                    : 'linear-gradient(90deg, var(--accent-line), var(--primary))',
                  borderRadius: '99px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
              {totalCount > 0 && (
                <p style={{ fontSize: '10px', color: 'var(--secondary)', marginTop: '6px', textAlign: 'center' }}>
                  {sentCount} of {totalCount} delivered
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Recipient Table */}
        <div style={{
          background: 'var(--surface-container-lowest)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          {/* Table Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', borderBottom: '1px solid var(--border-color)',
            background: 'var(--surface-container-low)'
          }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--on-surface)', margin: 0 }}>
                Recipient Database Status Tracker
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--secondary)', marginTop: '2px' }}>
                {totalCount} recipient{totalCount !== 1 ? 's' : ''} in database
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--secondary)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    paddingLeft: '30px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px',
                    fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '6px',
                    background: 'var(--surface-container-lowest)', outline: 'none', width: '200px'
                  }}
                />
              </div>
              {dbRecipients.length > 0 && (
                <button type="button" className="btn btn-xs btn-outline" onClick={clearDbList}
                  style={{ color: 'var(--error)', borderColor: 'var(--error)', fontSize: '11px' }}>
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-container-low)', position: 'sticky', top: 0, zIndex: 1 }}>
                  {['Recipient Details', 'Contact Info', 'City', 'Campaign Status', 'Processed Time', 'Action'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', fontSize: '11px',
                      fontWeight: '600', color: 'var(--secondary)', textTransform: 'uppercase',
                      letterSpacing: '0.04em', borderBottom: '1px solid var(--border-color)',
                      whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecipients.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--secondary)' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>No recipients in campaign database</div>
                      <div style={{ fontSize: '11px' }}>Import an Excel sheet above to get started.</div>
                    </td>
                  </tr>
                ) : (
                  filteredRecipients.map((rec, idx) => (
                    <tr key={rec._id} style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: idx % 2 === 0 ? 'transparent' : 'var(--surface-container-low)',
                      transition: 'background 0.15s'
                    }}>

                      {/* Recipient Details */}
                      <td style={{ padding: '12px 14px' }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--on-surface)' }}>
                            {rec.firm_name || rec.name}
                          </div>
                          {rec.firm_name && (
                            <div style={{ fontSize: '11px', color: 'var(--secondary)', marginTop: '1px' }}>
                              Contact: {rec.name}
                            </div>
                          )}
                          {rec.address && (
                            <div style={{ fontSize: '10px', color: 'var(--secondary)', marginTop: '1px', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rec.address}>
                              {rec.address}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--on-surface)' }}>{rec.email}</div>
                        {rec.phone && (
                          <div style={{ fontSize: '11px', color: 'var(--secondary)', marginTop: '2px' }}>{rec.phone}</div>
                        )}
                      </td>

                      {/* City */}
                      <td style={{ padding: '12px 14px', color: 'var(--secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {rec.city || '—'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '11px', fontWeight: '600', padding: '3px 10px', borderRadius: '99px',
                          ...(rec.status === 'Sent'
                            ? { background: 'var(--success-bg)', color: 'var(--success)' }
                            : rec.status === 'Sending'
                              ? { background: 'var(--accent-active-bg)', color: 'var(--accent-line)' }
                              : rec.status === 'Failed'
                                ? { background: 'var(--error-bg)', color: 'var(--error)' }
                                : { background: 'var(--warning-bg)', color: 'var(--warning)' })
                        }}>
                          {rec.status === 'Sent' && '✓ '}
                          {rec.status === 'Sending' && <span className="spinner-mini" style={{ width: '8px', height: '8px' }} />}
                          {rec.status === 'Failed' && '✗ '}
                          {rec.status}
                        </span>
                        {rec.status === 'Failed' && rec.error && (
                          <div style={{ fontSize: '9px', color: 'var(--error)', marginTop: '3px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rec.error}>
                            {rec.error}
                          </div>
                        )}
                      </td>

                      {/* Time */}
                      <td style={{ padding: '12px 14px', color: 'var(--secondary)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {rec.sentAt ? new Date(rec.sentAt).toLocaleTimeString() : '—'}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 14px' }}>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => sendSingleCampaign(rec._id, rec.email)}
                          disabled={isSending || sendingStates[rec._id] || rec.status === 'Sending'}
                          style={{
                            borderColor: rec.status === 'Failed' ? 'var(--error)' : undefined,
                            color: rec.status === 'Failed' ? 'var(--error)' : undefined,
                            minWidth: '58px'
                          }}
                        >
                          {rec.status === 'Sending'
                            ? <span className="spinner-mini" style={{ width: '8px', height: '8px' }} />
                            : rec.status === 'Sent' ? 'Resend'
                              : rec.status === 'Failed' ? 'Retry'
                                : 'Send'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── Raw Excel Preview Modal ────────────────────────────── */}
      {showExcelPreview && rawExcelData && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--surface-container-lowest)', borderRadius: '12px', width: '90%', maxWidth: '1000px',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-container-low)' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--on-surface)', margin: 0 }}>Excel Sheet Preview</h3>
                <p style={{ fontSize: '12px', color: 'var(--secondary)', margin: '2px 0 0 0' }}>{excelFileName} ({rawExcelData.length} rows)</p>
              </div>
              <button type="button" className="btn btn-xs btn-outline" onClick={() => setShowExcelPreview(false)}>Close</button>
            </div>
            <div style={{ overflow: 'auto', padding: '0', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-container-low)', position: 'sticky', top: 0, zIndex: 1 }}>
                    {rawExcelData[0]?.map((header, idx) => (
                      <th key={idx} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--secondary)', borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                        {header || `Column ${idx + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawExcelData.slice(1).map((row, rowIndex) => (
                    <tr key={rowIndex} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {rawExcelData[0]?.map((_, colIndex) => (
                        <td key={colIndex} style={{ padding: '8px 14px', borderRight: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                          {row[colIndex] !== undefined && row[colIndex] !== null ? String(row[colIndex]) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
