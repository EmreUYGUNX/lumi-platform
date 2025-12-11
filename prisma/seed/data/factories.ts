/* eslint-disable sonarjs/no-duplicate-string */
import { Faker, en } from "@faker-js/faker";
import type { MediaProvider, MediaType, ProductStatus } from "@prisma/client";

import {
  BASE_CATEGORY_TREE,
  BASE_PERMISSIONS,
  BASE_ROLES,
  type CategorySeed,
  type PermissionSeed,
  type ProductMediaSeed,
  type ProductSeed,
  type ProductVariantSeed,
  type RoleSeed,
} from "./constants.js";

export type SeedProfileName = "development" | "qa" | "production" | "demo";

export interface SeedProfileConfig {
  name: SeedProfileName;
  description: string;
  fakerSeed: number;
  additionalRootCategories: number;
  additionalChildrenPerRoot: number;
  generatedProductCount: number;
  includeSampleProducts: boolean;
}

const PROFILE_CONFIGS: Record<SeedProfileName, SeedProfileConfig> = {
  development: {
    name: "development",
    description: "Lean dataset for local development.",
    fakerSeed: 2025,
    additionalRootCategories: 0,
    additionalChildrenPerRoot: 0,
    generatedProductCount: 2,
    includeSampleProducts: true,
  },
  qa: {
    name: "qa",
    description: "Expanded dataset for QA scenarios.",
    fakerSeed: 4242,
    additionalRootCategories: 2,
    additionalChildrenPerRoot: 3,
    generatedProductCount: 8,
    includeSampleProducts: true,
  },
  production: {
    name: "production",
    description: "Minimal dataset for production bootstrapping.",
    fakerSeed: 1111,
    additionalRootCategories: 0,
    additionalChildrenPerRoot: 0,
    generatedProductCount: 0,
    includeSampleProducts: false,
  },
  demo: {
    name: "demo",
    description: "Showcase dataset for demos and sandboxes.",
    fakerSeed: 5150,
    additionalRootCategories: 3,
    additionalChildrenPerRoot: 4,
    generatedProductCount: 12,
    includeSampleProducts: true,
  },
};

export function getSeedProfileConfig(name: string): SeedProfileConfig {
  if (name in PROFILE_CONFIGS) {
    return PROFILE_CONFIGS[name as SeedProfileName];
  }

  const validProfiles = Object.keys(PROFILE_CONFIGS).join(", ");
  throw new Error(`Unknown seed profile "${name}". Valid profiles: ${validProfiles}`);
}

export function getBaseRoles(): RoleSeed[] {
  return BASE_ROLES;
}

export function getBasePermissions(): PermissionSeed[] {
  return BASE_PERMISSIONS;
}

const CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "dqmutwjcg";

const buildCloudinaryUrl = (publicId: string): string =>
  `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}`;

const SEED_IMAGE_POOL = [
  "lumi/products/jeans-428614_1920_uflws5",
  "lumi/products/jeans-3051102_1920_hsp61l",
  "lumi/products/kid-7471803_1920_snjfnd",
  "lumi/products/neon-8726714_1920_fcykgq",
  "lumi/products/guy-598180_1920_qfemem",
  "lumi/products/tshirt-8726716_1920_oawa3r",
  "lumi/products/stand-5126363_1920_enrcp9",
  "lumi/products/male-5321547_1920_zy5nsm",
  "lumi/products/young-girl-7409676_1920_ostddl",
  "lumi/products/people-2592339_1920_wxtia8",
  "lumi/products/ai-generated-9565195_1920_dcn8pe",
  "lumi/products/t-shirt-3995093_1920_dijocp",
];

let seedImageCursor = 0;
const nextSeedImage = (): { publicId: string; url: string } => {
  const publicId = SEED_IMAGE_POOL[seedImageCursor % SEED_IMAGE_POOL.length];
  seedImageCursor += 1;
  return { publicId, url: buildCloudinaryUrl(publicId) };
};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^\da-z]+/g, "-")
    .replaceAll(/(^-|-$)+/g, "");

const ensureUniqueSlug = (suggested: string, registry: Set<string>): string => {
  let candidate = suggested;
  let attempt = 1;
  while (registry.has(candidate)) {
    candidate = `${suggested}-${attempt}`;
    attempt += 1;
  }
  registry.add(candidate);
  return candidate;
};

const createFaker = (seed: number): Faker => {
  const faker = new Faker({ locale: [en] });
  faker.seed(seed);
  return faker;
};

