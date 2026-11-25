import { CalculatorCondition, CalculatorDefinition } from '../types';
import { convertUnitValue, UnitItem } from './unitConverter';

/**
 * Safe, zero-eval recursive-descent mathematical & conditional expression parser.
 * Never uses eval() or new Function().
 */

type TokenType =
  | 'number'
  | 'ident'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'eof';

interface Token {
  type: TokenType;
  value: string;
}

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
  SQRT2: Math.SQRT2,
  SQRT3: Math.sqrt(3),
  g: 9.80665,
  NaN: Number.NaN,
};

function factorialSafe(n: number): number {
  if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n || n > 170) return NaN;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: (x) => (x < 0 ? NaN : Math.sqrt(x)),
  cbrt: (x) => Math.cbrt(x),
  nthroot: (n, x) => {
    if (!Number.isFinite(n) || n === 0) return NaN;
    if (x < 0 && Math.abs(n % 2) === 1) return -Math.pow(-x, 1 / n);
    if (x < 0) return NaN;
    return Math.pow(x, 1 / n);
  },
  abs: (x) => Math.abs(x),
  sign: (x) => Math.sign(x),
  round: (x, p = 0) => {
    const f = Math.pow(10, p);
    return Math.round(x * f) / f;
  },
  ceil: (x) => Math.ceil(x),
  floor: (x) => Math.floor(x),
  sin: (x) => Math.sin(x),
  cos: (x) => Math.cos(x),
  tan: (x) => Math.tan(x),
  sind: (x) => Math.sin((x * Math.PI) / 180),
  cosd: (x) => Math.cos((x * Math.PI) / 180),
  tand: (x) => Math.tan((x * Math.PI) / 180),
  asin: (x) => Math.asin(x),
  acos: (x) => Math.acos(x),
  atan: (x) => Math.atan(x),
  asind: (x) => (Math.asin(x) * 180) / Math.PI,
  acosd: (x) => (Math.acos(x) * 180) / Math.PI,
  atand: (x) => (Math.atan(x) * 180) / Math.PI,
  atan2: (y, x) => Math.atan2(y, x),
  sinh: (x) => Math.sinh(x),
  cosh: (x) => Math.cosh(x),
  tanh: (x) => Math.tanh(x),
  asinh: (x) => Math.asinh(x),
  acosh: (x) => Math.acosh(x),
  atanh: (x) => Math.atanh(x),
  log: (x) => (x <= 0 ? NaN : Math.log10(x)),
  log10: (x) => (x <= 0 ? NaN : Math.log10(x)),
  log2: (x) => (x <= 0 ? NaN : Math.log2(x)),
  ln: (x) => (x <= 0 ? NaN : Math.log(x)),
  exp: (x) => Math.exp(x),
  pow: (x, y) => Math.pow(x, y),
  mod: (a, b) => (b === 0 ? NaN : a % b),
  fact: (n) => factorialSafe(n),
  npr: (n, r) => {
    if (n < 0 || r < 0 || r > n || Math.floor(n) !== n || Math.floor(r) !== r) return NaN;
    return factorialSafe(n) / factorialSafe(n - r);
  },
  ncr: (n, r) => {
    if (n < 0 || r < 0 || r > n || Math.floor(n) !== n || Math.floor(r) !== r) return NaN;
    return factorialSafe(n) / (factorialSafe(r) * factorialSafe(n - r));
  },
  deg2rad: (d) => (d * Math.PI) / 180,
  rad2deg: (r) => (r * 180) / Math.PI,
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
  if: (cond, a, b) => (cond !== 0 && !Number.isNaN(cond) ? a : b),
};

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = expr.length;

  while (i < len) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Two-char operators
    const two = expr.slice(i, i + 2);
    if (['>=', '<=', '==', '!=', '&&', '||', '**'].includes(two)) {
      tokens.push({ type: 'op', value: two === '**' ? '^' : two });
      i += 2;
      continue;
    }

    if ('+-*/%^<>!'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ',' });
      i++;
      continue;
    }

    // Number (including scientific notation)
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < len && /[0-9.]/.test(expr[i])) {
        numStr += expr[i++];
      }
      if (i < len && (expr[i] === 'e' || expr[i] === 'E')) {
        const next = expr[i + 1];
        if (next && /[0-9+-]/.test(next)) {
          numStr += expr[i++];
          if (expr[i] === '+' || expr[i] === '-') {
            numStr += expr[i++];
          }
          while (i < len && /[0-9]/.test(expr[i])) {
            numStr += expr[i++];
          }
        }
      }
      if (Number.isNaN(Number(numStr))) {
        throw new Error(`Invalid number literal: ${numStr}`);
      }
      tokens.push({ type: 'number', value: numStr });
      continue;
    }

    // Identifier
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < len && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i++];
      }
      tokens.push({ type: 'ident', value: id });
      continue;
    }

    throw new Error(`Unsupported character in expression: "${ch}"`);
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos = 0;
  private scope: Record<string, number>;

  constructor(tokens: Token[], scope: Record<string, number>) {
    this.tokens = tokens;
    this.scope = scope;
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: 'eof', value: '' };
  }

  private consume(): Token {
    const t = this.peek();
    this.pos++;
    return t;
  }

  parse(): number {
    const val = this.parseOr();
    if (this.peek().type !== 'eof') {
      throw new Error(`Unexpected token: "${this.peek().value}"`);
    }
    return val;
  }

  private parseOr(): number {
    let left = this.parseAnd();
    while (this.peek().type === 'op' && this.peek().value === '||') {
      this.consume();
      const right = this.parseAnd();
      left = left !== 0 || right !== 0 ? 1 : 0;
    }
    return left;
  }

  private parseAnd(): number {
    let left = this.parseEquality();
    while (this.peek().type === 'op' && this.peek().value === '&&') {
      this.consume();
      const right = this.parseEquality();
      left = left !== 0 && right !== 0 ? 1 : 0;
    }
    return left;
  }

  private parseEquality(): number {
    let left = this.parseComparison();
    while (
      this.peek().type === 'op' &&
      (this.peek().value === '==' || this.peek().value === '!=')
    ) {
      const op = this.consume().value;
      const right = this.parseComparison();
      left = op === '==' ? (left === right ? 1 : 0) : left !== right ? 1 : 0;
    }
    return left;
  }

  private parseComparison(): number {
    let left = this.parseAdditive();
    while (
      this.peek().type === 'op' &&
      ['>', '<', '>=', '<='].includes(this.peek().value)
    ) {
      const op = this.consume().value;
      const right = this.parseAdditive();
      if (op === '>') left = left > right ? 1 : 0;
      else if (op === '<') left = left < right ? 1 : 0;
      else if (op === '>=') left = left >= right ? 1 : 0;
      else if (op === '<=') left = left <= right ? 1 : 0;
    }
    return left;
  }

  private parseAdditive(): number {
    let left = this.parseMultiplicative();
    while (
      this.peek().type === 'op' &&
      (this.peek().value === '+' || this.peek().value === '-')
    ) {
      const op = this.consume().value;
      const right = this.parseMultiplicative();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private parseMultiplicative(): number {
    let left = this.parseUnary();
    while (
      this.peek().type === 'op' &&
      ['*', '/', '%'].includes(this.peek().value)
    ) {
      const op = this.consume().value;
      const right = this.parseUnary();
      if (op === '*') left = left * right;
      else if (op === '/') {
        if (right === 0) return NaN;
        left = left / right;
      } else {
        left = left % right;
      }
    }
    return left;
  }

  private parseUnary(): number {
    if (this.peek().type === 'op') {
      const op = this.peek().value;
      if (op === '+' || op === '-' || op === '!') {
        this.consume();
        const val = this.parseUnary();
        if (op === '-') return -val;
        if (op === '!') return val === 0 ? 1 : 0;
        return val;
      }
    }
    return this.parsePower();
  }

  private parsePower(): number {
    const base = this.parsePrimary();
    if (this.peek().type === 'op' && this.peek().value === '^') {
      this.consume();
      const exp = this.parseUnary();
      return Math.pow(base, exp);
    }
    return base;
  }

  private parsePrimary(): number {
    const tok = this.peek();

    if (tok.type === 'number') {
      this.consume();
      return Number(tok.value);
    }

    if (tok.type === 'lparen') {
      this.consume();
      const val = this.parseOr();
      if (this.peek().type !== 'rparen') {
        throw new Error('Missing closing parenthesis ")"');
      }
      this.consume();
      return val;
    }

    if (tok.type === 'ident') {
      this.consume();
      const name = tok.value;

      // Function call
      if (this.peek().type === 'lparen') {
        this.consume();
        const fn = FUNCTIONS[name];
        if (!fn) {
          throw new Error(`Unknown or disallowed function: "${name}"`);
        }
        const args: number[] = [];
        if (this.peek().type !== 'rparen') {
          args.push(this.parseOr());
          while (this.peek().type === 'comma') {
            this.consume();
            args.push(this.parseOr());
          }
        }
        if (this.peek().type !== 'rparen') {
          throw new Error(`Expected ")" after arguments to ${name}`);
        }
        this.consume();
        return fn(...args);
      }

      if (name in this.scope) {
        return this.scope[name];
      }
      if (name in CONSTANTS) {
        return CONSTANTS[name];
      }
      throw new Error(`Undefined variable: "${name}"`);
    }

    throw new Error(`Unexpected token: "${tok.value || 'end of expression'}"`);
  }
}

export function evaluateSafeExpression(
  expression: string,
  variables: Record<string, number>
): number {
  const tokens = tokenize(expression);
  const parser = new Parser(tokens, variables);
  return parser.parse();
}

export function validateExpressionSyntax(
  expression: string,
  allowedVariables: string[]
): { valid: boolean; error?: string } {
  try {
    const mockScope: Record<string, number> = {};
    for (const v of allowedVariables) {
      mockScope[v] = 1;
    }
    evaluateSafeExpression(expression, mockScope);
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Invalid expression',
    };
  }
}

