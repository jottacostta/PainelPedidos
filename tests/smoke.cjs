const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

async function checkRuptureCD(page) {
  const base = {
    vendaUnidade: 30, estoqueLojaUnidade: 0, quantidadeCaixa: 1,
    pendenteCaixa: 0, transitoCaixa: 0, abc: 'A', areaVenda: 1,
    valorCaixa: 10, alertasCadastro: [],
  };
  const backup = { products: [
    { ...base, codigo: '01', descricao: 'CD ESGOTADO', estoqueCDCaixa: 0 },
    { ...base, codigo: '02', descricao: 'CD COM ESTOQUE', estoqueCDCaixa: 20 },
  ] };
  await page.locator('#backupFile').setInputFiles({
    name: 'backup-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('Backup restaurado'));
  assert(!(await page.locator('#suggestions').isVisible()));
  assert.equal(await page.locator('#suggestionRows tr').count(), 0);

  const zero = page.locator('#rows tr').filter({ hasText: 'CD ESGOTADO' });
  const available = page.locator('#rows tr').filter({ hasText: 'CD COM ESTOQUE' });
  assert.equal(await zero.locator('td').nth(5).innerText(), 'RUPTURA CD');
  assert.equal(await zero.locator('td.order-column').innerText(), '0');
  assert.equal(await zero.locator('[data-edit-code]').count(), 0);
  assert.equal(await available.locator('td').nth(5).innerText(), 'FALTA');

  await available.locator('[data-edit-code]').click();
  await page.locator('#manualEditValue').fill('5');
  await page.locator('#saveManualEdit').click();
  assert.match(await available.locator('td.order-column').innerText(), /^5/);
  await page.locator('#onlyRupture').check();
  assert.equal(await page.locator('#rows tr.rupture-row').count(), 2);
  await page.locator('#onlyRupture').uncheck();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString('utf8');
  const blockedRow = csv.split('\r\n').find(line => line.startsWith('"01";'));
  assert(blockedRow);
  assert.deepEqual(blockedRow.split(';').slice(9, 13), ['"0"', '"0"', '"0"', '"0"']);

  await page.locator('#suggestBtn').click();
  const suggestions = await page.locator('#suggestionRows').innerText();
  assert.match(suggestions, /CD COM ESTOQUE/);
  assert.doesNotMatch(suggestions, /CD ESGOTADO/);
}

async function checkERPBoxSize(page) {
  const codes = ['101', '102', '103', '104'];
  const base = {
    mix: codes.map(codigo => ({ codigo, quantidadeCaixa: 6, valorCaixa: 10, pallet: 10 })),
    abc: codes.map(codigo => ({ codigo, abc: 'A' })),
    part: codes.map(codigo => ({ codigo, areaVenda: 1 })),
  };
  await page.locator('#baseFile').setInputFiles({
    name: 'bases-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(base)),
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('Bases atualizadas'));

  const report = [
    'Ordem	Chave	Descricao	Qtde Venda	Estoque (Un)	Qtde Ped.Pend (CX)	Qtde Est.Transito (CX)	Est. Deposito (Cx)',
    '	Total	Total	1440	96	00 x 999,0 + 000	00 x 999,0 + 000	00 x 999,0 + 000',
    '',
    ['1', '101', 'PENDENTE E TRANSITO', '360', '24', '00 x 012,0 + 000', '00 x 012,0 + 000', '20 x 001,0 + 000'].join('\t'),
    ['2', '102', 'SOMENTE TRANSITO', '360', '24', '-*-', '02 x 024,0 + 003', '20 x 001,0 + 000'].join('\t'),
    ['3', '103', 'DIVERGENCIA', '360', '24', '00 x 012,0 + 000', '00 x 024,0 + 000', '20 x 001,0 + 000'].join('\t'),
    ['4', '104', 'SEM EMBALAGEM', '360', '24', '-*-', '-*-', '20 x 001,0 + 000'].join('\t'),
  ].join('\r\n');
  await page.locator('#erpFile').setInputFiles({
    name: 'embalagens-test.xls', mimeType: 'text/tab-separated-values', buffer: Buffer.from(report),
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('ERP importado: 4'));
  const rows = await page.locator('#rows tr').evaluateAll(items =>
    items.map(row => Array.from(row.cells, cell => cell.textContent)));
  assert.deepEqual(rows.map(row => row[7]), ['12', '24', '0', '0']);
  assert.deepEqual(rows.map(row => row[9]), ['6', '2', '—', '—']);
  assert.match(rows[2][11], /QUANTIDADE POR CAIXA DIVERGENTE NO ERP/);
  assert.match(rows[3][11], /QUANTIDADE POR CAIXA INVÁLIDA NO ERP/);
}

async function checkDynamicABC(page) {
  const products = [
    { id: '201', sales: 60, packageSize: 12, curve: 'C', order: '4' },
    { id: '202', sales: 1500, packageSize: 100, curve: 'B', order: '6' },
    { id: '203', sales: 960, packageSize: 12, curve: 'A', order: '20' },
    { id: '204', sales: 0, packageSize: 12, curve: 'C', order: '2' },
    { id: '205', sales: 5000, packageSize: 0, curve: '', order: '—' },
  ];
  const base = {
    mix: products.map(({ id }) => ({ codigo: id, valorCaixa: 10, pallet: 10 })),
    abc: products.map(({ id }) => ({ codigo: id, abc: 'A' })),
    part: products.map(({ id }) => ({ codigo: id, areaVenda: 1 })),
  };
  await page.locator('#baseFile').setInputFiles({
    name: 'bases-abc.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(base)),
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('Bases atualizadas'));

  async function importReport() {
    const header = 'Ordem\tChave\tDescricao\tQtde Venda\tEstoque (Un)\tQtde Ped.Pend (CX)\tQtde Est.Transito (CX)\tEst. Deposito (Cx)';
    const rows = products.map(({ id, sales, packageSize }, i) => {
      const movement = packageSize > 0 ? '00 x ' + packageSize + ',0 + 000' : '-*-';
      return [i + 1, id, 'PRODUTO ' + id, sales, 0, movement, movement, '100 x 001,0 + 000'].join('\t');
    });
    const report = [header, '\tTotal', '', ...rows].join('\r\n');
    await page.locator('#erpFile').setInputFiles({
      name: 'pareto.xls', mimeType: 'text/tab-separated-values', buffer: Buffer.from(report),
    });
    await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('ERP importado: 5'));
  }

  await importReport();
  const rows = await page.locator('#rows tr').evaluateAll(items =>
    items.map(row => [row.cells[0].textContent, row.cells[8].textContent, row.cells[9].textContent]));
  assert.deepEqual(rows, products.map(({ id, curve, order }) => [id, curve, order]));
  assert.equal(await page.locator('#abcCountA').innerText(), '1');
  assert.equal(await page.locator('#abcCountB').innerText(), '1');
  assert.equal(await page.locator('#abcCountC').innerText(), '2');
  await page.locator('[data-abc-filter="A"]').click();
  assert.equal(await page.locator('#rows td').first().innerText(), '203');

  products[0].sales = 960;
  products[2].sales = 60;
  await importReport();
  assert.equal(await page.locator('#rows td').first().innerText(), '201');
}

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

    const filterPanel = page.locator('.filters-panel');
    const filterToggle = filterPanel.locator('summary');
    assert.equal(await filterPanel.evaluate(element => element.open), true);
    assert(await page.locator('#supplierFilter').isVisible());
    assert.equal(await page.locator('#filters button:visible').count(), 15);
    assert(await page.locator('#onlyRupture').isVisible());

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
    assert.equal((await page.locator('#kProducts').innerText()).trim(), '0');
    await page.locator('#hideZero').uncheck();
    assert.equal((await page.locator('#kProducts').innerText()).trim(), '3');
    assert.deepEqual(await page.locator('#products th').allTextContents(), [
      'HOST', 'DESCRIÇÃO', 'VENDA', 'ESTOQUE UN', 'CD CX', 'SITUAÇÃO',
      'PASTA', 'CX/CAIXA', 'ABC', 'PEDIDO FINAL', 'FORNECEDOR', 'ALERTAS',
    ]);
    const firstProduct = page.locator('#rows tr').first();
    const cells = await firstProduct.locator('td').allTextContents();
    assert.equal(cells.length, 12);
    assert.equal(cells[0], '384667');
    assert.deepEqual(cells.slice(2, 6), ['10', '0', '0', 'RUPTURA CD']);
    assert.equal(cells[9], '0');
    assert.equal(await firstProduct.locator('td:nth-child(10).order-column').count(), 1);

    for (const curve of ['A', '']) {
      const filter = page.locator('[data-abc-filter="' + curve + '"]');
      await filter.click();
      assert.equal(await filter.getAttribute('aria-pressed'), 'true');
    }

    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      'Page overflowed horizontally after importing and opening filters');
    await filterToggle.click();
    assert.equal(await filterPanel.evaluate(element => element.open), false);
    assert(!(await page.locator('#supplierFilter').isVisible()));
    await filterToggle.click();
    assert(await page.locator('#supplierFilter').isVisible());

    await page.locator('#suggestBtn').click();
    assert(await page.locator('#suggestions').isVisible());
    assert.equal(await page.evaluate(() => document.activeElement.id), 'suggestionsTitle');
    await page.emulateMedia({ media: 'print' });
    assert(await page.locator('#printTitle').isVisible());
    assert(!(await page.locator('#products').isVisible()));
    await page.emulateMedia({ media: 'screen' });
    if (width === 1366) {
      await checkRuptureCD(page);
      await checkERPBoxSize(page);
      await checkDynamicABC(page);
    }
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
