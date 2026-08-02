# Fixture Inventory

The Node test creates in-memory XLSX packages only: normal 20-store composition,
20-store mismatch, target-month failure, missing/unknown/duplicate account, invalid
number, unknown P/L sheet, duplicate mapping, blank cell, and
FC-profit-unavailable. It also checks that headquarters/EC rows never gain a store
ID, hash determinism, and buffer non-mutation. The existing local Yayoi adapter
fixture suite remains a regression check. No real Workbook is opened or saved.