export interface EvaluatedOutputItem {
  key: string;
  labelEn: string;
  labelBn: string;
  value: number;
  formatted: string;
  unit?: string;
  primary?: boolean;
}

export interface EvaluatedConditionAlert {
  id: string;
  severity: 'info' | 'warning' | 'error';
  messageEn: string;
  messageBn: string;
}

export interface CalculationExecutionResult {
  valid: boolean;
  validationErrors: string[];
  outputs: EvaluatedOutputItem[];
  triggeredConditions: EvaluatedConditionAlert[];
  normalizedScope: Record<string, number>;
}

export function formatCalculatedNumber(
  val: number,
  precision = 2,
  format: 'decimal' | 'scientific' | 'currency' | 'percentage' = 'decimal'
): string {
  if (!Number.isFinite(val)) return 'Undefined / Error';
  if (format === 'scientific') return val.toExponential(precision);
  if (format === 'percentage') return `${val.toFixed(precision)}%`;
  if (format === 'currency') {
    return val.toLocaleString('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  });
}

export function runDynamicCalculator(
  calculator: CalculatorDefinition,
  rawInputs: Record<string, number>,
  selectedUnits: Record<string, string> = {},
  extraUnits: UnitItem[] = []
): CalculationExecutionResult {
  const validationErrors: string[] = [];
  const scope: Record<string, number> = {};

  for (const field of calculator.inputs) {
    const rawVal = rawInputs[field.key];
    if (field.required && (rawVal === undefined || rawVal === null || Number.isNaN(rawVal))) {
      validationErrors.push(`${field.labelEn} (${field.key}) is required.`);
      continue;
    }
    const val = rawVal ?? field.defaultValue;
    if (!Number.isFinite(val)) {
      validationErrors.push(`${field.labelEn} must be a valid finite number.`);
      continue;
    }
    if (field.min !== undefined && val < field.min) {
      validationErrors.push(`${field.labelEn} must be ≥ ${field.min}.`);
    }
    if (field.max !== undefined && val > field.max) {
      validationErrors.push(`${field.labelEn} must be ≤ ${field.max}.`);
    }

    // Convert input unit into field.defaultUnit (the formula's expected unit)
    const chosenUnit = selectedUnits[field.key] || field.defaultUnit;
    if (field.unitDimension && field.defaultUnit && chosenUnit && chosenUnit !== field.defaultUnit) {
      scope[field.key] = convertUnitValue(
        val,
        chosenUnit,
        field.defaultUnit,
        field.unitDimension,
        extraUnits
      );
    } else {
      scope[field.key] = val;
    }
  }

  if (validationErrors.length > 0) {
    return {
      valid: false,
      validationErrors,
      outputs: [],
      triggeredConditions: [],
      normalizedScope: scope,
    };
  }

  const outputs: EvaluatedOutputItem[] = [];
  for (const out of calculator.outputs) {
    try {
      const value = evaluateSafeExpression(out.expression, scope);
      scope[out.key] = value; // Allow subsequent outputs/conditions to reference earlier output keys
      if (!Number.isFinite(value)) {
        validationErrors.push(`Calculation for "${out.labelEn}" resulted in an undefined or infinite value (check division by zero or domain limits).`);
      }
      outputs.push({
        key: out.key,
        labelEn: out.labelEn,
        labelBn: out.labelBn,
        value,
        formatted: formatCalculatedNumber(value, out.precision, out.format),
        unit: out.unit,
        primary: out.primary,
      });
    } catch (err) {
      validationErrors.push(
        `Formula error in ${out.labelEn}: ${err instanceof Error ? err.message : 'Evaluation failed'}`
      );
    }
  }

  const triggeredConditions: EvaluatedConditionAlert[] = [];
  for (const cond of calculator.conditions || []) {
    try {
      const matched = evaluateSafeExpression(cond.expression, scope);
      if (matched !== 0 && !Number.isNaN(matched)) {
        triggeredConditions.push({
          id: cond.id,
          severity: cond.severity,
          messageEn: cond.messageEn,
          messageBn: cond.messageBn,
        });
      }
    } catch {
      // Ignore invalid condition silently during run, surfaced in admin tester
    }
  }

  return {
    valid: validationErrors.length === 0,
    validationErrors,
    outputs,
    triggeredConditions,
    normalizedScope: scope,
  };
}
