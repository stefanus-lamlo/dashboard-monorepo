import { useEffect } from "react";

let mermaidInitialized = false;

/** Renders a Mermaid definition into `containerRef` whenever it changes, reporting render failures via `onError`. */
export function useMermaidRender(
  definition: string | null | undefined,
  containerRef: React.RefObject<HTMLDivElement>,
  onError: (message: string | null) => void,
) {
  useEffect(() => {
    if (!definition || !containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;

    async function render() {
      try {
        const { default: mermaid } = await import("mermaid");
        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
          mermaidInitialized = true;
        }
        const id = `mermaid-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        const { svg } = await mermaid.render(id, definition);
        if (!cancelled) {
          container.innerHTML = svg;
          onError(null);
        }
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err.message : "Failed to render the diagram");
      }
    }

    render();
    return () => {
      cancelled = true;
    };
    // only re-render when the definition text itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition]);
}
