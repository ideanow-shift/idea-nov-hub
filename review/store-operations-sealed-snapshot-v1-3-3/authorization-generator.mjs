import { hashCanonical } from './canonicalization.mjs';
import {
  EXECUTION_AUTHORIZATION_FIELDS,
  assertExecutionAuthorizationBinding,
} from './run-contract.mjs';

export function generateExecutionAuthorization({ source, request, packageLock, approvedSchemaContract }) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw Object.assign(new Error('EXECUTION_AUTHORIZATION_REJECTED'), { code: 'EXECUTION_AUTHORIZATION_REJECTED' });
  }
  const missingFieldCount = EXECUTION_AUTHORIZATION_FIELDS.filter((field) => !Object.hasOwn(source, field)).length;
  const unknownFieldCount = Object.keys(source).filter((field) => !EXECUTION_AUTHORIZATION_FIELDS.includes(field)).length;
  if (missingFieldCount !== 0 || unknownFieldCount !== 0) {
    throw Object.assign(new Error('EXECUTION_AUTHORIZATION_REJECTED'), { code: 'EXECUTION_AUTHORIZATION_REJECTED' });
  }
  const authorization = Object.freeze(Object.fromEntries(
    EXECUTION_AUTHORIZATION_FIELDS.map((field) => [field, source[field]]),
  ));
  assertExecutionAuthorizationBinding({ request, authorization, packageLock, approvedSchemaContract });
  return Object.freeze({
    authorization,
    authorizationSha256: hashCanonical(authorization),
    requiredFieldCount: EXECUTION_AUTHORIZATION_FIELDS.length,
    missingFieldCount,
    unknownFieldCount,
  });
}

export function assertAuthorizationGeneratorParity() {
  if (EXECUTION_AUTHORIZATION_FIELDS.length !== 31 || new Set(EXECUTION_AUTHORIZATION_FIELDS).size !== 31) {
    throw Object.assign(new Error('AUTHORIZATION_CONTRACT_DRIFT'), { code: 'AUTHORIZATION_CONTRACT_DRIFT' });
  }
  return true;
}
