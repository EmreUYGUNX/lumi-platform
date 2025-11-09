export const PERMISSIONS = {
  PRODUCTS: {
    READ: "products:read",
    WRITE: "products:write",
    DELETE: "products:delete",
  },
  ORDERS: {
    READ: "orders:read",
    WRITE: "orders:write",
    REFUND: "orders:refund",
  },
  USERS: {
    READ: "users:read",
    WRITE: "users:write",
    DELETE: "users:delete",
  },
  REPORTS: {
    READ: "report:read",
  },
} as const;

export type PermissionGroup = keyof typeof PERMISSIONS;
export type PermissionKey<TGroup extends PermissionGroup = PermissionGroup> =
  (typeof PERMISSIONS)[TGroup][keyof (typeof PERMISSIONS)[TGroup]];

export const ALL_PERMISSIONS = Object.freeze(
  Object.values(PERMISSIONS).flatMap((group) => Object.values(group)),
) as readonly PermissionKey[];

export const isPermissionKey = (value: unknown): value is PermissionKey =>
  typeof value === "string" && ALL_PERMISSIONS.includes(value as PermissionKey);
