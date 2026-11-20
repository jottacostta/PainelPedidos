const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

async function checkInvalidERP(page) {
  const rows = page.locator('#rows tr');
  const previousRows = await rows.allTextContents();
  await page.locator('#erpFile').setInputFiles({
    name: 'cabecalho-invalido.xls',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('CABECALHO INCORRETO\tCHAVE\nTOTAL\n\n1\t900'),
  });
  await page.waitForFunction(() => document.querySelector('#notice').classList.contains('error'));
  assert.match(await page.locator('#notice').innerText(), /Cabeçalho ERP ESTATÍSTICA não reconhecido/);
  assert.deepEqual(await rows.allTextContents(), previousRows);
  assert.equal(await page.locator('#erpFile').inputValue(), '');
}

async function checkManualCalculator(page) {
  await page.locator('#baseFile').setInputFiles({
    name: 'bases-calc.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ mix: [{ codigo: '801', pasta: 'LIMPEZA', fornecedor: 'ALFA', valorCaixa: 10, pallet: 10 }] })),
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('Bases atualizadas'));
  const report = [
    'Ordem\tChave\tDescricao\tQtde Venda\tEstoque (Un)\tQtde Ped.Pend (CX)\tQtde Est.Transito (CX)\tEst. Deposito (Cx)',
    '\tTotal\tTotal\t0\t0\t00 x 001,0 + 000\t00 x 001,0 + 000\t00 x 001,0 + 000', '',
    ['1', '801', 'CALCULADORA', '360', '24', '00 x 012,0 + 000', '00 x 012,0 + 000', '30 x 001,0 + 000'].join('\t'),
  ].join('\r\n');
  await page.locator('#erpFile').setInputFiles({ name: 'calc.xls', mimeType: 'text/tab-separated-values', buffer: Buffer.from(report, 'latin1') });
  await page.waitForFunction(() => /ERP importado: 1/.test(document.querySelector('#notice').textContent));
  const edit = page.locator('#rows [data-edit-code="801"]');
  await edit.click();
  await page.waitForSelector('#manualEditModal.open');
  assert.match(await page.locator('#calcChips').innerText(), /Sugestão/);
  assert.match(await page.locator('#calcChips').innerText(), /÷ 12 un\/cx/);
  assert.equal(await page.locator('#calcExpr').innerText(), '0');
  assert.equal(await page.locator('#calcUse').isDisabled(), true);
  const press = async keys => { for (const k of keys) await page.locator(`#manualCalc [data-calc="${k}"]`).click(); };
  // (3 + 1) × 2 ÷ 3 = 2,67 → usa 3 caixas, arredondando para cima.
  await press(['(', '3', '+', '1', ')', '×', '2', '÷', '3']);
  assert.equal(await page.locator('#calcExpr').innerText(), '(3+1)×2÷3');
  assert.equal(await page.locator('#calcResult').innerText(), '= 2,67');
  assert.match(await page.locator('#calcUse').innerText(), /^Usar 3 cx no pedido \(arredondado para cima\)$/);
  await page.locator('#calcUse').click();
  assert.equal(await page.locator('#manualEditValue').inputValue(), '3');
  // Erro de conta não quebra a janela e desativa o botão.
  await press(['C', '7', '÷', '0']);
  assert.equal(await page.locator('#calcResult').innerText(), 'divisão por zero');
  assert.equal(await page.locator('#calcUse').isDisabled(), true);
  await press(['⌫', '2', '=']);
  assert.equal(await page.locator('#calcExpr').innerText(), '3,5');
  // Valor do produto entra na conta pelo atalho.
  await press(['C']);
  await page.locator('#calcChips [data-calc-insert]').first().click();
  assert.notEqual(await page.locator('#calcExpr').innerText(), '0');
  // Aplicar grava o valor do campo, como antes.
  await page.locator('#manualEditValue').fill('3');
  await page.locator('#saveManualEdit').click();
  assert(!(await page.locator('#manualEditModal').evaluate(el => el.classList.contains('open'))));
  assert.equal((await edit.innerText()).split('\n')[0].trim(), '3');
}

async function checkBackupAndLogistics(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Bases internas carregadas'));
  const base = {
    vendaUnidade: 30, estoqueLojaUnidade: 0, estoqueCDCaixa: 20,
    quantidadeCaixa: 1, pendenteCaixa: 0, transitoCaixa: 0, abc: 'A',
    areaVenda: 99, valorCaixa: 10, alertasCadastro: ['SEM PART GON'],
  };
  const backup = {
    products: [
      { ...base, codigo: '1730883', descricao: 'ZETA', fornecedor: 'ALFA', estoqueCDCaixa: 243, vendaUnidade: 0, quantidadeCaixa: 12, abc: 'C', pendenteCaixa: 1 },
      { ...base, codigo: '602', descricao: 'BETA', fornecedor: 'ALFA', transitoCaixa: 3 },
      { ...base, codigo: '603', descricao: 'GAMA', fornecedor: 'OUTRO', pendenteCaixa: 4, transitoCaixa: 1 },
      { ...base, codigo: '604', descricao: 'DELTA', fornecedor: 'ALFA', vendaUnidade: 24 },
    ],
    config: { diasA: 8, diasB: 10, diasC: 14, periodoVenda: 30 },
    matrix: ['1730883'],
  };
  const backupInput = page.locator('#backupFile');
  await backupInput.setInputFiles({
    name: 'logistica-teste.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Backup restaurado: 4'));

  assert.equal(await page.locator('#hideZero').isChecked(), true);
  assert.equal(await page.locator('#logisticsRows tr').filter({ hasText: '1730883' }).count(), 1);
  await page.locator('#hideZero').uncheck();
  const pendente = page.locator('#rows tr').filter({ hasText: '1730883' });
  assert.equal(await pendente.locator('.order-column').innerText(), '0');
  assert.match(await pendente.innerText(), /RUPTURA TEMPORÁRIA/);
  const order = page.locator('#rows tr').filter({ hasText: 'DELTA' });
  assert.equal(await order.locator('.order-column').innerText(), '7');
  assert.deepEqual((await order.locator('td').allTextContents()).slice(-3), ['0','9','9']);
  assert.doesNotMatch(await order.locator('.product-alerts').innerText(), /SEM PART GON/);
  await page.locator('#suggestBtn').click();
  assert.equal(await page.locator('#suggestionRows tr').filter({ hasText: '1730883' }).count(), 0);
  const suggested = page.locator('#suggestionRows tr').filter({ hasText: 'DELTA' });
  assert.equal(await suggested.locator('td').nth(6).innerText(), '7');
  await order.locator('[data-edit-code]').click();
  await page.locator('#manualEditValue').fill('3');
  await page.locator('#saveManualEdit').click();
  assert.deepEqual((await order.locator('td').allTextContents()).slice(-3), ['0','4','4']);
  await page.locator('#search').fill('DELTA');
  await page.evaluate(() => {
    window.print = () => {
      window.printedOrders = Array.from(document.querySelectorAll('#suggestionRows tr'),
        row => [row.cells[1].textContent, row.cells[6].textContent]);
    };
  });
  await page.locator('#printSuggestions').click();
  assert.deepEqual(await page.evaluate(() => window.printedOrders), [['604', '3']]);
  await page.locator('#search').fill('');

  await page.locator('#hideZero').check();
  await page.locator('#supplierFilter').selectOption('ALFA');
  assert.equal(await page.locator('#logisticsRows tr').count(), 2);
  assert.equal(await page.locator('#pendingSummary').innerText(), 'Pedidos pendentes: 1 itens / 1 caixas');
  assert.equal(await page.locator('#transitSummary').innerText(), 'Em trânsito: 1 itens / 3 caixas');
  await page.evaluate(() => { window.print = () => { window.printRequested = true; }; });
  await page.locator('#printLogistics').click();
  assert.equal(await page.evaluate(() => window.printRequested), true);
  await page.emulateMedia({ media: 'print' });
  assert(await page.locator('#logisticsPrint').isVisible());
  const printRows = page.locator('#logisticsPrintRows tr');
  assert.deepEqual(await printRows.locator('td:first-child').allTextContents(), ['602', '1730883']);
  assert.equal(await page.locator('#logisticsPrintTotals').innerText(),
    'Pendentes: 1 itens / 1 caixas | Em trânsito: 1 itens / 3 caixas');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert(!(await page.locator('#logisticsPrint').isVisible()));
  await page.emulateMedia({ media: 'screen' });

  for (const [modo, host, coluna] of [['pendente','1730883','PENDENTE (CX)'], ['transito','602','EM TRÂNSITO (CX)']]) {
    await page.locator('#logisticsPrintMode').selectOption(modo);
    await page.locator('#printLogistics').click();
    assert.deepEqual(await printRows.locator('td:first-child').allTextContents(), [host]);
    assert.equal(await page.locator('#logisticsPrintHead th').last().textContent(), coluna);
    assert.equal(await printRows.locator('td').count(), 5);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  }
  await page.getByText('Bases, matriz e backup', { exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saveBtn').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'JBS_BACKUP_LOCAL.json');
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const saved = Buffer.concat(chunks);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Bases internas carregadas'));
  assert.equal(await page.locator('#kProducts').innerText(), '0');
  await backupInput.setInputFiles({
    name: download.suggestedFilename(), mimeType: 'application/json', buffer: saved,
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Backup restaurado: 4'));
  assert.equal(await page.locator('#daysA').inputValue(), '8');
  assert.equal(await order.locator('.order-column').innerText(), '7');
  await page.locator('#hideZero').uncheck();
  await page.locator('[data-filter="MATRIZ"]').click();
  assert.deepEqual(await page.locator('#rows tr td:first-child').allTextContents(), ['1730883']);
}

async function checkRuptureCD(page) {
  const base = {
    vendaUnidade: 30, estoqueLojaUnidade: 0, quantidadeCaixa: 1,
    pendenteCaixa: 0, transitoCaixa: 0, abc: 'A', areaVenda: 1,
    valorCaixa: 10, alertasCadastro: [],
  };
  const backup = { products: [
    { ...base, codigo: '01', descricao: 'CD ESGOTADO', estoqueCDCaixa: 0 },
    { ...base, codigo: '02', descricao: 'CD COM ESTOQUE', estoqueCDCaixa: 20 },
    {
      ...base, codigo: '03', descricao: 'PEDIDO NEGATIVO COM TRANSITO', estoqueCDCaixa: 20,
      vendaUnidade: 0, estoqueLojaUnidade: 1, quantidadeCaixa: 24, transitoCaixa: 8,
      alertasCadastro: ['ALERTA CADASTRAL EXISTENTE'],
    },
    {
      ...base, codigo: '04', descricao: 'PEDIDO NEGATIVO COM ESTOQUE', estoqueCDCaixa: 20,
      vendaUnidade: 24, estoqueLojaUnidade: 48, quantidadeCaixa: 24,
    },
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

  await page.locator('#hideNegative').uncheck();
  const transit = page.locator('#rows tr').filter({ hasText: 'PEDIDO NEGATIVO COM TRANSITO' });
  const stock = page.locator('#rows tr').filter({ hasText: 'PEDIDO NEGATIVO COM ESTOQUE' });
  assert.equal(await transit.locator('td.order-column').innerText(), '-9');
  const transitAlert = await transit.locator('.product-alerts').innerText();
  assert.match(transitAlert, /estoque loja 0,04, pendentes 0, trânsito 8/);
  assert.match(transitAlert, /necessidade com área de venda 0/);
  assert.match(transitAlert, /Sugestão 0/);
  assert.match(transitAlert, /Sem estimativa de dias para o excedente/);
  assert.match(transitAlert, /ALERTA CADASTRAL EXISTENTE/);
  const stockAlert = await stock.locator('.product-alerts').innerText();
  assert.match(stockAlert, /estoque loja 2, pendentes 0, trânsito 0/);
  assert.match(stockAlert, /Excedente de 2 cx equivale a 60 dias de venda/);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString('utf8');
  assert.match(csv, /Excedente de 2 cx equivale a 60 dias de venda/);
  const blockedRow = csv.split('\r\n').find(line => line.startsWith('"01";'));
  assert(blockedRow);
  assert.deepEqual(blockedRow.split(';').slice(9, 13), ['"0"', '"0"', '"0"', '"0"']);
  assert.match(csv, /PEDIDO NEGATIVO \(cx\): estoque loja 0,04, pendentes 0, trânsito 8/);

  await page.locator('#suggestBtn').click();
  const suggestions = await page.locator('#suggestionRows').innerText();
  assert.match(suggestions, /CD COM ESTOQUE/);
  assert.doesNotMatch(suggestions, /CD ESGOTADO|PEDIDO NEGATIVO/);
  await transit.locator('[data-edit-code]').click();
  await page.locator('#manualEditValue').fill('0');
  await page.locator('#saveManualEdit').click();
  assert.equal(await transit.locator('.product-alerts').innerText(), 'ALERTA CADASTRAL EXISTENTE');
  await page.locator('#hideNegative').check();
}

async function checkERPBoxSize(page) {
  const codes = ['101', '102', '103', '104'];
  const base = {
    mix: codes.map(codigo => ({ codigo, quantidadeCaixa: 6, valorCaixa: 10, pallet: 10 })),
    abc: codes.map(codigo => ({ codigo, abc: 'A' })),
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
  assert.deepEqual(rows.map(row => row[9]), ['5', '1', '—', '—']);
  assert.match(rows[2][12], /QUANTIDADE POR CAIXA DIVERGENTE NO ERP/);
  assert.match(rows[3][12], /QUANTIDADE POR CAIXA INVÁLIDA NO ERP/);
}

async function checkDynamicABC(page) {
  const products = [
    { id: '201', sales: 60, packageSize: 12, curve: 'C', order: '3' },
    { id: '202', sales: 1500, packageSize: 100, curve: 'B', order: '5' },
    { id: '203', sales: 960, packageSize: 12, curve: 'A', order: '19' },
    { id: '204', sales: 0, packageSize: 12, curve: 'C', order: '1' },
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

async function checkInferredFolders(page) {
  await page.locator('[data-abc-filter=""]').click();
  const cadastro = (codigo, descricao, pasta) => ({ codigo, descricao, pasta, valorCaixa: 10, pallet: 10 });
  const mix = [
    cadastro('301', 'Amaciante Comfort Floral', 'LIMPEZA'),
    cadastro('302', 'Amaciante Comfort Intenso', 'LIMPEZA'),
    cadastro('303', 'Amaciante Comfort Azul', 'LIMPEZA'),
    cadastro('304', 'Desinfetante Marca A', 'LIMPEZA'),
    cadastro('305', 'Desinfetante Marca B', 'LIMPEZA'),
    cadastro('306', 'Desinfetante Marca C', 'PERFUMARIA'),
    cadastro('135450', 'AGUARDENTE CANINHA DA ROCA 500ml', 'BEBIDAS'),
    cadastro('312', 'Amaciante Comfort Sem Pasta', ' '),
    cadastro('314', 'Amaciante Comfort Pasta Oficial', 'LIMPEZA'),
  ];
  await page.locator('#baseFile').setInputFiles({
    name: 'bases-pastas.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ mix })),
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('Bases atualizadas'));

  const header = 'Ordem\tChave\tDescricao\tQtde Venda\tEstoque (Un)\tQtde Ped.Pend (CX)\tQtde Est.Transito (CX)\tEst. Deposito (Cx)';
  const products = [
    ['311', 'AMACIANTE COMFORT SEM MIX'],
    ['312', 'AMACIANTE COMFORT SEM PASTA'],
    ['313', 'DESINFETANTE MARCA CONFLITO'],
    ['314', 'AMACIANTE COMFORT PASTA OFICIAL'],
    ['2151717', 'AGUARDENTE CANINHA DA ROCA 275ml'],
  ];
  const report = [header, '\tTotal', '', ...products.map(([host, description], i) =>
    [i + 1, host, description, 120, 0, '00 x 012,0 + 000', '00 x 012,0 + 000', '20 x 012,0 + 000'].join('\t')
  )].join('\r\n');
  await page.locator('#erpFile').setInputFiles({
    name: 'pastas.xls', mimeType: 'text/tab-separated-values', buffer: Buffer.from(report),
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('ERP importado: 5'));

  const rows = await page.locator('#rows tr').evaluateAll(items =>
    items.map(row => [row.cells[6].querySelector("select")?.value ?? row.cells[6].textContent, row.cells[12].textContent]));
  assert.deepEqual(rows.map(row => row[0]), ['LIMPEZA', 'LIMPEZA', '', 'LIMPEZA', 'BEBIDAS']);
  assert.match(rows[0][1], /SEM CADASTRO MIX.*PASTA CLASSIFICADA POR SEMELHANÇA/);
  assert.match(rows[1][1], /PASTA CLASSIFICADA POR SEMELHANÇA/);
  assert.doesNotMatch(rows[2][1], /PASTA CLASSIFICADA POR SEMELHANÇA/);
  assert.doesNotMatch(rows[3][1], /PASTA CLASSIFICADA POR SEMELHANÇA/);
  assert.match(rows[4][1], /PASTA CLASSIFICADA POR SEMELHANÇA/);

  await page.locator('[data-filter="LIMPEZA"]').click();
  assert.deepEqual(await page.locator('#rows tr td:first-child').allTextContents(), ['311', '312', '314']);
  await page.locator('#suggestBtn').click();
  const suggestions = await page.locator('#suggestionRows').innerText();
  assert.match(suggestions, /AMACIANTE COMFORT SEM PASTA/);
  assert.doesNotMatch(suggestions, /AMACIANTE COMFORT SEM MIX/);
}

async function checkScopedABC(page) {
  await page.locator('[data-filter=""]').click();
  await page.locator('[data-abc-filter=""]').click();
  const base = {
    estoqueLojaUnidade: 0, quantidadeCaixa: 1, estoqueCDCaixa: 200,
    pendenteCaixa: 0, transitoCaixa: 0, areaVenda: 1, valorCaixa: 10, alertasCadastro: [],
  };
  const backup = { products: [
    { ...base, codigo: '501', descricao: 'VENDAS LIMPEZA', pasta: 'LIMPEZA', fornecedor: 'MIX LIMPEZA', vendaUnidade: 1000, abc: 'A' },
    { ...base, codigo: '502', descricao: 'PERFUMARIA A', pasta: 'PERFUMARIA', fornecedor: 'FORNECEDOR A', vendaUnidade: 80, abc: 'B' },
    { ...base, codigo: '503', descricao: 'PERFUMARIA B', pasta: 'PERFUMARIA', fornecedor: 'FORNECEDOR B', vendaUnidade: 15, abc: 'C' },
    { ...base, codigo: '504', descricao: 'PERFUMARIA C', pasta: 'PERFUMARIA', fornecedor: 'FORNECEDOR B', vendaUnidade: 5, abc: 'C' },
  ] };
  await page.locator('#backupFile').setInputFiles({
    name: 'curva-grupo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('Backup restaurado'));

  const hosts = () => page.locator('#rows tr td:first-child').allTextContents();
  await page.locator('[data-abc-filter="A"]').click();
  assert.deepEqual(await hosts(), ['501']);
  await page.locator('[data-filter="PERFUMARIA"]').click();
  assert.deepEqual(await hosts(), ['502']);
  assert.equal(await page.locator('#abcCountAll').innerText(), '3');
  assert.equal(await page.locator('#abcCountA').innerText(), '1');
  assert.equal(await page.locator('#rows td.order-column').innerText(), '19');
  await page.locator('#rows [data-edit-code="502"]').click();
  assert.equal(await page.locator('#manualEditValue').inputValue(), '19');
  await page.locator('#cancelManualEdit').click();

  await page.locator('[data-abc-filter="B"]').click();
  assert.deepEqual(await hosts(), ['503']);
  await page.locator('[data-abc-filter="A"]').click();
  await page.locator('#suggestBtn').click();
  assert.match(await page.locator('#suggestionRows').innerText(), /PERFUMARIA A/);

  await page.locator('#supplierFilter').selectOption('FORNECEDOR B');
  assert.deepEqual(await hosts(), ['503', '504']);
  assert.equal(await page.locator('#abcCountAll').innerText(), '2');
  assert.equal(await page.locator('#abcCountA').innerText(), '2');
  assert(!(await page.locator('#suggestions').isVisible()));
  await page.locator('#supplierFilter').selectOption('');
  await page.locator('[data-filter=""]').click();
  assert.deepEqual(await hosts(), ['501']);
}

async function checkERPFields(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Bases internas carregadas'));
  const codes = ['701', '702', '703', '704', '705'];
  await page.locator('#baseFile').setInputFiles({
    name: 'bases-campos.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ mix: codes.map(codigo => ({ codigo, pasta: 'LIMPEZA', fornecedor: 'ALFA', valorCaixa: 100, pallet: 10 })) })),
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('Bases atualizadas'));
  // Colunas novas fora da ordem antiga: a leitura é pelo nome do cabeçalho.
  const report = [
    // Cabeçalho exatamente como o ERP ESTATÍSTICA exporta (arquivo real de 18/11/2026), com colunas vazias no fim.
    'Ordem\tChave\tDescrição\tValor Venda\tQtde Venda\tCusto\tEstoque (Un)\tEst. Custo C/ICM\tQtde Ped.Pend (CX)\tQtde Est.Transito (CX)\tEst. Deposito (Cx)\t \t',
    ' \tTotal\tTotal\t0\t0\t0\t0\t0\t00 x 001,0 + 000\t00 x 001,0 + 000\t00 x 001,0 + 000\t',
    '',
    // 701: muitas caixas, pouco faturamento. 702: poucas caixas, muito faturamento.
    ['1', '701', 'CAIXAS', '300,00', '3000', '240,00', '0', '50,50', '02 x 010,0 + 000', '00 x 010,0 + 000', '20 x 001,0 + 000'].join('\t'),
    ['2', '702', 'FATURAMENTO', '9.000,00', '300', '6.000,00', '0', '100,00', '00 x 010,0 + 000', '00 x 010,0 + 000', '20 x 001,0 + 000'].join('\t'),
    ['3', '703', 'MARGEM NEGATIVA', '100,00', '300', '150,00', '0', '0', '00 x 010,0 + 000', '00 x 010,0 + 000', '20 x 001,0 + 000'].join('\t'),
    ['4', '704', 'SEM CD', '50,00', '300', '40,00', '0', '-0,50', '00 x 010,0 + 000', '00 x 010,0 + 000', '-*-'].join('\t'),
    ['5', '705', 'CD ZERADO', '10,00', '300', '8,00', '0', '0', '00 x 010,0 + 000', '00 x 010,0 + 000', '00 x 001,0 + 000'].join('\t'),
  ].join('\r\n');
  await page.locator('#erpFile').setInputFiles({ name: 'campos.xls', mimeType: 'text/tab-separated-values', buffer: Buffer.from(report, 'latin1') });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('ERP importado: 5'));
  await page.locator('#hideZero').uncheck();
  const row = async host => page.locator('#rows tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp('^' + host + '$') }) });
  const cells = async host => (await row(host)).locator('td').allTextContents();
  const field = id => page.locator(`#erpFields input[data-campo="${id}"]`);

  // Todos marcados: ABC por faturamento, valor pelo custo, margem e estoque a custo.
  for (const id of ['f001', 'f003', 'f052', 'f153', 'f154', 'f164']) assert.equal(await field(id).isChecked(), true);
  assert.equal(await field('f164x').isChecked(), false);
  for (const id of ['f002', 'f049']) { assert.equal(await field(id).isChecked(), true); assert.equal(await field(id).isDisabled(), true); }
  assert.equal((await cells('702'))[8], 'A');
  assert.equal((await cells('701'))[8], 'C');
  assert.equal((await cells('702'))[11], '33,3%');
  assert.equal((await cells('703'))[11], '-50,0%');
  assert.match((await cells('703'))[12], /MARGEM NEGATIVA/);
  assert.match(await page.locator('#kStockCost').innerText(), /^R\$\s150,00$/);
  assert.match(await page.locator('#abcRuleText').innerText(), /faturamento/);
  // 701: média 10 cx/dia, curva C (14 dias) = 140; pendente 2 → pedido final 0.
  assert.equal((await cells('701'))[9], '0');
  // CD zerado (705) e -*- no CD (704): por padrão, os dois são RUPTURA CD com pedido 0.
  assert.equal((await cells('705'))[5], 'RUPTURA CD');
  assert.equal((await cells('705'))[9], '0');
  assert.equal((await cells('705'))[4], '0');
  assert.equal((await cells('704'))[5], 'RUPTURA CD');
  assert.equal((await cells('704'))[9], '0');
  // A coluna CD CX mostra -*- para diferenciar do CD zerado.
  assert.equal((await cells('704'))[4], '-*-');
  // Caixa -*- marcada: 704 sai da ruptura e mantém pedido zero; 705 continua em ruptura.
  await field('f164x').check();
  assert.notEqual((await cells('704'))[5], 'RUPTURA CD');
  assert.equal((await cells('704'))[9], '0');
  assert.equal(await (await row('704')).locator('[data-edit-code]').count(), 0);
  assert.equal((await cells('705'))[9], '0');
  await field('f164x').uncheck();
  assert.equal((await cells('704'))[9], '0');
  // O indicador considera o custo dos pedidos positivos.
  const valorComCusto = await page.locator('#kValue').innerText();

  // 001 desmarcado: ABC volta a caixas vendidas e a margem some.
  await field('f001').uncheck();
  assert.equal((await cells('701'))[8], 'A');
  assert.equal((await cells('702'))[11], '—');
  assert.match(await page.locator('#abcRuleText').innerText(), /caixas vendidas/);
  await field('f001').check();
  assert.equal((await cells('702'))[8], 'A');

  // 003 desmarcado: valor do pedido volta ao valor da caixa do MIX.
  await field('f003').uncheck();
  assert.notEqual(await page.locator('#kValue').innerText(), valorComCusto);
  assert.equal((await cells('702'))[11], '—');
  await field('f003').check();
  assert.equal(await page.locator('#kValue').innerText(), valorComCusto);

  // 153 desmarcado: pendência zerada no cálculo e no acompanhamento.
  await field('f153').uncheck();
  assert.equal((await cells('701'))[9], '140');
  assert.equal(await page.locator('#pendingSummary').innerText(), 'Pedidos pendentes: 0 itens / 0 caixas');
  await field('f153').check();
  assert.equal((await cells('701'))[9], '0');

  // 164 desmarcado: regra RUPTURA CD desligada e a caixa -*- fica bloqueada.
  await field('f164').uncheck();
  assert.equal((await cells('704'))[9], '0');
  assert.notEqual((await cells('705'))[5], 'RUPTURA CD');
  assert.equal((await cells('705'))[9], '14');
  assert.equal(await field('f164x').isDisabled(), true);
  await field('f164').check();
  assert.equal((await cells('705'))[9], '0');
  assert.equal(await field('f164x').isDisabled(), false);

  // 052 desmarcado: indicador sem valor.
  await field('f052').uncheck();
  assert.equal(await page.locator('#kStockCost').innerText(), '—');
  await field('f052').check();

  // ERP antigo (sem 001, 003 e 052): campos aparecem como não encontrados e o cálculo segue por caixas.
  await page.locator('#erpFile').setInputFiles(path.join(__dirname, 'fixture-erp.xls'));
  await page.waitForFunction(() => /ERP importado: 3/.test(document.querySelector('#notice').textContent));
  assert.match(await page.locator('label.erp-field', { has: page.locator('input[data-campo="f001"]') }).innerText(), /não encontrado no último ERP/);
  assert.equal(await page.locator('#kStockCost').innerText(), '—');
}

async function checkOfflineDownload(page) {
  const mark = page.locator('#offlineDownload');
  assert.equal(await mark.innerText(), 'G');
  assert.equal(await mark.getAttribute('download'), 'PainelPedidos-offline.html');
  const [download] = await Promise.all([page.waitForEvent('download'), mark.click()]);
  assert.equal(download.suggestedFilename(), 'PainelPedidos-offline.html');
  const file = await download.path();
  const html = require('fs').readFileSync(file, 'utf8');
  assert(html.length > 1_000_000, 'cópia offline deve trazer as bases embutidas');
  assert.match(html, /id="embedded-base"/);
  assert.match(html, /<title>Painel de pedidos/);
  await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Versão offline baixada'));
}

async function checkFaltaEPasta(page) {
  const products = [[-143, 2, 1, 0], [-187, 34, 0, 1], [0, 97, 0, 0], [1, 15, 1, 1], [0, 2, 1, 1]].map(([estoqueLojaUnidade, estoqueCDCaixa, pendenteCaixa, transitoCaixa], i) => ({
    codigo: String(900100 + i), descricao: 'PRODUTO ' + i, quantidadeCaixa: 1,
    estoqueLojaUnidade, estoqueCDCaixa, pendenteCaixa, transitoCaixa,
    pasta: i ? 'LIMPEZA' : '', abc: 'C', alertasCadastro: [],
  }));
  const backup = { name: 'rupturas.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ products })) };
  async function carregar() {
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Bases internas carregadas'));
    await page.locator('#hideNegative').uncheck();
    await page.locator('#hideZero').uncheck();
    await page.locator('#backupFile').setInputFiles(backup);
    await page.locator('#rows tr').getByText('900100', { exact: true }).waitFor();
  }
  await carregar();
  assert.equal(await page.locator('#kFalta').innerText(), '4');
  await page.locator('#onlyRupture').check();
  assert.equal(await page.locator('#rows tr').count(), 4);
  for (const [host, situacao] of [['900100', 'RUPTURA TEMPORÁRIA'], ['900101', 'RUPTURA TEMPORÁRIA'], ['900102', 'FALTA'], ['900104', 'RUPTURA TEMPORÁRIA']]) {
    const linha = page.locator('#rows tr').filter({ has: page.getByText(host, { exact: true }) });
    assert.equal(await linha.locator('td').nth(5).innerText(), situacao);
  }
  await page.getByLabel('Pasta do produto 900100').selectOption('LIMPEZA');
  await page.locator('[data-filter="LIMPEZA"]').click();
  await page.locator('#rows tr').getByText('900100', { exact: true }).waitFor();
  await carregar();
  const pasta=page.getByLabel('Pasta do produto 900100');
  assert.equal(await pasta.inputValue(), 'LIMPEZA');
  await pasta.selectOption('BEBIDAS');
  assert.equal(await pasta.inputValue(), 'BEBIDAS');
  await carregar();
  assert.equal(await pasta.inputValue(), 'BEBIDAS');
}

async function checkExcesso(page) {
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Bases internas carregadas'));
  const products = [
    ['101', 'A', 30, 60], ['102', 'B', 60, 100], ['103', 'C', 0, 5],
  ].map(([codigo, abc, vendaUnidade, estoqueLojaUnidade]) => ({
    codigo, abc, vendaUnidade, estoqueLojaUnidade, quantidadeCaixa: 1,
    descricao: 'PRODUTO ' + codigo, estoqueCustoERP: 3000, alertasCadastro: [],
  }));
  await page.locator('#backupFile').setInputFiles({
    name: 'excesso.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ products })),
  });
  await page.locator('#excessoPanel summary').click();
  const rows = page.locator('#excessoRows tr');
  await rows.getByText('Sem venda no período', { exact: true }).waitFor();
  assert.equal(await rows.count(), 2);
  const totais=page.locator('#excessoTotais');
  assert.match(await totais.innerText(), /58 cx.*5\.650,00/);
  const hosts = () => rows.locator('td:first-child').allTextContents();
  for (const [ordem, esperado] of [
    ['az', ['101','103']], ['za', ['103','101']], ['cxDesc', ['101','103']],
    ['cxAsc', ['103','101']], ['valorDesc', ['103','101']], ['valorAsc', ['101','103']],
  ]) {
    await page.locator('#excessoOrdem').selectOption(ordem);
    assert.deepEqual(await hosts(), esperado);
  }
  await page.evaluate(() => { window.print = () => window.dispatchEvent(new Event('beforeprint')); });
  await page.locator('#excessoLinhasImprimir').fill('1');
  await page.locator('#printExcesso').click();
  assert.deepEqual(await hosts(), ['101']);
  assert.match(await totais.innerText(), /53 cx/);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.deepEqual(await hosts(), ['101','103']);
  await page.locator('#excessoTodasLinhas').click();
  await page.locator('#printExcesso').click();
  assert.deepEqual(await hosts(), ['101','103']);
  assert.match(await totais.innerText(), /58 cx/);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.locator('#excessoMinValor').fill('2700');
  assert.deepEqual(await hosts(), ['103']);
  await page.locator('#excessoMinCx').fill('6');
  assert.match(await rows.innerText(), /Nenhum produto/);
  assert.match(await totais.innerText(), /0 cx.*0,00/);
  await page.locator('#excessoMinValor').fill('');
  assert.deepEqual(await hosts(), ['101']);
  await page.evaluate(() => { window.print = () => window.dispatchEvent(new Event('beforeprint')); });
  await page.locator('#printExcesso').click();
  await page.emulateMedia({ media: 'print' });
  assert(await rows.isVisible());
  assert(await totais.isVisible());
  assert.match(await totais.innerText(), /53 cx.*2\.650,00/);
  assert.deepEqual(await hosts(), ['101']);
  assert.match(await page.locator('#excessoContexto').innerText(), /Excesso mínimo: 6 cx.*Menor valor do excesso/);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: 'screen' });
  const baixar=page.waitForEvent('download');
  await page.locator('#csvExcesso').click();
  const arquivo=await baixar;
  assert.equal(arquivo.suggestedFilename(), 'Excesso_estoque_ABC.csv');
  const partes=[];
  for await(const parte of await arquivo.createReadStream()) partes.push(parte);
  const registros=Buffer.concat(partes).toString('utf8').split('\r\n');
  assert.equal(registros.length,3);
  assert.match(registros[1], /^"101";"PRODUTO 101"/);
  assert.match(registros[2], /"TOTAL".*"53";".*2\.650,00"/);
  await page.locator('#excessoMinCx').fill('');
  await page.locator('#excessoCurva').selectOption('A');
  assert.deepEqual((await rows.locator('td').allTextContents()).slice(0, 7), ['101', 'PRODUTO 101', 'A', '60', '1', '60', '53']);
  assert.match(await rows.locator('td').last().innerText(), /2\.650,00/);
  assert.deepEqual(await page.locator('#period option').allTextContents(), ['15','30','45','60']);
  await page.locator('#excessoDias').fill('61');
  assert.match(await rows.innerText(), /Nenhum produto/);
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
      'PASTA', 'CX/CAIXA', 'ABC', 'PEDIDO FINAL', 'FORNECEDOR', 'MARGEM', 'ALERTAS', 'COBERTURA ESTOQUE (DIAS)', 'COBERTURA PEDIDO (DIAS)', 'ESTOQUE + PEDIDO (DIAS)',
    ]);
    const firstProduct = page.locator('#rows tr').first();
    const cells = await firstProduct.locator('td').allTextContents();
    assert.equal(cells.length, 16);
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
      await checkInvalidERP(page);
      await checkManualCalculator(page);
      await checkRuptureCD(page);
      await checkERPBoxSize(page);
      await checkDynamicABC(page);
      await checkInferredFolders(page);
      await checkScopedABC(page);
      await checkBackupAndLogistics(page);
      await checkFaltaEPasta(page);
      await checkExcesso(page);
      await checkERPFields(page);
      await checkOfflineDownload(page);
      await page.locator('#daysA').evaluate(el=>el.closest('details').open=true);
      for(const [id,valor] of [['daysA','9'],['daysB','12'],['daysC','17']])await page.locator('#'+id).fill(valor);
      await page.locator('#period').selectOption('45');
      await page.locator('#applyParams').click();
      await page.reload();
      for(const [id,valor] of [['daysA','9'],['daysB','12'],['daysC','17'],['period','45']])assert.equal(await page.locator('#'+id).inputValue(),valor);
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
