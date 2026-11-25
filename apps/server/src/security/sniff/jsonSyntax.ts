/**
 * jsonSyntax — tells, piece by piece, whether a text is one JSON value that `JSON.parse` would accept, and builds
 * nothing from it.
 *
 * Why: SEC-002 accepts a `.json` content file only when it is valid JSON. `JSON.parse` needs the whole text at once
 *      and builds the whole value (many times the file's size in memory, for a file of up to 50 MB), and it keeps
 *      the request thread busy until it is done (D-143). The rule needs only the answer yes or no, which a state
 *      machine gives from one piece of the text at a time.
 * Spec: SEC-002
 * Invariants:
 *   - The answer is exactly that of `JSON.parse` (RFC 8259: the four whitespace characters, no control character
 *     in a string, no leading zero, any value at the top). A test compares the two on generated texts.
 *   - Memory: one bit for each bracket that is still open; nothing else grows with the text.
 *   - A piece may end anywhere, also inside a string, a number or an escape.
 * Collaborators: ./jsonFileCheck.ts (feeds it a file).
 * Tests: apps/server/test/security/sniff/jsonSyntax.test.ts
 */

const VALUE = 0;
const ARRAY_START = 1;
const OBJECT_START = 2;
const KEY = 3;
const COLON = 4;
const AFTER_VALUE = 5;
const STRING = 6;
const ESCAPE = 7;
const HEX = 8;
const LITERAL = 9;
const MINUS = 10;
const ZERO = 11;
const INT = 12;
const DOT = 13;
const FRACTION = 14;
const EXPONENT = 15;
const EXPONENT_SIGN = 16;
const EXPONENT_DIGITS = 17;
const FAILED = 18;

/** The number states in which the number read so far is complete. */
const NUMBER_ENDS = new Set([ZERO, INT, FRACTION, EXPONENT_DIGITS]);
const LITERALS: Readonly<Record<string, string>> = { t: 'rue', f: 'alse', n: 'ull' };

const isBlank = (c: number): boolean => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09;
const isDigit = (c: number): boolean => c >= 0x30 && c <= 0x39;
const isHex = (c: number): boolean => isDigit(c) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);
const isExponentMark = (c: number): boolean => c === 0x65 || c === 0x45;

/** Reads JSON text piece by piece and tells whether it is one complete JSON value. */
export class JsonSyntax {
  private state = VALUE;
  /** One bit for each open bracket, 1 for `{` and 0 for `[`. */
  private kinds = new Uint8Array(64);
  private depth = 0;
  private stringIsKey = false;
  private hexLeft = 0;
  private literalRest = '';
  private literalAt = 0;

  /**
   * Reads the next piece of the text.
   * @param text - The piece; a piece may end anywhere, also inside a string or a number.
   * @returns False when the text read so far cannot be the start of a JSON value.
   */
  push(text: string): boolean {
    for (let i = 0; i < text.length && this.state !== FAILED; i += 1) {
      const c = text.charCodeAt(i);
      if (this.state === STRING) this.inString(c);
      else if (this.state >= MINUS) i -= this.inNumber(c);
      else this.betweenTokens(c, text[i] ?? '');
    }
    return this.state !== FAILED;
  }

  /**
   * Tells whether the text read so far is complete.
   * @returns True when it is exactly one JSON value, with only whitespace around it.
   */
  end(): boolean {
    return this.depth === 0 && (this.state === AFTER_VALUE || NUMBER_ENDS.has(this.state));
  }

  private inString(c: number): void {
    if (c === 0x22) this.state = this.stringIsKey ? COLON : AFTER_VALUE;
    else if (c === 0x5c) this.state = ESCAPE;
    else if (c < 0x20) this.state = FAILED;
  }

