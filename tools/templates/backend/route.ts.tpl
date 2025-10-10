import type { Request, Response, Router } from "express";

/**
 * Registers the {{kebabCaseName}} route with instrumentation-ready handlers.
 */
export function register{{pascalCaseName}}Route(router: Router): void {
  router.get("/{{kebabCaseName}}", async (req: Request, res: Response) => {
    const correlationId = req.headers["x-correlation-id"];
    req.log.info({ correlationId }, "Serving {{kebabCaseName}} payload");

    res.json({
      status: "ok",
      data: {
        id: "{{camelCaseName}}",
        requestedAt: new Date().toISOString()
      }
    });
  });
}
