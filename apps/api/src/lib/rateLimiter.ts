import rateLimit from "express-rate-limit";

// Applied only to the OpenAI-backed routes (images/documents/audio/flowchart/learning) -
// those cost real money per request and have no auth in front of them. The mock-data
// dashboard route has no cost and stays unlimited. Per-IP, so it's a blunt safety net
// against runaway bugs/abuse, not real abuse prevention - see README's production notes.
const windowMs = Number(process.env.AI_RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000;
const max = Number(process.env.AI_RATE_LIMIT_MAX || 20);

export const aiRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests - please wait a bit before trying again." },
});
