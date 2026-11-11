import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { syntheticXml, syntheticHybridPdf } from './synthetic-fixtures.js';

for (const kind of ['xml', 'pdf']) {
  test(`${kind}: downloads and copied viewer XML remain parseable and complete`, async ({ page }) => {
    await page.addInitScript(() => { Math.random = () => 0.5; });
    await page.goto('/');
    await page.locator('[data-lang="en"]').click();
    await page.locator('#fileInput').setInputFiles({
      name: `synthetic.${kind}`,
      mimeType: kind === 'xml' ? 'text/xml' : 'application/pdf',
      buffer: kind === 'xml' ? Buffer.from(syntheticXml) : syntheticHybridPdf(syntheticXml),
    });
    await expect(page.locator('#xmlViewer')).toBeVisible();
    const downloadReady = page.waitForEvent('download');
    await page.locator('#downloadBtn').click();
    const download = await downloadReady;
    const downloaded = await readFile(await download.path(), 'utf8');
    expect(download.suggestedFilename()).toBe('synthetic_anonymized.xml');
    const check = async (xml) => page.evaluate(xml => {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      return {
        errors: doc.querySelectorAll('parsererror').length,
        root: doc.documentElement.localName,
        mixed: doc.querySelector('Mixed')?.textContent,
        name: doc.querySelector('Name')?.textContent,
        description: doc.querySelector('Description')?.textContent,
        note: doc.querySelector('Note')?.textContent,
        label: doc.documentElement.getAttribute('label'),
        amount: doc.querySelector('Amount')?.textContent,
        parts: doc.querySelectorAll('Part').length,
      };
    }, xml);
    const exported = await check(downloaded);
    expect(exported.errors).toBe(0);
    expect(exported.root).toBe('Invoice');
    expect(exported.name).toContain('&');
    expect(exported.description).toContain('<');
    expect(exported.mixed).toMatch(/.+ & .+ .+ & .+/);
    expect(exported.note).toContain('$&');
    expect(exported.note).toContain("$'");
    expect(exported.note).toContain('$`');
    expect(exported.note).not.toContain('Dollar');
    expect(exported.note.length).toBe('Dollar $& and $\' and $`'.length);
    expect(downloaded).not.toContain('Synthetic comment');
    expect(exported.parts).toBe(1);
    expect(exported.amount).toBe('12.34');
    expect(exported.label).toContain('\t \n \r');
    const copied = await page.locator('#xmlViewer').innerText();
    expect(await check(copied)).toEqual(exported);
    await expect(page.locator('.xml-value.changed').filter({ hasText: 'NNNNNN &' })).toHaveCount(1);
    await page.locator('#origToggle').click();
    expect(await check(await page.locator('#xmlViewer').innerText())).toEqual(await check(syntheticXml));
  });
}
