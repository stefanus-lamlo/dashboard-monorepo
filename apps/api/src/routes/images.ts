import { Router } from "express";
import multer from "multer";
import { toFile } from "openai";
import type { GenerateImageResponse } from "@dashboard/shared";
import { getOpenAIClient } from "../lib/openaiClient.js";
import { multerErrorHandler } from "../lib/uploads.js";

export const imagesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // matches OpenAI's image edit upload cap
});

function makeImageId(): string {
  return `img-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

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
        id: makeImageId(),
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

imagesRouter.post("/edit", upload.single("image"), async (req, res) => {
  const file = req.file;
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!file) {
    res.status(400).json({ error: "An image file is required." });
    return;
  }
  if (!prompt) {
    res.status(400).json({ error: "A prompt is required." });
    return;
  }

  try {
    const openai = getOpenAIClient("image editing");
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

    // OpenAI's edit endpoint only accepts jpeg/png/webp and infers the type from this
    // content-type rather than the filename, so pass multer's detected mimetype explicitly.
    const mimetype = file.mimetype && file.mimetype !== "application/octet-stream" ? file.mimetype : "image/png";

    const result = await openai.images.edit({
      model,
      image: await toFile(file.buffer, file.originalname || "image.png", { type: mimetype }),
      prompt,
      size: "1024x1024",
      n: 1,
    });

    const item = result.data?.[0];
    if (!item) throw new Error("OpenAI returned no image data.");

    const imageDataUrl = item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url;
    if (!imageDataUrl) throw new Error("OpenAI response did not include image data.");

    // The browser already has the source photo locally (it just uploaded it), so it attaches
    // its own local preview URL as sourceImageDataUrl - no need to round-trip these bytes back.
    const body: GenerateImageResponse = {
      image: {
        id: makeImageId(),
        prompt,
        imageDataUrl,
        createdAt: new Date().toISOString(),
      },
    };
    res.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to edit image.";
    console.error("Image edit failed:", message);
    res.status(502).json({ error: message });
  }
});

imagesRouter.use(multerErrorHandler("Image file is too large (max 25MB)."));
