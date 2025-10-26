# Role-Based Access Control (RBAC)

Lumi’s RBAC system delivers principle-of-least-privilege enforcement for every authenticated
request. This guide describes the data model, runtime behaviour, and patterns for using the
middleware effectively.

## Data Model Overview

- **Roles** (`Role` table) – Named groups such as `customer`, `staff`, `admin`.
- **Permissions** (`Permission` table) – Granular capabilities (`catalog:read`, `order:manage`, …).
- **RolePermission** – Many-to-many mapping linking roles to permissions.
- **UserRole** / **UserPermission** – Direct assignments supporting overrides or elevated access.

During seeding (`prisma/seed.ts`) the following base roles & permissions are applied:

| Resource   | Permissions                                        |
| ---------- | -------------------------------------------------- |
| Catalog    | `catalog:read`, `catalog:write`, `catalog:publish` |
| Orders     | `order:read`, `order:manage`                       |
| Customers  | `customer:read`, `customer:manage`                 |
| Promotions | `promotion:manage`                                 |
| Reporting  | `report:read`                                      |

Refer to `docs/backend/auth/rbac-matrix.md` for the full role assignment grid.

## Runtime Architecture

1. `deserializeUser` middleware decodes the access token and attaches the session context.
2. `requireAuth` ensures a user is present on the request.
3. `requireRole` / `requirePermission` enforce RBAC assertions.
4. `authorizeResource` performs owner/resource-scoped checks (e.g. `order:read` only for own order).
5. `RbacService` resolves roles & permissions:
   - Cache key: `auth:rbac:permissions:<userId>`
   - Redis TTL: 5 minutes (memory fallback with same TTL)
   - Wildcard matching (`catalog:*`, `*:*`) supported
6. Permission cache invalidated on role or permission changes (`invalidateUserPermissions`).

## Usage Patterns

### Require a Role

```ts
import { requireRole } from "@/middleware/auth/requireRole.js";

router.get("/api/v1/admin/users", requireAuth, requireRole(["admin"]), listUsersController);
```

### Require a Permission

```ts
import { requirePermission } from "@/middleware/auth/requirePermission.js";

router.post(
  "/api/v1/catalog/products",
  requireAuth,
  requirePermission(["catalog:write"]),
  createProductController,
);
```

### Resource Authorisation

```ts
router.get(
  "/api/v1/orders/:orderId",
  requireAuth,
  authorizeResource({
    resource: "order",
    permissions: ["order:read"],
    ownershipResolver: async ({ user, params, services }) => {
      const order = await services.orderService.findById(params.orderId);
      return order?.userId === user.id;
    },
  }),
  getOrderController,
);
```

The resolver receives the authenticated user, request parameters, and a typed service container.
Return `true` to allow access, `false` to emit `403`.

## Permission Matching Rules

1. **Exact match** – Required permission must equal a granted permission.
2. **Wildcard match** – `catalog:*` grants any `catalog:<action>`; `*:<action>` grants action across
   resources; `*` grants everything (reserved for administrators).
3. **Direct assignment precedence** – User-specific permissions override role assignments.

## Operational Guidance

- Call `rbacService.invalidateUserPermissions(userId)` whenever roles or direct permissions change.
- Monitor the `auth:rbac:cache` logger – repeated Redis failures automatically fall back to memory.
- Use the `RBAC` metrics emitted via Prometheus:
  - `rbac_permission_cache_hits_total`
  - `rbac_permission_cache_misses_total`
  - `rbac_permission_resolve_duration_ms`

## Testing Strategies

- Unit tests (`rbac.service.jest.spec.ts`) cover caching layers, wildcards, and invalidation.
- Integration tests assert that protected endpoints return `403` without roles/permissions and `200`
  when correct scopes are present (see `auth.flow.integration.jest.spec.ts` and admin route specs).
- Security tests simulate permission escalation attempts to verify denial and logging.

## When Adding New Permissions

1. Update `prisma/seed/data/constants.ts` with the new permission key and description.
2. Map the permission to one or more roles in `ROLE_PERMISSIONS_MAP`.
3. Regenerate the Prisma client (`pnpm prisma generate`) if the schema changed.
4. Extend `docs/backend/auth/rbac-matrix.md`.
5. Add targeted integration tests for the new capability.

Adhering to these steps keeps RBAC deterministic, observable, and auditable across services.
