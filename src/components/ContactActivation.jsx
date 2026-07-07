import React, { useState, useEffect } from 'react';

export default function ContactActivation({ currentUser, apiBase }) {
  const [whatsappLink, setWhatsappLink] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      if (!currentUser) return;
      
      const today = new Date().toISOString().split('T')[0];
      const isExpired = currentUser.expiry_date && currentUser.expiry_date < today;
      
      if (currentUser.credits < 1 || isExpired) {
        try {
          const setRes = await fetch(`${apiBase}/api/settings`);
          const settings = await setRes.json();
          const num = settings.whatsapp_support || '919019946181';
          const msg = encodeURIComponent(`Hi Growth Partners, my account (${currentUser.username}) has exhausted its credits. Please activate my account.`);
          setWhatsappLink(`https://wa.me/${num}?text=${msg}`);
        } catch (e) {
          console.error('Failed to load settings for whatsapp link', e);
        }
      } else {
        setWhatsappLink('');
      }
    };
    
    fetchSettings();
  }, [currentUser, apiBase]);

  if (!whatsappLink) return null;

  return (
    <div className="activation-action">
      <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-warning btn-sm">Contact for Activation</a>
    </div>
  );
}
