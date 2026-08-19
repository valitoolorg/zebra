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

import {
  anonymizeIban, isValidIban,
  anonymizeBic, isValidBic,
  anonymizeVatId, isValidVatId,
} from './checksums';

/*
 * Everything is anonymized unless it is explicitly known to be technical.
 *
 * The reverse — anonymizing only what is recognized — leaves unknown elements
 * readable, and unknown elements are exactly what faulty invoices are full of:
 * vendor extensions, misplaced fields, misspelled tags. Defaulting to "replace"
 * means a tag nobody anticipated ends up scrambled rather than leaked.
 */

/** Element name suffixes whose content is technical and must survive. */
const KEEP_SUFFIXES = [
  'code', 'date', 'time', 'datetimestring',
  'amount', 'percent', 'quantity', 'rate', 'numeric', 'measure',
  'currencyid', 'countryid', 'lineid', 'unitcode',
  'indicator', 'versionid', 'customizationid', 'profileid',
];

/** Overrides KEEP_SUFFIXES: a postcode ends in "code" but identifies people. */
const FORCE_SUFFIXES = ['postcodecode', 'postcode'];

/** Technical values reachable only via their parent: "<tag> inside <parent>". */
const KEEP_IN_PARENT: Record<string, (parent: string) => boolean> = {
  id: parent =>
    parent === 'guidelinespecifieddocumentcontextparameter' || // CII profile ID
    parent === 'taxscheme' ||                                  // UBL: carries "VAT"
    parent.endsWith('taxcategory') ||                          // UBL: "S", "Z", "E", ...
    parent.endsWith('invoiceline') ||                          // UBL: line number
    parent.endsWith('creditnoteline'),
  name: parent => parent === 'exchangeddocument',              // document type, e.g. "INVOICE"
};

/** Attributes that are technical metadata rather than business content. */
const KEEP_ATTRIBUTES = new Set([
  'schemeid', 'schemeagencyid', 'schemeagencyname', 'schemeuri', 'schemeversionid',
  'listid', 'listagencyid', 'listagencyname', 'listuri', 'listversionid',
  'currencyid', 'unitcode', 'unitcodelistversionid', 'format', 'mimecode',
  'languageid', 'languagelocaleid',
]);

const ATTACHMENT_TAGS = new Set(['attachmentbinaryobject', 'embeddeddocumentbinaryobject']);

/*
 * Character classes are replaced within themselves: ASCII stays ASCII, an umlaut
 * stays an umlaut. Mixing them would introduce non-ASCII where the source had
 * none, which breaks e-mail addresses, URLs and anything else validated against
 * an ASCII pattern.
 */
const CHAR_CLASSES = [
  'abcdefghijklmnopqrstuvwxyz',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'äöüß',
  'ÄÖÜ',
  '0123456789',
];

const EMAIL_PATTERN = /^([^@\s]+)@([^@\s]+)\.([A-Za-z]{2,})$/;
const URL_PATTERN = /^(https?:\/\/)(\S+)$/i;

export function anonymizeXmlDoc(xmlDoc: Document): void {
  /*
   * Same input always yields the same replacement, so relationships between
   * fields survive. Validators report things like "seller name in BT-27 does not
   * match BG-4"; with per-occurrence randomness that finding would be impossible
   * to reproduce on the anonymized file.
   */
  const pseudonyms = new Map<string, string>();

  const randomChar = (chars: string): string => chars[Math.floor(Math.random() * chars.length)];

  /** Replaces characters class by class, so length and punctuation survive. */
  const scramble = (text: string): string => {
    let result = '';
    for (const c of text) {
      const charClass = CHAR_CLASSES.find(cls => cls.includes(c));
      result += charClass ? randomChar(charClass) : c;
    }
    return result;
  };

  const isBicContext = (tag: string, parent: string): boolean =>
    tag === 'bicid' || parent.endsWith('financialinstitution') || parent.endsWith('financialinstitutionbranch');

  /**
   * Picks a replacement strategy for one value.
   *
   * Identifiers are only regenerated in rule-conforming form when the original
   * already conformed. An invalid IBAN is scrambled like any other string and
   * stays invalid — repairing it would erase the defect under analysis.
   */
  const replacementFor = (value: string, tag: string, parent: string): string => {
    if (isValidIban(value)) return anonymizeIban(value);
    if (isValidVatId(value)) return anonymizeVatId(value);
    if (isBicContext(tag, parent) && isValidBic(value)) return anonymizeBic(value);

    // Keep an address parseable: local part and domain change, the TLD stays.
    const email = value.match(EMAIL_PATTERN);
    if (email) return `${scramble(email[1])}@${scramble(email[2])}.${email[3]}`;

    const url = value.match(URL_PATTERN);
    if (url) return url[1] + scramble(url[2]);

    return scramble(value);
  };

  const anonymizeValue = (text: string, tag: string, parent: string): string => {
    const value = text.trim();
    if (!value) return text;

    const key = `${isBicContext(tag, parent) ? 'bic' : ''}:${value}`;
    let replacement = pseudonyms.get(key);
    if (replacement === undefined) {
      replacement = replacementFor(value, tag, parent);
      pseudonyms.set(key, replacement);
    }

    return text.replace(value, replacement); // keep surrounding whitespace
  };

  /** True if the element's content is technical and must be left alone. */
  const shouldKeep = (tag: string, parent: string): boolean => {
    if (FORCE_SUFFIXES.some(s => tag.endsWith(s))) return false;
    if (KEEP_IN_PARENT[tag]?.(parent)) return true;
    return KEEP_SUFFIXES.some(s => tag.endsWith(s));
  };

  const anonymizeAttributes = (el: Element, parent: string): void => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      // Namespace and schema declarations are structure, never content.
      if (name === 'xmlns' || name.startsWith('xmlns:') || name.startsWith('xsi:')) continue;
      if (KEEP_ATTRIBUTES.has(name.replace(/^.*:/, ''))) continue;
      attr.value = anonymizeValue(attr.value, name, parent);
    }
  };

  /** Comments routinely carry export paths, clerk names and internal notes. */
  const stripComments = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) node.removeChild(child);
      else stripComments(child);
    }
  };

  const isTextual = (node: Node): boolean =>
    node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE;

  const walk = (node: Node): void => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as Element;
    const tag = el.localName.toLowerCase();
    const parent = el.parentElement?.localName.toLowerCase() || '';

    anonymizeAttributes(el, parent);

    if (ATTACHMENT_TAGS.has(tag)) {
      // CDATA counts as text here — attachment payloads are often wrapped in it.
      for (const child of Array.from(el.childNodes)) {
        if (isTextual(child)) child.textContent = 'RHVtbXktQW5oYW5n'; // "Dummy-Anhang" in base64
      }
    } else if (!shouldKeep(tag, parent)) {
      for (const child of Array.from(el.childNodes)) {
        if (isTextual(child)) child.textContent = anonymizeValue(child.textContent || '', tag, parent);
      }
    }

    for (const child of Array.from(el.childNodes)) walk(child);
  };

  if (!xmlDoc.documentElement) return;

  stripComments(xmlDoc);
  walk(xmlDoc.documentElement);
}
