export const STRICT_JSON_LIMITS = Object.freeze({
  maxBytes: 4096,
  timeoutMs: 3000,
  maxDepth: 16,
  maxMembers: 256,
  maxTokens: 1024,
});

export class StrictJsonBoundaryError extends Error {
  readonly status: number;
  readonly category: string;

  constructor(status: number, category: string) {
    super(category);
    this.name = "StrictJsonBoundaryError";
    this.status = status;
    this.category = category;
  }
}

type ParseOptions = Partial<{
  maxBytes: number;
  timeoutMs: number;
  maxDepth: number;
  maxMembers: number;
  maxTokens: number;
}>;
type ReaderResult = ReadableStreamReadResult<Uint8Array>;

class JsonParseFailure extends Error {
  readonly category: string;

  constructor(category: string) {
    super(category);
    this.category = category;
  }
}

function fail(category = "JSON_REJECTED"): never {
  throw new JsonParseFailure(category);
}

async function readWithDeadline(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
  deadline: number,
): Promise<ReaderResult> {
  if (signal.aborted) throw new StrictJsonBoundaryError(400, "BODY_STREAM_ABORTED");
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new StrictJsonBoundaryError(408, "BODY_STREAM_TIMEOUT");

  return await new Promise<ReaderResult>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    };
    const resolveOnce = (value: ReaderResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const rejectOnce = (reason: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(reason);
    };
    const onAbort = () => rejectOnce(new StrictJsonBoundaryError(400, "BODY_STREAM_ABORTED"));
    timer = setTimeout(
      () => rejectOnce(new StrictJsonBoundaryError(408, "BODY_STREAM_TIMEOUT")),
      remaining,
    );
    signal.addEventListener("abort", onAbort, { once: true });
    reader.read().then(
      resolveOnce,
      () => rejectOnce(new StrictJsonBoundaryError(400, "BODY_STREAM_REJECTED")),
    );
  });
}

async function readBoundedBytes(
  request: Request,
  maxBytes: number,
  timeoutMs: number,
): Promise<Uint8Array> {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new StrictJsonBoundaryError(400, "BODY_STREAM_REJECTED");
  }
  if (!request.body) throw new StrictJsonBoundaryError(413, "BODY_SIZE_REJECTED");

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch {
    throw new StrictJsonBoundaryError(400, "BODY_STREAM_REJECTED");
  }
  const deadline = Date.now() + timeoutMs;
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const result = await readWithDeadline(reader, request.signal, deadline);
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) {
        throw new StrictJsonBoundaryError(400, "BODY_STREAM_REJECTED");
      }
      const nextTotal = total + result.value.byteLength;
      if (nextTotal > maxBytes) {
        throw new StrictJsonBoundaryError(413, "BODY_SIZE_REJECTED");
      }
      chunks.push(result.value);
      total = nextTotal;
    }

    if (total === 0) throw new StrictJsonBoundaryError(413, "BODY_SIZE_REJECTED");
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Cancellation is best-effort; the fixed original category is retained.
    }
    if (error instanceof StrictJsonBoundaryError) throw error;
    throw new StrictJsonBoundaryError(400, "BODY_STREAM_REJECTED");
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // No raw stream error is exposed from lock release.
    }
  }
}

class StrictJsonParser {
  private index = 0;
  private members = 0;
  private tokens = 0;

  constructor(
    private readonly source: string,
    private readonly maxDepth: number,
    private readonly maxMembers: number,
    private readonly maxTokens: number,
  ) {}