const cloneCategory = (category: CategorySeed): CategorySeed => ({
  ...category,
  children: category.children?.map((child) => cloneCategory(child)),
});

export function buildCategorySeeds(profile: SeedProfileConfig): CategorySeed[] {
  const faker = createFaker(profile.fakerSeed);
  let categories = BASE_CATEGORY_TREE.map((category) => cloneCategory(category));

  const generateChildCategory = (parentSlug: string, order: number): CategorySeed => {
    const name = faker.commerce.department();
    return {
      name,
      slug: slugify(`${parentSlug}-${name}`),
      description: faker.commerce.productDescription(),
      displayOrder: order,
    };
  };

  const generateRootCategory = (order: number): CategorySeed => {
    const name = faker.commerce.department();
    return {
      name,
      slug: slugify(name),
      description: faker.company.catchPhrase(),
      displayOrder: order,
      children: Array.from({ length: Math.max(profile.additionalChildrenPerRoot, 1) }).map(
        (_, index) => generateChildCategory(slugify(name), index + 1),
      ),
    };
  };

  if (profile.additionalRootCategories > 0) {
    const startingOrder = categories.length + 1;
    for (let index = 0; index < profile.additionalRootCategories; index += 1) {
      categories.push(generateRootCategory(startingOrder + index));
    }
  } else if (profile.additionalChildrenPerRoot > 0) {
    categories = categories.map((category) => {
      const children = category.children ?? [];
      const additional = Array.from({ length: profile.additionalChildrenPerRoot }).map((_, index) =>
        generateChildCategory(category.slug, children.length + index + 1),
      );
      return {
        ...category,
        children: [...children, ...additional],
      };
    });
  }

  return categories;
}

