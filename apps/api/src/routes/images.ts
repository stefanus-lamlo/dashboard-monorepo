import { Router } from "express";
import type { GenerateImageResponse } from "@dashboard/shared";
import { getOpenAIClient } from "../lib/openaiClient.js";

export const imagesRouter = Router();

imagesRouter.post("/generate", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) {
    res.status(400).json({ error: "A prompt is required." });
    return;
  }

  try {
    const openai = getOpenAIClient("image generation");
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

    const result = await openai.images.generate({ model, prompt, size: "1024x1024", n: 1 });

    const item = result.data?.[0];
    if (!item) throw new Error("OpenAI returned no image data.");

    const imageDataUrl = item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url;
    if (!imageDataUrl) throw new Error("OpenAI response did not include image data.");

    const body: GenerateImageResponse = {
      image: {
        id: `img-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        prompt,
        imageDataUrl,
        createdAt: new Date().toISOString(),
      },
    };
    res.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate image.";
    console.error("Image generation failed:", message);
    res.status(502).json({ error: message });
  }
});