  /** Reads one character of a number; returns 1 when the number ended before it, so it must be read again. */
  private inNumber(c: number): number {
    const s = this.state;
    let next = FAILED;
    if (isDigit(c)) {
      if (s === MINUS) next = c === 0x30 ? ZERO : INT;
      else if (s === DOT || s === FRACTION) next = FRACTION;
      else if (s === EXPONENT || s === EXPONENT_SIGN || s === EXPONENT_DIGITS) next = EXPONENT_DIGITS;
      else if (s === INT) next = INT;
    } else if (c === 0x2e && (s === ZERO || s === INT)) next = DOT;
    else if (isExponentMark(c) && (s === ZERO || s === INT || s === FRACTION)) next = EXPONENT;
    else if ((c === 0x2b || c === 0x2d) && s === EXPONENT) next = EXPONENT_SIGN;
    // WHY: a number has no closing character; a complete one ends at the first character that is not part of it.
    if (next === FAILED && NUMBER_ENDS.has(s)) {
      this.state = AFTER_VALUE;
      return 1;
    }
    this.state = next;
    return 0;
  }

  private betweenTokens(c: number, char: string): void {
    const s = this.state;
    if (s === ESCAPE) this.afterBackslash(c, char);
    else if (s === HEX) this.state = !isHex(c) ? FAILED : (this.hexLeft -= 1) === 0 ? STRING : HEX;
    else if (s === LITERAL) this.inLiteral(char);
    else if (isBlank(c)) return;
    else if (s === AFTER_VALUE) this.afterValue(c);
    else if (s === COLON) this.state = c === 0x3a ? VALUE : FAILED;
    else if (s === KEY || s === OBJECT_START) this.keyOrEnd(c, s === OBJECT_START);
    else if (s === ARRAY_START && c === 0x5d) this.close();
    else this.valueStart(c, char);
  }

  private afterBackslash(c: number, char: string): void {
    this.hexLeft = 4;
    this.state = c === 0x75 ? HEX : '"\\/bfnrt'.includes(char) ? STRING : FAILED;
  }

  private inLiteral(char: string): void {
    if (char !== this.literalRest[this.literalAt]) this.state = FAILED;
    else if ((this.literalAt += 1) === this.literalRest.length) this.state = AFTER_VALUE;
  }

  private keyOrEnd(c: number, mayEnd: boolean): void {
    if (c === 0x22) this.openString(true);
    else if (c === 0x7d && mayEnd) this.close();
    else this.state = FAILED;
  }

  private afterValue(c: number): void {
    const inObject = this.depth > 0 && this.topIsObject();
    if (this.depth === 0) this.state = FAILED;
    else if (c === 0x2c) this.state = inObject ? KEY : VALUE;
    else if (c === (inObject ? 0x7d : 0x5d)) this.close();
    else this.state = FAILED;
  }

  private valueStart(c: number, char: string): void {
    if (c === 0x7b) this.open(true);
    else if (c === 0x5b) this.open(false);
    else if (c === 0x22) this.openString(false);
    else if (c === 0x2d) this.state = MINUS;
    else if (isDigit(c)) this.state = c === 0x30 ? ZERO : INT;
    else if (Object.hasOwn(LITERALS, char)) {
      this.literalRest = LITERALS[char] ?? '';
      this.literalAt = 0;
      this.state = LITERAL;
    } else this.state = FAILED;
  }

  private openString(isKey: boolean): void {
    this.stringIsKey = isKey;
    this.state = STRING;
  }

  private open(isObject: boolean): void {
    const byte = this.depth >> 3;
    if (byte === this.kinds.length) {
      const grown = new Uint8Array(this.kinds.length * 2);
      grown.set(this.kinds);
      this.kinds = grown;
    }
    const mask = 1 << (this.depth & 7);
    this.kinds[byte] = isObject ? (this.kinds[byte] ?? 0) | mask : (this.kinds[byte] ?? 0) & ~mask;
    this.depth += 1;
    this.state = isObject ? OBJECT_START : ARRAY_START;
  }

  private close(): void {
    this.depth -= 1;
    this.state = AFTER_VALUE;
  }

  private topIsObject(): boolean {
    const top = this.depth - 1;
    return ((this.kinds[top >> 3] ?? 0) & (1 << (top & 7))) !== 0;
  }
}
