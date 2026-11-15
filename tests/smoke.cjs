const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

async function checkViewport(browser, width) {
  const page = await browser.newPage({ viewport: { width, height: 850 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  try {
    await page.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => !document.querySelector('#notice').textContent.includes('Carregando'),
      null, { timeout: 30000 },
    );
    assert.match(await page.locator('#notice').innerText(), /^Bases internas carregadas/);

    const panels = await page.locator('.hero,.params-panel,.diagnostics-panel,.filters-panel,.products-panel,.logistics-panel')
      .evaluateAll(elements => elements.map(element => {
        const { x, width, right } = element.getBoundingClientRect();
        return { name: element.className, x, width, right };
      }));
    assert.equal(panels.length, 6);
    for (const panel of panels) {
      assert(panel.width >= Math.min(width - 50, 250), 'Panel too narrow: ' + JSON.stringify(panel));
      assert(panel.x >= 0 && panel.right <= width + 1, 'Panel outside viewport: ' + JSON.stringify(panel));
    }

    await page.locator('#erpFile').setInputFiles(path.join(__dirname, 'fixture-erp.xls'));
    await page.waitForFunction(
      () => /ERP importado|Falha na importação/.test(document.querySelector('#notice').textContent),
      null, { timeout: 30000 },
    );
    assert.match(await page.locator('#notice').innerText(), /^ERP importado: 3/);
    assert.equal((await page.locator('#kProducts').innerText()).trim(), '3');
    assert.deepEqual(await page.locator('#products th').allTextContents().then(cells => cells.slice(0, 3)),
      ['HOST', 'DESCRIÇÃO', 'PEDIDO (CX)']);

    for (const curve of ['A', '']) {
      const filter = page.locator('[data-abc-filter="' + curve + '"]');
      await filter.click();
      assert.equal(await filter.getAttribute('aria-pressed'), 'true');
    }

    const filterPanel = page.locator('.filters-panel');
    const filterToggle = filterPanel.locator('summary');
    await filterToggle.click();
    assert.equal(await filterPanel.evaluate(element => element.open), true);
    assert(await page.locator('#supplierFilter').isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      'Page overflowed horizontally after importing and opening filters');
    await filterToggle.click();
    assert.equal(await filterPanel.evaluate(element => element.open), false);

    await page.locator('#suggestBtn').click();
    assert(await page.locator('#suggestions').isVisible());
    assert.equal(await page.evaluate(() => document.activeElement.id), 'suggestionsTitle');
    await page.emulateMedia({ media: 'print' });
    assert(await page.locator('#printTitle').isVisible());
    assert(!(await page.locator('#products').isVisible()));
    assert.deepEqual(errors, [], 'JavaScript errors');
    console.log('PASS viewport', width, 'ERP import, ABC filters, panel geometry and CPD print layout');
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390, 768, 1366, 1920]) {
      await checkViewport(browser, width);
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
