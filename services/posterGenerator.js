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

  // Flatten onto white so transparent PNGs don't turn black, and normalise orientation.
  const bgSharp = sharp(inputSource).rotate().flatten({ background: '#FFFFFF' });
  const metadata = await bgSharp.metadata();
  const W = metadata.width;
  const H = metadata.height;

  // Detect trailing whitespace at the bottom of the image so we can drop the
  // footer into that empty band instead of leaving an awkward gap.
  async function measureBottomWhitespace() {
    try {
      const { data, info } = await bgSharp
        .clone()
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const iw = info.width;
      const ih = info.height;
      const channels = info.channels;
      const THRESHOLD = 248; // near-white
      let firstBlankRow = ih;
      for (let y = ih - 1; y >= 0; y--) {
        let rowIsBlank = true;
        for (let x = 0; x < iw; x += 4) { // sample every 4th pixel for speed
          if (data[(y * iw + x) * channels] < THRESHOLD) { rowIsBlank = false; break; }
        }
        if (rowIsBlank) firstBlankRow = y; else break;
      }
      return ih - firstBlankRow; // height of the blank band at the bottom
    } catch (e) {
      return 0;
    }
  }
  const bottomWhitespace = await measureBottomWhitespace();

  // ---- Brand colors ----
  const NAVY = '#0B2F6B';
  const NAVY_DEEP = '#08234F';   // panel background (slightly darker for depth)
  const GOLD = '#D4AF37';
  const GOLD_SOFT = '#E9C767';   // lighter gold for labels
  const WHITE = '#FFFFFF';
  const VALUE = '#F4F7FB';       // near-white values on navy

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

  const firmName = escapeXml(userData.firm_name || userData.name || 'FIRM NAME');
  const phone = escapeXml(userData.phone || '');
  const email = escapeXml(userData.email || '');

  const addressValUnescaped = [userData.address, userData.city].filter(Boolean).join(', ');
  const addressLines = wrapTextSvg(addressValUnescaped, 60).map(escapeXml);

  function getIconPath(type) {
    if (type === 'address') {
      return `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (type === 'phone') {
      return `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (type === 'email') {
      return `<rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (type === 'name') {
      return `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="7" r="4" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return '';
  }

  // A gold circular icon badge with a navy glyph, centered at (x, y).
  function getIcon(type, x, y, r) {
    const g = r * 0.72; // glyph is ~24px in a 0..24 viewBox; scale to fit
    return `
      <circle cx="${x}" cy="${y}" r="${r}" fill="${GOLD}"/>
      <g transform="translate(${x - g}, ${y - g}) scale(${(g * 2) / 24})">
        ${getIconPath(type)}
      </g>
    `;
  }

  const rows = [];
  if (userData.name) rows.push({ label: 'Name', value: escapeXml(userData.name), icon: 'name' });
  if (phone) rows.push({ label: 'Mobile', value: phone, icon: 'phone' });
  if (email) rows.push({ label: 'Email', value: email, icon: 'email' });
  if (addressLines.length > 0 && addressLines[0] !== '') {
    rows.push({ label: 'Address', valueLines: addressLines, icon: 'address' });
  }

  // ---- Layout constants (scaled to image width so it looks right on any size) ----
  const scale = W / 900;                  // reference design is 900px wide
  const padTop = Math.round(40 * scale);
  const padBottom = Math.round(40 * scale);
  const firmSize = Math.round(46 * scale);
  const labelSize = Math.round(18 * scale);
  const valueSize = Math.round(25 * scale);
  const rowLineH = Math.round(30 * scale);  // height of one wrapped value line
  const iconR = Math.round(21 * scale);
  const marginX = Math.round(60 * scale);   // left/right margin inside footer
  const labelToValueGap = Math.round(4 * scale);
  const colGap = Math.round(40 * scale);    // gap between the two columns
  const rowVGap = Math.round(30 * scale);   // vertical gap between grid rows

  // ---- Two-column grid layout ----
  const colWidth = (W - marginX * 2 - colGap) / 2;
  // Assign each row a (col, gridRow). Address spans the full width on its own row.
  let gridRow = 0;
  let colCursor = 0;
  rows.forEach(row => {
    const numLines = row.valueLines ? row.valueLines.length : 1;
    row._numLines = numLines;
    row._cellH = Math.max(iconR * 2, labelSize + labelToValueGap + numLines * rowLineH);
    const fullWidth = row.label === 'Address';
    if (fullWidth && colCursor !== 0) { gridRow++; colCursor = 0; }
    row._col = fullWidth ? 0 : colCursor;
    row._full = fullWidth;
    row._gridRow = gridRow;
    if (fullWidth) { gridRow++; colCursor = 0; }
    else { colCursor++; if (colCursor === 2) { colCursor = 0; gridRow++; } }
  });
  const numGridRows = colCursor === 0 ? gridRow : gridRow + 1;

  // Height of each grid row = tallest cell in it.
  const gridRowH = [];
  rows.forEach(row => {
    gridRowH[row._gridRow] = Math.max(gridRowH[row._gridRow] || 0, row._cellH);
  });

  // ---- Measure the footer height ----
  let contentHeight = padTop;
  contentHeight += firmSize;                  // firm name
  contentHeight += Math.round(14 * scale);    // gap to gold underline
  contentHeight += Math.round(30 * scale);    // underline + gap to grid
  for (let i = 0; i < numGridRows; i++) {
    contentHeight += (gridRowH[i] || 0) + (i < numGridRows - 1 ? rowVGap : 0);
  }
  contentHeight += padBottom;

  const footerWidth = W;
  const footerHeight = Math.round(contentHeight);
  const footerX = 0;

  // Small breathing room we keep as blank buffer above the footer.
  const topBuffer = Math.round(20 * scale);

  // If the image already has enough blank space at the bottom, sit the footer
  // inside it (no gap). Otherwise, extend the canvas to make room.
  const usableBlank = Math.max(0, bottomWhitespace - topBuffer);
  let footerY;
  let extendBy;
  if (usableBlank >= footerHeight) {
    footerY = H - footerHeight;
    extendBy = 0;
  } else {
    footerY = H - usableBlank;
    extendBy = footerHeight - usableBlank;
  }

  // ---- Build the footer SVG (navy business-card panel) ----
  const rTop = Math.round(6 * scale);
  let elementsSvg = `
    <defs>
      <linearGradient id="navyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${NAVY}"/>
        <stop offset="100%" stop-color="${NAVY_DEEP}"/>
      </linearGradient>
    </defs>
    <!-- Navy panel background -->
    <rect x="0" y="0" width="${footerWidth}" height="${footerHeight}" fill="url(#navyGrad)" />
    <!-- Gold accent line across the very top -->
    <rect x="0" y="0" width="${footerWidth}" height="${rTop}" fill="${GOLD}" />
  `;

  let currentY = padTop;

  // 1. Firm Name (centered, white, bold)
  const firmBaseline = currentY + firmSize * 0.78;
  elementsSvg += `<text x="50%" y="${firmBaseline}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${firmSize}" font-weight="700" letter-spacing="0.5" fill="${WHITE}">${firmName}</text>\n`;
  currentY += firmSize + Math.round(14 * scale);

  // Gold underline accent, centered, short
  const ulW = Math.round(90 * scale);
  const ulH = Math.max(2, Math.round(4 * scale));
  elementsSvg += `<rect x="${(W - ulW) / 2}" y="${currentY}" width="${ulW}" height="${ulH}" rx="${ulH / 2}" fill="${GOLD}" />\n`;
  currentY += Math.round(30 * scale);

  // 2. Detail rows in a 2-column grid
  const rowTopByGrid = [];
  {
    let y = currentY;
    for (let i = 0; i < numGridRows; i++) {
      rowTopByGrid[i] = y;
      y += (gridRowH[i] || 0) + rowVGap;
    }
  }

  rows.forEach((row) => {
    const cellTop = rowTopByGrid[row._gridRow];
    const cellH = gridRowH[row._gridRow];
    const cellX = marginX + row._col * (colWidth + colGap);

    const iconCX = cellX + iconR;
    const centerY = cellTop + cellH / 2;
    const textX = iconCX + iconR + Math.round(20 * scale);

    // Icon badge (gold), vertically centered in the cell
    elementsSvg += getIcon(row.icon, iconCX, centerY, iconR);

    // Content block (label + value) vertically centered next to icon
    const numLines = row._numLines;
    const blockH = labelSize + labelToValueGap + numLines * rowLineH;
    const blockTop = centerY - blockH / 2;

    const labelBaseline = blockTop + labelSize;
    elementsSvg += `<text x="${textX}" y="${labelBaseline}" font-family="Arial, Helvetica, sans-serif" font-size="${labelSize}" font-weight="700" letter-spacing="1.5" fill="${GOLD_SOFT}">${row.label.toUpperCase()}</text>\n`;

    const lines = row.valueLines ? row.valueLines : [row.value];
    lines.forEach((line, i) => {
      const valueBaseline = labelBaseline + labelToValueGap + valueSize + i * rowLineH;
      elementsSvg += `<text x="${textX}" y="${valueBaseline}" font-family="Arial, Helvetica, sans-serif" font-size="${valueSize}" font-weight="600" fill="${VALUE}">${line}</text>\n`;
    });
  });

  const svg = `
  <svg width="${footerWidth}" height="${footerHeight}" xmlns="http://www.w3.org/2000/svg">
    ${elementsSvg}
  </svg>
  `;

  // Extend the canvas only as much as needed, then composite the footer strip.
  let pipeline = bgSharp;
  if (extendBy > 0) {
    pipeline = pipeline.extend({ top: 0, bottom: extendBy, left: 0, right: 0, background: '#FFFFFF' });
  }
  const compositedBuffer = await pipeline
    .composite([{ input: Buffer.from(svg), left: footerX, top: footerY }])
    .toBuffer();

  return await sharp(compositedBuffer)
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function drawNavyFooter(ctx, userData, W, H, theme = 'light', poster = null) {
  console.log('drawNavyFooter is deprecated, sharp compositing is now used.');
}

module.exports = { generatePoster, drawNavyFooter };
