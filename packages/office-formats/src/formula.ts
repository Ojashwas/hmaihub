import type { CellValue, FormulaErrorValue, WorkbookModel } from "./models.ts";

export const ERR = {
  div0: { error: "#DIV/0!" },
  value: { error: "#VALUE!" },
  ref: { error: "#REF!" },
  name: { error: "#NAME?" },
  num: { error: "#NUM!" },
  na: { error: "#N/A" },
  cycle: { error: "#CYCLE!" }
} as const satisfies Record<string, FormulaErrorValue>;

export const isError = (v: unknown): v is FormulaErrorValue => typeof v === "object" && v !== null && "error" in v;

// ---------- addresses ----------

export interface CellAddress {
  col: number;
  row: number;
}

export function columnName(col: number): string {
  let s = "";
  let n = col + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function parseAddress(ref: string): CellAddress | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(ref);
  if (!m) return null;
  let col = 0;
  for (const ch of (m[1] as string).toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  const row = Number(m[2]) - 1;
  if (row < 0 || col < 1 || col > 16_384 || row >= 1_048_576) return null;
  return { col: col - 1, row };
}

export const addressKey = (a: CellAddress) => `${columnName(a.col)}${a.row + 1}`;

// ---------- tokenizer ----------

type Token =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "ref"; sheet?: string; v: string }
  | { t: "func"; v: string }
  | { t: "op"; v: string }
  | { t: "("; v: "(" }
  | { t: ")"; v: ")" }
  | { t: ","; v: "," };

export class FormulaSyntaxError extends Error {}

const REF_RE = /^(?:('(?:[^']|'')+'|[A-Za-z_][\w.]*)!)?(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)/;

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    const c = src[i] as string;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(rest);
    if (num) {
      tokens.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = "";
      for (;;) {
        if (j >= src.length) throw new FormulaSyntaxError("Unterminated string");
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            s += '"';
            j += 2;
            continue;
          }
          break;
        }
        s += src[j];
        j++;
      }
      tokens.push({ t: "str", v: s });
      i = j + 1;
      continue;
    }
    const ref = REF_RE.exec(rest);
    if (ref && !/^[A-Za-z_]/.test(rest.slice(ref[0].length)) && rest[ref[0].length] !== "(") {
      const sheet = ref[1] ? ref[1].replace(/^'|'$/g, "").replace(/''/g, "'") : undefined;
      tokens.push(sheet === undefined ? { t: "ref", v: ref[2] as string } : { t: "ref", sheet, v: ref[2] as string });
      i += ref[0].length;
      continue;
    }
    const ident = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest);
    if (ident) {
      const word = ident[0].toUpperCase();
      i += ident[0].length;
      if (src[i] === "(") tokens.push({ t: "func", v: word });
      else if (word === "TRUE" || word === "FALSE") tokens.push({ t: "bool", v: word === "TRUE" });
      else throw new FormulaSyntaxError(`Unknown name ${ident[0]}`);
      continue;
    }
    const op = /^(<>|<=|>=|[-+*/^&=<>%])/.exec(rest);
    if (op) {
      tokens.push({ t: "op", v: op[0] });
      i += op[0].length;
      continue;
    }
    if (c === "(" || c === ")" || c === ",") {
      tokens.push({ t: c, v: c } as Token);
      i++;
      continue;
    }
    throw new FormulaSyntaxError(`Unexpected character ${c}`);
  }
  return tokens;
}

// ---------- parser ----------

export type Ast =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "ref"; sheet?: string; from: CellAddress; to?: CellAddress }
  | { k: "unary"; op: string; a: Ast }
  | { k: "percent"; a: Ast }
  | { k: "bin"; op: string; a: Ast; b: Ast }
  | { k: "call"; name: string; args: Ast[] };

const PRECEDENCE: Record<string, number> = {
  "=": 1,
  "<>": 1,
  "<": 1,
  ">": 1,
  "<=": 1,
  ">=": 1,
  "&": 2,
  "+": 3,
  "-": 3,
  "*": 4,
  "/": 4,
  "^": 5
};

