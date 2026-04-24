/*
    Copyright (C) 2026 valitool GmbH

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

export async function extractXmlFromPdf(pdfBuffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  
  // Use local worker for PWA/Offline support
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;

  try {
    const doc = await pdfjs.getDocument({ data: pdfBuffer }).promise;
    const attachments = await doc.getAttachments();
    
    if (!attachments) throw new Error('NO_ATTACHMENTS');

    const RELEVANT = ['factur-x.xml', 'zugferd-invoice.xml', 'xrechnung.xml', 'basic-wl.xml'];
    for (const name of RELEVANT) {
      if (attachments[name]) {
        return new TextDecoder().decode(attachments[name].content);
      }
    }

    throw new Error('NO_ZUGFERD_XML');
  } catch (err: any) {
    if (err.message === 'NO_ZUGFERD_XML' || err.message === 'NO_ATTACHMENTS') throw err;
    console.error('PDF.js:', err);
    throw new Error('PDF_LOAD_FAILED');
  }
}
