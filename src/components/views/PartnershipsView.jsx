import React from 'react';

export default function PartnershipsView() {
  return (
    <section className="view-pane">
      <h1 className="headline-md">Growth Partners Professional Network</h1>
      <p className="body-sm text-secondary">Join hands with Growth Partners to expand your compliance practice and co-create professional tools.</p>
      <div className="partnership-content card">
        <h3>Why Partner With Us?</h3>
        <p>Over 5,000+ CA firms across India use Growth Partners software engines to manage client filings and automate client relations. As a partner, you gain access to:</p>
        <ul className="standard-list">
          <li>Co-branded educational webinars on direct/indirect taxation compliance</li>
          <li>Premium referral payouts (up to 20% on licensing) for clients onboarded to our automation portals</li>
          <li>Beta access to AI-driven tax summarizer and WhatsApp chatbots</li>
        </ul>
        <div className="partnership-cta">
          <button className="btn btn-primary" onClick={() => alert('Thank you for your interest! A representative will reach out soon.')}>Submit Partnership Interest</button>
        </div>
      </div>
    </section>
  );
}
