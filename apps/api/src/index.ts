import "dotenv/config";
import cors from "cors";
import express from "express";
import { audioRouter } from "./routes/audio.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { documentsRouter } from "./routes/documents.js";
import { flowchartRouter } from "./routes/flowchart.js";
import { imagesRouter } from "./routes/images.js";
import { learningRouter } from "./routes/learning.js";
import { aiRateLimiter } from "./lib/rateLimiter.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

// Unset (default) allows any origin, which is fine for local dev. Set CORS_ORIGIN in
// production to your actual web app's origin - see README's production notes.
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN } : undefined));
app.use(express.json({ limit: "2mb" })); // meeting transcripts can be long

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/dashboard", dashboardRouter);
app.use("/api/images", aiRateLimiter, imagesRouter);
app.use("/api/documents", aiRateLimiter, documentsRouter);
app.use("/api/audio", aiRateLimiter, audioRouter);
app.use("/api/flowchart", aiRateLimiter, flowchartRouter);
app.use("/api/learning", aiRateLimiter, learningRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Catches malformed JSON bodies (express.json() throws a SyntaxError for those) and any
// other error that reaches here uncaught, so clients always get the same JSON error shape
// every route already uses, instead of Express's default HTML/stack-trace response.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof SyntaxError && "status" in err && (err as { status?: number }).status === 400) {
    res.status(400).json({ error: "Malformed JSON in request body." });
    return;
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
