export const syntheticXml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Synthetic document comment. -->
<Invoice xmlns="urn:test:invoice" label="A &amp; R &quot;quoted&quot; &#9; &#10; &#13;">
  <!-- Synthetic comment to be removed from the anonymized document. -->
  <Name>A &amp; R &lt;example&gt; &#38; &#x26;</Name>
  <Mixed>Before &amp; <!-- Synthetic inline comment. --><Part>inside</Part> after &amp; end</Mixed>
  <Description><![CDATA[A & R <sample>]]></Description>
  <Note>Dollar $&amp; and $' and $&#96;</Note>
  <Amount currencyID="EUR">12.34</Amount>
  <?synthetic example?>
</Invoice>`;

/** Builds a minimal PDF with an uncompressed, entirely synthetic XML attachment. */
export function syntheticHybridPdf(xml) {
  const content = Buffer.from(xml, 'utf8');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(factur-x.xml) 4 0 R] >> >> >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>',
    '<< /Type /Filespec /F (factur-x.xml) /EF << /F 5 0 R >> >>',
    Buffer.concat([Buffer.from(`<< /Type /EmbeddedFile /Subtype /text#2Fxml /Length ${content.length} >>\nstream\n`), content, Buffer.from('\nendstream')]),
  ];
  const parts = [Buffer.from('%PDF-1.7\n')];
  const offsets = [0];
  let length = parts[0].length;
  objects.forEach((object, i) => {
    offsets.push(length);
    const part = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.from(object), Buffer.from('\nendobj\n')]);
    parts.push(part);
    length += part.length;
  });
  parts.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return Buffer.concat(parts);
}
