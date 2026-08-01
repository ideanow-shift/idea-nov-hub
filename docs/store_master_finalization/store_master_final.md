# Store Master Finalization Sprint

## Decision status

**CONDITIONAL PASS — canonical recommendation is ready; operational finalization is not yet approved.**

The evidence supports `public.stores` as the canonical physical source for the current 20-store baseline. `core.stores` contains one Tokorozawa record with a distinct UUID and must remain legacy evidence, not a fallback or write target. This recommendation follows ADR-001/ADR-002 and the existing core master audit; it does not create a DB change, UUID change, crosswalk, or API connection.

## Evidence-backed baseline

| Item | Evidence | Result |
| --- | --- | --- |
| Current store inventory | Core master audit records 22 `public.stores` rows: 20 active stores, one headquarters, one inactive legacy store | 20 current stores reconciled |
| Classification | Audit records 13 Direct and 7 FC rows through corporation relationship | 13/7 baseline reconciled |
| `core.stores` | Audit records only one Tokorozawa row, with a distinct UUID | not suitable as 20-store SSoT |
| Tokorozawa | same store code; masked public and core UUIDs differ | public UUID is canonical candidate; core UUID is legacy candidate |
| History | no store-operation history relation in the audited shape | effective period/operator history remains missing |
| API | Store Sales Projection API is design-only, endpoint/session/deploy are not approved | no official production connection information exists |

## Canonical policy

1. The canonical Store ID is the existing `public.stores.id` UUID for each current store.
2. `public.stores.store_id` and `store_no` are operational codes, not substitutes for the canonical UUID.
3. The core Tokorozawa UUID remains an immutable legacy identifier. It is never overwritten, deleted, or automatically mapped.
4. A future crosswalk requires Core Master Owner and Sales Owner approval plus a read-only FK/API impact receipt. No crosswalk is created in this sprint.
5. Headquarters and inactive legacy rows remain outside the current 20-store scope; they are not deleted or merged.

## 20-store scope

- **Direct 13:** 所沢、高田馬場、上石神井、保谷、石神井公園、東大和、下井草、江古田、ANNEX、野方、池袋、KYARA HALF、立川。
- **FC 7:** 新所沢、鷺ノ宮、Roane by Bassa、久米川、国分寺、花小金井、東久留米。

The canonical mapping candidate is in [store_id_mapping.csv](store_id_mapping.csv). UUIDs are masked. The file deliberately records `PENDING_READONLY_VERIFICATION` for fields that are not proven by a current approved production read-only receipt.

## Store Scope and AM

The role-to-scope model is ready: representative/executive all 20, sales manager direct 13, area manager assigned stores only, store manager self only, FC owner FC stores as separately assigned. No source evidence identifies the current assigned AM for each store. Every AM assignment therefore remains `UNASSIGNED_PENDING_OWNER`; the UI and API must fail closed for AM scope until the owner supplies an approved assignment source.

## Store Sales API connection

The formal connection **contract** is defined in [store_sales_api_contract.md](store_sales_api_contract.md). A production base URL, credential, and active endpoint are intentionally absent: the existing design explicitly states the endpoint/session/deploy are not implemented or approved. Browser-to-DB access and production mock fallback are prohibited.

## Blocking decisions

1. Core Master Owner, Platform Owner, Security Owner, Accounting Owner, Sales Owner, and CTO must approve the public canonical recommendation.
2. Core Master/Sales owners must confirm the two Tokorozawa records represent the same business store before approving an immutable legacy crosswalk.
3. Sales owner must provide an effective-dated AM assignment source.
4. Store-operation history/effective-period design must be approved before historical operator claims become canonical.
5. Platform/Security/Accounting/Sales owners must approve and implement a server-side Store Sales API under a separate read-only gate.

## Completion statement

Store Operations is **not yet authorized to start a production data connection**. This sprint removes ambiguity from the proposed canonical baseline and supplies the mapping/scope/API contract package needed for the next gates. It does not remove the read-only identity, API deployment, effective-history, or AM-assignment blocks.
