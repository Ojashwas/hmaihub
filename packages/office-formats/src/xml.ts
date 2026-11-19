export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}
export type XmlNode = XmlElement | string;

export class XmlError extends Error {}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (m, e: string) => {
    if (e.startsWith("#x")) return String.fromCodePoint(Number.parseInt(e.slice(2), 16));
    if (e.startsWith("#")) return String.fromCodePoint(Number.parseInt(e.slice(1), 10));
    const v = ENTITIES[e];
    if (v === undefined) throw new XmlError(`Unknown entity ${m}`);
    return v;
  });
}

/**
 * Small non-validating XML parser for Office parts. DTDs are refused, so
 * entity expansion and external entities cannot occur.
 */
export function parseXml(text: string, maxDepth = 256): XmlElement {
  let i = 0;
  const root: XmlElement = { name: "#root", attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  const top = () => stack[stack.length - 1] as XmlElement;

  while (i < text.length) {
    const lt = text.indexOf("<", i);
    if (lt === -1) {
      if (text.slice(i).trim()) top().children.push(decodeEntities(text.slice(i)));
      break;
    }
    if (lt > i) {
      const t = text.slice(i, lt);
      if (stack.length > 1) top().children.push(decodeEntities(t));
      else if (t.trim()) throw new XmlError("Text outside the root element");
    }
    if (text.startsWith("<?", lt)) {
      const end = text.indexOf("?>", lt);
      if (end === -1) throw new XmlError("Unterminated processing instruction");
      i = end + 2;
    } else if (text.startsWith("<!--", lt)) {
      const end = text.indexOf("-->", lt);
      if (end === -1) throw new XmlError("Unterminated comment");
      i = end + 3;
    } else if (text.startsWith("<![CDATA[", lt)) {
      const end = text.indexOf("]]>", lt);
      if (end === -1) throw new XmlError("Unterminated CDATA");
      top().children.push(text.slice(lt + 9, end));
      i = end + 3;
    } else if (text.startsWith("<!", lt)) {
      throw new XmlError("Document type declarations are not allowed");
    } else if (text.startsWith("</", lt)) {
      const end = text.indexOf(">", lt);
      const name = text.slice(lt + 2, end).trim();
      const open = stack.pop();
      if (!open || open.name !== name || stack.length === 0) throw new XmlError(`Mismatched closing tag </${name}>`);
      i = end + 1;
    } else {
      const end = findTagEnd(text, lt);
      const selfClosing = text[end - 1] === "/";
      const body = text.slice(lt + 1, selfClosing ? end - 1 : end);
      const nameMatch = /^[^\s/>]+/.exec(body);
      if (!nameMatch) throw new XmlError("Missing element name");
      const el: XmlElement = {
        name: nameMatch[0],
        attrs: parseAttributes(body.slice(nameMatch[0].length)),
        children: []
      };
      top().children.push(el);
      if (!selfClosing) {
        if (stack.length > maxDepth) throw new XmlError("Maximum nesting depth exceeded");
        stack.push(el);
      }
      i = end + 1;
    }
  }
  if (stack.length !== 1) throw new XmlError("Unclosed elements");
  const docEl = root.children.find((c): c is XmlElement => typeof c !== "string");
  if (!docEl) throw new XmlError("No root element");
  return docEl;
}

function findTagEnd(text: string, start: number): number {
  let quote: string | null = null;
  for (let j = start + 1; j < text.length; j++) {
    const c = text[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ">") return j;
  }
  throw new XmlError("Unterminated tag");
}

function parseAttributes(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  for (const m of s.matchAll(re)) attrs[m[1] as string] = decodeEntities(m[3] ?? m[4] ?? "");
  return attrs;
}

export const elements = (el: XmlElement | undefined, name?: string): XmlElement[] =>
  (el?.children ?? []).filter((c): c is XmlElement => typeof c !== "string" && (name === undefined || c.name === name));

export const element = (el: XmlElement | undefined, name: string): XmlElement | undefined => elements(el, name)[0];

export function descendants(el: XmlElement, name: string, out: XmlElement[] = []): XmlElement[] {
  for (const c of elements(el)) {
    if (c.name === name) out.push(c);
    descendants(c, name, out);
  }
  return out;
}

export function textContent(el: XmlElement | undefined): string {
  if (!el) return "";
  return el.children.map((c) => (typeof c === "string" ? c : textContent(c))).join("");
}

export function escapeXml(s: string): string {
  // Characters not allowed in XML 1.0 are dropped.
  // eslint-disable-next-line no-control-regex -- removing control characters is the purpose
  const clean = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "");
  return clean.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
