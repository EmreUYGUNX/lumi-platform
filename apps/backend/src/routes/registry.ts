/* istanbul ignore file -- registry utilities exercised indirectly via integration tests */
import type { Application, Express } from "express";

export type RouteRegistry = Map<string, Set<string>>;

const ROUTE_REGISTRY_KEY = "routeRegistry";

const normaliseSegment = (segment: string): string => {
  if (!segment) {
    return "";
  }

  const trimmed = segment.trim();
  if (!trimmed) {
    return "";
  }

  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (prefixed === "/") {
    return "";
  }

  return prefixed.endsWith("/") ? prefixed.slice(0, -1) : prefixed;
};

const joinPath = (prefix: string, path: string): string => {
  const normalisedPrefix = normaliseSegment(prefix);
  const normalisedPath = normaliseSegment(path);

  const combined = `${normalisedPrefix}${normalisedPath}`;
  if (!combined) {
    return "/";
  }

  return combined.startsWith("/") ? combined : `/${combined}`;
};

export const createRouteRegistry = (): RouteRegistry => new Map<string, Set<string>>();

export const attachRouteRegistry = (app: Express, registry: RouteRegistry): void => {
  app.set(ROUTE_REGISTRY_KEY, registry);
};

export const getRouteRegistry = (app: Application): RouteRegistry | undefined =>
  app.get(ROUTE_REGISTRY_KEY);

export const registerRoute = (registry: RouteRegistry, method: string, path: string): void => {
  const normalisedPath = joinPath("", path);
  const normalisedMethod = method.toUpperCase();

  if (!registry.has(normalisedPath)) {
    registry.set(normalisedPath, new Set<string>());
  }

  registry.get(normalisedPath)?.add(normalisedMethod);
};

export const getAllowedMethodsForPath = (registry: RouteRegistry, path: string): string[] => {
  const normalisedPath = joinPath("", path);
  const methods = registry.get(normalisedPath);

  if (!methods) {
    return [];
  }

  return [...methods].sort();
};

export const createRouteRegistrar =
  (registry: RouteRegistry, prefix = "") =>
  (method: string, path: string) => {
    const combinedPath = joinPath(prefix, path);
    registerRoute(registry, method, combinedPath);
  };

export const buildRequestPath = (baseUrl: string, path: string): string => joinPath(baseUrl, path);
