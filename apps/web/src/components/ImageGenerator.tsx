import { useState } from "react";
import type { GeneratedImage } from "@dashboard/shared";
import { generateImage } from "../api";

export function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isGenerating = pendingPrompt !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;

    setPendingPrompt(trimmed);
    setError(null);
    try {
      const image = await generateImage(trimmed);
      setImages((prev) => [image, ...prev]);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPendingPrompt(null);
    }
  }

  return (
    <div className="image-generator">
      <form className="image-generator-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate…"
          className="image-prompt-input"
          disabled={isGenerating}
        />
        <button type="submit" className="export-button" disabled={isGenerating || !prompt.trim()}>
          {isGenerating ? "Generating…" : "Generate"}
        </button>
      </form>

      {error && <p className="status-line image-error">Couldn't generate image: {error}</p>}

      <div className="image-results">
        {pendingPrompt && (
          <div className="image-result-card">
            <div className="image-result-prompt">{pendingPrompt}</div>
            <div className="image-skeleton" aria-label="Generating image" />
          </div>
        )}
        {images.map((img) => (
          <div key={img.id} className="image-result-card">
            <div className="image-result-prompt">{img.prompt}</div>
            <img src={img.imageDataUrl} alt={img.prompt} className="image-result-img" />
          </div>
        ))}
        {!pendingPrompt && images.length === 0 && !error && (
          <p className="status-line">No images yet — describe one above to get started.</p>
        )}
      </div>
    </div>
  );
}
