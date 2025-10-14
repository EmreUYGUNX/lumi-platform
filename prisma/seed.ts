import process from "node:process";

/* eslint-disable unicorn/no-null */
import type { Category, Permission, Product, ProductVariant, Role, User } from "@prisma/client";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  ADMIN_DEFAULTS,
  type CategorySeed,
  type ProductMediaSeed,
  type ProductSeed,
  ROLE_PERMISSIONS_MAP,
  type SeedProfileConfig,
  type SeedProfileName,
  buildCategorySeeds,
  buildProductSeeds,
  getBasePermissions,
  getBaseRoles,
  getSeedProfileConfig,
} from "./seed/data/index.js";

type TransactionClient = Prisma.TransactionClient;

const SALT_ROUNDS = 12;
const DEFAULT_PROFILE: SeedProfileName = "development";

interface CliOptions {
  profile: SeedProfileName;
  validateOnly: boolean;
  showHelp: boolean;
}

interface SeedSummary {
  roles: number;
  permissions: number;
  roleAssignments: number;
  categories: number;
  products: number;
  variants: number;
  media: number;
}

const log = {
  info: (message: string, metadata?: Record<string, unknown>) => {
    // eslint-disable-next-line no-console
    console.log(`ℹ️  ${message}`, metadata ?? "");
  },
  success: (message: string, metadata?: Record<string, unknown>) => {
    // eslint-disable-next-line no-console
    console.log(`✅ ${message}`, metadata ?? "");
  },
  warn: (message: string, metadata?: Record<string, unknown>) => {
    // eslint-disable-next-line no-console
    console.warn(`⚠️  ${message}`, metadata ?? "");
  },
  error: (message: string, metadata?: Record<string, unknown>) => {
    // eslint-disable-next-line no-console
    console.error(`❌ ${message}`, metadata ?? "");
  },
};

const HELP_MESSAGE = [
  "Usage: pnpm prisma:seed [-- --profile <name>] [--check]",
  "Profiles: development (default), qa, production, demo",
  "--check / --status / --validate : run validation only",
].join("\n");

const parseCliOptions = (): CliOptions => {
  const args = process.argv.slice(2);
  const envProfile = process.env.SEED_PROFILE as SeedProfileName | undefined;
  let profile: SeedProfileName = envProfile ?? DEFAULT_PROFILE;
  let validateOnly = false;
  let showHelp = false;

  for (let index = 0; index < args.length; index += 1) {
    // eslint-disable-next-line security/detect-object-injection
    const token = args[index];
    if (token === "--profile" || token === "-p") {
      // eslint-disable-next-line security/detect-object-injection
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --profile flag.");
      }
      profile = value as SeedProfileName;
      index += 1;
    } else if (token.startsWith("--profile=")) {
      const [, value] = token.split("=");
      profile = value as SeedProfileName;
    } else if (["--check", "--status", "--validate"].includes(token)) {
      validateOnly = true;
    } else if (token === "--help" || token === "-h") {
      showHelp = true;
    }
  }

  const config = getSeedProfileConfig(profile);
  return { profile: config.name, validateOnly, showHelp };
};

const seedRoles = async (tx: TransactionClient): Promise<Map<string, Role>> => {
  const baseRoles = getBaseRoles();
  const roleMap = new Map<string, Role>();

  // eslint-disable-next-line no-restricted-syntax
  for (const role of baseRoles) {
    // eslint-disable-next-line no-await-in-loop
    const record = await tx.role.upsert({
      where: { name: role.name },
      update: { description: role.description ?? null },
      create: { name: role.name, description: role.description ?? null },
    });
    roleMap.set(record.name, record);
  }

  log.info("Roles ensured", { count: roleMap.size });
  return roleMap;
};

