export default function wrapAsync(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error(
        `[ROUTE ERROR] ${new Date().toISOString()} ${req.ip} ${req.method} ${req.originalUrl} err=${err?.stack || err}`
      );
      next(err);
    });
  };
}