  parse(): unknown {
    this.skipWhitespace();
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.source.length) fail();
    return value;
  }

  private parseValue(depth: number): unknown {
    this.tokens += 1;
    if (this.tokens > this.maxTokens) fail("JSON_LIMIT_REJECTED");
    const char = this.source[this.index];
    if (char === "{") return this.parseObject(depth + 1);
    if (char === "[") return this.parseArray(depth + 1);
    if (char === '"') return this.parseString();
    if (char === "t") return this.parseLiteral("true", true);
    if (char === "f") return this.parseLiteral("false", false);
    if (char === "n") return this.parseLiteral("null", null);
    if (char === "-" || (char >= "0" && char <= "9")) return this.parseNumber();
    fail();
  }

  private parseObject(depth: number): Record<string, unknown> {
    if (depth > this.maxDepth) fail("JSON_LIMIT_REJECTED");
    this.index += 1;
    this.skipWhitespace();
    const result = Object.create(null) as Record<string, unknown>;
    const keys = new Set<string>();
    if (this.source[this.index] === "}") {
      this.index += 1;
      return result;
    }

    while (true) {
      if (this.source[this.index] !== '"') fail();
      const key = this.parseString();
      if (keys.has(key)) fail("JSON_DUPLICATE_KEY_REJECTED");
      keys.add(key);
      this.members += 1;
      if (this.members > this.maxMembers) fail("JSON_LIMIT_REJECTED");
      this.skipWhitespace();
      if (this.source[this.index] !== ":") fail();
      this.index += 1;
      this.skipWhitespace();
      const value = this.parseValue(depth);
      Object.defineProperty(result, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      this.skipWhitespace();
      const delimiter = this.source[this.index];
      if (delimiter === "}") {
        this.index += 1;
        return result;
      }
      if (delimiter !== ",") fail();
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private parseArray(depth: number): unknown[] {
    if (depth > this.maxDepth) fail("JSON_LIMIT_REJECTED");
    this.index += 1;
    this.skipWhitespace();
    const result: unknown[] = [];
    if (this.source[this.index] === "]") {
      this.index += 1;
      return result;
    }
    while (true) {
      result.push(this.parseValue(depth));
      this.skipWhitespace();
      const delimiter = this.source[this.index];
      if (delimiter === "]") {
        this.index += 1;
        return result;
      }
      if (delimiter !== ",") fail();
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private parseString(): string {
    if (this.source[this.index] !== '"') fail();
    this.index += 1;
    let result = "";

    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (char === '"') {
        this.index += 1;
        return result;
      }
      if (char === "\\") {
        this.index += 1;
        const escape = this.source[this.index++];
        if (escape === '"' || escape === "\\" || escape === "/") result += escape;
        else if (escape === "b") result += "\b";
        else if (escape === "f") result += "\f";
        else if (escape === "n") result += "\n";
        else if (escape === "r") result += "\r";
        else if (escape === "t") result += "\t";
        else if (escape === "u") result += this.parseUnicodeEscape();
        else fail();
        continue;
      }

      const code = this.source.charCodeAt(this.index);
      if (code <= 0x1f) fail();
      if (code >= 0xd800 && code <= 0xdbff) {
        const low = this.source.charCodeAt(this.index + 1);
        if (low < 0xdc00 || low > 0xdfff) fail();
        result += this.source.slice(this.index, this.index + 2);
        this.index += 2;
        continue;
      }
      if (code >= 0xdc00 && code <= 0xdfff) fail();
      result += char;
      this.index += 1;
    }
    fail();
  }

  private parseUnicodeEscape(): string {
    const first = this.readHexCodeUnit();
    if (first >= 0xd800 && first <= 0xdbff) {
      if (this.source[this.index] !== "\\" || this.source[this.index + 1] !== "u") fail();
      this.index += 2;
      const second = this.readHexCodeUnit();
      if (second < 0xdc00 || second > 0xdfff) fail();
      const codePoint = 0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00);
      return String.fromCodePoint(codePoint);
    }
    if (first >= 0xdc00 && first <= 0xdfff) fail();
    return String.fromCharCode(first);
  }

  private readHexCodeUnit(): number {
    const hex = this.source.slice(this.index, this.index + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
    this.index += 4;
    return Number.parseInt(hex, 16);
  }

  private parseNumber(): number {
    const rest = this.source.slice(this.index);
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(rest);
    if (!match) fail();
    const raw = match[0];
    this.index += raw.length;
    const value = Number(raw);
    if (!Number.isFinite(value)) fail();
    return value;
  }

  private parseLiteral<T>(literal: string, value: T): T {
    if (this.source.slice(this.index, this.index + literal.length) !== literal) fail();
    this.index += literal.length;
    return value;
  }

  private skipWhitespace(): void {
    while (this.index < this.source.length && /[\u0009\u000a\u000d\u0020]/.test(this.source[this.index])) {
      this.index += 1;
    }
  }
}

export function parseStrictJsonText(
  source: string,
  options: ParseOptions = {},
): unknown {
  const limits = { ...STRICT_JSON_LIMITS, ...options };
  const byteLength = new TextEncoder().encode(source).byteLength;
  if (byteLength < 1 || byteLength > limits.maxBytes || source.startsWith("\ufeff")) {
    throw new StrictJsonBoundaryError(400, byteLength > limits.maxBytes ? "BODY_SIZE_REJECTED" : "JSON_REJECTED");
  }
  try {
    return new StrictJsonParser(source, limits.maxDepth, limits.maxMembers, limits.maxTokens).parse();
  } catch (error) {
    if (error instanceof JsonParseFailure) {
      throw new StrictJsonBoundaryError(400, error.category);
    }
    if (error instanceof StrictJsonBoundaryError) throw error;
    throw new StrictJsonBoundaryError(400, "JSON_REJECTED");
  }
}

export async function parseStrictJsonRequest(
  request: Request,
  options: ParseOptions = {},
): Promise<Record<string, unknown>> {
  const limits = { ...STRICT_JSON_LIMITS, ...options };
  const bytes = await readBoundedBytes(request, limits.maxBytes, limits.timeoutMs);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new StrictJsonBoundaryError(400, "JSON_REJECTED");
  }

  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new StrictJsonBoundaryError(400, "UTF8_REJECTED");
  }

  const parsed = parseStrictJsonText(source, limits);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new StrictJsonBoundaryError(400, "BODY_SHAPE_REJECTED");
  }
  return parsed as Record<string, unknown>;
}