export function parseFormula(src: string): Ast {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];

  const primary = (): Ast => {
    const tok = tokens[pos++];
    if (!tok) throw new FormulaSyntaxError("Unexpected end of formula");
    switch (tok.t) {
      case "num":
        return { k: "num", v: tok.v };
      case "str":
        return { k: "str", v: tok.v };
      case "bool":
        return { k: "bool", v: tok.v };
      case "ref": {
        const [a, b] = tok.v.split(":");
        const from = parseAddress(a as string);
        const to = b ? parseAddress(b) : undefined;
        if (!from || (b && !to)) throw new FormulaSyntaxError(`Invalid reference ${tok.v}`);
        const node: Ast = {
          k: "ref",
          from,
          ...(to ? { to } : {}),
          ...(tok.sheet !== undefined ? { sheet: tok.sheet } : {})
        };
        return node;
      }
      case "func": {
        if (tokens[pos++]?.t !== "(") throw new FormulaSyntaxError("Expected (");
        const args: Ast[] = [];
        if (peek()?.t !== ")") {
          for (;;) {
            args.push(expression(0));
            if (peek()?.t === ",") {
              pos++;
              continue;
            }
            break;
          }
        }
        if (tokens[pos++]?.t !== ")") throw new FormulaSyntaxError("Expected )");
        return { k: "call", name: tok.v, args };
      }
      case "(": {
        const e = expression(0);
        if (tokens[pos++]?.t !== ")") throw new FormulaSyntaxError("Expected )");
        return e;
      }
      case "op":
        if (tok.v === "-" || tok.v === "+") return { k: "unary", op: tok.v, a: unaryOperand() };
        throw new FormulaSyntaxError(`Unexpected operator ${tok.v}`);
      default:
        throw new FormulaSyntaxError(`Unexpected ${tok.v}`);
    }
  };

  // Unary minus binds tighter than ^ only for its own operand, matching common spreadsheet behaviour.
  const unaryOperand = (): Ast => postfix(primary());

  const postfix = (node: Ast): Ast => {
    let n = node;
    while (peek()?.t === "op" && peek()?.v === "%") {
      pos++;
      n = { k: "percent", a: n };
    }
    return n;
  };

  const expression = (minPrec: number): Ast => {
    let left = postfix(primary());
    for (;;) {
      const tok = peek();
      if (tok?.t !== "op") break;
      const prec = PRECEDENCE[tok.v];
      if (prec === undefined || prec < minPrec) break;
      pos++;
      const right = expression(prec + 1);
      left = { k: "bin", op: tok.v, a: left, b: right };
    }
    return left;
  };

  const ast = expression(0);
  if (pos !== tokens.length) throw new FormulaSyntaxError("Unexpected input after formula");
  return ast;
}

// ---------- evaluation ----------

type Scalar = CellValue;
type Value = Scalar | Scalar[][];

export interface EvalContext {
  sheet: string;
  getCell(sheet: string, key: string): Scalar;
}

const MAX_RANGE_CELLS = 1_000_000;

const toNumber = (v: Scalar): number | FormulaErrorValue => {
  if (isError(v)) return v;
  if (v === null || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v.trim());
  return v.trim() !== "" && Number.isFinite(n) ? n : ERR.value;
};

const toText = (v: Scalar): string | FormulaErrorValue => {
  if (isError(v)) return v;
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
};

const toBool = (v: Scalar): boolean | FormulaErrorValue => {
  if (isError(v)) return v;
  if (typeof v === "boolean") return v;
  if (v === null) return false;
  if (typeof v === "number") return v !== 0;
  const u = v.toUpperCase();
  return u === "TRUE" ? true : u === "FALSE" ? false : ERR.value;
};

const scalar = (v: Value): Scalar => (Array.isArray(v) ? (v[0]?.[0] ?? null) : v);
const flatten = (v: Value): Scalar[] => (Array.isArray(v) ? v.flat() : [v]);

function compare(a: Scalar, b: Scalar): number {
  const rank = (x: Scalar) => (typeof x === "number" || x === null ? 0 : typeof x === "string" ? 1 : 2);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === "string" && typeof b === "string") return a.toLowerCase().localeCompare(b.toLowerCase());
  const na = a === null ? 0 : Number(a);
  const nb = b === null ? 0 : Number(b);
  return na === nb ? 0 : na < nb ? -1 : 1;
}

function numbersIn(args: Value[], directCoerce: boolean): number[] | FormulaErrorValue {
  const out: number[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const v of arg.flat()) {
        if (isError(v)) return v;
        if (typeof v === "number") out.push(v);
      }
    } else {
      if (isError(arg)) return arg;
      if (arg === null) continue;
      if (typeof arg === "number" || directCoerce) {
        const n = toNumber(arg);
        if (isError(n)) return n;
        out.push(n);
      }
    }
  }
  return out;
}

