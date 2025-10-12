import type { RequestHandler } from "express";
import helmet, { type HelmetOptions } from "helmet";

import type { ApplicationConfig } from "@lumi/types";

import { resolveSecurityHeaderMap } from "../security/headers.js";

const NOOP_HANDLER: RequestHandler = (_request, _response, next) => {
  next();
};

const toHelmetDirectiveKey = (directive: string): string =>
  directive
    .trim()
    .split("-")
    .filter((token) => token.length > 0)
    .map((token, index) =>
      index === 0
        ? token.toLowerCase()
        : token.charAt(0).toUpperCase() + token.slice(1).toLowerCase(),
    )
    .join("");

type ContentSecurityPolicyOptions = Exclude<
  HelmetOptions["contentSecurityPolicy"],
  boolean | undefined
>;

type ReferrerPolicyToken =
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "same-origin"
  | "origin"
  | "strict-origin"
  | "origin-when-cross-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url"
  | "";

const REFERRER_POLICY_VALUES = [
  "no-referrer",
  "no-referrer-when-downgrade",
  "same-origin",
  "origin",
  "strict-origin",
  "origin-when-cross-origin",
  "strict-origin-when-cross-origin",
  "unsafe-url",
  "",
] as const satisfies ReferrerPolicyToken[];

const REFERRER_POLICY_TOKENS = new Set<ReferrerPolicyToken>(REFERRER_POLICY_VALUES);

const resolveReferrerPolicy = (policy: string): ReferrerPolicyToken => {
  const candidate = policy as ReferrerPolicyToken;
  if (REFERRER_POLICY_TOKENS.has(candidate)) {
    return candidate;
  }

  return "no-referrer";
};

const parseContentSecurityPolicy = (policy: string): ContentSecurityPolicyOptions | undefined => {
  const trimmed = policy.trim();
  if (!trimmed) {
    return undefined;
  }

  const directivesEntries = trimmed
    .split(";")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => chunk.split(/\s+/));

  if (directivesEntries.length === 0) {
    return undefined;
  }

  const directiveEntries: [string, Iterable<string>][] = [];

  directivesEntries.forEach(([name, ...values]) => {
    if (!name) {
      return;
    }
    const directiveKey = toHelmetDirectiveKey(name);
    if (!directiveKey) {
      return;
    }

    const directiveValues: Iterable<string> = values.length === 0 ? [] : values;
    directiveEntries.push([directiveKey, directiveValues]);
  });

  if (directiveEntries.length === 0) {
    return undefined;
  }

  return {
    useDefaults: false,
    directives: Object.fromEntries(directiveEntries) as NonNullable<
      ContentSecurityPolicyOptions["directives"]
    >,
  };
};

const createHelmetMiddleware = (
  config: ApplicationConfig["security"]["headers"],
): RequestHandler => {
  const options: HelmetOptions = {
    dnsPrefetchControl: true,
    hidePoweredBy: true,
    ieNoOpen: true,
    originAgentCluster: true,
    noSniff: config.xContentTypeOptions === "nosniff",
  };

  if (!config.enabled) {
    return helmet(options);
  }

  const contentSecurityPolicy = parseContentSecurityPolicy(config.contentSecurityPolicy);
  if (contentSecurityPolicy) {
    options.contentSecurityPolicy = contentSecurityPolicy;
  }

  options.crossOriginEmbedderPolicy = { policy: config.crossOriginEmbedderPolicy };
  options.crossOriginOpenerPolicy = { policy: config.crossOriginOpenerPolicy };
  options.crossOriginResourcePolicy = { policy: config.crossOriginResourcePolicy };
  const referrerPolicyOption = {
    policy: resolveReferrerPolicy(config.referrerPolicy),
  } satisfies NonNullable<Parameters<typeof helmet.referrerPolicy>[0]>;

  options.referrerPolicy = referrerPolicyOption;
  options.frameguard = { action: config.frameGuard.toLowerCase() as "deny" | "sameorigin" };
  options.hsts = {
    maxAge: config.strictTransportSecurity.maxAgeSeconds,
    includeSubDomains: config.strictTransportSecurity.includeSubDomains,
    preload: config.strictTransportSecurity.preload,
  };

  return helmet(options);
};

const createSecurityHeaderSetter = (
  config: ApplicationConfig["security"]["headers"],
): RequestHandler => {
  if (!config.enabled) {
    return NOOP_HANDLER;
  }

  const headers = resolveSecurityHeaderMap(config);

  return (_request, response, next) => {
    Object.entries(headers).forEach(([header, value]) => {
      response.setHeader(header, value);
    });

    next();
  };
};

export const createSecurityMiddleware = (
  config: ApplicationConfig["security"]["headers"],
): RequestHandler[] => [createHelmetMiddleware(config), createSecurityHeaderSetter(config)];
