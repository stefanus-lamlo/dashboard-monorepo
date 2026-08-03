import { Router } from "express";
import { getDashboardSummary, isDateRange } from "../data.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", (req, res) => {
  const rangeParam = req.query.range;
  const range = isDateRange(rangeParam) ? rangeParam : "30d";
  res.json(getDashboardSummary(range));
});
