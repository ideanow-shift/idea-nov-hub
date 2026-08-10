import { createHash } from 'node:crypto';

const HASH_ALGORITHM = 'sha256';

function normalizeString(value) {
  if (value.startsWith('\uFEFF')) throw new Error('CANONICALIZATION_BOM_REJECTED');
  return value.normalize('NFC').replace(/\r\n?/g, '\n');
}

function normalizeValue(value) {
  if (value === null) return null;
  if (typeof value === 'string') return normalizeString(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('CANONICALIZATION_NUMBER_REJECTED');
    return Object.is(value, -0) ? 0 : value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('CANONICALIZATION_DATE_REJECTED');
    return value.toISOString();
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object') {
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      if (typeof value[key] === 'undefined') throw new Error('CANONICALIZATION_UNDEFINED_REJECTED');
      normalized[normalizeString(key)] = normalizeValue(value[key]);
    }
    return normalized;
  }
  throw new Error('CANONICALIZATION_TYPE_REJECTED');
}

export function canonicalize(value) {
  return JSON.stringify(normalizeValue(value));
}

export function sha256Utf8(canonicalText) {
  if (typeof canonicalText !== 'string' || canonicalText.startsWith('\uFEFF')) {
    throw new Error('CANONICALIZATION_TEXT_REJECTED');
  }
  return createHash(HASH_ALGORITHM).update(canonicalText, 'utf8').digest('hex');
}

export function hashCanonical(value) {
  return sha256Utf8(`${canonicalize(value)}\n`);
}

export function stableRecordSet(records, keyFields = []) {
  if (!Array.isArray(records)) throw new Error('CANONICALIZATION_RECORD_SET_REJECTED');
  return records.map(normalizeValue).sort((left, right) => {
    const leftKey = canonicalize(keyFields.map((field) => left[field] ?? null));
    const rightKey = canonicalize(keyFields.map((field) => right[field] ?? null));
    return leftKey.localeCompare(rightKey) || canonicalize(left).localeCompare(canonicalize(right));
  });
}

export function hashRecordSet(records, keyFields = []) {
  return hashCanonical(stableRecordSet(records, keyFields));
}

export const CANONICALIZATION_CONTRACT = Object.freeze({
  version: 'SOCE-CANONICALIZATION-v1',
  encoding: 'UTF-8',
  bom: 'forbidden',
  unicodeNormalization: 'NFC',
  newline: 'LF',
  leadingAndTrailingWhitespace: 'preserved',
  null: 'json-null',
  objectKeyOrder: 'ascending-codepoint',
  recordOrder: 'canonical-key-then-record',
  finalNewline: 'required',
  hashAlgorithm: 'SHA-256',
});