const seedPermissions = async (tx: TransactionClient): Promise<Map<string, Permission>> => {
  const basePermissions = getBasePermissions();
  const permissionMap = new Map<string, Permission>();

  // eslint-disable-next-line no-restricted-syntax
  for (const permission of basePermissions) {
    // eslint-disable-next-line no-await-in-loop
    const record = await tx.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description ?? null },
      create: { key: permission.key, description: permission.description ?? null },
    });
    permissionMap.set(record.key, record);
  }

  log.info("Permissions ensured", { count: permissionMap.size });
  return permissionMap;
};

const seedRolePermissions = async (
  tx: TransactionClient,
  roles: Map<string, Role>,
  permissions: Map<string, Permission>,
): Promise<number> => {
  let assignmentCount = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (const [roleName, permissionKeys] of Object.entries(ROLE_PERMISSIONS_MAP)) {
    const role = roles.get(roleName);
    if (!role) {
      log.warn("Skipping permission assignment for missing role", { roleName });
      // eslint-disable-next-line no-continue
      continue;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const permissionKey of permissionKeys) {
      const permission = permissions.get(permissionKey);
      if (!permission) {
        log.warn("Skipping assignment for missing permission", { permissionKey });
        // eslint-disable-next-line no-continue
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
      assignmentCount += 1;
    }
  }

  log.info("Role permissions ensured", { count: assignmentCount });
  return assignmentCount;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const ensureAdminUser = async (tx: TransactionClient, roles: Map<string, Role>): Promise<User> => {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? ADMIN_DEFAULTS.email;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? ADMIN_DEFAULTS.password;
  const firstName = process.env.SEED_ADMIN_FIRST_NAME ?? ADMIN_DEFAULTS.firstName;
  const lastName = process.env.SEED_ADMIN_LAST_NAME ?? ADMIN_DEFAULTS.lastName;

  const existing = await tx.user.findUnique({ where: { email: adminEmail } });

  const passwordHash =
    existing && (await bcrypt.compare(adminPassword, existing.passwordHash))
      ? existing.passwordHash
      : await bcrypt.hash(adminPassword, SALT_ROUNDS);

  const adminUser = existing
    ? await tx.user.update({
        where: { id: existing.id },
        data: {
          firstName,
          lastName,
          passwordHash,
          status: "ACTIVE",
          emailVerified: true,
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          lockoutUntil: null,
          failedLoginCount: 0,
        },
      })
    : await tx.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          firstName,
          lastName,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          status: "ACTIVE",
        },
      });

  const adminRole = roles.get("admin");
  if (adminRole) {
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: adminRole.id },
    });
  } else {
    log.warn("Admin role not available to assign", { email: adminEmail });
  }

  log.info("Admin user ensured", { email: adminEmail });
  return adminUser;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const seedCategoryTree = async (
  tx: TransactionClient,
  categories: CategorySeed[],
): Promise<Map<string, Category>> => {
  const categoryMap = new Map<string, Category>();

  const processNode = async (node: CategorySeed, parent?: Category): Promise<void> => {
    const level = parent ? parent.level + 1 : 0;
    const path = parent ? `${parent.path}/${node.slug}` : node.slug;

    const record = await tx.category.upsert({
      where: { slug: node.slug },
      update: {
        name: node.name,
        description: node.description ?? null,
        parentId: parent?.id ?? null,
        level,
        path,
        imageUrl: node.imageUrl ?? null,
        iconUrl: node.iconUrl ?? null,
        displayOrder: node.displayOrder ?? null,
      },
      create: {
        name: node.name,
        slug: node.slug,
        description: node.description ?? null,
        parentId: parent?.id ?? null,
        level,
        path,
        imageUrl: node.imageUrl ?? null,
        iconUrl: node.iconUrl ?? null,
        displayOrder: node.displayOrder ?? null,
      },
    });

    categoryMap.set(record.slug, record);

    if (node.children) {
      // eslint-disable-next-line no-restricted-syntax
      for (const child of node.children) {
        // eslint-disable-next-line no-await-in-loop
        await processNode(child, record);
      }
    }
  };

  // eslint-disable-next-line no-restricted-syntax
  for (const category of categories) {
    // eslint-disable-next-line no-await-in-loop
    await processNode(category);
  }

  log.info("Categories ensured", { count: categoryMap.size });
  return categoryMap;
};