const createBaseProductSeeds = (): ProductSeed[] => [
  (() => {
    const primary = nextSeedImage();
    const secondary = nextSeedImage();
    return {
      title: "Aurora X1 Smartphone",
      slug: "aurora-x1-smartphone",
      sku: "AURORA-X1",
      summary: "Flagship smartphone with exceptional camera and battery life.",
      description:
        "The Aurora X1 delivers a stunning AMOLED display, triple-lens AI camera system and all-day battery in a premium aluminum frame.",
      status: "ACTIVE" satisfies ProductStatus,
      price: "12999.00",
      compareAtPrice: "13999.00",
      currency: "TRY",
      searchKeywords: ["smartphone", "android", "camera"],
      tags: ["just-dropped"],
      attributes: { warrantyYears: 2, chipset: "LumiCore X", waterproof: true },
      categories: ["smartphones"],
      variants: [
        {
          sku: "AURORA-X1-128",
          title: "Aurora X1 128 GB",
          price: "12999.00",
          compareAtPrice: "13999.00",
          stock: 25,
          isPrimary: true,
          attributes: { storage: "128 GB", color: "Midnight Black" },
        },
        {
          sku: "AURORA-X1-256",
          title: "Aurora X1 256 GB",
          price: "14299.00",
          compareAtPrice: "15299.00",
          stock: 18,
          attributes: { storage: "256 GB", color: "Polar Silver" },
        },
      ],
      media: [
        {
          assetId: primary.publicId,
          url: primary.url,
          type: "IMAGE" satisfies MediaType,
          provider: "CLOUDINARY" satisfies MediaProvider,
          mimeType: "image/jpeg",
          sizeBytes: 785_432,
          width: 1600,
          height: 2000,
          alt: "Aurora X1 showcase",
          caption: "Aurora X1 flagship smartphone",
          isPrimary: true,
          sortOrder: 1,
          variantSkus: ["AURORA-X1-128", "AURORA-X1-256"],
        },
        {
          assetId: secondary.publicId,
          url: secondary.url,
          type: "IMAGE" satisfies MediaType,
          provider: "CLOUDINARY" satisfies MediaProvider,
          mimeType: "image/jpeg",
          sizeBytes: 502_331,
          width: 1600,
          height: 2000,
          alt: "Aurora X1 lifestyle",
          caption: "Ultra wide triple camera system",
          sortOrder: 2,
          variantSkus: ["AURORA-X1-256"],
        },
      ],
    };
  })(),
  (() => {
    const primary = nextSeedImage();
    return {
      title: "Nimbus Pro Laptop",
      slug: "nimbus-pro-laptop",
      sku: "NIMBUS-PRO",
      summary: 'Professional-grade laptop with 16" 4K display and 12-core CPU.',
      description:
        'Designed for creators and developers, the Nimbus Pro pairs a 12-core processor with a dedicated GPU and 16" 4K display for uncompromising productivity.',
      status: "ACTIVE" satisfies ProductStatus,
      price: "36999.00",
      compareAtPrice: "38999.00",
      currency: "TRY",
      searchKeywords: ["laptop", "4k", "creator"],
      tags: ["just-dropped"],
      attributes: { warrantyYears: 3, weightKg: 1.4 },
      categories: ["laptops"],
      variants: [
        {
          sku: "NIMBUS-PRO-I7",
          title: "Nimbus Pro Laptop (i7, 16 GB)",
          price: "36999.00",
          stock: 12,
          isPrimary: true,
          attributes: { cpu: "LumiCore i7", memory: "16 GB", storage: "512 GB SSD" },
        },
        {
          sku: "NIMBUS-PRO-I9",
          title: "Nimbus Pro Laptop (i9, 32 GB)",
          price: "42999.00",
          stock: 8,
          attributes: { cpu: "LumiCore i9", memory: "32 GB", storage: "1 TB SSD" },
        },
      ],
      media: [
        {
          assetId: primary.publicId,
          url: primary.url,
          type: "IMAGE" satisfies MediaType,
          provider: "CLOUDINARY" satisfies MediaProvider,
          mimeType: "image/jpeg",
          sizeBytes: 893_442,
          width: 1800,
          height: 1200,
          alt: "Nimbus Pro laptop hero",
          caption: "Nimbus Pro workstation laptop",
          isPrimary: true,
          sortOrder: 1,
          variantSkus: ["NIMBUS-PRO-I7", "NIMBUS-PRO-I9"],
        },
      ],
    };
  })(),
  (() => {
    const primary = nextSeedImage();
    return {
      title: "EcoBlend Pro Blender",
      slug: "ecoblend-pro-blender",
      sku: "ECOBLEND-PRO",
      summary: "High-performance blender with smart presets and silent motor.",
      description:
        "EcoBlend Pro combines a 1500W motor, sound-dampening shell and smart presets for smoothies, soups and nut milks.",
      status: "ACTIVE" satisfies ProductStatus,
      price: "3499.00",
      compareAtPrice: "3999.00",
      currency: "TRY",
      searchKeywords: ["kitchen", "blender", "appliance"],
      tags: ["just-dropped"],
      attributes: { warrantyYears: 2, capacityLiters: 1.8 },
      categories: ["kitchen"],
      variants: [
        {
          sku: "ECOBLEND-PRO-STD",
          title: "EcoBlend Pro (Standard)",
          price: "3499.00",
          stock: 40,
          isPrimary: true,
          attributes: { color: "Graphite Grey" },
        },
        {
          sku: "ECOBLEND-PRO-PREM",
          title: "EcoBlend Pro (Premium Accessories)",
          price: "4199.00",
          stock: 22,
          attributes: { color: "Arctic White", accessories: ["Travel cup", "Grinding blade"] },
        },
      ],
      media: [
        {
          assetId: primary.publicId,
          url: primary.url,
          type: "IMAGE" satisfies MediaType,
          provider: "CLOUDINARY" satisfies MediaProvider,
          mimeType: "image/jpeg",
          sizeBytes: 623_441,
          width: 1400,
          height: 1400,
          alt: "EcoBlend Pro hero",
          caption: "EcoBlend Pro countertop blender",
          isPrimary: true,
          sortOrder: 1,
          variantSkus: ["ECOBLEND-PRO-STD", "ECOBLEND-PRO-PREM"],
        },
      ],
    };
  })(),
  (() => {
    const primary = nextSeedImage();
    return {
      title: "LumiGlow Floor Lamp",
      slug: "lumiglow-floor-lamp",
      sku: "LUMIGLOW-FLOOR",
      summary: "Ambient LED floor lamp with voice assistant integration.",
      description:
        "Set the perfect mood with 16 million colors, scene presets and smart assistant control using the LumiGlow floor lamp.",
      status: "ACTIVE" satisfies ProductStatus,
      price: "2199.00",
      compareAtPrice: "2499.00",
      currency: "TRY",
      searchKeywords: ["lighting", "smart home", "decor"],
      tags: ["just-dropped"],
      attributes: { warrantyYears: 2, heightCm: 130 },
      categories: ["decor"],
      variants: [
        {
          sku: "LUMIGLOW-FLOOR-BLK",
          title: "LumiGlow Floor Lamp (Black)",
          price: "2199.00",
          stock: 35,
          isPrimary: true,
          attributes: { color: "Black" },
        },
        {
          sku: "LUMIGLOW-FLOOR-GLD",
          title: "LumiGlow Floor Lamp (Champagne Gold)",
          price: "2399.00",
          stock: 15,
          attributes: { color: "Champagne Gold" },
        },
      ],
      media: [
        {
          assetId: primary.publicId,
          url: primary.url,
          type: "IMAGE" satisfies MediaType,
          provider: "CLOUDINARY" satisfies MediaProvider,
          mimeType: "image/jpeg",
          sizeBytes: 512_304,
          width: 1600,
          height: 2000,
          alt: "LumiGlow floor lamp hero",
          caption: "Modern LED floor lamp with smart control",
          isPrimary: true,
          sortOrder: 1,
          variantSkus: ["LUMIGLOW-FLOOR-BLK", "LUMIGLOW-FLOOR-GLD"],
        },
      ],
    };
  })(),
];

