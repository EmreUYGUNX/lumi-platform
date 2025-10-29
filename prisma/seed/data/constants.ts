/* eslint-disable sonarjs/no-duplicate-string */
import type { MediaProvider, MediaType, ProductStatus } from "@prisma/client";

export interface RoleSeed {
  name: string;
  description?: string;
}

export interface PermissionSeed {
  key: string;
  description?: string;
}

export interface CategorySeed {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  iconUrl?: string;
  displayOrder?: number;
  children?: CategorySeed[];
}

export interface ProductVariantSeed {
  sku: string;
  title: string;
  price: string;
  compareAtPrice?: string;
  stock: number;
  isPrimary?: boolean;
  attributes?: Record<string, unknown>;
}

export interface ProductMediaSeed {
  assetId: string;
  url: string;
  type: MediaType;
  provider: MediaProvider;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
  sortOrder?: number;
  isPrimary?: boolean;
  variantSkus?: string[];
}

export interface ProductSeed {
  title: string;
  slug: string;
  sku?: string | null;
  summary?: string | null;
  description?: string | null;
  status?: ProductStatus;
  price: string;
  compareAtPrice?: string | null;
  currency?: string;
  searchKeywords?: string[];
  attributes?: Record<string, unknown>;
  categories: string[];
  variants: ProductVariantSeed[];
  media: ProductMediaSeed[];
}

export const BASE_ROLES: RoleSeed[] = [
  {
    name: "customer",
    description: "Default shopper role with access to personal orders and account.",
  },
  {
    name: "staff",
    description: "Customer service and operations role with catalog and order access.",
  },
  {
    name: "admin",
    description: "Platform administrator with full access.",
  },
];

export const BASE_PERMISSIONS: PermissionSeed[] = [
  { key: "catalog:read", description: "View catalog entities." },
  { key: "catalog:write", description: "Create or update catalog entities." },
  { key: "catalog:publish", description: "Publish products and categories." },
  { key: "order:read", description: "View customer orders." },
  { key: "order:manage", description: "Manage lifecycle of orders." },
  { key: "customer:read", description: "View customer profiles." },
  { key: "customer:manage", description: "Manage customer accounts." },
  { key: "promotion:manage", description: "Manage coupons and promotions." },
  { key: "report:read", description: "View analytical reports." },
];

export const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  customer: ["catalog:read", "order:read", "customer:read"],
  staff: [
    "catalog:read",
    "catalog:write",
    "order:read",
    "order:manage",
    "customer:read",
    "promotion:manage",
  ],
  admin: BASE_PERMISSIONS.map((permission) => permission.key),
};

export const ADMIN_DEFAULTS = {
  email: "admin@lumi.com",
  firstName: "Lumi",
  lastName: "Admin",
  password: "ChangeMeNow!2025",
};

export const BASE_CATEGORY_TREE: CategorySeed[] = [
  {
    name: "Electronics",
    slug: "electronics",
    description: "Phones, computers, wearables and accessories.",
    displayOrder: 1,
    children: [
      {
        name: "Smartphones",
        slug: "smartphones",
        description: "Latest smartphones and accessories.",
        displayOrder: 1,
      },
      {
        name: "Laptops",
        slug: "laptops",
        description: "Workstations, ultrabooks and gaming laptops.",
        displayOrder: 2,
      },
      {
        name: "Wearables",
        slug: "wearables",
        description: "Smart watches, fitness bands and more.",
        displayOrder: 3,
      },
    ],
  },
  {
    name: "Home & Living",
    slug: "home-living",
    description: "Make your living space comfortable and smart.",
    displayOrder: 2,
    children: [
      {
        name: "Kitchen",
        slug: "kitchen",
        description: "Kitchen appliances and tools.",
        displayOrder: 1,
      },
      {
        name: "Decor",
        slug: "decor",
        description: "Home décor and lighting.",
        displayOrder: 2,
      },
    ],
  },
  {
    name: "Fashion",
    slug: "fashion",
    description: "Clothing and accessories for all styles.",
    displayOrder: 3,
    children: [
      {
        name: "Women",
        slug: "women",
        description: "Women’s clothing, shoes and accessories.",
        displayOrder: 1,
      },
      {
        name: "Men",
        slug: "men",
        description: "Men’s clothing, shoes and accessories.",
        displayOrder: 2,
      },
      {
        name: "Kids",
        slug: "kids",
        description: "Kids’ clothing and accessories.",
        displayOrder: 3,
      },
    ],
  },
];