type Fn = (args: Value[]) => Scalar;

const numFn =
  (f: (nums: number[]) => Scalar): Fn =>
  (args) => {
    const nums = numbersIn(args, true);
    return isError(nums) ? nums : f(nums);
  };

const textArg = (args: Value[], i: number): string | FormulaErrorValue => toText(scalar(args[i] ?? null));
const numArg = (args: Value[], i: number, fallback?: number): number | FormulaErrorValue =>
  args[i] === undefined && fallback !== undefined ? fallback : toNumber(scalar(args[i] ?? null));

export const FUNCTIONS: Record<string, Fn> = {
  SUM: numFn((n) => n.reduce((a, b) => a + b, 0)),
  AVERAGE: numFn((n) => (n.length ? n.reduce((a, b) => a + b, 0) / n.length : ERR.div0)),
  MIN: numFn((n) => (n.length ? Math.min(...n) : 0)),
  MAX: numFn((n) => (n.length ? Math.max(...n) : 0)),
  COUNT: (args) => args.flatMap(flatten).filter((v) => typeof v === "number").length,
  COUNTA: (args) => args.flatMap(flatten).filter((v) => v !== null && v !== "").length,
  ABS: (args) => {
    const n = numArg(args, 0);
    return isError(n) ? n : Math.abs(n);
  },
  ROUND: (args) => {
    const n = numArg(args, 0);
    const d = numArg(args, 1, 0);
    if (isError(n)) return n;
    if (isError(d)) return d;
    const f = 10 ** Math.trunc(d);
    return Math.sign(n) * (Math.round(Math.abs(n) * f + Number.EPSILON) / f);
  },
  IF: (args) => {
    if (args.length < 2 || args.length > 3) return ERR.value;
    const c = toBool(scalar(args[0] ?? null));
    if (isError(c)) return c;
    return c ? scalar(args[1] ?? null) : args.length === 3 ? scalar(args[2] ?? null) : false;
  },
  AND: (args) => {
    let result = true;
    for (const v of args.flatMap(flatten)) {
      if (v === null) continue;
      const b = toBool(v);
      if (isError(b)) return b;
      result = result && b;
    }
    return result;
  },
  OR: (args) => {
    let result = false;
    for (const v of args.flatMap(flatten)) {
      if (v === null) continue;
      const b = toBool(v);
      if (isError(b)) return b;
      result = result || b;
    }
    return result;
  },
  NOT: (args) => {
    const b = toBool(scalar(args[0] ?? null));
    return isError(b) ? b : !b;
  },
  CONCAT: (args) => {
    let s = "";
    for (const v of args.flatMap(flatten)) {
      const t = toText(v);
      if (isError(t)) return t;
      s += t;
    }
    return s;
  },
  LEN: (args) => {
    const t = textArg(args, 0);
    return isError(t) ? t : t.length;
  },
  UPPER: (args) => {
    const t = textArg(args, 0);
    return isError(t) ? t : t.toUpperCase();
  },
  LOWER: (args) => {
    const t = textArg(args, 0);
    return isError(t) ? t : t.toLowerCase();
  },
  LEFT: (args) => {
    const t = textArg(args, 0);
    const n = numArg(args, 1, 1);
    if (isError(t)) return t;
    if (isError(n)) return n;
    return n < 0 ? ERR.value : t.slice(0, Math.trunc(n));
  },
  RIGHT: (args) => {
    const t = textArg(args, 0);
    const n = numArg(args, 1, 1);
    if (isError(t)) return t;
    if (isError(n)) return n;
    return n < 0 ? ERR.value : Math.trunc(n) === 0 ? "" : t.slice(-Math.trunc(n));
  },
  MID: (args) => {
    const t = textArg(args, 0);
    const start = numArg(args, 1);
    const len = numArg(args, 2);
    if (isError(t)) return t;
    if (isError(start)) return start;
    if (isError(len)) return len;
    return start < 1 || len < 0 ? ERR.value : t.substr(Math.trunc(start) - 1, Math.trunc(len));
  }
};

