import * as XLSX from 'xlsx';
import {
  SpreadsheetCellData,
  SpreadsheetConditionalRule,
  SpreadsheetNumberFormat,
  SpreadsheetWorkbookRecord,
  SpreadsheetWorksheet,
} from '../types';

/**
 * Zero-eval, dependency-aware Excel formula & spreadsheet engine for SUTRO SATHI.
 */

export function colIndexToLetter(index: number): string {
  let n = index;
  let result = '';
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export function colLetterToIndex(letters: string): number {
  const clean = letters.replace(/\$/g, '').toUpperCase();
  let col = 0;
  for (let i = 0; i < clean.length; i++) {
    col = col * 26 + (clean.charCodeAt(i) - 64);
  }
  return col - 1;
}

export function parseCellRef(ref: string): { row: number; col: number } | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(ref.trim());
  if (!m) return null;
  const col = colLetterToIndex(m[1]);
  const row = Number(m[2]) - 1;
  if (col < 0 || row < 0) return null;
  return { row, col };
}

export function formatCellKey(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`;
}

export function expandRangeKeys(rangeStr: string): string[] {
  const parts = rangeStr.split(':');
  if (parts.length !== 2) {
    const single = parseCellRef(rangeStr);
    return single ? [formatCellKey(single.row, single.col)] : [];
  }
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return [];
  const rMin = Math.min(start.row, end.row);
  const rMax = Math.max(start.row, end.row);
  const cMin = Math.min(start.col, end.col);
  const cMax = Math.max(start.col, end.col);
  const keys: string[] = [];
  for (let r = rMin; r <= rMax && keys.length < 5000; r++) {
    for (let c = cMin; c <= cMax && keys.length < 5000; c++) {
      keys.push(formatCellKey(r, c));
    }
  }
  return keys;
}

export function expandRangeMatrix(rangeStr: string): {
  rows: number;
  cols: number;
  keys: string[][];
} {
  const parts = rangeStr.split(':');
  const start = parseCellRef(parts[0]);
  const end = parts[1] ? parseCellRef(parts[1]) : start;
  if (!start || !end) return { rows: 0, cols: 0, keys: [] };
  const rMin = Math.min(start.row, end.row);
  const rMax = Math.max(start.row, end.row);
  const cMin = Math.min(start.col, end.col);
  const cMax = Math.max(start.col, end.col);
  const keys: string[][] = [];
  for (let r = rMin; r <= rMax; r++) {
    const rowKeys: string[] = [];
    for (let c = cMin; c <= cMax; c++) {
      rowKeys.push(formatCellKey(r, c));
    }
    keys.push(rowKeys);
  }
  return { rows: rMax - rMin + 1, cols: cMax - cMin + 1, keys };
}

export type CellScalar = string | number | boolean;

interface RangeValue {
  __range: true;
  sheetName: string;
  rangeStr: string;
  values: CellScalar[];
  matrix: CellScalar[][];
}

type ExprVal = CellScalar | RangeValue;

function isRangeValue(v: ExprVal): v is RangeValue {
  return typeof v === 'object' && v !== null && '__range' in v;
}

function toNum(v: ExprVal): number {
  if (isRangeValue(v)) {
    return toNum(v.values[0] ?? 0);
  }
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const trimmed = String(v).trim();
  if (!trimmed) return 0;
  if (trimmed.startsWith('#')) return Number.NaN;
  const cleaned = trimmed.replace(/[৳$€£,\s%]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : Number.NaN;
}

function toStr(v: ExprVal): string {
  if (isRangeValue(v)) return toStr(v.values[0] ?? '');
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v ?? '');
}

function toBool(v: ExprVal): boolean {
  if (isRangeValue(v)) return toBool(v.values[0] ?? false);
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toUpperCase();
  if (s === '' || s === 'FALSE' || s === '0') return false;
  return true;
}

function flattenArgs(args: ExprVal[]): CellScalar[] {
  const out: CellScalar[] = [];
  for (const a of args) {
    if (isRangeValue(a)) {
      out.push(...a.values);
    } else {
      out.push(a);
    }
  }
  return out;
}

function matchesCriteria(cellVal: CellScalar, criteriaRaw: CellScalar): boolean {
  const critStr = String(criteriaRaw ?? '').trim();
  const cellStr = String(cellVal ?? '').trim();

  const opMatch = /^(>=|<=|<>|!=|>|<|=)(.*)$/.exec(critStr);
  if (opMatch) {
    const op = opMatch[1];
    const rhsRaw = opMatch[2].trim();
    const lhsNum = Number(cellStr);
    const rhsNum = Number(rhsRaw);
    const bothNumeric = cellStr !== '' && rhsRaw !== '' && Number.isFinite(lhsNum) && Number.isFinite(rhsNum);
    if (op === '>') return bothNumeric ? lhsNum > rhsNum : cellStr > rhsRaw;
    if (op === '<') return bothNumeric ? lhsNum < rhsNum : cellStr < rhsRaw;
    if (op === '>=') return bothNumeric ? lhsNum >= rhsNum : cellStr >= rhsRaw;
    if (op === '<=') return bothNumeric ? lhsNum <= rhsNum : cellStr <= rhsRaw;
    if (op === '<>' || op === '!=') {
      return bothNumeric ? lhsNum !== rhsNum : cellStr.toLowerCase() !== rhsRaw.toLowerCase();
    }
    if (op === '=') {
      return bothNumeric ? lhsNum === rhsNum : cellStr.toLowerCase() === rhsRaw.toLowerCase();
    }
  }

  // Wildcard * / ? or exact match
  if (critStr.includes('*') || critStr.includes('?')) {
    const escaped = critStr
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`, 'i').test(cellStr);
  }

  const cNum = Number(cellStr);
  const kNum = Number(critStr);
  if (cellStr !== '' && critStr !== '' && Number.isFinite(cNum) && Number.isFinite(kNum)) {
    return cNum === kNum;
  }
  return cellStr.toLowerCase() === critStr.toLowerCase();
}