const buildGeneratedProduct = (
  faker: Faker,
  categories: string[],
  slugRegistry: Set<string>,
  profile: SeedProfileConfig,
  index: number,
): ProductSeed => {
  const productName = faker.commerce.productName();
  const baseSlug = slugify(productName);
  const productSlug = ensureUniqueSlug(baseSlug, slugRegistry);
  const category = faker.helpers.arrayElement(categories);
  const variantCount = faker.number.int({ min: 1, max: 3 });

  const skuPrefix = profile.name.slice(0, 3).toUpperCase();
  const baseSkuSegment = productSlug.replaceAll("-", "").slice(0, 8).toUpperCase();
  const baseSku = `${skuPrefix}-${baseSkuSegment}-${index + 1}`;
  const price = faker.commerce.price({ min: 199, max: 9999, dec: 2 });

  const variants: ProductVariantSeed[] = Array.from({ length: variantCount }).map(
    (_, variantIndex) => {
      const suffix = String.fromCodePoint(65 + variantIndex);
      const variantSku = `${baseSku}-${suffix}`;
      return {
        sku: variantSku,
        title: `${productName} ${suffix}`,
        price,
        stock: faker.number.int({ min: 10, max: 60 }),
        isPrimary: variantIndex === 0,
        attributes: {
          color: faker.color.human(),
          size: faker.helpers.arrayElement(["XS", "S", "M", "L", "XL"]),
        },
      };
    },
  );

  const heroImage = nextSeedImage();
  const media: ProductMediaSeed[] = [
    {
      assetId: heroImage.publicId,
      url: heroImage.url,
      type: "IMAGE" satisfies MediaType,
      provider: "CLOUDINARY" satisfies MediaProvider,
      mimeType: "image/jpeg",
      sizeBytes: faker.number.int({ min: 350_000, max: 820_000 }),
      width: 1600,
      height: 2000,
      alt: `${productName} product photo`,
      caption: `${productName} lifestyle`,
      isPrimary: true,
      sortOrder: 1,
      variantSkus: variants.map((variant) => variant.sku),
    },
  ];

  return {
    title: productName,
    slug: productSlug,
    sku: baseSku,
    summary: faker.commerce.productDescription(),
    description: faker.lorem.paragraph(),
    status: "ACTIVE" satisfies ProductStatus,
    price,
    currency: "TRY",
    searchKeywords: [
      faker.commerce.productMaterial().toLowerCase(),
      faker.commerce.productAdjective().toLowerCase(),
    ],
    tags: ["just-dropped"],
    attributes: { brand: faker.company.name() },
    categories: [category],
    variants,
    media,
  };
};

export function buildProductSeeds(
  profile: SeedProfileConfig,
  categories: CategorySeed[],
): ProductSeed[] {
  if (!profile.includeSampleProducts) {
    return [];
  }

  const faker = createFaker(profile.fakerSeed);
  const baseProducts = createBaseProductSeeds();
  const slugRegistry = new Set(baseProducts.map((product) => product.slug));

  const categorySlugs = categories
    .flatMap((category) => {
      const childSlugs = category.children?.map((child) => child.slug) ?? [];
      return childSlugs.length > 0 ? childSlugs : [category.slug];
    })
    .filter(Boolean);

  const generatedProducts = Array.from({ length: profile.generatedProductCount }, (_, index) =>
    buildGeneratedProduct(faker, categorySlugs, slugRegistry, profile, index),
  );

  return [...baseProducts, ...generatedProducts];
}
