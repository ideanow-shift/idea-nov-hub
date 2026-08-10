import { hashCanonical } from './canonicalization.mjs';

const WORD = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const FORBIDDEN_WORDS = new Set([
  'insert', 'update', 'delete', 'merge', 'create', 'alter', 'drop', 'truncate',
  'grant', 'revoke', 'call', 'do', 'copy', 'lock', 'set', 'reset', 'discard',
  'prepare', 'execute', 'deallocate', 'listen', 'notify', 'vacuum', 'analyze',
  'cluster', 'reindex', 'refresh', 'comment', 'security', 'temporary', 'temp',
  'unlogged', 'commit', 'rollback', 'savepoint', 'release', 'start', 'begin',
]);
const NON_FUNCTION_WORDS = new Set([
  'all', 'and', 'any', 'array', 'as', 'asc', 'between', 'by', 'case', 'cast',
  'cross', 'desc', 'distinct', 'else', 'end', 'exists', 'false', 'filter', 'for',
  'from', 'full', 'group', 'having', 'in', 'inner', 'is', 'join', 'lateral',
  'left', 'limit', 'not', 'null', 'offset', 'on', 'or', 'order', 'outer', 'over',
  'recursive', 'right', 'select', 'then', 'true', 'union', 'using', 'values',
  'when', 'where', 'window', 'with', 'coalesce', 'greatest', 'least', 'nullif',
]);
const NON_IDENTIFIER_WORDS = new Set([...NON_FUNCTION_WORDS, ...FORBIDDEN_WORDS,
  'integer', 'text', 'boolean', 'date', 'oid', 'jsonb', 'character', 'varying',
  'primary_key', 'unique', 'foreign_key', 'other', 'none', 'source', 'target',
]);
const KEYWORD_OPERATORS = new Set(['and', 'or', 'not', 'in', 'is', 'like', 'ilike', 'between']);

function reject(code = 'SQL_SECURITY_AST_REJECTED') {
  throw Object.assign(new Error(code), { code });
}

function wordToken(value, quoted = false) {
  return { type: quoted ? 'identifier' : 'word', value: quoted ? value : value.toLowerCase() };
}

