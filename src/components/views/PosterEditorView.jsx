import React, { useState, useEffect, useRef } from 'react';

export default function PosterEditorView({ 
  currentUser, posters, selectedPosterId, setSelectedPosterId, selectedMonth,
  API_BASE, showToast, handleSetUser, fetchEmails 
}) {
  const [editorTheme, setEditorTheme] = useState('blue');
  const [logoBase64, setLogoBase64] = useState('');
  const [editorFields, setEditorFields] = useState({
    name: '', phone: '', email: '', city: '', address: ''
  });
  const [isGenerated, setIsGenerated] = useState(false);
  const [generatedImageData, setGeneratedImageData] = useState(null);
  const [previewImageData, setPreviewImageData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [emailing, setEmailing] = useState(false);
  
  const activePoster = posters.find(p => p.id == selectedPosterId);
  
  // Parse mode from hash (e.g. #/editor?posterId=XYZ&mode=preview)
  const hashPart = window.location.hash.split('?')[1] || '';
  const urlParams = new URLSearchParams(hashPart);
  const mode = urlParams.get('mode') || 'generate';

  // Initialize fields when entering the editor
  useEffect(() => {
    if (selectedPosterId && currentUser) {
      setEditorFields({
        name: currentUser.name || '',
        phone: currentUser.phone || '',
        email: currentUser.email || '',
        city: currentUser.city || '',
        address: currentUser.address || ''
      });
      setLogoBase64(currentUser.firm_logo || '');
      setIsGenerated(false);
      setPreviewImageData(null);
      setGeneratedImageData(null);
    }
  }, [selectedPosterId, currentUser?.id]);

  // Reset generation status when inputs change to prevent free downloads of modified previews
  // ponytail: resets isGenerated and clears generatedImageData when branding details are modified
  useEffect(() => {
    setIsGenerated(false);
    setGeneratedImageData(null);
  }, [
    editorFields.name,
    editorFields.phone,
    editorFields.email,
    editorFields.city,
    editorFields.address,
    logoBase64,
    editorTheme
  ]);

  // Live Canvas Customizer Drawing (via Backend)
  const refreshPreview = async () => {
    if (!activePoster) return;
    setPreviewLoading(true);
    setGeneratedImageData(null); // Clear previous generation to show preview update

    try {
      const payload = {
        user_id: currentUser.id,
        poster_id: selectedPosterId,
        theme: editorTheme,
        fields: editorFields,
        logoBase64,
        month: selectedMonth
      };

      const res = await fetch(`${API_BASE}/api/posters/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Preview fetch failed');
      const data = await res.json();
      setPreviewImageData(data.image_data);
    } catch (err) {
      console.error(err);
      showToast('Failed to generate preview. Please check your data.', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Trigger preview on mount after a small delay to ensure fields are loaded
  useEffect(() => {
    if (selectedPosterId && !isGenerated) {
      const timer = setTimeout(() => {
        refreshPreview();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedPosterId, editorTheme]); // Only auto-refresh on mount and theme change. Others require manual refresh to save backend calls.

  const handleGeneratePoster = async () => {
    if (!currentUser || !activePoster) return;
    setGenerating(true);

    try {
      const response = await fetch(`${API_BASE}/api/posters/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          poster_id: activePoster.id,
          poster_title: activePoster.title,
          theme: editorTheme,
          fields: editorFields,
          logoBase64: logoBase64,
          month: selectedMonth
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Generation failed');

      // Update Credits
      const updatedUser = { ...currentUser, credits: data.remaining_credits };
      handleSetUser(updatedUser);
      setIsGenerated(true);
      setGeneratedImageData(data.image_data);
      showToast('Poster generated! 1 credit consumed.', 'success');
      
      if (fetchEmails) fetchEmails();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleEmailShare = async () => {
    const targetImage = generatedImageData;
    if (!isGenerated || !targetImage) {
      showToast('Please generate the poster first.', 'error');
      return;
    }
    setEmailing(true);
    try {
      const response = await fetch(`${API_BASE}/api/posters/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          poster_title: activePoster.title,
          poster_description: activePoster.description,
          image_data: targetImage
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send email');
      showToast('Email sent successfully!', 'success');
      if (fetchEmails) fetchEmails();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setEmailing(false);
    }
  };

  const handleDownload = async (format) => {
    const targetImage = generatedImageData;
    if (!isGenerated || !targetImage) {
      showToast('Please generate the poster first.', 'error');
      return;
    }

    try {
      showToast('Preparing download...', 'info');
      let downloadUrl = targetImage;

      // Convert to actual PNG blob to prevent browser download blocks due to mime mismatch
      if (format === 'png') {
        const pngBlob = await getPngBlob(targetImage);
        downloadUrl = URL.createObjectURL(pngBlob);
      }

      const link = document.createElement('a');
      link.download = `compliance_poster_${selectedPosterId}.${format}`;
      link.href = downloadUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (format === 'png') {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
      }

      showToast(`Downloading poster as ${format.toUpperCase()}...`, 'success');
    } catch (err) {
      console.error('Download failed:', err);
      showToast('Download failed. Please try again or right-click to save.', 'error');
    }
  };

  const handleNativeShare = async () => {
    const targetImage = generatedImageData;
    if (!isGenerated || !targetImage) {
      showToast('Please generate the poster first.', 'error');
      return;
    }
    try {
      const blob = await (await fetch(targetImage)).blob();
      const file = new File([blob], `compliance_poster_${selectedPosterId}.png`, { type: 'image/png' });
      if (navigator.share) {
        await navigator.share({
          title: 'Compliance Poster',
          text: 'Here is our latest compliance poster.',
          files: [file]
        });
        showToast('Shared successfully!', 'success');
      } else {
        showToast('Native sharing not supported on this device/browser.', 'info');
      }
    } catch (error) {
      console.error('Share failed', error);
      showToast('Sharing cancelled or failed.', 'error');
    }
  };

  const getPngBlob = (dataUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = dataUrl;
    });
  };

  const handleShareToPlatform = async (platform) => {
    const targetImage = generatedImageData;
    if (!isGenerated || !targetImage) {
      showToast('Please generate the poster first.', 'error');
      return;
    }

    // Open target window immediately during the user gesture thread to bypass popup blocker
    const targetUrl = platform === 'whatsapp' ? 'https://web.whatsapp.com/' : 'https://www.instagram.com/';
    const newWindow = window.open('about:blank', '_blank');
    if (newWindow) {
      newWindow.document.write('<p style="font-family:sans-serif;text-align:center;margin-top:20%;">Preparing your poster sharing, please wait...</p>');
    }

    try {
      showToast('Copying image to clipboard...', 'info');
      const pngBlob = await getPngBlob(targetImage);
      
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob })
        ]);
        showToast('✅ Copied to clipboard! Just paste (Ctrl+V) in the chat.', 'success');
      } else {
        throw new Error('Clipboard API not supported');
      }
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      showToast('Clipboard copy failed. Please download the image and upload directly.', 'warning');
    } finally {
      if (newWindow) {
        newWindow.location.href = targetUrl;
      }
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!selectedPosterId || !activePoster) return null;

  return (
    <section className="view-pane">
      <div className="back-link">
        <a href="#/dashboard" className="icon-link">
          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M381-480 570-669l-57-57-246 246 246 246 57-57-189-189Z"/></svg>
          <span>Back to Posters</span>
        </a>
      </div>

      <div className="editor-workspace">
        <div className="editor-preview-column">
          <h3>Compliance Poster Canvas</h3>
          <div className="canvas-wrapper" style={{ position: 'relative' }}>
            {previewImageData ? (
              <div style={{ position: 'relative' }}>
                <img 
                  src={previewImageData} 
                  alt="Live Preview" 
                  id="poster-canvas" 
                  style={{ 
                    width: '100%', 
                    height: 'auto', 
                    borderRadius: '12px',
                    opacity: (previewLoading || generating) ? 0.5 : 1,
                    transition: 'opacity 0.2s ease'
                  }} 
                />
                {(previewLoading || generating) && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.4)', borderRadius: '12px',
                    zIndex: 10
                  }}>
                    <div className="spinner" style={{ 
                      border: '4px solid #f3f3f3', 
                      borderTop: '4px solid #003366', 
                      borderRadius: '50%', 
                      width: '40px', 
                      height: '40px', 
                      animation: 'spin 1s linear infinite' 
                    }}></div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          {isGenerated && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', width: '100%' }}>
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button className="btn btn-outline" onClick={() => handleDownload('png')} style={{ flex: 1 }} disabled={previewLoading || generating}>Download PNG</button>
                <button className="btn btn-outline" onClick={() => handleDownload('jpg')} style={{ flex: 1 }} disabled={previewLoading || generating}>Download JPG</button>
              </div>
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button className="btn btn-success" onClick={() => handleShareToPlatform('whatsapp')} style={{ flex: 1, backgroundColor: '#25D366', borderColor: '#25D366', color: '#fff' }} disabled={previewLoading || generating}>Share on WhatsApp</button>
                <button className="btn btn-primary" onClick={() => handleShareToPlatform('instagram')} style={{ flex: 1, background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', border: 'none', color: '#fff' }} disabled={previewLoading || generating}>Share on Instagram</button>
              </div>
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button className="btn btn-primary" onClick={handleEmailShare} style={{ flex: 1, backgroundColor: '#003366', borderColor: '#003366', color: '#fff' }} disabled={previewLoading || generating || emailing}>
                  {emailing ? '⏳ Sending Email...' : 'Email Poster (with Attachment)'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="editor-controls-column card">
          <h3>Branding Options</h3>
          <p className="body-sm text-secondary">Branding overlays on the bottom 30% of the poster.</p>



          <div className="form-group">
            <label className="input-label">Firm Logo Image</label>
            <div className="logo-uploader">
              {logoBase64 ? (
                <img src={logoBase64} alt="Firm Logo" className="logo-preview" />
              ) : (
                <div className="uploader-placeholder">No Logo Uploaded</div>
              )}
              <input type="file" id="logo-input-edit" accept="image/*" className="file-input-hidden" onChange={handleLogoUpload} disabled={previewLoading || generating} />
              <button type="button" className="btn btn-sm btn-outline" onClick={() => document.getElementById('logo-input-edit').click()} disabled={previewLoading || generating}>Upload Logo</button>
            </div>
          </div>

          <div className="form-group">
            <label>Firm Name / Your Name</label>
            <input type="text" value={editorFields.name} onChange={(e) => setEditorFields({ ...editorFields, name: e.target.value })} placeholder="Firm Name" disabled={previewLoading || generating} />
          </div>

          <div className="row">
            <div className="col form-group">
              <label>City</label>
              <input type="text" value={editorFields.city} onChange={(e) => setEditorFields({ ...editorFields, city: e.target.value })} placeholder="City" disabled={previewLoading || generating} />
            </div>
            <div className="col form-group">
              <label>Phone Number</label>
              <input type="text" value={editorFields.phone} onChange={(e) => setEditorFields({ ...editorFields, phone: e.target.value })} placeholder="Phone Number" disabled={previewLoading || generating} />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={editorFields.email} onChange={(e) => setEditorFields({ ...editorFields, email: e.target.value })} placeholder="Email Address" disabled={previewLoading || generating} />
          </div>

          <div className="form-group">
            <label>Office Address</label>
            <input type="text" value={editorFields.address} onChange={(e) => setEditorFields({ ...editorFields, address: e.target.value })} placeholder="Address" disabled={previewLoading || generating} />
          </div>

          <div className="editor-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={refreshPreview} 
              disabled={previewLoading || generating}
            >
              {previewLoading ? '⏳ Loading...' : 'Refresh Live Preview'}
            </button>
            {!isGenerated && (
              currentUser.credits > 0 ? (
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleGeneratePoster}
                  disabled={previewLoading || generating}
                >
                  {generating ? '⏳ Generating...' : 'Deduct 1 Credit & Generate'}
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>Insufficient credits. Credits: 0</span>
                  <a 
                    href={`https://wa.me/919019946181?text=${encodeURIComponent(`Hi Growth Partners, my account (${currentUser.username}) has exhausted its credits. Please activate my account.`)}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-warning"
                  >
                    Contact for Activation
                  </a>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
