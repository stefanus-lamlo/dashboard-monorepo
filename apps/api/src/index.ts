import "dotenv/config";
import cors from "cors";
import express from "express";
import { audioRouter } from "./routes/audio.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { documentsRouter } from "./routes/documents.js";
import { flowchartRouter } from "./routes/flowchart.js";
import { imagesRouter } from "./routes/images.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json({ limit: "2mb" })); // meeting transcripts can be long

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/dashboard", dashboardRouter);
app.use("/api/images", imagesRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/audio", audioRouter);
app.use("/api/flowchart", flowchartRouter);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