type TokenKind = 'num' | 'str' | 'bool' | 'ref' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma' | 'eof';

interface FToken {
  kind: TokenKind;
  value: string;
}

function tokenizeFormula(expr: string): FToken[] {
  const tokens: FToken[] = [];
  let i = 0;
  const n = expr.length;

  while (i < n) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // String literal
    if (ch === '"') {
      i++;
      let s = '';
      while (i < n) {
        if (expr[i] === '"' && expr[i + 1] === '"') {
          s += '"';
          i += 2;
        } else if (expr[i] === '"') {
          i++;
          break;
        } else {
          s += expr[i++];
        }
      }
      tokens.push({ kind: 'str', value: s });
      continue;
    }

    // Quoted sheet reference: 'Sheet 2'!A1 or 'Sheet 2'!A1:B10
    if (ch === "'") {
      let j = i + 1;
      let sheet = '';
      while (j < n && expr[j] !== "'") {
        sheet += expr[j++];
      }
      if (j < n && expr[j] === "'" && expr[j + 1] === '!') {
        j += 2;
        const restMatch = /^(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)/.exec(expr.slice(j));
        if (restMatch) {
          tokens.push({ kind: 'ref', value: `${sheet}!${restMatch[1]}` });
          i = j + restMatch[1].length;
          continue;
        }
      }
    }

    // Multi-char operators
    const two = expr.slice(i, i + 2);
    if (['>=', '<=', '<>', '!=', '=='].includes(two)) {
      tokens.push({ kind: 'op', value: two });
      i += 2;
      continue;
    }

    if ('+-*/^&=<>'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen', value: ')' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ kind: 'comma', value: ',' });
      i++;
      continue;
    }

    // Number
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < n && /[0-9]/.test(expr[i + 1]))) {
      let numStr = '';
      while (i < n && /[0-9.]/.test(expr[i])) {
        numStr += expr[i++];
      }
      if (i < n && (expr[i] === 'e' || expr[i] === 'E') && /[0-9+-]/.test(expr[i + 1] || '')) {
        numStr += expr[i++];
        if (expr[i] === '+' || expr[i] === '-') numStr += expr[i++];
        while (i < n && /[0-9]/.test(expr[i])) numStr += expr[i++];
      }
      tokens.push({ kind: 'num', value: numStr });
      continue;
    }

    // Unquoted sheet ref or cell ref or range: Sheet2!A1:B5 or A1:B5 or $A$1
    const refMatch = /^(?:([A-Za-z0-9_]+)!)?(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)(?![A-Za-z0-9_(])/.exec(
      expr.slice(i)
    );
    if (refMatch) {
      tokens.push({ kind: 'ref', value: refMatch[0] });
      i += refMatch[0].length;
      continue;
    }

    // Identifier / function name / TRUE / FALSE
    if (/[A-Za-z_]/.test(ch)) {
      let id = '';
      while (i < n && /[A-Za-z0-9_.]/.test(expr[i])) {
        id += expr[i++];
      }
      const upper = id.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ kind: 'bool', value: upper });
      } else {
        tokens.push({ kind: 'ident', value: upper });
      }
      continue;
    }

    throw new Error('#NAME?');
  }

  tokens.push({ kind: 'eof', value: '' });
  return tokens;
}