export function tokenizeSql(sqlText) {
  if (typeof sqlText !== 'string' || sqlText.length === 0 || sqlText.includes('\0')) reject();
  const tokens = [];
  let index = 0;
  while (index < sqlText.length) {
    const char = sqlText[index];
    if (/\s/.test(char)) { index += 1; continue; }
    if (char === '-' && sqlText[index + 1] === '-') {
      index += 2;
      while (index < sqlText.length && sqlText[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && sqlText[index + 1] === '*') {
      const end = sqlText.indexOf('*/', index + 2);
      if (end < 0) reject();
      index = end + 2;
      continue;
    }
    if (char === '$') reject();
    if (char === "'") {
      let value = '';
      index += 1;
      let closed = false;
      while (index < sqlText.length) {
        if (sqlText[index] === "'" && sqlText[index + 1] === "'") { value += "'"; index += 2; continue; }
        if (sqlText[index] === "'") { index += 1; closed = true; break; }
        value += sqlText[index++];
      }
      if (!closed) reject();
      tokens.push({ type: 'string', value });
      continue;
    }
    if (char === '"') {
      let value = '';
      index += 1;
      let closed = false;
      while (index < sqlText.length) {
        if (sqlText[index] === '"' && sqlText[index + 1] === '"') { value += '"'; index += 2; continue; }
        if (sqlText[index] === '"') { index += 1; closed = true; break; }
        value += sqlText[index++];
      }
      if (!closed || value.length === 0) reject();
      tokens.push(wordToken(value, true));
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let value = char;
      index += 1;
      while (index < sqlText.length && /[A-Za-z0-9_$]/.test(sqlText[index])) value += sqlText[index++];
      tokens.push(wordToken(value));
      continue;
    }
    if (/[0-9]/.test(char)) {
      let value = char;
      index += 1;
      while (index < sqlText.length && /[0-9.]/.test(sqlText[index])) value += sqlText[index++];
      tokens.push({ type: 'number', value });
      continue;
    }
    const two = sqlText.slice(index, index + 2);
    if (['::', '||', '<=', '>=', '<>', '!=', '!~', '~*', '!~*', '=>'].includes(two)) {
      tokens.push({ type: two === '::' ? 'cast' : 'operator', value: two });
      index += 2;
      continue;
    }
    if ('(),.;[]'.includes(char)) { tokens.push({ type: 'punctuation', value: char }); index += 1; continue; }
    if ('=<>+-*/%~'.includes(char)) { tokens.push({ type: 'operator', value: char }); index += 1; continue; }
    reject();
  }
  return tokens;
}

function tokenName(tokens, index) {
  const first = tokens[index];
  if (!first || !['word', 'identifier'].includes(first.type)) return null;
  if (tokens[index + 1]?.value === '.' && ['word', 'identifier'].includes(tokens[index + 2]?.type)) {
    return `${first.value}.${tokens[index + 2].value}`.toLowerCase();
  }
  return first.value.toLowerCase();
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

export function parseSecurityAst(sqlText) {
  const tokens = tokenizeSql(sqlText);
  const semicolons = tokens.map((token, index) => token.value === ';' ? index : -1).filter((index) => index >= 0);
  if (semicolons.length !== 1 || semicolons[0] !== tokens.length - 1) reject('SQL_MULTI_STATEMENT_REJECTED');
  const body = tokens.slice(0, -1);
  if (!['select', 'with'].includes(body[0]?.value)) reject('SQL_STATEMENT_TYPE_REJECTED');

  const forbiddenNodes = uniqueSorted(body.filter((token) => token.type === 'word' && FORBIDDEN_WORDS.has(token.value)).map((token) => token.value));
  if (forbiddenNodes.length > 0) reject('SQL_FORBIDDEN_NODE_REJECTED');
  if (body.some((token) => token.type === 'word' && token.value === 'into')) reject('SQL_SELECT_INTO_REJECTED');
  for (let index = 0; index < body.length - 1; index += 1) {
    if (body[index].value === 'for' && ['update', 'share'].includes(body[index + 1].value)) reject('SQL_ROW_LOCK_REJECTED');
    if (body[index].value === 'for' && body[index + 1].value === 'no' && body[index + 2]?.value === 'key' && body[index + 3]?.value === 'update') reject('SQL_ROW_LOCK_REJECTED');
    if (body[index].value === 'for' && body[index + 1].value === 'key' && body[index + 2]?.value === 'share') reject('SQL_ROW_LOCK_REJECTED');
  }

  const cteNames = [];
  if (body[0].value === 'with') {
    let cursor = body[1]?.value === 'recursive' ? 2 : 1;
    let depth = 0;
    let foundMainSelect = false;
    while (cursor < body.length) {
      const token = body[cursor];
      if (token.value === '(') depth += 1;
      if (token.value === ')') depth -= 1;
      if (depth === 0 && ['word', 'identifier'].includes(token.type) && body[cursor + 1]?.value === 'as' && body[cursor + 2]?.value === '(') cteNames.push(token.value.toLowerCase());
      if (depth === 0 && token.value === 'select') { foundMainSelect = true; break; }
      cursor += 1;
    }
    if (!foundMainSelect || cteNames.length === 0) reject('SQL_CTE_STRUCTURE_REJECTED');
  }

  const functions = [];
  const relations = [];
  const columnReferences = [];
  const identifiers = [];
  const operators = [];
  for (let index = 0; index < body.length; index += 1) {
    const token = body[index];
    if (token.type === 'operator') operators.push(token.value);
    if (token.type === 'word' && KEYWORD_OPERATORS.has(token.value)) operators.push(token.value);
    if (!['word', 'identifier'].includes(token.type)) continue;
    const name = tokenName(body, index);
    const qualified = name?.includes('.');
    const callOffset = qualified ? 3 : 1;
    if (name && body[index + callOffset]?.value === '(' && !NON_FUNCTION_WORDS.has(token.value) && body[index - 1]?.value !== 'as') functions.push(name);
    if (['from', 'join'].includes(body[index - 1]?.value) && name && !cteNames.includes(name) && !['values', 'lateral'].includes(name)) relations.push(name);
    if (qualified && !['from', 'join'].includes(body[index - 1]?.value)) columnReferences.push(name);
    if (!NON_IDENTIFIER_WORDS.has(token.value) && WORD.test(token.value) && body[index + 1]?.value !== '(') identifiers.push(token.value);
  }

  const ast = {
    statementType: body[0].value === 'with' ? 'with-select' : 'select',
    statementCount: 1,
    cteNames: uniqueSorted(cteNames),
    relations: uniqueSorted(relations),
    columnReferences: uniqueSorted(columnReferences),
    functions: uniqueSorted(functions),
    operators: uniqueSorted(operators),
    identifiers: uniqueSorted(identifiers),
    forbiddenNodes,
  };
  return Object.freeze({ ...ast, astSha256: hashCanonical(ast) });
}
