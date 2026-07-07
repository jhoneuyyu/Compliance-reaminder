import React from 'react';

export default function SetNewPassword({ onResetSubmit, onNavigateToLogin }) {
  // Parse token from window.location.hash (e.g. #/reset?token=xyz)
  const hashPart = window.location.hash.split('?')[1] || '';
  const urlParams = new URLSearchParams(hashPart);
  const token = urlParams.get('token') || '';

  const handleSubmit = (e) => {
    e.preventDefault();
    const { new_password, confirm_password } = e.target.elements;
    
    if (new_password.value !== confirm_password.value) {
      alert('Passwords do not match.');
      return;
    }
    
    onResetSubmit(token, new_password.value);
  };

  if (!token) {
    return (
      <div className="auth-card">
        <h2>Set New Password</h2>
        <p className="subtitle" style={{ color: '#dc2626', fontWeight: 'bold' }}>
          Invalid or expired password reset link. Please request a new link from the forgot password page.
        </p>
        <div className="auth-links">
          <a href="javascript:void(0)" onClick={onNavigateToLogin}>Back to Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2>Set New Password</h2>
      <p className="subtitle">Enter your new secure password below to update your account credentials.</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="reset-new-password">New Password</label>
          <input type="password" id="reset-new-password" name="new_password" placeholder="Enter new secure password" required />
        </div>
        <div className="form-group">
          <label htmlFor="reset-confirm-password">Confirm New Password</label>
          <input type="password" id="reset-confirm-password" name="confirm_password" placeholder="Confirm new secure password" required />
        </div>
        <button type="submit" className="btn btn-primary w-full">Update Password & Login</button>
      </form>
      
      <div className="auth-links">
        Cancel reset? <a href="javascript:void(0)" onClick={onNavigateToLogin}>Back to Sign In</a>
      </div>
    </div>
  );
}
