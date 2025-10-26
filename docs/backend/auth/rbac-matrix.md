# RBAC Matrix

The following table maps base roles to their granted permissions. Custom roles or direct user
assignments should extend – not overwrite – these defaults.

| Permission         | customer | staff | admin |
| ------------------ | :------: | :---: | :---: |
| `catalog:read`     |    ✓     |   ✓   |   ✓   |
| `catalog:write`    |          |   ✓   |   ✓   |
| `catalog:publish`  |          |       |   ✓   |
| `order:read`       |    ✓     |   ✓   |   ✓   |
| `order:manage`     |          |   ✓   |   ✓   |
| `customer:read`    |    ✓     |   ✓   |   ✓   |
| `customer:manage`  |          |       |   ✓   |
| `promotion:manage` |          |   ✓   |   ✓   |
| `report:read`      |          |       |   ✓   |

Additional permissions introduced in future phases must be appended here with corresponding role
decisions. Use `ROLE_PERMISSIONS_MAP` in `prisma/seed/data/constants.ts` as the authoritative seed
definition.
