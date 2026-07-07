import React, { useState } from 'react';
import CompanyLogo from '../assets/growth_partner_login.ico';

export default function CreateAccount({ onRegisterSubmit, onNavigateToLogin }) {
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const { name, email, phone, password } = e.target.elements;
    onRegisterSubmit({
      name: name.value,
      email: email.value,
      phone: phone.value,
      username: email.value,
      password: password.value
    });
  };

  return (
    <div className="auth-card">
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <img src={CompanyLogo} alt="Growth Partners Logo" style={{ width: '64px', height: '64px' }} />
      </div>
      <h2>Create account</h2>
      <p className="subtitle">Join Growth Partners. Get 20 free credits instantly to customize compliance posters.</p>
      
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="form-group">
          <label htmlFor="reg-name">Full Name</label>
          <input type="text" id="reg-name" name="name" placeholder="CA Manish Bhansali" autoComplete="off" required />
        </div>
        <div className="form-group">
          <label htmlFor="reg-email">Email</label>
          <input type="email" id="reg-email" name="email" placeholder="growthpartnersgadag@gmail.com" autoComplete="new-password" required />
        </div>
        <div className="form-group">
          <label htmlFor="reg-phone">Mobile / WhatsApp Number</label>
          <input type="tel" id="reg-phone" name="phone" placeholder="+91 90199 46181" autoComplete="off" required />
        </div>
        <div className="form-group">
          <label htmlFor="reg-password">Password</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type={showPassword ? "text" : "password"} 
              id="reg-password" 
              name="password" 
              placeholder="*********" 
              autoComplete="new-password"
              required 
              style={{ width: '100%', paddingRight: '60px' }}
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{ 
                position: 'absolute', 
                right: '10px', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--secondary)',
                userSelect: 'none'
              }}
            >
              {showPassword ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>
        <button type="submit" className="btn btn-primary w-full">Register Account</button>
      </form>
      
      <div className="auth-links">
        Already registered? <a href="javascript:void(0)" onClick={onNavigateToLogin}>Login here</a>
      </div>
    </div>
  );
}