class FormulaEvaluator {
  private tokens: FToken[];
  private pos = 0;
  private resolveCell: (sheetName: string | null, cellKey: string) => CellScalar;
  private defaultSheet: string;

  constructor(
    tokens: FToken[],
    defaultSheet: string,
    resolveCell: (sheetName: string | null, cellKey: string) => CellScalar
  ) {
    this.tokens = tokens;
    this.defaultSheet = defaultSheet;
    this.resolveCell = resolveCell;
  }

  private peek(): FToken {
    return this.tokens[this.pos] || { kind: 'eof', value: '' };
  }

  private consume(): FToken {
    const t = this.peek();
    this.pos++;
    return t;
  }

  evaluate(): CellScalar {
    const val = this.parseComparison();
    if (this.peek().kind !== 'eof') {
      throw new Error('#VALUE!');
    }
    return isRangeValue(val) ? (val.values[0] ?? '') : val;
  }

  private parseComparison(): ExprVal {
    let left = this.parseConcat();
    while (
      this.peek().kind === 'op' &&
      ['=', '==', '<>', '!=', '>', '<', '>=', '<='].includes(this.peek().value)
    ) {
      const op = this.consume().value;
      const right = this.parseConcat();
      const l = isRangeValue(left) ? (left.values[0] ?? '') : left;
      const r = isRangeValue(right) ? (right.values[0] ?? '') : right;
      const ln = typeof l === 'number' ? l : Number(l);
      const rn = typeof r === 'number' ? r : Number(r);
      const numeric =
        l !== '' && r !== '' && typeof l !== 'boolean' && typeof r !== 'boolean' && Number.isFinite(ln) && Number.isFinite(rn);

      if (op === '=' || op === '==') {
        left = numeric ? ln === rn : String(l).toLowerCase() === String(r).toLowerCase();
      } else if (op === '<>' || op === '!=') {
        left = numeric ? ln !== rn : String(l).toLowerCase() !== String(r).toLowerCase();
      } else if (op === '>') {
        left = numeric ? ln > rn : String(l) > String(r);
      } else if (op === '<') {
        left = numeric ? ln < rn : String(l) < String(r);
      } else if (op === '>=') {
        left = numeric ? ln >= rn : String(l) >= String(r);
      } else if (op === '<=') {
        left = numeric ? ln <= rn : String(l) <= String(r);
      }
    }
    return left;
  }

  private parseConcat(): ExprVal {
    let left = this.parseAdditive();
    while (this.peek().kind === 'op' && this.peek().value === '&') {
      this.consume();
      const right = this.parseAdditive();
      left = `${toStr(left)}${toStr(right)}`;
    }
    return left;
  }

  private parseAdditive(): ExprVal {
    let left = this.parseMultiplicative();
    while (this.peek().kind === 'op' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.consume().value;
      const right = this.parseMultiplicative();
      const a = toNum(left);
      const b = toNum(right);
      if (Number.isNaN(a) || Number.isNaN(b)) return '#VALUE!';
      left = op === '+' ? a + b : a - b;
    }
    return left;
  }

  private parseMultiplicative(): ExprVal {
    let left = this.parseUnary();
    while (this.peek().kind === 'op' && (this.peek().value === '*' || this.peek().value === '/')) {
      const op = this.consume().value;
      const right = this.parseUnary();
      const a = toNum(left);
      const b = toNum(right);
      if (Number.isNaN(a) || Number.isNaN(b)) return '#VALUE!';
      if (op === '/') {
        if (b === 0) return '#DIV/0!';
        left = a / b;
      } else {
        left = a * b;
      }
    }
    return left;
  }

  private parseUnary(): ExprVal {
    if (this.peek().kind === 'op' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.consume().value;
      const val = this.parseUnary();
      const num = toNum(val);
      if (Number.isNaN(num)) return '#VALUE!';
      return op === '-' ? -num : num;
    }
    return this.parsePower();
  }

