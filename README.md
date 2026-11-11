# 🦓 ZEBRA - E-Invoice Anonymizer

ZEBRA is a privacy-focused web application designed to anonymize electronic invoices (E-Invoices). It allows users to strip sensitive personal and business information from invoice data while preserving the structural integrity of the document for testing or sharing purposes.

## ✨ Features

- **Format Support:** Processes both standalone `.xml` files (ZUGFeRD/XRechnung) and Hybrid-PDFs (`.pdf` with embedded XML).
- **Smart Anonymization:** Replaces names, addresses, IDs, and contact details with randomized, type-preserving data (e.g., `De1234` → `Uz7253`).
- **Interactive Viewer:** Compare original and anonymized XML structures side-by-side before downloading.
- **Privacy First:** 100% client-side processing. Your data never leaves your browser.
- **PWA Ready:** Installable as a progressive web app for offline use.
- **Multi-language:** Available in English, German, and French.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone git@github.com:valitoolorg/zebra.git
   cd zebra
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

### Regression tests

With Node.js 24, install the locked dependencies and the test browser:

```bash
npm ci
npx playwright install chromium
npm test
```

On Linux CI hosts, use `npx playwright install --with-deps chromium` to install
browser system dependencies as well. Playwright starts and stops a local Vite
server on port 4173; the port must be free.

The tests use only invented identifiers, synthetic XML, and an in-memory PDF
with a synthetic XML attachment. No customer documents are needed. See
[the notes for issues #1 and #2](docs/issues-1-2-vat-and-xml.md) for scope and limits.

## 🛠 Tech Stack

- **Framework:** [Vite](https://vitejs.dev/) + TypeScript
- **PDF Processing:** [PDF.js](https://mozilla.github.io/pdf.js/)
- **Styling:** Vanilla CSS (Modern CSS Variables)
- **Deployment:** GitHub Pages

## 📄 License & Attribution

- ZEBRA is private and intended for use by [valitool](https://valitool.org).
- This project uses [PDF.js](https://mozilla.github.io/pdf.js/), licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0).
