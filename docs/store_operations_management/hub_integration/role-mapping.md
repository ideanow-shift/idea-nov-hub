# Role Mapping

| HUB role key | Product role | Store scope | Initial view |
|---|---|---|---|
| `super_admin`, `executive`, `representative` | representative | all stores | Dashboard / all stores |
| `department_manager`, `sales_manager` | sales_manager | 13 direct stores | Dashboard / direct stores |
| `area_manager` | area_manager | assigned stores | Dashboard / assigned stores |
| `store_manager` | store_manager | self | own store detail |
| all other roles | none | none | card hidden; direct access forbidden |

The browser cannot enlarge scope by query parameters. Integration and staging scope remain server-resolved from the authenticated session.