  private parsePower(): ExprVal {
    const base = this.parsePrimary();
    if (this.peek().kind === 'op' && this.peek().value === '^') {
      this.consume();
      const exp = this.parseUnary();
      const a = toNum(base);
      const b = toNum(exp);
      if (Number.isNaN(a) || Number.isNaN(b)) return '#VALUE!';
      return Math.pow(a, b);
    }
    return base;
  }

  private parsePrimary(): ExprVal {
    const tok = this.peek();

    if (tok.kind === 'num') {
      this.consume();
      return Number(tok.value);
    }
    if (tok.kind === 'str') {
      this.consume();
      return tok.value;
    }
    if (tok.kind === 'bool') {
      this.consume();
      return tok.value === 'TRUE';
    }
    if (tok.kind === 'lparen') {
      this.consume();
      const val = this.parseComparison();
      if (this.peek().kind !== 'rparen') throw new Error('#VALUE!');
      this.consume();
      return val;
    }
    if (tok.kind === 'ref') {
      this.consume();
      return this.resolveReferenceToken(tok.value);
    }
    if (tok.kind === 'ident') {
      this.consume();
      const fnName = tok.value;
      if (this.peek().kind !== 'lparen') {
        throw new Error('#NAME?');
      }
      this.consume();
      const args: ExprVal[] = [];
      if (this.peek().kind !== 'rparen') {
        args.push(this.parseComparison());
        while (this.peek().kind === 'comma') {
          this.consume();
          args.push(this.parseComparison());
        }
      }
      if (this.peek().kind !== 'rparen') throw new Error('#VALUE!');
      this.consume();
      return this.callFunction(fnName, args);
    }

    throw new Error('#VALUE!');
  }

  private resolveReferenceToken(raw: string): ExprVal {
    let sheetName: string | null = null;
    let addr = raw;
    const bangIdx = raw.indexOf('!');
    if (bangIdx !== -1) {
      sheetName = raw.slice(0, bangIdx);
      addr = raw.slice(bangIdx + 1);
    }

    if (addr.includes(':')) {
      const mat = expandRangeMatrix(addr);
      if (mat.rows === 0 || mat.cols === 0) return '#REF!';
      const values: CellScalar[] = [];
      const matrix: CellScalar[][] = [];
      for (const rowKeys of mat.keys) {
        const rowVals: CellScalar[] = [];
        for (const k of rowKeys) {
          const v = this.resolveCell(sheetName, k);
          values.push(v);
          rowVals.push(v);
        }
        matrix.push(rowVals);
      }
      return {
        __range: true,
        sheetName: sheetName || this.defaultSheet,
        rangeStr: addr,
        values,
        matrix,
      };
    }

    const parsed = parseCellRef(addr);
    if (!parsed) return '#REF!';
    return this.resolveCell(sheetName, formatCellKey(parsed.row, parsed.col));
  }

