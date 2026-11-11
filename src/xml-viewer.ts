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

/**
 * Renders copyable XML, highlighting values that differ from the counterpart.
 * XML escaping is separate from HTML escaping: spans receive textContent, but
 * that text must itself be valid XML when copied out of the viewer.
 */
export function formatXml(doc: Document, counterpart?: Document | null): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const serializer = new XMLSerializer();
  const escapeText = (value: string): string => value.replace(/[&<>]/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
  const escapeAttribute = (value: string): string => escapeText(value).replace(/["\t\n\r]/g, c =>
    c === '"' ? '&quot;' : `&#${c.charCodeAt(0)};`);

  const span = (className: string, text: string, changed = false): HTMLSpanElement => {
    const element = document.createElement('span');
    element.className = changed ? `${className} changed` : className;
    element.textContent = text;
    return element;
  };

  const renderNode = (node: Node, other: Node | undefined, line: HTMLElement, indent: number, inline: boolean): void => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      const value = node.nodeType === Node.TEXT_NODE ? escapeText(node.nodeValue || '') : serializer.serializeToString(node);
      line.appendChild(span('xml-value', value,
        other !== undefined && other.nodeValue !== node.nodeValue));
      return;
    }

    const el = node as Element;
    const twin = other?.nodeType === Node.ELEMENT_NODE && other.nodeName === el.nodeName ? other as Element : undefined;
    // Anonymization removes comments; ignore them when pairing value nodes.
    const otherChildren = Array.from(twin?.childNodes ?? []).filter(child => child.nodeType !== Node.COMMENT_NODE);
    let otherIndex = 0;
    const counterpartFor = (child: Node): Node | undefined =>
      child.nodeType === Node.COMMENT_NODE ? undefined : otherChildren[otherIndex++];
    line.appendChild(span('xml-tag', `<${el.nodeName}`));
    for (const attr of Array.from(el.attributes)) {
      line.appendChild(span('xml-tag', ` ${attr.name}="`));
      line.appendChild(span('xml-attr-value', escapeAttribute(attr.value),
        twin !== undefined && twin.getAttribute(attr.name) !== attr.value));
      line.appendChild(span('xml-tag', '"'));
    }
    line.appendChild(span('xml-tag', '>'));

    // Mixed content must stay in order on a single line; indentation would add
    // text to the value. Only element-only content receives visual line breaks.
    const block = !inline && el.children.length > 0 && !Array.from(el.childNodes).some(child =>
      child.nodeType === Node.CDATA_SECTION_NODE
      || (child.nodeType === Node.TEXT_NODE && child.textContent!.trim() !== ''));
    if (block) {
      fragment.appendChild(line);
      Array.from(el.childNodes).forEach(child => {
        const otherChild = counterpartFor(child);
        if (child.nodeType === Node.TEXT_NODE && !child.textContent!.trim()) return;
        const childLine = document.createElement('div');
        childLine.appendChild(document.createTextNode('  '.repeat(indent + 1)));
        renderNode(child, otherChild, childLine, indent + 1, false);
        if (childLine.parentNode === null) fragment.appendChild(childLine);
      });
      const closeLine = document.createElement('div');
      closeLine.appendChild(span('xml-tag', `${'  '.repeat(indent)}</${el.nodeName}>`));
      fragment.appendChild(closeLine);
    } else {
      Array.from(el.childNodes).forEach(child => renderNode(child, counterpartFor(child), line, indent, true));
      line.appendChild(span('xml-tag', `</${el.nodeName}>`));
    }
  };

  const otherNodes = Array.from(counterpart?.childNodes ?? []).filter(node => node.nodeType !== Node.COMMENT_NODE);
  let otherIndex = 0;
  Array.from(doc.childNodes).forEach(node => {
    const line = document.createElement('div');
    renderNode(node, node.nodeType === Node.COMMENT_NODE ? undefined : otherNodes[otherIndex++], line, 0, false);
    if (line.parentNode === null) fragment.appendChild(line);
  });
  return fragment;
}