const upsertProduct = async (tx: TransactionClient, productSeed: ProductSeed): Promise<Product> =>
  tx.product.upsert({
    where: { slug: productSeed.slug },
    update: {
      title: productSeed.title,
      description: productSeed.description ?? null,
      summary: productSeed.summary ?? null,
      status: productSeed.status ?? "ACTIVE",
      price: new Prisma.Decimal(productSeed.price),
      compareAtPrice: productSeed.compareAtPrice
        ? new Prisma.Decimal(productSeed.compareAtPrice)
        : null,
      currency: productSeed.currency ?? "TRY",
      searchKeywords: productSeed.searchKeywords ?? [],
      attributes: productSeed.attributes ?? Prisma.JsonNull,
      inventoryPolicy: "TRACK",
      deletedAt: null,
    },
    create: {
      title: productSeed.title,
      slug: productSeed.slug,
      sku: productSeed.sku ?? null,
      description: productSeed.description ?? null,
      summary: productSeed.summary ?? null,
      status: productSeed.status ?? "ACTIVE",
      price: new Prisma.Decimal(productSeed.price),
      compareAtPrice: productSeed.compareAtPrice
        ? new Prisma.Decimal(productSeed.compareAtPrice)
        : null,
      currency: productSeed.currency ?? "TRY",
      searchKeywords: productSeed.searchKeywords ?? [],
      attributes: productSeed.attributes ?? Prisma.JsonNull,
      inventoryPolicy: "TRACK",
    },
  });

const seedProductCategories = async (
  tx: TransactionClient,
  product: Product,
  categorySlugs: string[],
  categoryMap: Map<string, Category>,
) => {
  await Promise.all(
    categorySlugs.map(async (slug, index) => {
      const category = categoryMap.get(slug);
      if (!category) {
        log.warn("Skipping product category assignment – slug not found", {
          slug,
          product: product.slug,
        });
        return;
      }

      await tx.productCategory.upsert({
        where: { productId_categoryId: { productId: product.id, categoryId: category.id } },
        update: { isPrimary: index === 0 },
        create: {
          productId: product.id,
          categoryId: category.id,
          isPrimary: index === 0,
        },
      });
    }),
  );
};

