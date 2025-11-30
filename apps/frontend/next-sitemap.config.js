const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lumi-commerce.dev";
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1").replace(
  /\/+$/u,
  "",
);

const safeFetch = async (path) => {
  const url = `${apiBaseUrl}${path}`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.warn(`[sitemap] Failed to fetch ${url}`, error);
    return undefined;
  }
};

const collectProductPaths = async () => {
  const perPage = 100;
  const paths = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && page <= 50) {
    const payload = await safeFetch(`/catalog/products?page=${page}&perPage=${perPage}`);
    const data = payload?.data ?? [];
    data.forEach((product) => {
      if (product?.slug) {
        paths.push(`/products/${product.slug}`);
      }
    });
    hasNextPage = payload?.meta?.pagination?.hasNextPage ?? false;
    page += 1;
  }

  return paths;
};

const collectCategoryPaths = async () => {
  const payload = await safeFetch("/categories");
  const categories = payload?.data?.items ?? payload?.data ?? [];
  return categories
    .map((category) => category?.slug)
    .filter(Boolean)
    .map((slug) => `/products?category=${slug}`);
};

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl,
  generateRobotsTxt: false,
  sitemapSize: 7000,
  sourceDir: ".next-build",
  exclude: ["/admin/*", "/dashboard/*", "/api/*"],
  transform: async (config, path) => {
    const priority = (() => {
      if (path === "/") return 1.0;
      if (path.startsWith("/products/")) return 0.9;
      if (path.startsWith("/products")) return 0.8;
      if (path.startsWith("/checkout") || path.startsWith("/cart")) return 0.7;
      return 0.6;
    })();

    const changefreq = path.startsWith("/products") ? "daily" : "weekly";

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
    };
  },
  additionalPaths: async (config) => {
    const [productPaths, categoryPaths] = await Promise.all([
      collectProductPaths(),
      collectCategoryPaths(),
    ]);

    const uniquePaths = Array.from(new Set([...productPaths, ...categoryPaths]));

    return uniquePaths.map((path) => ({
      loc: path,
      changefreq: path.startsWith("/products") ? "daily" : "weekly",
      priority: path.startsWith("/products/") ? 0.9 : 0.7,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
    }));
  },
};
