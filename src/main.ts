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

import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { anonymizeXmlDoc } from './anonymizer';
import { setLanguage, updateTranslations, getLanguage } from './i18n';
import { setTheme, getTheme, applyTheme } from './theme';
import { extractXmlFromPdf } from './pdf-extractor';

registerSW({ immediate: true });

let originalDoc: Document | null = null;
let anonymizedDoc: Document | null = null;
let isAnonView = true;
let fileName = 'anonymized.xml';

const app = document.querySelector<HTMLDivElement>('#app')!;

function init() {
  render();
  updateTranslations();
  applyTheme();
  setupGlobalEvents();
}

function setupGlobalEvents() {
  const dropzone = () => document.querySelector('.dropzone');
  
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone()?.classList.add('dragging');
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (!e.relatedTarget) dropzone()?.classList.remove('dragging');
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone()?.classList.remove('dragging');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });
}

function showErrorMessage(key: string) {
  const overlay = document.createElement('div');
  overlay.className = 'error-overlay';
  overlay.innerHTML = `
    <div class="error-modal">
      <h3 data-t="error.title"></h3>
      <p data-t="${key}"></p>
      <button class="primary" id="errorCloseBtn" data-t="error.close"></button>
    </div>
  `;
  document.body.appendChild(overlay);
  updateTranslations();
  overlay.querySelector('#errorCloseBtn')?.addEventListener('click', () => overlay.remove());
}

async function handleFile(file: File) {
  let xmlText = '';
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isXml = file.type === 'text/xml' || file.name.toLowerCase().endsWith('.xml');

  try {
    if (isPdf) {
      xmlText = await extractXmlFromPdf(await file.arrayBuffer());
      fileName = file.name.replace(/\.pdf$/i, '.xml');
    } else if (isXml) {
      xmlText = await file.text();
      fileName = file.name;
    } else {
      return showErrorMessage('error.invalid_file');
    }

    const parser = new DOMParser();
    originalDoc = parser.parseFromString(xmlText, 'text/xml');
    anonymizedDoc = originalDoc.cloneNode(true) as Document;
    anonymizeXmlDoc(anonymizedDoc);
    
    isAnonView = true;
    render();
  } catch (err: any) {
    const msg = (err.message === 'NO_ZUGFERD_XML' || err.message === 'NO_ATTACHMENTS') 
      ? 'error.no_xml_in_pdf' 
      : 'error.pdf_load_failed';
    showErrorMessage(msg);
  }
}

function render() {
  app.innerHTML = originalDoc ? renderViewerHtml() : renderDropzoneHtml();
  if (originalDoc) {
    const container = document.getElementById('xmlViewer')!;
    container.appendChild(formatXml(isAnonView ? anonymizedDoc! : originalDoc));
    attachViewerEvents();
  } else {
    attachDropzoneEvents();
  }
  attachHeaderEvents();
  updateTranslations();
}

function renderHeader() {
  const lang = getLanguage();
  const theme = getTheme();
  const themes = ['light', 'dark', 'system'] as const;
  const langs = ['de', 'en', 'fr'] as const;

  return `
    <header>
      <div class="logo" data-t="app.title"></div>
      <div class="controls">
        <div class="toggle-group">
          ${langs.map(l => `<button class="toggle-item ${lang === l ? 'active' : ''}" data-lang="${l}">${l.toUpperCase()}</button>`).join('')}
        </div>
        <div class="toggle-group">
          ${themes.map(t => `<button class="toggle-item ${theme === t ? 'active' : ''}" data-theme="${t}">${renderThemeIcon(t)}</button>`).join('')}
        </div>
      </div>
    </header>
  `;
}

function renderThemeIcon(theme: string) {
  if (theme === 'light') return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  if (theme === 'dark') return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
}

function renderDropzoneHtml() {
  const year = new Date().getFullYear();
  return `
    ${renderHeader()}
    <div class="dropzone">
      <h2 data-t="drop.title"></h2>
      <button class="outline" id="fileBtn" data-t="drop.subtitle"></button>
      <p data-t="drop.description"></p>
      <input type="file" id="fileInput" accept=".xml,.pdf" class="hidden">
    </div>
    <footer class="initial-footer">
      <span>Copyright &copy; ${year} valitool GmbH - <a href="https://validool.org/impressum/" target="_blank" data-t="footer.impressum"></a></span>
    </footer>
  `;
}

function renderViewerHtml() {
  return `
    ${renderHeader()}
    <div class="viewer" id="xmlViewer"></div>
    <div class="floating-controls">
      <button class="outline" id="backBtn" data-t="view.back"></button>
      <div class="toggle-group">
        <button class="toggle-item ${isAnonView ? 'active' : ''}" id="anonToggle" data-t="view.toggle.anon"></button>
        <button class="toggle-item ${!isAnonView ? 'active' : ''}" id="origToggle" data-t="view.toggle.orig"></button>
      </div>
      <button class="primary" id="downloadBtn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span data-t="view.download"></span>
      </button>
    </div>
  `;
}

function attachDropzoneEvents() {
  const input = document.getElementById('fileInput') as HTMLInputElement;
  document.getElementById('fileBtn')?.addEventListener('click', () => input.click());
  input.addEventListener('change', () => input.files?.[0] && handleFile(input.files[0]));
}

function attachViewerEvents() {
  document.getElementById('backBtn')?.addEventListener('click', () => { originalDoc = null; render(); });
  document.getElementById('anonToggle')?.addEventListener('click', () => { isAnonView = true; render(); });
  document.getElementById('origToggle')?.addEventListener('click', () => { isAnonView = false; render(); });
  document.getElementById('downloadBtn')?.addEventListener('click', downloadFile);
}

function attachHeaderEvents() {
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', (e) => {
    setLanguage((e.currentTarget as HTMLButtonElement).dataset.lang as any);
    render();
  }));
  document.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', (e) => {
    setTheme((e.currentTarget as HTMLButtonElement).dataset.theme as any);
    render();
  }));
}

function formatXml(doc: Document): DocumentFragment {
  const fragment = document.createDocumentFragment();
  
  const traverse = (node: Node, indent = 0) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const spacing = '  '.repeat(indent);
    const line = document.createElement('div');
    
    const tag = (text: string) => {
      const s = document.createElement('span');
      s.className = 'xml-tag';
      s.textContent = text;
      return s;
    };

    let attrStr = '';
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes[i];
      attrStr += ` ${a.name}="${a.value}"`;
    }

    line.appendChild(tag(`${spacing}<${el.nodeName}${attrStr}>`));

    if (el.children.length > 0) {
      fragment.appendChild(line);
      for (let i = 0; i < el.childNodes.length; i++) traverse(el.childNodes[i], indent + 1);
      const closeLine = document.createElement('div');
      closeLine.appendChild(tag(`${spacing}</${el.nodeName}>`));
      fragment.appendChild(closeLine);
    } else {
      const val = document.createElement('span');
      val.className = 'xml-value';
      val.textContent = el.textContent || '';
      line.appendChild(val);
      line.appendChild(tag(`</${el.nodeName}>`));
      fragment.appendChild(line);
    }
  };

  traverse(doc.documentElement);
  return fragment;
}

function downloadFile() {
  if (!anonymizedDoc) return;
  const xml = new XMLSerializer().serializeToString(anonymizedDoc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([xml], { type: 'text/xml' }));
  a.download = fileName.replace('.xml', '_anonymized.xml');
  a.click();
  URL.revokeObjectURL(a.href);
}

init();
