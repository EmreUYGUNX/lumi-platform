import { NextResponse, type NextRequest } from "next/server";

interface JwtPayload {
  exp?: number;
  roles?: string[];
  sub?: string;
  [key: string]: unknown;
}

const ACCESS_TOKEN_COOKIE = "accessToken";
const CSRF_COOKIE = "lumi.csrf";
const AUTH_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/magic-link",
]);

// eslint-disable-next-line security/detect-unsafe-regex
const PROTECTED_ROUTE_PATTERNS: RegExp[] = [
  /^\/dashboard(\/.*)?$/i,
  /^\/admin(\/.*)?$/i,
  /^\/account(\/.*)?$/i,
];

const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const isProd = process.env.NODE_ENV === "production";
const enforceGuards = process.env.NEXT_PUBLIC_REQUIRE_AUTH_GUARDS === "true";

const decodeBase64Url = (input: string): string => {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof atob === "function") {
    return atob(padded);
  }

  // Fallback for Node environments that lack atob (should not run in edge)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return Buffer.from(padded, "base64").toString("binary");
};

const decodeJwt = (token: string): JwtPayload | undefined => {
  const parts = token.split(".");
  if (parts.length < 2) {
    return undefined;
  }

  const payloadSegment = parts[1];
  if (!payloadSegment) {
    return undefined;
  }

  try {
    const payload = decodeBase64Url(payloadSegment);
    return JSON.parse(payload) as JwtPayload;
  } catch {
    return undefined;
  }
};

const isExpired = (payload: JwtPayload | undefined): boolean => {
  if (!payload || !payload.exp) {
    return false;
  }
  return payload.exp * 1000 < Date.now();
};

const generateCsrfToken = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const isProtectedPath = (pathname: string): boolean =>
  PROTECTED_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));

const appendCsrf = (request: NextRequest, response: NextResponse): NextResponse => {
  const csrfFromCookie = request.cookies.get(CSRF_COOKIE)?.value;
  const csrfToken = csrfFromCookie ?? generateCsrfToken();

  if (!csrfFromCookie) {
    response.cookies.set(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });
  }

  if (CSRF_METHODS.has(request.method.toUpperCase())) {
    const headerToken = request.headers.get("x-csrf-token") ?? request.headers.get("x-xsrf-token");

    if (!headerToken || headerToken !== csrfToken) {
      console.warn("CSRF validation failed", {
        path: request.nextUrl.pathname,
        method: request.method,
      });
      return NextResponse.redirect(new URL("/403", request.url));
    }
  }

  return response;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const shouldHandle = enforceGuards || isProtectedPath(pathname) || AUTH_ROUTES.has(pathname);
  if (!shouldHandle) {
    return NextResponse.next();
  }

  const bearerToken = request.headers.get("authorization") ?? "";
  const bearerValue = bearerToken.startsWith("Bearer ")
    ? bearerToken.replace("Bearer ", "").trim()
    : undefined;
  const cookieToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const token = cookieToken ?? bearerValue;

  const payload = token ? decodeJwt(token) : undefined;
  const isAuthenticated = Boolean(token && payload && !isExpired(payload));
  const roles = Array.isArray(payload?.roles)
    ? payload.roles.map((role) => String(role).toLowerCase())
    : [];
  const isAdmin = roles.includes("admin");
  const isStaff = roles.includes("staff") || isAdmin;

  if (!isAuthenticated && AUTH_ROUTES.has(pathname)) {
    return appendCsrf(request, NextResponse.next());
  }

  if (isAuthenticated && AUTH_ROUTES.has(pathname)) {
    console.info("Authenticated user attempted to access auth route; redirecting.", { pathname });
    return appendCsrf(request, NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  if (isProtectedPath(pathname)) {
    if (!isAuthenticated) {
      console.warn("Unauthenticated request blocked by middleware", { pathname });
      return appendCsrf(request, NextResponse.redirect(new URL("/login", request.url)));
    }

    if (pathname.toLowerCase().startsWith("/admin") && !isAdmin) {
      console.warn("Unauthorized admin access blocked", { pathname, roles });
      return appendCsrf(request, NextResponse.redirect(new URL("/403", request.url)));
    }

    if (pathname.toLowerCase().startsWith("/dashboard") && !isStaff) {
      // Dashboard default requires at least staff/customer
      return appendCsrf(request, NextResponse.redirect(new URL("/403", request.url)));
    }
  }

  return appendCsrf(request, NextResponse.next());
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
