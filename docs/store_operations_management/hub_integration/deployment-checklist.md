# Deployment Checklist

This sprint does not deploy Production.

- [ ] Base includes Dashboard V1.1 Draft PR commit
- [ ] Preview App Registry is enabled only in the review artifact
- [ ] Integration endpoint and Local Session are configured together
- [ ] Staging origin, Staging Session, audience, expiry, and CORS are approved
- [ ] Production adapter remains `PRODUCTION_NOT_APPROVED`
- [ ] Mock Identity cannot be created in integration, staging, or production
- [ ] No token appears in URL, console, artifact, or documentation
- [ ] 401, 403, expiry, logout, and HUB return are verified
- [ ] Release commit and rollback commit are recorded
