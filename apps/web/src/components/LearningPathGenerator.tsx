import { useRef, useState } from "react";
import type { LearningPlan } from "@dashboard/shared";
import { generateLearningPlan } from "../api";
import { useMermaidRender } from "../hooks/useMermaidRender";

export function LearningPathGenerator() {
  const [topic, setTopic] = useState("");
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const diagramRef = useRef<HTMLDivElement>(null);

  useMermaidRender(plan?.pipelineMermaid, diagramRef, setRenderError);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setRenderError(null);
    try {
      const result = await generateLearningPlan(trimmed);
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="learning-path-generator">
      <form className="image-generator-form" onSubmit={handleSubmit}>
        <div className="image-generator-inputs">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder='Any topic - "jazz piano", "building muscle", "learn Rust"…'
            className="image-prompt-input"
            disabled={isGenerating}
          />
          <button type="submit" className="export-button" disabled={isGenerating || !topic.trim()}>
            {isGenerating ? "Generating…" : "Generate plan"}
          </button>
        </div>
      </form>

      {error && <p className="status-line image-error">Couldn't generate a learning plan: {error}</p>}

      {plan && (
        <div className="summary-card learning-plan-card">
          <div className="summary-card-header">
            <h2>{plan.topic}</h2>
          </div>

          <p className="summary-overview">{plan.overview}</p>

          {renderError && (
            <p className="status-line image-error">
              Couldn't render the pipeline diagram ({renderError}) — the stages below still show the full plan.
            </p>
          )}

          <div ref={diagramRef} className="flowchart-diagram" />

          {plan.stages.map((stage, i) => (
            <div className="summary-section learning-stage" key={i}>
              <h3>
                <span className="stage-number">{i + 1}</span>
                {stage.title}
              </h3>
              <p className="stage-description">{stage.description}</p>

              {stage.milestones.length > 0 && (
                <>
                  <h4>Milestones</h4>
                  <ul>
                    {stage.milestones.map((milestone, j) => (
                      <li key={j}>{milestone}</li>
                    ))}
                  </ul>
                </>
              )}

              {stage.resources.length > 0 && (
                <>
                  <h4>Materials</h4>
                  <ul className="resource-list">
                    {stage.resources.map((resource, j) => (
                      <li key={j}>
                        <div className="resource-heading">
                          <span>{resource.name}</span>
                          <span className="action-owner resource-type">{resource.type}</span>
                        </div>
                        {resource.note && <p className="resource-note">{resource.note}</p>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {!plan && !error && (
        <p className="status-line">Type any topic above and click Generate plan.</p>
      )}
    </div>
  );
}