function evaluate(ast: Ast, ctx: EvalContext): Value {
  switch (ast.k) {
    case "num":
      return ast.v;
    case "str":
      return ast.v;
    case "bool":
      return ast.v;
    case "ref": {
      const sheet = ast.sheet ?? ctx.sheet;
      if (!ast.to) return ctx.getCell(sheet, addressKey(ast.from));
      const r1 = Math.min(ast.from.row, ast.to.row);
      const r2 = Math.max(ast.from.row, ast.to.row);
      const c1 = Math.min(ast.from.col, ast.to.col);
      const c2 = Math.max(ast.from.col, ast.to.col);
      if ((r2 - r1 + 1) * (c2 - c1 + 1) > MAX_RANGE_CELLS) return ERR.ref;
      const rows: Scalar[][] = [];
      for (let r = r1; r <= r2; r++) {
        const row: Scalar[] = [];
        for (let c = c1; c <= c2; c++) row.push(ctx.getCell(sheet, addressKey({ col: c, row: r })));
        rows.push(row);
      }
      return rows;
    }
    case "unary": {
      const n = toNumber(scalar(evaluate(ast.a, ctx)));
      return isError(n) ? n : ast.op === "-" ? -n : n;
    }
    case "percent": {
      const n = toNumber(scalar(evaluate(ast.a, ctx)));
      return isError(n) ? n : n / 100;
    }
    case "bin": {
      const a = scalar(evaluate(ast.a, ctx));
      const b = scalar(evaluate(ast.b, ctx));
      if (isError(a)) return a;
      if (isError(b)) return b;
      if (ast.op === "&") return `${toText(a) as string}${toText(b) as string}`;
      if (["=", "<>", "<", ">", "<=", ">="].includes(ast.op)) {
        const c = compare(a, b);
        return { "=": c === 0, "<>": c !== 0, "<": c < 0, ">": c > 0, "<=": c <= 0, ">=": c >= 0 }[ast.op] as boolean;
      }
      const x = toNumber(a);
      const y = toNumber(b);
      if (isError(x)) return x;
      if (isError(y)) return y;
      switch (ast.op) {
        case "+":
          return x + y;
        case "-":
          return x - y;
        case "*":
          return x * y;
        case "/":
          return y === 0 ? ERR.div0 : x / y;
        default: {
          const r = x ** y;
          return Number.isFinite(r) ? r : ERR.num;
        }
      }
    }
    case "call": {
      const fn = FUNCTIONS[ast.name];
      if (!fn) return ERR.name;
      return fn(ast.args.map((a) => evaluate(a, ctx)));
    }
  }
}

export function evaluateFormula(src: string, ctx: EvalContext): Scalar {
  let ast: Ast;
  try {
    ast = parseFormula(src);
  } catch {
    return ERR.name;
  }
  const v = scalar(evaluate(ast, ctx));
  return typeof v === "number" && !Number.isFinite(v) ? ERR.num : v;
}

/** Literal entered by a user: numbers and booleans are recognised; everything else is text. */
export function parseLiteral(input: string): number | string | boolean {
  const t = input.trim();
  if (t !== "" && Number.isFinite(Number(t))) return Number(t);
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  return input;
}

/** Computes every cell of a workbook with memoisation and cycle detection. */
export function computeWorkbook(wb: WorkbookModel): Map<string, Map<string, CellValue>> {
  const results = new Map<string, Map<string, CellValue>>();
  const visiting = new Set<string>();
  const sheets = new Map(wb.sheets.map((s) => [s.name.toLowerCase(), s]));

  const getCell = (sheetName: string, key: string): CellValue => {
    const sheet = sheets.get(sheetName.toLowerCase());
    if (!sheet) return ERR.ref;
    let memo = results.get(sheet.name);
    if (!memo) results.set(sheet.name, (memo = new Map()));
    if (memo.has(key)) return memo.get(key) as CellValue;
    const cell = sheet.cells[key];
    if (!cell) return null;
    if (cell.f === undefined) {
      const v = cell.v ?? null;
      memo.set(key, v);
      return v;
    }
    const id = `${sheet.name}!${key}`;
    if (visiting.has(id)) return ERR.cycle;
    visiting.add(id);
    const v = evaluateFormula(cell.f, { sheet: sheet.name, getCell });
    visiting.delete(id);
    memo.set(key, v);
    return v;
  };

  for (const sheet of wb.sheets) for (const key of Object.keys(sheet.cells)) getCell(sheet.name, key);
  return results;
}

export function formatValue(v: CellValue): string {
  if (v === null) return "";
  if (isError(v)) return v.error;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)));
  return v;
}
