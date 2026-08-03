import { useEffect, useState } from "react";
import type { DocumentSummary } from "@dashboard/shared";
import { downloadSummaryExport, summarizeDocument } from "../api";

export function DocumentSummarizer({
  initialText,
  onInitialTextConsumed,
}: {
  initialText?: string | null;
  onInitialTextConsumed?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pptx" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (initialText) {
      setText(initialText);
      onInitialTextConsumed?.();
    }
    // only react to a fresh handoff from the Audio module, not every parent re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSummarizing) return;

    setIsSummarizing(true);
    setSummarizeError(null);
    setExportError(null);
    try {
      const result = await summarizeDocument(trimmed, title.trim());
      setSummary(result);
    } catch (err) {
      setSummarizeError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSummarizing(false);
    }
  }

  async function handleExport(format: "pptx" | "pdf") {
    if (!summary || exporting) return;
    setExporting(format);
    setExportError(null);
    try {
      await downloadSummaryExport(summary, format);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="document-summarizer">
      <form className="document-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional — inferred from the text if left blank)"
          className="image-prompt-input"
          disabled={isSummarizing}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a document or meeting transcript here… (or transcribe one in the Audio tab)"
          className="document-textarea"
          rows={10}
          disabled={isSummarizing}
        />
        <button type="submit" className="export-button" disabled={isSummarizing || !text.trim()}>
          {isSummarizing ? "Summarizing…" : "Summarize"}
        </button>
      </form>

      {summarizeError && <p className="status-line image-error">Couldn't summarize: {summarizeError}</p>}

      {summary && (
        <div className="summary-card">
          <div className="summary-card-header">
            <h2>{summary.title}</h2>
            <div className="summary-export-actions">
              <button className="export-button" disabled={exporting !== null} onClick={() => handleExport("pptx")}>
                {exporting === "pptx" ? "Exporting…" : "Download PPTX"}
              </button>
              <button className="export-button" disabled={exporting !== null} onClick={() => handleExport("pdf")}>
                {exporting === "pdf" ? "Exporting…" : "Download PDF"}
              </button>
            </div>
          </div>

          {exportError && <p className="status-line image-error">Couldn't export: {exportError}</p>}

          <p className="summary-overview">{summary.overview}</p>

          {summary.keyPoints.length > 0 && (
            <div className="summary-section">
              <h3>Key points</h3>
              <ul>
                {summary.keyPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {summary.decisions.length > 0 && (
            <div className="summary-section">
              <h3>Decisions</h3>
              <ul>
                {summary.decisions.map((decision, i) => (
                  <li key={i}>{decision}</li>
                ))}
              </ul>
            </div>
          )}

          {summary.actionItems.length > 0 && (
            <div className="summary-section">
              <h3>Action items</h3>
              <ul className="action-items">
                {summary.actionItems.map((item, i) => (
                  <li key={i}>
                    <span>{item.task}</span>
                    {item.owner && <span className="action-owner">{item.owner}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!summary && !summarizeError && (
        <p className="status-line">Paste a document or meeting transcript above and click Summarize.</p>
      )}
    </div>
  );
}
