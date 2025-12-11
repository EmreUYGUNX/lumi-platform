import { createRequire } from "node:module";

// Node 18 (CI) does not expose `self` globally like Node 20+. Some client bundles
// leveraged during SSG expect `self` to exist, so polyfill it early to avoid
// ReferenceError when Next executes those chunks while collecting page data.
if (typeof globalThis.self === "undefined") {
  globalThis.self = globalThis;
}

const require = createRequire(import.meta.url);
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
  analyzerMode: "static",
  openAnalyzer: false,
});
const isCI = process.env.CI === "true";
const enablePWA = process.env.NEXT_PWA_ENABLED === "true" && !isCI;
const withPWA = require("next-pwa")({
  dest: "public",
  disable:
    !enablePWA || process.env.NEXT_DISABLE_PWA === "true" || process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/[^/]+\/?$/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "lumi-homepage",
        expiration: {
          maxEntries: 2,
          maxAgeSeconds: 60 * 60 * 24,
        },
      },
    },
    {
      urlPattern: /^https?:\/\/res\.cloudinary\.com\/.*\.(?:png|jpg|jpeg|gif|webp|avif)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "lumi-product-images",
        expiration: {
          maxEntries: 120,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: ({ url }) => url.pathname.startsWith("/api/v1/products"),
      handler: "StaleWhileRevalidate",
      method: "GET",
      options: {
        cacheName: "lumi-product-data",
        expiration: {
          maxEntries: 40,
          maxAgeSeconds: 60 * 10,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: ({ url }) => url.pathname.startsWith("/api/v1/cart"),
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "lumi-cart",
        networkTimeoutSeconds: 4,
        expiration: {
          maxEntries: 15,
          maxAgeSeconds: 60,
        },
        cacheableResponse: {
          statuses: [0, 200, 404],
        },
      },
    },
    {
      urlPattern: /\/_next\/image\?url=/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "lumi-next-images",
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
});
const CLOUDINARY_BREAKPOINTS = require("../../packages/shared/media/cloudinary-breakpoints.json");
const CLOUDINARY_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_REMOTE_PATH = CLOUDINARY_CLOUD_NAME ? `/${CLOUDINARY_CLOUD_NAME}/**` : "/**";

const distDir = process.env.NODE_ENV === "development" ? ".next" : ".next-build";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  output: "standalone",
  productionBrowserSourceMaps: process.env.NODE_ENV === "production",
  typedRoutes: true,
  transpilePackages: ["@lumi/ui", "@lumi/shared"],
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/@swc/helpers/esm/**/*"],
  },
  distDir,
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ["@lumi/ui", "@lumi/shared"],
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  serverExternalPackages: ["@prisma/client"],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
    styledComponents: true,
  },
  modularizeImports: {
    lodash: {
      transform: "lodash/{{member}}",
    },
  },
  eslint: {
    dirs: ["src"],
  },
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: CLOUDINARY_BREAKPOINTS,
    minimumCacheTTL: 31536000,
    domains: ["res.cloudinary.com"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: CLOUDINARY_REMOTE_PATH,
      },
    ],
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/products/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, stale-while-revalidate=60",
          },
        ],
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.devtool = "eval-source-map";
    }

    if (!dev) {
      config.optimization.splitChunks = {
        chunks: "all",
        minSize: 20000,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
      };
      config.optimization.runtimeChunk = "single";
    }

    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".js", ".ts", ".tsx"],
      ".mjs": [".mjs", ".mts"],
      ".cjs": [".cjs", ".cts"],
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "node:fs": false,
      "node:path": false,
      "node:url": false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      url: false,
    };

    return config;
  },
};

export default withBundleAnalyzer(withPWA(nextConfig));
