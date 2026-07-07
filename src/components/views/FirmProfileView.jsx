import React, { useState, useEffect } from 'react';

export default function FirmProfileView({ currentUser, API_BASE, showToast, handleSetUser }) {
  const [profileFields, setProfileFields] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    address: ''
  });
  const [logoBase64, setLogoBase64] = useState('');

  useEffect(() => {
    if (currentUser?.id) {
      loadProfileData();
    }
  }, [currentUser?.id]);

  const loadProfileData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/user/profile/${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        handleSetUser(data);
        setProfileFields({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          city: data.city || '',
          address: data.address || ''
        });
        if (data.firm_logo) {
          setLogoBase64(data.firm_logo);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoBase64(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/user/profile/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profileFields,
          firm_logo: logoBase64
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profile update failed');
      
      handleSetUser(data.user);
      showToast('Professional profile saved successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <section className="view-pane">
      <h1 className="headline-md">Professional Firm Profile</h1>
      <p className="body-sm text-secondary">These settings automatically pre-populate the branding fields on your compliance posters.</p>
      <div className="profile-layout card">
        <form onSubmit={handleProfileSubmit}>
          <div className="profile-logo-section">
            <div className="logo-uploader-large">
              {logoBase64 ? (
                <img src={logoBase64} alt="Firm Logo" className="logo-preview-lg" />
              ) : (
                <div className="uploader-placeholder-lg">No Logo Uploaded</div>
              )}
              <input type="file" id="logo-input-prof" accept="image/*" className="file-input-hidden" onChange={(e) => handleLogoUpload(e, 'profile')} />
              <button type="button" className="btn btn-sm btn-outline" onClick={() => document.getElementById('logo-input-prof').click()}>Upload Firm Logo</button>
            </div>
            <div className="logo-guidelines">
              <h4>Logo Guidelines</h4>
              <p className="body-sm text-secondary">Square or horizontal logo with high contrast. Recommended dimensions: 300 x 300 px.</p>
            </div>
          </div>

          <div className="form-group">
            <label>Firm Name / Your Name</label>
            <input type="text" value={profileFields.name} onChange={(e) => setProfileFields({ ...profileFields, name: e.target.value })} placeholder="e.g. Sudha Ramakrishnan CA & Co." required />
          </div>

          <div className="row">
            <div className="col form-group">
              <label>Contact Email</label>
              <input type="email" value={profileFields.email} onChange={(e) => setProfileFields({ ...profileFields, email: e.target.value })} required />
            </div>
            <div className="col form-group">
              <label>Mobile / WhatsApp Number</label>
              <input type="tel" value={profileFields.phone} onChange={(e) => setProfileFields({ ...profileFields, phone: e.target.value })} required />
            </div>
          </div>

          <div className="row">
            <div className="col form-group">
              <label>City</label>
              <input type="text" value={profileFields.city} onChange={(e) => setProfileFields({ ...profileFields, city: e.target.value })} required />
            </div>
            <div className="col form-group">
              <label>Office Address</label>
              <input type="text" value={profileFields.address} onChange={(e) => setProfileFields({ ...profileFields, address: e.target.value })} required />
            </div>
          </div>

          <div className="profile-actions">
            <button type="submit" className="btn btn-primary">Save Changes & Complete Profile</button>
          </div>
        </form>
      </div>
    </section>
  );
}
