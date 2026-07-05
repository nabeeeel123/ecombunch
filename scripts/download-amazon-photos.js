let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const fs = require('fs');
const path = require('path');

const DOWNLOAD_DIR = path.join(__dirname, '..', 'download');
const SEARCHES = ['wireless earbuds', 'coffee maker', 'yoga mat'];
const PER_SEARCH = 4;

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

(async () => {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  const manifest = [];

  for (const query of SEARCHES) {
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    console.log(`\n== Searching: ${query}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);

      // Detect captcha/robot check
      const title = await page.title();
      if (/robot|captcha/i.test(title) || (await page.locator('form[action*="validateCaptcha"]').count()) > 0) {
        console.log('  !! Captcha page detected, skipping this search');
        await page.screenshot({ path: path.join(DOWNLOAD_DIR, `captcha-${slug(query)}.png`) });
        continue;
      }

      // Collect product info from search results
      const items = await page.$$eval(
        'div[data-component-type="s-search-result"]',
        (cards, max) =>
          cards
            .map((c) => {
              const img = c.querySelector('img.s-image');
              const titleEl = c.querySelector('h2 span');
              if (!img || !img.src) return null;
              // Get highest-res variant from srcset if present
              let src = img.src;
              if (img.srcset) {
                const parts = img.srcset.split(',').map((p) => p.trim().split(' ')[0]);
                if (parts.length) src = parts[parts.length - 1];
              }
              return { src, title: titleEl ? titleEl.textContent.trim() : 'product' };
            })
            .filter(Boolean)
            .slice(0, max),
        PER_SEARCH
      );

      console.log(`  Found ${items.length} products`);

      for (let i = 0; i < items.length; i++) {
        const { src, title: ptitle } = items[i];
        // Request full-size image by stripping Amazon size modifiers (e.g. ._AC_UY218_.)
        const fullSrc = src.replace(/\._[^.]*_\./, '.');
        const ext = (fullSrc.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) || [null, 'jpg'])[1];
        const fname = `${slug(query)}-${i + 1}-${slug(ptitle).slice(0, 50)}.${ext}`;
        const fpath = path.join(DOWNLOAD_DIR, fname);
        try {
          const resp = await context.request.get(fullSrc);
          if (!resp.ok()) throw new Error(`HTTP ${resp.status()}`);
          fs.writeFileSync(fpath, await resp.body());
          const kb = (fs.statSync(fpath).size / 1024).toFixed(0);
          console.log(`  saved ${fname} (${kb} KB)`);
          manifest.push({ query, file: fname, title: ptitle, url: fullSrc });
        } catch (e) {
          console.log(`  failed ${fname}: ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`  !! Error on search "${query}": ${e.message}`);
    }
  }

  fs.writeFileSync(
    path.join(DOWNLOAD_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log(`\nDone. ${manifest.length} photos saved to ${DOWNLOAD_DIR}`);
  await browser.close();
})();
