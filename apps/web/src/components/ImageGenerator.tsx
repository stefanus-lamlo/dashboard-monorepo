import { useEffect, useRef, useState } from "react";
import type { GeneratedImage } from "@dashboard/shared";
import { editImage, generateImage } from "../api";

function ResultCard({
  prompt,
  sourceUrl,
  children,
}: {
  prompt: string;
  sourceUrl?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="image-result-card">
      <div className="image-result-prompt">{prompt}</div>
      {sourceUrl ? (
        <div className="image-before-after">
          <img src={sourceUrl} alt="Original" className="image-result-img" />
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks every object URL ever created here (including ones handed off to a result card
  // below), so they're all released on unmount instead of just the currently-selected one.
  const objectUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function revoke(url: string) {
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (photoPreviewUrl) revoke(photoPreviewUrl);
    setPhotoFile(file);
    if (!file) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.add(url);
    setPhotoPreviewUrl(url);
  }

  function clearPhoto() {
    if (photoPreviewUrl) revoke(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    try {
      const image = photoFile
        ? { ...(await editImage(photoFile, trimmed)), sourceImageDataUrl: photoPreviewUrl ?? undefined }
        : await generateImage(trimmed);
      setImages((prev) => [image, ...prev]);
      setPrompt("");
      // photoPreviewUrl (if any) is now owned by the result entry above - clear the
      // selection without revoking it, so its object URL stays valid for that entry.
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="image-generator">
      <form className="image-generator-form" onSubmit={handleSubmit}>
        <div className="image-generator-inputs">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={photoFile ? 'Describe the change, e.g. "ghibli style"…' : "Describe the image you want to generate…"}
            className="image-prompt-input"
            disabled={isGenerating}
          />
          <button type="submit" className="export-button" disabled={isGenerating || !prompt.trim()}>
            {isGenerating ? (photoFile ? "Transforming…" : "Generating…") : photoFile ? "Transform photo" : "Generate"}
          </button>
        </div>

        <label className="audio-upload">
          <span>Or upload a photo to transform with the prompt above (optional)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            disabled={isGenerating}
          />
        </label>

        {photoPreviewUrl && (
          <div className="photo-preview">
            <img src={photoPreviewUrl} alt="Selected photo to transform" />
            <button type="button" className="export-button" onClick={clearPhoto} disabled={isGenerating}>
              Remove photo
            </button>
          </div>
        )}
      </form>

      {error && <p className="status-line image-error">Couldn't generate image: {error}</p>}

      <div className="image-results">
        {isGenerating && (
          <ResultCard prompt={prompt} sourceUrl={photoPreviewUrl}>
            <div className="image-skeleton" aria-label="Generating image" />
          </ResultCard>
        )}
        {images.map((img) => (
          <ResultCard key={img.id} prompt={img.prompt} sourceUrl={img.sourceImageDataUrl}>
            <img src={img.imageDataUrl} alt={img.prompt} className="image-result-img" />
          </ResultCard>
        ))}
        {!isGenerating && images.length === 0 && !error && (
          <p className="status-line">No images yet — describe one above to get started.</p>
        )}
      </div>
    </div>
  );
}
