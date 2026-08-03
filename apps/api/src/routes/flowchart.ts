import { Router } from "express";
import type { GenerateFlowchartResponse, TorFlowchart } from "@dashboard/shared";
import { getOpenAIClient } from "../lib/openaiClient.js";

export const flowchartRouter = Router();

const FLOWCHART_SCHEMA = {
  name: "tor_flowchart",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      mermaidDefinition: { type: "string" },
      stages: { type: "array", items: { type: "string" } },
    },
    required: ["title", "mermaidDefinition", "stages"],
    additionalProperties: false,
  },
} as const;

flowchartRouter.post("/generate", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const titleHint = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!text) {
    res.status(400).json({ error: "TOR / Kerangka Acuan Kerja document text is required." });
    return;
  }

  try {
    const openai = getOpenAIClient("flowchart generation");
    const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You read a Kerangka Acuan Kerja / Terms of Reference (TOR/KAK) document and turn its process " +
            "into a flowchart: the stages/phases, key deliverables, and any approval or decision points, in " +
            "the order they occur. Output a short title and a valid Mermaid flowchart definition.\n\n" +
            "Mermaid rules to follow exactly:\n" +
            "- Start with 'flowchart TD'\n" +
            "- Give every node a short alphanumeric id (A, B, C, ...) followed by label text in square " +
            "brackets for process steps, e.g. A[Kick-off meeting]\n" +
            "- Use curly braces for decision points, e.g. B{Approved?}\n" +
            "- Connect nodes with '-->' and put edge labels in pipes for decisions, e.g. B -->|Yes| C\n" +
            "- Keep labels short (under 6 words) and avoid quotes, semicolons, or parentheses inside labels " +
            "since they break Mermaid parsing\n" +
            "- 6-12 nodes is ideal - group minor sub-steps into their parent stage rather than listing " +
            "everything\n" +
            "Also return `stages` as a plain-text ordered list of the same stages (one string per stage), " +
            "as a fallback for when the diagram can't be rendered.",
        },
        {
          role: "user",
          content: titleHint
            ? `Title hint: ${titleHint}\n\nTOR/KAK document:\n${text}`
            : `TOR/KAK document:\n${text}`,
        },
      ],
      response_format: { type: "json_schema", json_schema: FLOWCHART_SCHEMA },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Model returned no content.");

    const flowchart: TorFlowchart = JSON.parse(content);
    const body: GenerateFlowchartResponse = { flowchart };
    res.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate flowchart.";
    console.error("Flowchart generation failed:", message);
    res.status(502).json({ error: message });
  }
});
