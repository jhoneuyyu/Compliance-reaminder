import React from 'react';

export default function ProductsView() {
  return (
    <section className="view-pane">
      <h1 className="headline-md">Growth Partners Products & Solutions</h1>
      <p className="body-sm text-secondary">Discover professional automation suites designed to scale your tax advisory practice.</p>
      <div className="products-grid-static">
        <div className="product-card card">
          <h3>GP AutoGST Suite</h3>
          <p>Automate GST portal data retrieval, reconciliation matching (2A/2B vs purchase registers), and client notification emails with single-click reports.</p>
          <a href="https://growthpartners.in/products/autogst" target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">Explore Product</a>
        </div>
        <div className="product-card card">
          <h3>GP Income Tax Advisor</h3>
          <p>Compute dynamic tax optimizations under Old vs New Tax Regimes, generate direct CA audits forms, and manage secure electronic tax filing APIs.</p>
          <a href="https://growthpartners.in/products/incometax" target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">Explore Product</a>
        </div>
        <div className="product-card card">
          <h3>GP Digital Office</h3>
          <p>A client management portal for CAs allowing secure file uploads, bill reminders, WhatsApp chat automations, and custom cloud folders.</p>
          <a href="https://growthpartners.in/products/digitaloffice" target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">Explore Product</a>
        </div>
      </div>
    </section>
  );
}
