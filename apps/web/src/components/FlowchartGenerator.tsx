import { useRef, useState } from "react";
import type { TorFlowchart } from "@dashboard/shared";
import { generateFlowchart } from "../api";
import { useMermaidRender } from "../hooks/useMermaidRender";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "") || "flowchart";
}

export function FlowchartGenerator() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [flowchart, setFlowchart] = useState<TorFlowchart | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const diagramRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setRenderError(null);
    try {
      const result = await generateFlowchart(trimmed, title.trim());
      setFlowchart(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  useMermaidRender(flowchart?.mermaidDefinition, diagramRef, setRenderError);

  function downloadSvg() {
    const svgEl = diagramRef.current?.querySelector("svg");
    if (!svgEl || !flowchart) return;
    const blob = new Blob([svgEl.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(flowchart.title)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flowchart-generator">
      <form className="document-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional — inferred from the text if left blank)"
          className="image-prompt-input"
          disabled={isGenerating}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the TOR / Kerangka Acuan Kerja (KAK) document text here…"
          className="document-textarea"
          rows={10}
          disabled={isGenerating}
        />
        <button type="submit" className="export-button" disabled={isGenerating || !text.trim()}>
          {isGenerating ? "Generating…" : "Generate flowchart"}
        </button>
      </form>

      {error && <p className="status-line image-error">Couldn't generate flowchart: {error}</p>}

      {flowchart && (
        <div className="summary-card flowchart-card">
          <div className="summary-card-header">
            <h2>{flowchart.title}</h2>
            <div className="summary-export-actions">
              <button className="export-button" onClick={downloadSvg}>
                Download SVG
              </button>
            </div>
          </div>

          {renderError && (
            <p className="status-line image-error">
              Couldn't render the diagram ({renderError}) — see the raw definition and stage list below instead.
            </p>
          )}

          <div ref={diagramRef} className="flowchart-diagram" />

          <details className="table-toggle">
            <summary>View Mermaid source / stage list</summary>
            <pre className="flowchart-source">{flowchart.mermaidDefinition}</pre>
            <ol className="flowchart-stages">
              {flowchart.stages.map((stage, i) => (
                <li key={i}>{stage}</li>
              ))}
            </ol>
          </details>
        </div>
      )}

      {!flowchart && !error && (
        <p className="status-line">Paste a TOR/KAK document above and click Generate flowchart.</p>
      )}
    </div>
  );
}
