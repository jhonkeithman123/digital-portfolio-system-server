import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncRequestHandler =
  | ((req: Request, res: Response, next: NextFunction) => void)
  | ((req: Request, res: Response, next: NextFunction) => Response<any>)
  | ((
      req: Request,
      res: Response,
      next: NextFunction
    ) => Promise<void | Response<any>>);

export default function wrapAsync(fn: AsyncRequestHandler): RequestHandler {
  return function (req: Request, res: Response, next: NextFunction): void {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error(
        `[ROUTE ERROR] ${new Date().toISOString()} ${req.ip} ${req.method} ${
          req.originalUrl
        } err=${err?.stack || err}`
      );
      next(err);
    });
  };
}
