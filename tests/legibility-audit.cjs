const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const issues = [];

  for (const mode of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: mode });
    const page = await ctx.newPage();
    await page.goto('https://quantum.clouddelnorte.org/', { waitUntil: 'networkidle', timeout: 20000 });
    if (mode === 'light') {
      await page.evaluate(() => { localStorage.setItem('awsaerospace-theme', 'light'); });
      await page.reload({ waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(2000);

    const elements = await page.$$eval('h1, h2, h3, p, span, a, button, div, header', (els) => {
      return els.filter(el => {
        const text = (el.textContent || '').trim();
        if (!text || text.length < 2 || el.children.length > 3) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).map(el => {
        const cs = getComputedStyle(el);
        const text = el.childNodes.length <= 3 ? (el.textContent || '').trim().substring(0, 60) : '';
        if (!text) return null;
        
        // Get actual colors
        const color = cs.color;
        const bg = cs.backgroundColor;
        const fontSize = parseFloat(cs.fontSize);
        const fontWeight = parseInt(cs.fontWeight);
        const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.4;
        const opacity = parseFloat(cs.opacity);
        const fontFamily = cs.fontFamily.substring(0, 40);
        
        // Parse RGB
        const parseRGB = (c) => {
          const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          return m ? [+m[1], +m[2], +m[3]] : null;
        };
        
        // Relative luminance
        const luminance = (rgb) => {
          const [r, g, b] = rgb.map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        
        const fgRGB = parseRGB(color);
        const bgRGB = parseRGB(bg);
        let contrast = null;
        if (fgRGB && bgRGB && bg !== 'rgba(0, 0, 0, 0)') {
          const l1 = luminance(fgRGB);
          const l2 = luminance(bgRGB);
          contrast = ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
        }
        
        return { text, color, bg, fontSize, fontWeight, lineHeight: (lineHeight / fontSize).toFixed(2), opacity, fontFamily, contrast, tag: el.tagName };
      }).filter(Boolean).slice(0, 50);
    });

    console.log(`\n=== ${mode.toUpperCase()} MODE ===`);
    for (const el of elements) {
      const probs = [];
      if (el.contrast && parseFloat(el.contrast) < 4.5 && el.fontSize < 18) probs.push(`LOW CONTRAST ${el.contrast}:1`);
      if (el.contrast && parseFloat(el.contrast) < 3.0 && el.fontSize >= 18) probs.push(`LOW CONTRAST (large) ${el.contrast}:1`);
      if (el.fontSize < 14) probs.push(`TOO SMALL ${el.fontSize}px`);
      if (parseFloat(el.lineHeight) < 1.3) probs.push(`TIGHT LINE-HEIGHT ${el.lineHeight}`);
      if (el.fontWeight < 400 && el.fontSize < 18) probs.push(`THIN ${el.fontWeight}w`);
      if (el.opacity < 0.9) probs.push(`LOW OPACITY ${el.opacity}`);
      
      if (probs.length > 0) {
        issues.push({ mode, ...el, problems: probs });
        console.log(`  ✗ "${el.text}" | ${el.fontSize}px ${el.fontWeight}w | contrast:${el.contrast || '?'} | ${probs.join(', ')}`);
      }
    }
    await ctx.close();
  }

  console.log(`\n=== TOTAL LEGIBILITY ISSUES: ${issues.length} ===`);
  
  // Group by unique text to see which elements fail in both modes
  const byText = {};
  for (const i of issues) {
    const key = i.text.substring(0, 30);
    if (!byText[key]) byText[key] = [];
    byText[key].push(i);
  }
  
  console.log('\n=== WORST OFFENDERS (fail in both modes) ===');
  for (const [text, items] of Object.entries(byText)) {
    if (items.length >= 2) {
      console.log(`  "${text}" — fails in BOTH modes`);
      for (const i of items) console.log(`    ${i.mode}: ${i.problems.join(', ')}`);
    }
  }

  await browser.close();
  process.exit(issues.length > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
