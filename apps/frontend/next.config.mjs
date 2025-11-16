import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
  analyzerMode: "static",
  openAnalyzer: false
});
const CLOUDINARY_BREAKPOINTS = require("../../packages/shared/media/cloudinary-breakpoints.json");

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  compress: true,
  output: "standalone",
  productionBrowserSourceMaps: process.env.NODE_ENV === "production",
  transpilePackages: ["@lumi/ui", "@lumi/shared"],
  experimental: {
    typedRoutes: true,
    optimizePackageImports: ["@lumi/ui", "@lumi/shared"],
    serverActions: {
      bodySizeLimit: "2mb"
    }
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
    styledComponents: true
  },
  modularizeImports: {
    lodash: {
      transform: "lodash/{{member}}"
    }
  },
  eslint: {
    dirs: ["src"]
  },
  typescript: {
    tsconfigPath: "./tsconfig.json"
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: CLOUDINARY_BREAKPOINTS,
    minimumCacheTTL: 31536000
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5
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
        maxInitialRequests: 30
      };
      config.optimization.runtimeChunk = "single";
    }

    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".js", ".ts", ".tsx"],
      ".mjs": [".mjs", ".mts"],
      ".cjs": [".cjs", ".cts"]
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "node:fs": false,
      "node:path": false,
      "node:url": false
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      url: false
    };

    return config;
  }
};

export default withBundleAnalyzer(nextConfig);
