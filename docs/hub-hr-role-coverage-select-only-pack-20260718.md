# HUB HR role coverage SELECT-only pack 2026-07-18

## Purpose

Confirm whether the existing `hr.staff` / `hr.admin` role population is ready for the proposed HR application and Master Admin access rollout.

The query returns aggregate counts only: role definitions and assignments, distinct and active employees, login readiness, missing credentials, disabled login, current locks, duplicate assignments, and all-scope assignments.

It does not project names, email addresses, employee IDs, credential values, PIN data, role assignment rows, or scope IDs. A targeted operator check must use approved private identifiers and return booleans only; those identifiers must not be committed to Git or shared documentation.

Production query, role DML, employee/credential mutation, Edge deploy, and Pages publish were not executed while preparing this pack.
