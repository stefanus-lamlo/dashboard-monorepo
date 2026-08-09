import { useEffect, useState } from "react";
import type { DashboardSummary, DateRange } from "@dashboard/shared";
import { fetchDashboard } from "./api";
import { StatCard } from "./components/StatCard";
import { LineChart } from "./components/LineChart";
import { BarChart } from "./components/BarChart";
import { MonthlySalesChart } from "./components/MonthlySalesChart";
import { OrdersTable } from "./components/OrdersTable";
import { ImageGenerator } from "./components/ImageGenerator";
import { DocumentSummarizer } from "./components/DocumentSummarizer";
import { AudioTranscriber } from "./components/AudioTranscriber";
import { FlowchartGenerator } from "./components/FlowchartGenerator";
import { LearningPathGenerator } from "./components/LearningPathGenerator";

const RANGES: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

type View = "dashboard" | "images" | "documents" | "audio" | "flowchart" | "learning";

const VIEW_SUBTITLES: Record<View, string> = {
  dashboard: "An overview of visitors and revenue.",
  images: "Generate images from a text prompt.",
  documents: "Summarize a document or meeting transcript, then export it as PPTX or PDF.",
  audio: "Transcribe a meeting recording (Bahasa Indonesia).",
  flowchart: "Turn a TOR / Kerangka Acuan Kerja document into a flowchart.",
  learning: "Turn any topic into a learning pipeline, track, and material list.",
};

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [range, setRange] = useState<DateRange>("30d");
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [pendingDocumentText, setPendingDocumentText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsFetching(true);
    fetchDashboard(range)
      .then((summary) => {
        if (!cancelled) {
          setData(summary);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong");
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <div className="app-shell">
      <div className="app-header">
        <div>
          <h1>Dashboard</h1>
          <p>{VIEW_SUBTITLES[view]}</p>
        </div>
        {view === "dashboard" && (
          <div className="range-filter" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.value} aria-pressed={range === r.value} onClick={() => setRange(r.value)}>
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="range-filter view-tabs" role="group" aria-label="View">
        <button aria-pressed={view === "dashboard"} onClick={() => setView("dashboard")}>
          Dashboard
        </button>
        <button aria-pressed={view === "images"} onClick={() => setView("images")}>
          Image generator
        </button>
        <button aria-pressed={view === "documents"} onClick={() => setView("documents")}>
          Documents
        </button>
        <button aria-pressed={view === "audio"} onClick={() => setView("audio")}>
          Audio
        </button>
        <button aria-pressed={view === "flowchart"} onClick={() => setView("flowchart")}>
          TOR flowchart
        </button>
        <button aria-pressed={view === "learning"} onClick={() => setView("learning")}>
          Learning path
        </button>
      </div>

      {view === "images" && <ImageGenerator />}
      {view === "documents" && (
        <DocumentSummarizer
          initialText={pendingDocumentText}
          onInitialTextConsumed={() => setPendingDocumentText(null)}
        />
      )}
      {view === "audio" && (
        <AudioTranscriber
          onUseInDocuments={(transcript) => {
            setPendingDocumentText(transcript);
            setView("documents");
          }}
        />
      )}
      {view === "flowchart" && <FlowchartGenerator />}
      {view === "learning" && <LearningPathGenerator />}

      {view === "dashboard" && (
        <>
          {error && !data && <p className="status-line">Couldn't load dashboard data: {error}</p>}

          {data && (
            <div style={{ opacity: isFetching ? 0.6 : 1, transition: "opacity 150ms" }}>
              <div className="stat-grid">
                {data.stats.map((stat) => (
                  <StatCard key={stat.id} stat={stat} />
                ))}
              </div>
              <div className="chart-grid">
                <LineChart data={data.visitors} />
                <BarChart data={data.revenueByCategory} selectedCategory={category} onSelectCategory={setCategory} />
              </div>
              <MonthlySalesChart data={data.monthlySales} />
              <OrdersTable
                orders={data.orders}
                categoryFilter={category}
                onClearCategory={() => setCategory(null)}
                rangeLabel={range}
              />
            </div>
          )}

          {!data && !error && <p className="status-line">Loading dashboard…</p>}
        </>
      )}
    </div>
  );
}
