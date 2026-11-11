# Issues #1 and #2: VAT prefixes and XML integrity

## Cause and changes

### Issue #1

VAT-prefix preservation previously depended on `isValidVatId()`. That function
only accepts national formats with implemented checksum rules. Other numbers
fell back to general scrambling, including their prefix letters.

The anonymizer now identifies VAT fields from their CII/UBL context:

- CII `SpecifiedTaxRegistration/ID` with `schemeID="VA"`.
- UBL `PartyTaxScheme/CompanyID` with a sibling `TaxScheme/ID` equal to `VAT`.

These fields retain their exact leading two letters independently of checksum
support. The remainder is anonymized. A supported, checksum-valid source still
gets a checksum-valid replacement. A supported source with a bad checksum cannot
become checksum-valid by chance: if necessary, the replacement's last checksum
digit is changed. Unknown, invalid, and lowercase prefixes are retained rather
than silently corrected. Unsupported national formats are not newly validated.
Non-VAT tax registrations retain their previous behavior. VAT-context pseudonyms
have a separate cache key so an earlier free-text occurrence cannot replace their
prefix. Repeated VAT values still share one replacement within the document.

### Issue #2

Synthetic tests reproduce malformed XML when copying the viewer: decoded `&`,
`<`, and attribute quotes were displayed without XML escaping. The viewer also
discarded text surrounding child elements in mixed content.

The viewer now displays escaped XML text and attributes, preserves CDATA and
mixed-content order, and retains value-change highlighting. Attribute whitespace
uses character references so copying and parsing does not normalize it away.
The download continues to use `XMLSerializer` rather than the viewer's text.

The tests also exposed two related failures:

- Replacement strings containing `$&`, `$'`, or the dollar/backtick sequence
  were interpreted by `String.replace`. This could reinsert original text.
  A replacement callback now keeps those sequences literal.
- With PDF.js 6.5.438, attachment metadata can omit `content`. The extractor now
  loads it through `getAttachmentContent()` when available, while retaining the
  inline-content path for PDF.js 6.0.227. The loading task is destroyed on both
  success and failure. See the [PDF.js attachment API](https://mozilla.github.io/pdf.js/api/draft/api.js.html).

## Verification

All fixtures are synthetic. VAT fixtures are invented format/checksum examples,
not assertions about registered businesses. The PDF fixture is built in memory
and carries only the synthetic XML used by the standalone-file test.

The Chromium suite contains 16 tests covering:

- CII and UBL VAT fields for seller, buyer, and representative, with EL, ES,
  supported DE checksums, invalid checksums, and invalid/lowercase prefixes.
- Earlier free-text occurrences, repeated VAT values, non-VAT tax fields, and
  accidental checksum repair with grouped formatting.
- Actual XML/PDF file upload and XML download, reparsing the downloaded UTF-8
  bytes and copied viewer contents in both original and anonymized views.
- Entity escaping, attribute whitespace, CDATA, mixed content, removed comments,
  change highlighting, technical amounts, and literal dollar sequences.

Before the product changes, the first regression run had 13 failures and 3
passes. After the changes, all 16 tests and the production build passed with
both the npm dependency set (PDF.js 6.5.438) and the pnpm dependency set
(PDF.js 6.0.227). Commands: `npm test -- --reporter=line --workers=2`,
`npm run build`, `pnpm test --reporter=line --workers=2`, and `pnpm run build`.
Locked installations were checked with `npm ci` and
`pnpm install --frozen-lockfile`. The pnpm lock retains its prior production
versions; the stale npm lock also needed synchronization with the existing
package manifest. `git diff --check` was run before submitting the change.

`npm audit` reports 10 dependency findings (4 high, 4 moderate, 2 low), including
existing build-tool dependencies. Resolving that dependency tree is outside these
two fixes; no audit-fix command or security-policy bypass was applied.

## Limits

No original private invoice or historical attachment was read or copied. The
tests establish the synthetic viewer/export failures above; they do not establish
the cause of a historical artifact. The synthetic PDF exercises attachment
extraction, not PDF/A or hybrid-invoice conformance. VAT tests preserve the
existing supported checksum rules; they do not verify registration or add
national validation rules. Only Chromium was tested. No deployment is implied.
