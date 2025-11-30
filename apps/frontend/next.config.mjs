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
const CLOUDINARY_BREAKPOINTS = require("../../packages/shared/media/cloudinary-breakpoints.json");
const CLOUDINARY_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_REMOTE_PATH = CLOUDINARY_CLOUD_NAME ? `/${CLOUDINARY_CLOUD_NAME}/**` : "/**";

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

export default withBundleAnalyzer(nextConfig);
