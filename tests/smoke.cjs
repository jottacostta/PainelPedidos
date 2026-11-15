const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [390,768,1366,1920]){
   const page=await browser.newPage({viewport:{width,height:850},acceptDownloads:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!document.querySelector('#notice').textContent.includes('Carregando'),{timeout:30000});
   assert.equal(errors.length,0,'JavaScript errors: '+errors.join('; '));
   const panels=await page.locator('.operation-panel,.params-panel,.diagnostics-panel,.filters-panel,.abc-filter-panel,.products-panel,.logistics-panel').evaluateAll(els=>els.map(e=>({name:e.className,x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width})));
   for(const panel of panels){
    assert(panel.width>=Math.min(width-50,250),'Panel too narrow: '+JSON.stringify(panel));
    assert(panel.x>=0,'Panel outside viewport: '+JSON.stringify(panel));
   }
   const fixture=path.join(__dirname,'fixture-erp.xls');
   await page.locator('#erpFile').setInputFiles(fixture);
   await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('ERP importado'),{timeout:30000});
   assert.equal((await page.locator('#kProducts').innerText()).trim(),'3','ERP product count');
   await page.locator('[data-abc-filter="A"]').click();
   assert.equal(await page.locator('[data-abc-filter="A"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-abc-filter=""]').click();
   assert.equal(await page.locator('[data-abc-filter=""]').getAttribute('aria-pressed'),'true');
   assert.equal(errors.length,0,'Runtime errors after import');
   console.log('PASS viewport',width,'ERP import, ABC filters, panel geometry');
   await page.close();
  }
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
