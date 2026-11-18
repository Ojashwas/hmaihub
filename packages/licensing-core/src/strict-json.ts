import { LicenseTokenError } from "./errors.ts";

const NUMBER_PATTERN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const HEX4 = /^[0-9a-fA-F]{4}$/;

/**
 * RFC 8259 parser that rejects duplicate member names (after unescaping),
 * trailing data, and excessive nesting. Objects have a null prototype.
 */
export function parseStrictJson(text: string, maxDepth = 32): unknown {
  let i = 0;

  const fail = (message: string): never => {
    throw new LicenseTokenError("INVALID_JSON", `${message} at offset ${i}`);
  };

  const skipWhitespace = (): void => {
    while (i < text.length) {
      const c = text.charCodeAt(i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) i++;
      else break;
    }
  };

  const parseString = (): string => {
    i++;
    let out = "";
    for (;;) {
      if (i >= text.length) fail("Unterminated string");
      const c = text.charCodeAt(i);
      if (c === 0x22) {
        i++;
        return out;
      }
      if (c < 0x20) fail("Unescaped control character");
      if (c !== 0x5c) {
        out += text[i];
        i++;
        continue;
      }
      i++;
      const e = text[i];
      switch (e) {
        case '"':
        case "\\":
        case "/":
          out += e;
          break;
        case "b":
          out += "\b";
          break;
        case "f":
          out += "\f";
          break;
        case "n":
          out += "\n";
          break;
        case "r":
          out += "\r";
          break;
        case "t":
          out += "\t";
          break;
        case "u": {
          const hex = text.slice(i + 1, i + 5);
          if (!HEX4.test(hex)) fail("Invalid unicode escape");
          out += String.fromCharCode(Number.parseInt(hex, 16));
          i += 4;
          break;
        }
        default:
          fail("Invalid escape");
      }
      i++;
    }
  };

  const parseLiteral = <T>(word: string, value: T): T => {
    if (!text.startsWith(word, i)) fail("Invalid literal");
    i += word.length;
    return value;
  };

  const parseNumber = (): number => {
    NUMBER_PATTERN.lastIndex = i;
    const match = NUMBER_PATTERN.exec(text);
    if (!match) return fail("Invalid value");
    i += match[0].length;
    const n = Number(match[0]);
    if (!Number.isFinite(n)) fail("Number out of range");
    return n;
  };

  const parseValue = (depth: number): unknown => {
    if (depth > maxDepth) fail("Maximum nesting depth exceeded");
    skipWhitespace();
    switch (text[i]) {
      case "{":
        return parseObject(depth);
      case "[":
        return parseArray(depth);
      case '"':
        return parseString();
      case "t":
        return parseLiteral("true", true);
      case "f":
        return parseLiteral("false", false);
      case "n":
        return parseLiteral("null", null);
      default:
        return parseNumber();
    }
  };

  const parseObject = (depth: number): Record<string, unknown> => {
    i++;
    const out = Object.create(null) as Record<string, unknown>;
    const seen = new Set<string>();
    skipWhitespace();
    if (text[i] === "}") {
      i++;
      return out;
    }
    for (;;) {
      skipWhitespace();
      if (text[i] !== '"') fail("Expected member name");
      const key = parseString();
      if (seen.has(key)) {
        throw new LicenseTokenError("DUPLICATE_JSON_MEMBER", `Duplicate member "${key}"`);
      }
      seen.add(key);
      skipWhitespace();
      if (text[i] !== ":") fail("Expected ':'");
      i++;
      out[key] = parseValue(depth + 1);
      skipWhitespace();
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === "}") {
        i++;
        return out;
      }
      fail("Expected ',' or '}'");
    }
  };

  const parseArray = (depth: number): unknown[] => {
    i++;
    const out: unknown[] = [];
    skipWhitespace();
    if (text[i] === "]") {
      i++;
      return out;
    }
    for (;;) {
      out.push(parseValue(depth + 1));
      skipWhitespace();
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === "]") {
        i++;
        return out;
      }
      fail("Expected ',' or ']'");
    }
  };

  const result = parseValue(0);
  skipWhitespace();
  if (i !== text.length) fail("Trailing data");
  return result;
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
