import { test, expect } from '@playwright/test';

// Invented identifiers: these are format/checksum fixtures, not registered VAT IDs.
const cases = [
  ['EL000000000', 'EL'],
  ['ESX0000000A', 'ES'],
  ['DE000000003', 'DE'],
  ['DE000000004', 'DE'],
  ['ZZ000000000', 'ZZ'],
  ['el000000000', 'el'],
];

for (const syntax of ['CII', 'UBL']) {
  for (const [value, prefix] of cases) {
    test(`${syntax}: preserve ${value} prefix for seller, buyer and representative`, async ({ page }) => {
      await page.goto('/');
      const result = await page.evaluate(async ({ syntax, value }) => {
        const { anonymizeXmlDoc } = await import('/src/anonymizer.ts');
        const { isValidVatId } = await import('/src/checksums.ts');
        // A free-text occurrence first must not determine the VAT-context pseudonym.
        const party = syntax === 'CII'
          ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${value}</ram:ID></ram:SpecifiedTaxRegistration>`
          : `<cac:PartyTaxScheme><cbc:CompanyID>${value}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`;
        const xml = `<Invoice xmlns:ram="urn:test:cii" xmlns:cac="urn:test:ubl:aggregate" xmlns:cbc="urn:test:ubl:basic"><Note>${value}</Note><Seller>${party}</Seller><Buyer>${party}</Buyer><Representative>${party}</Representative></Invoice>`;
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const random = Math.random;
        Math.random = () => 0.5;
        try { anonymizeXmlDoc(doc); } finally { Math.random = random; }
        const values = Array.from(doc.querySelectorAll(syntax === 'CII' ? '[schemeID="VA"]' : 'CompanyID'), el => el.textContent);
        return { values, valid: values.map(isValidVatId), note: doc.querySelector('Note').textContent };
      }, { syntax, value });
      expect(result.values).toHaveLength(3);
      for (const replacement of result.values) {
        expect(replacement.slice(0, 2)).toBe(prefix);
        expect(replacement).not.toBe(value);
      }
      expect(new Set(result.values).size).toBe(1);
      if (value === 'DE000000003') expect(result.valid).toEqual([true, true, true]);
      if (value === 'DE000000004') expect(result.valid).toEqual([false, false, false]);
      if (value.startsWith('EL') || value.startsWith('ES')) expect(result.note.slice(0, 2)).not.toBe(prefix);
    });
  }
}

test('an invalid checksum cannot become valid by chance', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { anonymizeXmlDoc } = await import('/src/anonymizer.ts');
    const { isValidVatId } = await import('/src/checksums.ts');
    const doc = new DOMParser().parseFromString('<Tax><SpecifiedTaxRegistration><ID schemeID="VA"> DE 000.000.004 </ID></SpecifiedTaxRegistration></Tax>', 'text/xml');
    let digit = 0;
    const random = Math.random;
    // Generic scrambling would create the checksum-valid DE000000003.
    Math.random = () => ++digit === 9 ? 0.3 : 0;
    try { anonymizeXmlDoc(doc); } finally { Math.random = random; }
    const value = doc.querySelector('ID').textContent;
    return { value, valid: isValidVatId(value) };
  });
  expect(result.value).toMatch(/^ DE \d{3}\.\d{3}\.\d{3} $/);
  expect(result.valid).toBe(false);
});

test('non-VAT tax registrations keep using generic anonymization', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { anonymizeXmlDoc } = await import('/src/anonymizer.ts');
    const doc = new DOMParser().parseFromString('<Invoice><SpecifiedTaxRegistration><ID schemeID="FC">ESX0000000A</ID></SpecifiedTaxRegistration><PartyTaxScheme><CompanyID>ESX0000000A</CompanyID><TaxScheme><ID>OTHER</ID></TaxScheme></PartyTaxScheme></Invoice>', 'text/xml');
    const random = Math.random;
    Math.random = () => 0.5;
    try { anonymizeXmlDoc(doc); } finally { Math.random = random; }
    return Array.from(doc.querySelectorAll('[schemeID="FC"], CompanyID'), el => el.textContent);
  });
  for (const value of result) expect(value.slice(0, 2)).toBe('NN');
});
