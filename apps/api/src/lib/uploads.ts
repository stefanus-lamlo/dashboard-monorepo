import type { NextFunction, Request, Response } from "express";
import multer from "multer";

// Multer throws synchronously-caught errors (e.g. file too large) via next(err) rather than
// the route handler's try/catch, so every upload route needs this mounted after its multer
// middleware to surface those as JSON instead of Express's default HTML error page.
export function multerErrorHandler(tooLargeMessage: string) {
  return (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? tooLargeMessage : err.message });
      return;
    }
    next(err);
  };
}
