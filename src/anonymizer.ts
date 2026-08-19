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

import { anonymizeIban, isValidIban, looksLikeIban, anonymizeBic, looksLikeBic, anonymizeVatId, isSupportedVatId } from './checksums';

const WHITELIST_SUFFIXES = ['code', 'date', 'time', 'amount', 'percent', 'tax', 'currency', 'indicator'];
const BLACKLIST_SUFFIXES = ['name', 'street', 'city', 'lineone', 'linetwo', 'person', 'contact', 'telephone', 'telefax', 'mail', 'note', 'description', 'content'];
const FORCED_TAGS = new Set(['ibanid', 'bicid', 'companyid', 'postcodecode', 'globalid', 'completenumber', 'uriid', 'id', 'sellerassignedid']);

const LOWER_CHARS = "abcdefghijklmnopqrstuvwxyzäöüß";
const UPPER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ";
const DIGIT_CHARS = "0123456789";

export function anonymizeXmlDoc(xmlDoc: Document): void {
  const getRandomChar = (chars: string): string => {
    return chars[Math.floor(Math.random() * chars.length)];
  };

  const anonymizeText = (text: string): string => {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (LOWER_CHARS.includes(c)) result += getRandomChar(LOWER_CHARS);
      else if (UPPER_CHARS.includes(c)) result += getRandomChar(UPPER_CHARS);
      else if (DIGIT_CHARS.includes(c)) result += getRandomChar(DIGIT_CHARS);
      else result += c;
    }
    return result;
  };

  // Tags that hold an IBAN even when the value's check digits are already broken.
  const isIbanContext = (el: Element): boolean => {
    const tag = el.localName.toLowerCase();
    const parent = el.parentElement?.localName.toLowerCase() || '';
    return tag === 'ibanid' || parent.endsWith('financialaccount');
  };

  // Tags that hold a BIC. Matched by context rather than by value, because a
  // plain 8-letter word (a company name, say) also matches the BIC pattern.
  const isBicContext = (el: Element): boolean => {
    const tag = el.localName.toLowerCase();
    const parent = el.parentElement?.localName.toLowerCase() || '';
    return tag === 'bicid' || parent.endsWith('financialinstitution') || parent.endsWith('financialinstitutionbranch');
  };

  /**
   * Anonymizes a single value. Structured identifiers (IBAN, VAT ID, BIC) are
   * regenerated so they keep a valid check digit or format, instead of being
   * scrambled into something validators reject.
   */
  const anonymizeValue = (text: string, el: Element): string => {
    const value = text.trim();
    if (!value) return text;

    let replacement: string | null = null;
    if (isSupportedVatId(value)) replacement = anonymizeVatId(value);
    else if (looksLikeIban(value) && (isValidIban(value) || isIbanContext(el))) replacement = anonymizeIban(value);
    else if (isBicContext(el) && looksLikeBic(value)) replacement = anonymizeBic(value);

    if (replacement === null) return anonymizeText(text);
    return text.replace(value, replacement); // keep surrounding whitespace
  };

  const shouldAnonymize = (el: Element): boolean => {
    const tag = el.localName.toLowerCase();

    const parent = el.parentElement?.localName.toLowerCase() || '';

    // Preserve technical metadata like Profile/Guideline ID and Document Name (e.g. "INVOICE")
    if (tag === 'id' && parent === 'guidelinespecifieddocumentcontextparameter') return false;
    if (tag === 'name' && parent === 'exchangeddocument') return false;

    // UBL code list identifiers, not business data: TaxScheme/ID carries "VAT",
    // TaxCategory/ID carries the category code ("S", "Z", "E", ...). Scrambling
    // them makes the invoice fail EN 16931 validation.
    if (tag === 'id' && (parent === 'taxscheme' || parent.endsWith('taxcategory'))) return false;

    if (FORCED_TAGS.has(tag)) return true;

    if (WHITELIST_SUFFIXES.some(s => tag.endsWith(s))) return false;
    if (BLACKLIST_SUFFIXES.some(s => tag.endsWith(s))) return true;
    return false;
  };

  const ATTACHMENT_TAGS = new Set(['attachmentbinaryobject', 'embeddeddocumentbinaryobject']);

  const walk = (node: Node): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.localName.toLowerCase();

      if (ATTACHMENT_TAGS.has(tag)) {
        for (let i = 0; i < el.childNodes.length; i++) {
          const child = el.childNodes[i];
          if (child.nodeType === Node.TEXT_NODE) {
            child.textContent = 'RHVtbXktQW5oYW5n'; // "Dummy-Anhang" in base64
          }
        }
      } else if (shouldAnonymize(el)) {
        for (let i = 0; i < el.childNodes.length; i++) {
          const child = el.childNodes[i];
          if (child.nodeType === Node.TEXT_NODE) {
            child.textContent = anonymizeValue(child.textContent || '', el);
          }
        }
      }

      for (let i = 0; i < el.childNodes.length; i++) {
        walk(el.childNodes[i]);
      }
    }
  };

  walk(xmlDoc.documentElement);
}
