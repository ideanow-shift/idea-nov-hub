# Fixed Query Pack Catalog v1.3.3

v1.3.3 retains the 16 fixed Query IDs and the v1.3.2 QP04 semantics. The only
SQL corrective is `SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP` v1.0.1, whose Source
object set now includes the Canonical Assignment Foundation relations used by
QP04. Registry, public catalog, AST allowlist, private manifest, and Package Lock
all bind the new SQL bytes.

The Broker remains Query-ID-only. Arbitrary SQL, Auth schema access, retries,
and database mutation remain forbidden.
