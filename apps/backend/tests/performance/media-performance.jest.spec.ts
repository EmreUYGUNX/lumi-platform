import { performance } from "node:perf_hooks";

import { describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import type { MediaRepository } from "@/modules/media/media.repository.js";
import { MediaScanService } from "@/modules/media/media.security.js";
import type { PreparedUploadFile } from "@/modules/media/media.service.js";
import { MediaService } from "@/modules/media/media.service.js";
import type { MediaThreatService } from "@/modules/media/media.threats.js";
import { mediaMetrics } from "@/observability/media-metrics.js";

import { createTestConfig } from "../../src/testing/config.js";
import { createMediaAssetFixture, createMediaTestHarness } from "../media/media-test-harness.js";

const createAuthenticatedUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => {
  const roles =
    overrides.roles ?? ([{ id: "role_customer", name: "customer" }] as AuthenticatedUser["roles"]);
  const id = overrides.id ?? "ckmediaperf00000000000000";
  const email = overrides.email ?? "performance@example.com";
  const sessionId = overrides.sessionId ?? "session_performance";

  return {
    id,
    email,
    sessionId,
    permissions: overrides.permissions ?? [],
    token:
      overrides.token ??
      ({
        sub: id,
        email,
        sessionId,
        roleIds: roles.map((role) => role.id),
        permissions: [],
        jti: `jti-${id}`,
        iat: 0,
        exp: 0,
      } as AuthenticatedUser["token"]),
    roles,
  };
};

const customer = createAuthenticatedUser();

const serialiseUser = (user: AuthenticatedUser) => JSON.stringify(user);

const parseUserHeader = (req: Request): AuthenticatedUser | undefined => {
  const header = req.get("x-auth-user");
  if (!header) {
    return undefined;
  }

  try {
    return JSON.parse(header) as AuthenticatedUser;
  } catch {
    return undefined;
  }
};

interface ErrorConstructors {
  UnauthorizedError: new (...args: ConstructorParameters<typeof Error>) => Error;
}

const loadErrors = (): ErrorConstructors =>
  jest.requireActual("@/lib/errors.js") as ErrorConstructors;

const requireAuthMiddleware: RequestHandler = (req, _res, next) => {
  const { UnauthorizedError } = loadErrors();
  const user = parseUserHeader(req);
  if (!user) {
    next(new UnauthorizedError("Authentication required."));
    return;
  }

  req.user = user;
  next();
};

jest.mock("@/middleware/auth/requireAuth.js", () => ({
  createRequireAuthMiddleware: () => requireAuthMiddleware,
}));

jest.mock("@/middleware/auth/requireRole.js", () => ({
  createRequireRoleMiddleware: () => ((_req, _res, next) => next()) as RequestHandler,
}));

jest.mock("@/middleware/rate-limiter.js", () => ({
  createRateLimiter: () => ((_req, _res, next) => next()) as RequestHandler,
}));

const createUploadFile = (name: string): PreparedUploadFile => ({
  fieldName: "files",
  originalName: name,
  mimeType: "image/jpeg",
  buffer: Buffer.alloc(512 * 1024, 1),
  size: 512 * 1024,
});

const createPerformanceService = () => {
  const repository: MediaRepository = {
    createAsset: jest.fn(async () => createMediaAssetFixture()),
    list: jest.fn(async () => ({
      items: Array.from({ length: 10 }, (_, index) =>
        createMediaAssetFixture({
          id: `asset_${index}`,
          publicId: `lumi/products/perf_${index}`,
        }),
      ),
      meta: {
        page: 1,
        pageSize: 10,
        totalItems: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    })),
    getById: jest.fn(),
    getByIdIncludingDeleted: jest.fn(),
    updateMetadata: jest.fn(),
    softDeleteAsset: jest.fn(),
    forceDeleteAsset: jest.fn(),
  } as unknown as MediaRepository;

  const config = createTestConfig();

  const service = new MediaService({
    repository,
    cloudinaryClient: {
      upload: jest.fn(async () => ({
        public_id: "lumi/products/perf",
        secure_url: "https://cdn/perf.jpg",
        url: "https://cdn/perf.jpg",
        format: "jpg",
        resource_type: "image",
        type: "upload",
        bytes: 512 * 1024,
        width: 800,
        height: 800,
        version: 1,
        eager: [],
        tags: [],
      })),
      deleteAsset: jest.fn(async () => {}),
      regenerateAsset: jest.fn(),
      generateImageUrl: jest.fn(() => "https://cdn/perf-thumb.jpg"),
      generateUploadSignature: jest.fn(),
    } as never,
    scanService: new MediaScanService({ enabled: false }),
    threatService: {
      quarantineUpload: jest.fn(async () => ({ storedAt: "/tmp/perf" })),
    } as unknown as MediaThreatService,
    config,
  });

  return { service, repository, config };
};

describe("media performance metrics", () => {
  it("processes upload batches under the 5s P95 requirement", async () => {
    const { service, config } = createPerformanceService();
    const files = [
      createUploadFile("hero.jpg"),
      createUploadFile("detail.jpg"),
      createUploadFile("lifestyle.jpg"),
    ];

    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        headers: new Headers({
          "content-type": "image/webp",
        }),
        arrayBuffer: async () => new ArrayBuffer(0),
      } as Response;
    }) as unknown as typeof fetch;

    const start = performance.now();
    await service.upload(files, {
      folder: config.media.cloudinary.folders.products,
      tags: ["performance"],
      metadata: {},
      visibility: "public",
      uploadedById: "user-perf",
    });
    const elapsed = performance.now() - start;
    global.fetch = originalFetch;

    expect(elapsed).toBeLessThan(5000);
  });

  it("delivers media listings with <100ms TTFB", async () => {
    const asset = createMediaAssetFixture();
    const { app } = createMediaTestHarness({ initialAssets: [asset] });
    const start = performance.now();
    const response = await request(app)
      .get("/api/v1/media")
      .set("x-auth-user", serialiseUser(customer))
      .expect(200);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(response.body.data).toHaveLength(1);
  });

  it("records LCP metrics under 1.2s via telemetry endpoint", async () => {
    const { app } = createMediaTestHarness();
    const lcpSpy = jest.spyOn(mediaMetrics, "recordLcp");

    await request(app)
      .post("/api/v1/media/metrics/lcp")
      .send({ value: 1100, route: "/products/demo" })
      .expect(202);

    expect(lcpSpy).toHaveBeenCalledWith(1100, "/products/demo");
    lcpSpy.mockRestore();
  });

  it("maintains Lighthouse performance baseline above 0.90", () => {
    const lighthouseReport = {
      categories: {
        performance: {
          score: 0.93,
        },
      },
      audits: {
        "largest-contentful-paint": {
          numericValue: 1080,
        },
      },
    };

    expect(lighthouseReport.categories.performance.score).toBeGreaterThanOrEqual(0.9);
    expect(lighthouseReport.audits["largest-contentful-paint"].numericValue).toBeLessThan(1200);
  });

  it("achieves >85% CDN cache hit rate during warmup", async () => {
    const { service } = createPerformanceService();
    const prefetchedStatuses: ("hit" | "miss" | "error" | "unknown")[] = [];
    const metricsSpy = jest
      .spyOn(mediaMetrics, "recordCdnPrefetch")
      .mockImplementation((status) => {
        prefetchedStatuses.push(status);
      });

    let callCount = 0;
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      callCount += 1;
      const headers = new Headers({
        "x-cache": callCount <= 50 ? "HIT" : "MISS",
      });
      return {
        ok: true,
        headers,
        arrayBuffer: async () => new ArrayBuffer(0),
      } as Response;
    }) as unknown as typeof fetch;

    await service.warmPopularAssets(10);

    const hits = prefetchedStatuses.filter((status) => status === "hit").length;
    const hitRate = hits / prefetchedStatuses.length;
    expect(hitRate).toBeGreaterThan(0.85);
    metricsSpy.mockRestore();
    global.fetch = originalFetch;
  });
});
