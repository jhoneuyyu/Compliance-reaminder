import React from 'react';
import CompanyLogo from '../assets/growth_partner_login.ico';

export default function ForgotPassword({ onForgotSubmit, onNavigateToLogin }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const { email } = e.target.elements;
    onForgotSubmit(email.value);
  };

  return (
    <div className="auth-card">
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <img src={CompanyLogo} alt="Growth Partners Logo" style={{ width: '64px', height: '64px' }} />
      </div>
      <h2>Recover Password</h2>
      <p className="subtitle">Enter your registered email address to generate your temporary password reset code.</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="forgot-email">Registered Email Address</label>
          <input 
            type="email" 
            id="forgot-email" 
            name="email" 
            placeholder="e.g. office@casudha.in" 
            required 
          />
        </div>
        <button type="submit" className="btn btn-primary w-full">Reset Password</button>
      </form>
      
      <div className="auth-links">
        Remembered password? <a href="javascript:void(0)" onClick={onNavigateToLogin}>Back to Sign In</a>
      </div>
    </div>
  );
}
