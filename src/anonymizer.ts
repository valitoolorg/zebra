const WHITELIST_SUFFIXES = ['code', 'date', 'time', 'amount', 'percent', 'tax', 'currency', 'indicator'];
const BLACKLIST_SUFFIXES = ['name', 'street', 'city', 'lineone', 'linetwo', 'person', 'contact', 'telephone', 'telefax', 'mail', 'note', 'description', 'content'];
const FORCED_TAGS = new Set(['ibanid', 'postcodecode', 'globalid', 'completenumber', 'uriid', 'id', 'sellerassignedid']);

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

  const shouldAnonymize = (el: Element): boolean => {
    const tag = el.localName.toLowerCase();

    const parent = el.parentElement?.localName.toLowerCase() || '';

    // Preserve technical metadata like Profile/Guideline ID and Document Name (e.g. "INVOICE")
    if (tag === 'id' && parent === 'guidelinespecifieddocumentcontextparameter') return false;
    if (tag === 'name' && parent === 'exchangeddocument') return false;

    if (FORCED_TAGS.has(tag)) return true;

    if (WHITELIST_SUFFIXES.some(s => tag.endsWith(s))) return false;
    if (BLACKLIST_SUFFIXES.some(s => tag.endsWith(s))) return true;
    return false;
  };

  const walk = (node: Node): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (shouldAnonymize(el)) {
        for (let i = 0; i < el.childNodes.length; i++) {
          const child = el.childNodes[i];
          if (child.nodeType === Node.TEXT_NODE) {
            child.textContent = anonymizeText(child.textContent || '');
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
