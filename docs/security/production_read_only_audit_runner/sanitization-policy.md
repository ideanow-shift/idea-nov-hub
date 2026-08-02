# Sanitization Policy

Allowed output is restricted to counts, booleans, approved schema/relation/column names, relation kinds, policy names only when separately approved, masked identifiers, and bounded categorical timestamps. Strings are single-line and at most 128 characters; integers are non-negative and at most 1,000,000.

The sanitizer rejects unknown fields, raw UUIDs, person/customer fields, account values, URLs, hostnames, tokens, credential-shaped fields, control characters, nested objects, arrays, and raw driver errors. Failure yields `SANITIZATION_REJECTED`; it never emits a partial raw row.
