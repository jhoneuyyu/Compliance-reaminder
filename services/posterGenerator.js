const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

function wrapTextSvg(text, maxLength = 45) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + ' ' + word).length > maxLength) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines;
}

async function generatePoster(userData, poster, theme = 'light', month = 'July') {
  // 1. Resolve template background image source
  let inputSource;
  if (poster.custom_image_base64 && poster.custom_image_base64.startsWith('data:')) {
    const base64Data = poster.custom_image_base64.split(';base64,').pop();
    inputSource = Buffer.from(base64Data, 'base64');
  } else {
    let pPath = poster.image_url;
    if (!pPath || !fs.existsSync(pPath)) {
      pPath = path.join(__dirname, '..', poster.image_url);
    }
    if (!fs.existsSync(pPath)) {
      pPath = path.join(__dirname, '../original_poster.png');
    }
    inputSource = pPath;
  }

  const bgSharp = sharp(inputSource);
  const metadata = await bgSharp.metadata();
  const W = metadata.width;
  const H = metadata.height;

  let footerWidth = (poster && poster.footer?.width) !== undefined
    ? poster.footer.width : W;
  let footerX = (poster && poster.footer?.x) !== undefined
    ? poster.footer.x : 0;

  const overlays = [];

  function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&apos;';
        case '"': return '&quot;';
      }
    });
  }

  const firmName = escapeXml(userData.firm_name || userData.name || "FIRM NAME");
  const phone = escapeXml(userData.phone || "");
  const email = escapeXml(userData.email || "");

  const addressValUnescaped = [userData.address, userData.city].filter(Boolean).join(", ");
  const addressLines = wrapTextSvg(addressValUnescaped, 55).map(escapeXml);

  function getIcon(type, x, y) {
    let path = '';
    if (type === 'address') {
      path = `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3" fill="none" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (type === 'phone') {
      path = `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" fill="none" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (type === 'email') {
      path = `<rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" fill="none" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (type === 'name') {
      path = `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="7" r="4" fill="none" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return `
      <circle cx="${x}" cy="${y}" r="16" fill="#0B2F6B"/>
      <g transform="translate(${x - 12}, ${y - 12})">
        ${path}
      </g>
    `;
  }

  const rows = [];
  if (userData.name) rows.push({ label: 'Name', value: escapeXml(userData.name), icon: 'name' });
  if (phone) rows.push({ label: 'Mobile', value: phone, icon: 'phone' });
  if (email) rows.push({ label: 'Email', value: email, icon: 'email' });
  if (addressLines.length > 0 && addressLines[0] !== "") {
    rows.push({ label: 'Address', valueLines: addressLines, icon: 'address' });
  }

  let contentHeight = 80; // Top padding (40) + Firm Name (40)
  if (rows.length > 0) {
    contentHeight += 30; // gap before first row
    rows.forEach(row => {
       const lines = row.valueLines ? row.valueLines.length : 1;
       contentHeight += (lines * 30) + 10; // height of row
       contentHeight += 30; // gap after row (including separator)
    });
  }
  contentHeight += 20; // Bottom padding

  let predefinedFooterHeight = (poster && poster.footer?.height) !== undefined ? poster.footer.height : null;
  let predefinedFooterY = (poster && poster.footer?.y) !== undefined ? poster.footer.y : null;

  let footerHeight = predefinedFooterHeight !== null ? predefinedFooterHeight : contentHeight;
  if (footerHeight < contentHeight) {
      footerHeight = contentHeight;
  }
  let footerY = predefinedFooterY !== null ? predefinedFooterY : H - footerHeight;

  // Enforce bounds
  if (footerHeight > H) footerHeight = H;
  if (footerWidth > W) footerWidth = W;
  if (footerY < 0) footerY = 0;
  if (footerX + footerWidth > W) footerX = Math.max(0, W - footerWidth);
  if (footerY + footerHeight > H) footerY = Math.max(0, H - footerHeight);

  footerWidth = Math.floor(footerWidth);
  footerHeight = Math.floor(footerHeight);
  footerX = Math.floor(footerX);
  footerY = Math.floor(footerY);
  let elementsSvg = `
    <!-- Background -->
    <rect x="0" y="0" width="${footerWidth}" height="${footerHeight}" fill="#FFFFFF" opacity="0.97" />
    <!-- Gold accent line -->
    <rect x="0" y="0" width="${footerWidth}" height="4" fill="#D4AF37" />
  `;

  let currentY = 60; // Firm Name baseline

  // 1. Firm Name
  elementsSvg += `<text x="50%" y="${currentY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="#0B2F6B">${firmName}</text>\n`;
  currentY += 25;

  if (rows.length > 0) {
    // Top Separator
    elementsSvg += `<line x1="10%" y1="${currentY}" x2="90%" y2="${currentY}" stroke="#E0E0E0" stroke-width="1" />\n`;
    currentY += 35; // gap before first row

    const startX = Math.max(40, footerWidth * 0.15); // 15% from left

    rows.forEach((row, idx) => {
      // Draw Icon
      elementsSvg += getIcon(row.icon, startX, currentY - 8);

      // Draw Label
      elementsSvg += `<text x="${startX + 35}" y="${currentY}" font-family="Arial, sans-serif" font-size="24" font-weight="500" fill="#555555">${row.label}</text>\n`;

      // Draw Value
      const lines = row.valueLines ? row.valueLines : [row.value];
      const isAddress = row.label === 'Address';
      lines.forEach((line, i) => {
        const lineY = currentY + (i * 30);
        elementsSvg += `<text x="${startX + 180}" y="${lineY}" font-family="Arial, sans-serif" font-size="24" font-weight="500" fill="${isAddress ? '#555555' : '#0B2F6B'}">${line}</text>\n`;
      });

      currentY += (lines.length - 1) * 30;
      currentY += 25; // padding before separator

      // Separator
      elementsSvg += `<line x1="10%" y1="${currentY}" x2="90%" y2="${currentY}" stroke="#E0E0E0" stroke-width="1" />\n`;
      currentY += 35; // padding after separator
    });
  }

  const svg = `
  <svg width="${footerWidth}" height="${footerHeight}" xmlns="http://www.w3.org/2000/svg">
    ${elementsSvg}
  </svg>
  `;

  overlays.push({ input: Buffer.from(svg), left: footerX, top: footerY });

  const compositedBuffer = await bgSharp
    .composite(overlays)
    .toBuffer();

  return await sharp(compositedBuffer)
    .resize({ 
      width: Math.round(W * 0.8),  // Reduces width to 80%
      height: Math.round(H * 0.8), // Reduces height to 80%
      fit: 'contain'
    })
    .jpeg({ quality: 95 })
    .toBuffer();
}

async function drawNavyFooter(ctx, userData, W, H, theme = 'light', poster = null) {
  console.log('drawNavyFooter is deprecated, sharp compositing is now used.');
}

module.exports = { generatePoster, drawNavyFooter };