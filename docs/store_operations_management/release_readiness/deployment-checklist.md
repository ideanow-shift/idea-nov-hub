# Deployment Checklist

No deployment is authorized by this document.

## Merge gates

- [ ] V1.1 PR base=`main`, head=`feature/store-operations-v1-1-ux-polish`
- [ ] V1.1 review confirms 6 signals, shared trend, and assigned AM
- [ ] V1.1 is merged before HUB integration
- [ ] HUB PR base is changed to updated `main`
- [ ] HUB PR contains only `c953c63` and 17 files
- [ ] App Registry has one active Store Operations record
- [ ] Store Operations targeted tests pass with zero failures
- [ ] Full-suite known-failure set is unchanged

## Staging deployment order

1. Deploy the V1.1 application artifact with the HUB card disabled.
2. Configure the approved Staging HUB session and read-only Projection endpoint.
3. Validate 401, 403, expiry, Role, organization, and store scope.
4. Deploy the HUB integration artifact.
5. Enable the Staging App Registry card last.
6. Run representative, sales manager, area manager, store manager, and employee browser checks.
7. Confirm Console Error/Warning 0 and no token in URL or logs.

Production remains blocked until a separate approval.
