import React from 'react';
import CompanyLogo from '../assets/growth_partner_login.ico';

export default function Login({ 
  onLoginSubmit, 
  onNavigateToRegister, 
  onNavigateToForgot, 
  onNavigateToReset 
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const { email, password } = e.target.elements;
    onLoginSubmit(email.value, password.value);
  };

  return (
    <div className="auth-card">
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <img src={CompanyLogo} alt="Growth Partners Logo" style={{ width: '64px', height: '64px' }} />
      </div>
      <h2>Sign In</h2>
      <p className="subtitle">Growth Partners Compliance Personalisation Workspace</p>
      
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="form-group">
          <label htmlFor="login-email">Email</label>
          <input 
            type="email" 
            id="login-email" 
            name="email" 
            placeholder="growthpartnersgadag@gmail.com" 
            autoComplete="new-password"
            required 
          />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">Password</label>
          <input 
            type="password" 
            id="login-password" 
            name="password" 
            placeholder="******" 
            autoComplete="new-password"
            required 
          />
        </div>
        <button type="submit" className="btn btn-primary w-full">Sign In</button>
      </form>
      <div className="auth-links">
        <div className="forgot-pwd">
          <a href="javascript:void(0)" onClick={onNavigateToForgot}>Forgot Password?</a>
        </div>
        Don't have an account? <a href="javascript:void(0)" onClick={onNavigateToRegister}>Create one</a>
      </div>
    </div>
  );
}