  private callFunction(name: string, args: ExprVal[]): ExprVal {
    const numsFromArgs = (list: ExprVal[]) =>
      flattenArgs(list)
        .filter((v) => v !== '' && typeof v !== 'boolean')
        .map((v) => (typeof v === 'number' ? v : Number(String(v).replace(/[,\s]/g, ''))))
        .filter((n) => Number.isFinite(n));

    switch (name) {
      case 'SUM': {
        return numsFromArgs(args).reduce((a, b) => a + b, 0);
      }
      case 'AVERAGE':
      case 'AVG': {
        const nums = numsFromArgs(args);
        if (nums.length === 0) return '#DIV/0!';
        return nums.reduce((a, b) => a + b, 0) / nums.length;
      }
      case 'MAX': {
        const nums = numsFromArgs(args);
        return nums.length === 0 ? 0 : Math.max(...nums);
      }
      case 'MIN': {
        const nums = numsFromArgs(args);
        return nums.length === 0 ? 0 : Math.min(...nums);
      }
      case 'COUNT': {
        return numsFromArgs(args).length;
      }
      case 'COUNTA': {
        return flattenArgs(args).filter((v) => String(v ?? '').trim() !== '').length;
      }
      case 'IF': {
        const cond = toBool(args[0] ?? false);
        return cond ? (args[1] ?? true) : (args[2] ?? false);
      }
      case 'IFS': {
        for (let i = 0; i + 1 < args.length; i += 2) {
          if (toBool(args[i])) return args[i + 1];
        }
        return '#N/A';
      }
      case 'AND': {
        return flattenArgs(args).every((v) => toBool(v));
      }
      case 'OR': {
        return flattenArgs(args).some((v) => toBool(v));
      }
      case 'NOT': {
        return !toBool(args[0] ?? false);
      }
      case 'COUNTIF': {
        if (args.length < 2) return '#VALUE!';
        const rangeVals = isRangeValue(args[0]) ? args[0].values : [toStr(args[0])];
        const crit = isRangeValue(args[1]) ? (args[1].values[0] ?? '') : args[1];
        return rangeVals.filter((v) => matchesCriteria(v, crit)).length;
      }
      case 'COUNTIFS': {
        if (args.length < 2 || args.length % 2 !== 0) return '#VALUE!';
        const firstRange = isRangeValue(args[0]) ? args[0].values : [toStr(args[0])];
        let count = 0;
        for (let i = 0; i < firstRange.length; i++) {
          let ok = true;
          for (let p = 0; p < args.length; p += 2) {
            const rangeArg = args[p];
            const critArg = args[p + 1];
            const r = isRangeValue(rangeArg) ? rangeArg.values : [toStr(rangeArg)];
            const c = isRangeValue(critArg) ? (critArg.values[0] ?? '') : critArg;
            if (!matchesCriteria(r[i] ?? '', c)) {
              ok = false;
              break;
            }
          }
          if (ok) count++;
        }
        return count;
      }
      case 'SUMIF': {
        if (args.length < 2) return '#VALUE!';
        const rangeVals = isRangeValue(args[0]) ? args[0].values : [toStr(args[0])];
        const crit = isRangeValue(args[1]) ? (args[1].values[0] ?? '') : args[1];
        const sumVals = args[2] && isRangeValue(args[2]) ? args[2].values : rangeVals;
        let total = 0;
        for (let i = 0; i < rangeVals.length; i++) {
          if (matchesCriteria(rangeVals[i], crit)) {
            const n = toNum(sumVals[i] ?? 0);
            if (Number.isFinite(n)) total += n;
          }
        }
        return total;
      }
      case 'SUMIFS': {
        if (args.length < 3 || (args.length - 1) % 2 !== 0) return '#VALUE!';
        const sumVals = isRangeValue(args[0]) ? args[0].values : [toNum(args[0])];
        let total = 0;
        for (let i = 0; i < sumVals.length; i++) {
          let ok = true;
          for (let p = 1; p < args.length; p += 2) {
            const rangeArg = args[p];
            const critArg = args[p + 1];
            const r = isRangeValue(rangeArg) ? rangeArg.values : [toStr(rangeArg)];
            const c = isRangeValue(critArg) ? (critArg.values[0] ?? '') : critArg;
            if (!matchesCriteria(r[i] ?? '', c)) {
              ok = false;
              break;
            }
          }
          if (ok) {
            const n = toNum(sumVals[i] ?? 0);
            if (Number.isFinite(n)) total += n;
          }
        }
        return total;
      }
      case 'ROUND': {
        const val = toNum(args[0] ?? 0);
        const digits = Math.trunc(toNum(args[1] ?? 0));
        if (Number.isNaN(val) || Number.isNaN(digits)) return '#VALUE!';
        const f = Math.pow(10, digits);
        return Math.round(val * f) / f;
      }
      case 'ROUNDUP': {
        const val = toNum(args[0] ?? 0);
        const digits = Math.trunc(toNum(args[1] ?? 0));
        if (Number.isNaN(val)) return '#VALUE!';
        const f = Math.pow(10, digits);
        return (val >= 0 ? Math.ceil(val * f) : Math.floor(val * f)) / f;
      }
      case 'ROUNDDOWN': {
        const val = toNum(args[0] ?? 0);
        const digits = Math.trunc(toNum(args[1] ?? 0));
        if (Number.isNaN(val)) return '#VALUE!';
        const f = Math.pow(10, digits);
        return Math.trunc(val * f) / f;
      }
      case 'ABS': {
        const val = toNum(args[0] ?? 0);
        return Number.isNaN(val) ? '#VALUE!' : Math.abs(val);
      }
      case 'SQRT': {
        const val = toNum(args[0] ?? 0);
        if (Number.isNaN(val) || val < 0) return '#NUM!';
        return Math.sqrt(val);
      }
      case 'POWER': {
        const b = toNum(args[0] ?? 0);
        const e = toNum(args[1] ?? 1);
        return Number.isNaN(b) || Number.isNaN(e) ? '#VALUE!' : Math.pow(b, e);
      }
      case 'MOD': {
        const n = toNum(args[0] ?? 0);
        const d = toNum(args[1] ?? 1);
        if (Number.isNaN(n) || Number.isNaN(d) || d === 0) return '#DIV/0!';
        return ((n % d) + d) % d;
      }
      case 'CONCAT':
      case 'CONCATENATE': {
        return flattenArgs(args).map((v) => String(v ?? '')).join('');
      }
      case 'UPPER':
        return toStr(args[0] ?? '').toUpperCase();
      case 'LOWER':
        return toStr(args[0] ?? '').toLowerCase();
      case 'TRIM':
        return toStr(args[0] ?? '').trim();
      case 'LEN':
        return toStr(args[0] ?? '').length;
      case 'TEXT': {
        const val = args[0] ?? '';
        const fmt = toStr(args[1] ?? '');
        const n = toNum(val);
        if (Number.isFinite(n)) {
          if (fmt.includes('%')) return `${(n * 100).toFixed(2)}%`;
          const dotIdx = fmt.indexOf('.');
          if (dotIdx !== -1) {
            const dec = fmt.length - dotIdx - 1;
            return n.toFixed(Math.max(0, Math.min(6, dec)));
          }
          return n.toLocaleString('en-US');
        }
        return toStr(val);
      }
      case 'TODAY':
        return new Date().toISOString().slice(0, 10);
      case 'NOW':
        return new Date().toISOString().replace('T', ' ').slice(0, 16);
      case 'DATE': {
        const y = Math.trunc(toNum(args[0] ?? 2026));
        const m = Math.trunc(toNum(args[1] ?? 1));
        const d = Math.trunc(toNum(args[2] ?? 1));
        const dt = new Date(Date.UTC(y, m - 1, d));
        return Number.isNaN(dt.getTime()) ? '#VALUE!' : dt.toISOString().slice(0, 10);
      }
      case 'YEAR': {
        const dt = new Date(toStr(args[0] ?? ''));
        return Number.isNaN(dt.getTime()) ? '#VALUE!' : dt.getFullYear();
      }
      case 'MONTH': {
        const dt = new Date(toStr(args[0] ?? ''));
        return Number.isNaN(dt.getTime()) ? '#VALUE!' : dt.getMonth() + 1;
      }
      case 'DAY': {
        const dt = new Date(toStr(args[0] ?? ''));
        return Number.isNaN(dt.getTime()) ? '#VALUE!' : dt.getDate();
      }
      case 'VLOOKUP': {
        if (args.length < 3 || !isRangeValue(args[1])) return '#VALUE!';
        const needle = toStr(args[0]).toLowerCase();
        const mat = args[1].matrix;
        const colIdx = Math.trunc(toNum(args[2])) - 1;
        const exact = args[3] !== undefined ? !toBool(args[3]) : false;
        if (colIdx < 0 || mat.length === 0 || colIdx >= mat[0].length) return '#REF!';
        for (const row of mat) {
          const cellS = String(row[0] ?? '').toLowerCase();
          if (cellS === needle) {
            return row[colIdx] ?? '';
          }
        }
        if (!exact) {
          const needleNum = Number(needle);
          if (Number.isFinite(needleNum)) {
            let bestRow: CellScalar[] | null = null;
            for (const row of mat) {
              const v = Number(row[0]);
              if (Number.isFinite(v) && v <= needleNum) bestRow = row;
            }
            if (bestRow) return bestRow[colIdx] ?? '';
          }
        }
        return '#N/A';
      }
      case 'XLOOKUP': {
        if (args.length < 3 || !isRangeValue(args[1]) || !isRangeValue(args[2])) return '#VALUE!';
        const needle = toStr(args[0]).toLowerCase();
        const lookupVals = args[1].values;
        const returnVals = args[2].values;
        const notFound = args[3] !== undefined && !isRangeValue(args[3]) ? args[3] : '#N/A';
        const idx = lookupVals.findIndex((v) => String(v ?? '').toLowerCase() === needle);
        return idx === -1 ? notFound : (returnVals[idx] ?? '');
      }
      case 'MATCH': {
        if (args.length < 2 || !isRangeValue(args[1])) return '#VALUE!';
        const needle = toStr(args[0]).toLowerCase();
        const arr = args[1].values;
        const idx = arr.findIndex((v) => String(v ?? '').toLowerCase() === needle);
        return idx === -1 ? '#N/A' : idx + 1;
      }
      case 'INDEX': {
        if (args.length < 2 || !isRangeValue(args[0])) return '#VALUE!';
        const mat = args[0].matrix;
        const r = Math.trunc(toNum(args[1])) - 1;
        const c = args[2] !== undefined ? Math.trunc(toNum(args[2])) - 1 : 0;
        if (r < 0 || r >= mat.length || c < 0 || c >= (mat[r]?.length || 0)) return '#REF!';
        return mat[r][c] ?? '';
      }
      case 'IFERROR': {
        const val = args[0] ?? '';
        const s = toStr(val);
        if (s.startsWith('#')) return args[1] ?? '';
        return val;
      }
      default:
        return '#NAME?';
    }
  }
}

