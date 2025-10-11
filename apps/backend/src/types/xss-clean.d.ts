declare module "xss-clean" {
  import type { RequestHandler } from "express";

  interface XssCleanOptions {
    allowList?: Record<string, unknown>;
    stripIgnoreTag?: boolean;
    stripIgnoreTagBody?: string[];
  }

  function xssClean(options?: XssCleanOptions): RequestHandler;

  export default xssClean;
}
