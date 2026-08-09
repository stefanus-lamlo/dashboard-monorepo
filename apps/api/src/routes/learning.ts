import { Router } from "express";
import type { GenerateLearningPlanResponse, LearningPlan } from "@dashboard/shared";
import { getOpenAIClient } from "../lib/openaiClient.js";

export const learningRouter = Router();

const LEARNING_PLAN_SCHEMA = {
  name: "learning_plan",
  strict: true,
  schema: {
    type: "object",
    properties: {
      topic: { type: "string" },
      overview: { type: "string" },
      pipelineMermaid: { type: "string" },
      stages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            milestones: { type: "array", items: { type: "string" } },
            resources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                  note: { type: ["string", "null"] },
                },
                required: ["name", "type", "note"],
                additionalProperties: false,
              },
            },
          },
          required: ["title", "description", "milestones", "resources"],
          additionalProperties: false,
        },
      },
    },
    required: ["topic", "overview", "pipelineMermaid", "stages"],
    additionalProperties: false,
  },
} as const;

learningRouter.post("/generate", async (req, res) => {
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
  if (!topic) {
    res.status(400).json({ error: "A topic is required." });
    return;
  }

  try {
    const openai = getOpenAIClient("learning plan generation");
    const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You build a practical learning plan for any topic a user gives you - it could be a skill " +
            "(music, a language, a craft), a technical subject (a programming language, a framework), a " +
            "physical goal (building muscle, running a marathon), or anything else. Produce:\n" +
            "1. A 2-3 sentence overview of what learning this actually involves.\n" +
            "2. A pipeline: a valid Mermaid flowchart showing the sequence of stages a learner moves through " +
            "(e.g. Beginner -> Intermediate -> Advanced, or whatever phases genuinely fit this topic).\n" +
            "3. 3-5 stages, each with a title, a 1-2 sentence description, 3-6 concrete milestones " +
            "(specific skills/things to practice or achieve in that stage, not vague advice), and 2-5 " +
            "resources needed for that stage.\n\n" +
            "For resources: name REAL, specific, well-known things where possible - actual book titles, " +
            "actual well-known apps/tools/software, actual equipment (e.g. 'adjustable dumbbells', 'a " +
            "half-size acoustic guitar'), not generic placeholders like 'a good book'. Set `type` to a short " +
            "free-text kind such as book, course, app, tool, equipment, website, or community. Give a short " +
            "`note` on why/how to use it, or null if self-explanatory.\n\n" +
            "Mermaid rules to follow exactly:\n" +
            "- Start with 'flowchart TD'\n" +
            "- Give every node a short alphanumeric id followed by label text in square brackets, e.g. " +
            "A[Beginner: fundamentals]\n" +
            "- Connect nodes in sequence with '-->'; add a feedback loop (e.g. Practice -->|refine| an " +
            "earlier stage) only if that's genuinely how mastery of this topic works\n" +
            "- Keep labels short (under 6 words) and avoid quotes, semicolons, or parentheses inside labels " +
            "since they break Mermaid parsing\n" +
            "- One node per stage is ideal, matching the `stages` you return",
        },
        {
          role: "user",
          content: `Topic: ${topic}`,
        },
      ],
      response_format: { type: "json_schema", json_schema: LEARNING_PLAN_SCHEMA },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Model returned no content.");

    const plan: LearningPlan = JSON.parse(content);
    const body: GenerateLearningPlanResponse = { plan };
    res.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate learning plan.";
    console.error("Learning plan generation failed:", message);
    res.status(502).json({ error: message });
  }
});