export interface EvaluatedSheetResult {
  values: Record<string, CellScalar>;
  formatted: Record<string, string>;
}

export function formatSpreadsheetValue(
  val: CellScalar,
  format: SpreadsheetNumberFormat = 'general',
  currencySymbol = '৳'
): string {
  if (typeof val === 'string' && val.startsWith('#')) return val;
  if (val === '' || val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';

  const n = typeof val === 'number' ? val : Number(val);
  const isNum = typeof val === 'number' || (String(val).trim() !== '' && Number.isFinite(n));

  if (!isNum) return String(val);
  if (format === 'percentage') return `${(n * 100).toFixed(2)}%`;
  if (format === 'currency') {
    return `${currencySymbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (format === 'number') {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (format === 'date') {
    const dt = new Date(val);
    return Number.isNaN(dt.getTime()) ? String(val) : dt.toISOString().slice(0, 10);
  }
  return Number.isInteger(n) ? String(n) : Number(n.toFixed(4)).toString();
}

export function evaluateWorkbook(sheets: SpreadsheetWorksheet[]): Record<string, EvaluatedSheetResult> {
  const sheetByName = new Map<string, SpreadsheetWorksheet>();
  for (const s of sheets) {
    sheetByName.set(s.name.toLowerCase(), s);
  }

  const cache = new Map<string, CellScalar>();
  const visiting = new Set<string>();

  const getCellRawValue = (sheet: SpreadsheetWorksheet, key: string): CellScalar => {
    const cacheKey = `${sheet.id}::${key}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;
    if (visiting.has(cacheKey)) return '#CYCLE!';

    const cell = sheet.cells[key];
    if (!cell || cell.raw === undefined || cell.raw === '') {
      cache.set(cacheKey, '');
      return '';
    }

    const raw = String(cell.raw);
    if (!raw.startsWith('=')) {
      const trimmed = raw.trim();
      const num = Number(trimmed);
      const scalar: CellScalar =
        trimmed !== '' && !trimmed.startsWith('0') && Number.isFinite(num)
          ? num
          : trimmed === '0'
            ? 0
            : raw;
      cache.set(cacheKey, scalar);
      return scalar;
    }

    visiting.add(cacheKey);
    let evaluated: CellScalar = '';
    try {
      const expr = raw.slice(1).trim();
      const tokens = tokenizeFormula(expr);
      const evaluator = new FormulaEvaluator(tokens, sheet.name, (targetSheetName, targetKey) => {
        const targetSheet = targetSheetName
          ? sheetByName.get(targetSheetName.toLowerCase())
          : sheet;
        if (!targetSheet) return '#REF!';
        return getCellRawValue(targetSheet, targetKey);
      });
      evaluated = evaluator.evaluate();
    } catch (err) {
      evaluated = err instanceof Error && err.message.startsWith('#') ? err.message : '#ERROR!';
    } finally {
      visiting.delete(cacheKey);
    }

    cache.set(cacheKey, evaluated);
    return evaluated;
  };

  const results: Record<string, EvaluatedSheetResult> = {};
  for (const sheet of sheets) {
    const values: Record<string, CellScalar> = {};
    const formatted: Record<string, string> = {};
    for (const key of Object.keys(sheet.cells)) {
      const val = getCellRawValue(sheet, key);
      values[key] = val;
      const st = sheet.cells[key]?.style;
      formatted[key] = formatSpreadsheetValue(val, st?.numberFormat || 'general', st?.currencySymbol || '৳');
    }
    results[sheet.id] = { values, formatted };
  }

  return results;
}

export function evaluateConditionalStyle(
  key: string,
  val: CellScalar,
  rules: SpreadsheetConditionalRule[] = []
): { bgColor?: string; fontColor?: string } | null {
  for (const rule of rules) {
    const keys = expandRangeKeys(rule.range);
    if (!keys.includes(key)) continue;
    const valStr = String(val ?? '');
    const valNum = Number(val);
    const targetNum = Number(rule.value);
    const bothNum = valStr.trim() !== '' && rule.value.trim() !== '' && Number.isFinite(valNum) && Number.isFinite(targetNum);

    let match = false;
    if (rule.operator === 'gt') match = bothNum && valNum > targetNum;
    else if (rule.operator === 'lt') match = bothNum && valNum < targetNum;
    else if (rule.operator === 'gte') match = bothNum && valNum >= targetNum;
    else if (rule.operator === 'lte') match = bothNum && valNum <= targetNum;
    else if (rule.operator === 'eq') {
      match = bothNum ? valNum === targetNum : valStr.toLowerCase() === rule.value.toLowerCase();
    } else if (rule.operator === 'contains') {
      match = valStr.toLowerCase().includes(rule.value.toLowerCase());
    }
    if (match) return { bgColor: rule.bgColor, fontColor: rule.fontColor };
  }
  return null;
}

export function exportWorkbookToXlsx(workbook: SpreadsheetWorkbookRecord, evalResults: Record<string, EvaluatedSheetResult>) {
  const wb = XLSX.utils.book_new();
  for (const sheet of workbook.sheets) {
    const aoa: (string | number | boolean)[][] = [];
    for (let r = 0; r < sheet.rowCount; r++) {
      const rowArr: (string | number | boolean)[] = [];
      for (let c = 0; c < sheet.colCount; c++) {
        const k = formatCellKey(r, c);
        const val = evalResults[sheet.id]?.values[k];
        rowArr.push(val !== undefined ? val : '');
      }
      aoa.push(rowArr);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Attach raw Excel formulas where present
    for (const [k, cell] of Object.entries(sheet.cells)) {
      if (cell.raw?.startsWith('=') && ws[k]) {
        ws[k].f = cell.raw.slice(1);
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31) || 'Sheet');
  }
  const safeName = workbook.title.replace(/[^a-zA-Z0-9_\-\u0980-\u09FF ]+/g, '_') || 'sutro_sheet';
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}

export function exportSheetToCsv(sheet: SpreadsheetWorksheet, evalResult: EvaluatedSheetResult, fileTitle: string) {
  const lines: string[] = [];
  for (let r = 0; r < sheet.rowCount; r++) {
    const cols: string[] = [];
    let hasContent = false;
    for (let c = 0; c < sheet.colCount; c++) {
      const k = formatCellKey(r, c);
      const v = evalResult.formatted[k] ?? '';
      if (v !== '') hasContent = true;
      const escaped = `"${String(v).replace(/"/g, '""')}"`;
      cols.push(escaped);
    }
    if (hasContent || r < 5) lines.push(cols.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileTitle.replace(/\s+/g, '_')}_${sheet.name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importXlsxOrCsvFile(file: File): Promise<SpreadsheetWorksheet[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheets: SpreadsheetWorksheet[] = wb.SheetNames.slice(0, 12).map((name, idx) => {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, { header: 1, defval: '' });
    const cells: Record<string, SpreadsheetCellData> = {};
    const maxRows = Math.max(25, Math.min(120, aoa.length + 5));
    let maxCols = 12;
    aoa.forEach((row, rIdx) => {
      if (row.length > maxCols) maxCols = Math.min(26, row.length + 2);
      row.forEach((val, cIdx) => {
        if (val !== '' && val !== null && val !== undefined) {
          const key = formatCellKey(rIdx, cIdx);
          const rawCell = ws[key];
          cells[key] = {
            raw: rawCell?.f ? `=${rawCell.f}` : String(val),
            style: rIdx === 0 ? { bold: true, bgColor: '#eff6ff', border: true } : { border: true },
          };
        }
      });
    });
    return {
      id: `sheet-imp-${Date.now()}-${idx}`,
      name: name.slice(0, 28) || `Sheet ${idx + 1}`,
      rowCount: maxRows,
      colCount: maxCols,
      freezeRows: 1,
      freezeCols: 0,
      cells,
      merges: [],
      conditionalRules: [],
      charts: [],
    };
  });
  return sheets;
}

export function createBlankWorksheet(id: string, name: string, rows = 30, cols = 12): SpreadsheetWorksheet {
  return {
    id,
    name,
    rowCount: rows,
    colCount: cols,
    freezeRows: 1,
    freezeCols: 0,
    cells: {},
    merges: [],
    conditionalRules: [],
    charts: [],
  };
}
