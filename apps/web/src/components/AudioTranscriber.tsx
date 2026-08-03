import { useState } from "react";
import { transcribeAudio } from "../api";

export function AudioTranscriber({ onUseInDocuments }: { onUseInDocuments: (transcript: string) => void }) {
  const [transcript, setTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file again later
    if (!file || isTranscribing) return;

    setIsTranscribing(true);
    setError(null);
    setCopied(false);
    try {
      const result = await transcribeAudio(file);
      setTranscript(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsTranscribing(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="audio-transcriber">
      <label className="audio-upload">
        <span>Upload a meeting recording (Bahasa Indonesia audio)</span>
        <input
          type="file"
          accept="audio/*,video/mp4,video/webm"
          onChange={handleFileChange}
          disabled={isTranscribing}
        />
      </label>

      {isTranscribing && <p className="status-line">Transcribing audio…</p>}
      {error && <p className="status-line image-error">Couldn't transcribe: {error}</p>}

      {transcript && (
        <div className="summary-card">
          <div className="summary-card-header">
            <h2>Transcript</h2>
            <div className="summary-export-actions">
              <button className="export-button" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button className="export-button" onClick={() => onUseInDocuments(transcript)}>
                Summarize in Documents
              </button>
            </div>
          </div>
          <textarea
            className="document-textarea"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={14}
          />
        </div>
      )}

      {!transcript && !isTranscribing && !error && (
        <p className="status-line">Upload an audio file above to see its transcript here.</p>
      )}
    </div>
  );
}