const seedProductVariants = async (
  tx: TransactionClient,
  product: Product,
  variants: ProductSeed["variants"],
): Promise<Map<string, ProductVariant>> => {
  const variantMap = new Map<string, ProductVariant>();

  // eslint-disable-next-line no-restricted-syntax
  for (const variantSeed of variants) {
    // eslint-disable-next-line no-await-in-loop
    const variant = await tx.productVariant.upsert({
      where: { sku: variantSeed.sku },
      update: {
        title: variantSeed.title,
        price: new Prisma.Decimal(variantSeed.price),
        compareAtPrice: variantSeed.compareAtPrice
          ? new Prisma.Decimal(variantSeed.compareAtPrice)
          : null,
        stock: variantSeed.stock,
        productId: product.id,
        isPrimary: variantSeed.isPrimary ?? false,
        attributes: variantSeed.attributes ?? Prisma.JsonNull,
      },
      create: {
        productId: product.id,
        title: variantSeed.title,
        sku: variantSeed.sku,
        price: new Prisma.Decimal(variantSeed.price),
        compareAtPrice: variantSeed.compareAtPrice
          ? new Prisma.Decimal(variantSeed.compareAtPrice)
          : null,
        stock: variantSeed.stock,
        isPrimary: variantSeed.isPrimary ?? false,
        attributes: variantSeed.attributes ?? Prisma.JsonNull,
      },
    });

    variantMap.set(variantSeed.sku, variant);

    // eslint-disable-next-line no-await-in-loop
    await tx.inventory.upsert({
      where: { productVariantId: variant.id },
      update: {
        quantityAvailable: variantSeed.stock,
        quantityOnHand: variantSeed.stock,
        quantityReserved: 0,
        lowStockThreshold: Math.min(variantSeed.stock, 5),
      },
      create: {
        productVariantId: variant.id,
        quantityAvailable: variantSeed.stock,
        quantityOnHand: variantSeed.stock,
        quantityReserved: 0,
        lowStockThreshold: Math.min(variantSeed.stock, 5),
      },
    });
  }

  return variantMap;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const seedMediaAssets = async (
  tx: TransactionClient,
  product: Product,
  productMedia: ProductMediaSeed[],
  variantMap: Map<string, ProductVariant>,
): Promise<number> => {
  let mediaCount = 0;

  // eslint-disable-next-line no-restricted-syntax
  for (const mediaSeed of productMedia) {
    // eslint-disable-next-line no-await-in-loop
    const media = await tx.media.upsert({
      where: { assetId: mediaSeed.assetId },
      update: {
        url: mediaSeed.url,
        type: mediaSeed.type,
        provider: mediaSeed.provider,
        mimeType: mediaSeed.mimeType,
        sizeBytes: mediaSeed.sizeBytes,
        width: mediaSeed.width ?? null,
        height: mediaSeed.height ?? null,
        alt: mediaSeed.alt ?? null,
        caption: mediaSeed.caption ?? null,
      },
      create: {
        assetId: mediaSeed.assetId,
        url: mediaSeed.url,
        type: mediaSeed.type,
        provider: mediaSeed.provider,
        mimeType: mediaSeed.mimeType,
        sizeBytes: mediaSeed.sizeBytes,
        width: mediaSeed.width ?? null,
        height: mediaSeed.height ?? null,
        alt: mediaSeed.alt ?? null,
        caption: mediaSeed.caption ?? null,
      },
    });

    // eslint-disable-next-line no-await-in-loop
    await tx.productMedia.upsert({
      where: { productId_mediaId: { productId: product.id, mediaId: media.id } },
      update: {
        sortOrder: mediaSeed.sortOrder ?? null,
        isPrimary: mediaSeed.isPrimary ?? false,
      },
      create: {
        productId: product.id,
        mediaId: media.id,
        sortOrder: mediaSeed.sortOrder ?? null,
        isPrimary: mediaSeed.isPrimary ?? false,
      },
    });

    const variantSkus = mediaSeed.variantSkus ?? [];
    // eslint-disable-next-line no-restricted-syntax
    for (const sku of variantSkus) {
      const variant = variantMap.get(sku);
      if (!variant) {
        log.warn("Skipping variant media assignment – variant not found", {
          sku,
          assetId: media.assetId,
        });
        // eslint-disable-next-line no-continue
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await tx.variantMedia.upsert({
        where: { variantId_mediaId: { variantId: variant.id, mediaId: media.id } },
        update: {
          sortOrder: mediaSeed.sortOrder ?? null,
          isPrimary: mediaSeed.isPrimary ?? false,
        },
        create: {
          variantId: variant.id,
          mediaId: media.id,
          sortOrder: mediaSeed.sortOrder ?? null,
          isPrimary: mediaSeed.isPrimary ?? false,
        },
      });
    }

    mediaCount += 1;
  }

  return mediaCount;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const seedProducts = async (
  tx: TransactionClient,
  products: ProductSeed[],
  categories: Map<string, Category>,
): Promise<{ productCount: number; variantCount: number; mediaCount: number }> => {
  let productCount = 0;
  let variantCount = 0;
  let mediaCount = 0;

  // eslint-disable-next-line no-restricted-syntax
  // eslint-disable-next-line no-await-in-loop
  for (const productSeed of products) {
    // eslint-disable-next-line no-await-in-loop
    const product = await upsertProduct(tx, productSeed);
    productCount += 1;

    await seedProductCategories(tx, product, productSeed.categories, categories);
    // eslint-disable-next-line no-await-in-loop
    const variantMap = await seedProductVariants(tx, product, productSeed.variants);
    variantCount += variantMap.size;

    // eslint-disable-next-line no-await-in-loop
    mediaCount += await seedMediaAssets(tx, product, productSeed.media, variantMap);
  }

  return { productCount, variantCount, mediaCount };
};

const seedDatabase = async (
  prisma: PrismaClient,
  profile: SeedProfileConfig,
): Promise<SeedSummary> => {
  const categories = buildCategorySeeds(profile);
  const products = buildProductSeeds(profile, categories);

  return prisma.$transaction(async (tx) => {
    const roles = await seedRoles(tx);
    const permissions = await seedPermissions(tx);
    const roleAssignments = await seedRolePermissions(tx, roles, permissions);
    await ensureAdminUser(tx, roles);

    const categoryMap = await seedCategoryTree(tx, categories);
    let productTotals = { productCount: 0, variantCount: 0, mediaCount: 0 };

    if (products.length > 0) {
      productTotals = await seedProducts(tx, products, categoryMap);
    } else {
      log.warn("Seed profile does not include sample products", { profile: profile.name });
    }

    return {
      roles: roles.size,
      permissions: permissions.size,
      roleAssignments,
      categories: categoryMap.size,
      products: productTotals.productCount,
      variants: productTotals.variantCount,
      media: productTotals.mediaCount,
    };
  });
};

const validateSeed = async (prisma: PrismaClient, profile: SeedProfileConfig): Promise<void> => {
  const [roleCount, permissionCount, adminUser, productCount, categoryCount, variantCount] =
    await Promise.all([
      prisma.role.count(),
      prisma.permission.count(),
      prisma.user.findUnique({
        where: { email: process.env.SEED_ADMIN_EMAIL ?? ADMIN_DEFAULTS.email },
      }),
      prisma.product.count(),
      prisma.category.count(),
      prisma.productVariant.count(),
    ]);

  const validationErrors: string[] = [];

  if (roleCount < getBaseRoles().length) {
    validationErrors.push("Expected base roles to be seeded.");
  }

  if (permissionCount < getBasePermissions().length) {
    validationErrors.push("Expected base permissions to be seeded.");
  }

  if (!adminUser) {
    validationErrors.push("Admin user missing.");
  } else if (!/^\$2[aby]\$/u.test(adminUser.passwordHash)) {
    validationErrors.push("Admin user password hash is not in bcrypt format (S1 violation).");
  }

  if (profile.includeSampleProducts && productCount === 0) {
    validationErrors.push("Sample products were expected but none were found.");
  }

  log.info("Seed validation snapshot", {
    profile: profile.name,
    roles: roleCount,
    permissions: permissionCount,
    categories: categoryCount,
    products: productCount,
    variants: variantCount,
  });

  if (validationErrors.length > 0) {
    throw new Error(`Seed validation failed:\n- ${validationErrors.join("\n- ")}`);
  }
};

const main = async (): Promise<void> => {
  const options = parseCliOptions();
  if (options.showHelp) {
    log.info(HELP_MESSAGE);
    return;
  }
  const profile = getSeedProfileConfig(options.profile);

  log.info("Seed profile selected", {
    profile: profile.name,
    description: profile.description,
  });

  const prisma = new PrismaClient();

  try {
    if (options.validateOnly) {
      await validateSeed(prisma, profile);
      log.success("Seed validation completed");
      await prisma.$disconnect();
      return;
    }

    const summary = await seedDatabase(prisma, profile);
    log.success("Seed execution completed", summary);
    await validateSeed(prisma, profile);
    log.success("Seed validation completed");
  } finally {
    await prisma.$disconnect();
  }
};

// Top-level await is unavailable in the CommonJS build used by Prisma seeding, so rely on promises.
// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error) => {
  log.error("Seed execution failed", { error });
  process.exitCode = 1;
});
