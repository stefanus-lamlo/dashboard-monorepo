import type {
  DashboardSummary,
  DateRange,
  DocumentSummary,
  GeneratedImage,
  GenerateFlowchartResponse,
  GenerateImageResponse,
  GenerateLearningPlanResponse,
  LearningPlan,
  SummarizeDocumentResponse,
  TorFlowchart,
  TranscribeAudioResponse,
} from "@dashboard/shared";

export async function fetchDashboard(range: DateRange): Promise<DashboardSummary> {
  const res = await fetch(`/api/dashboard?range=${range}`);
  if (!res.ok) {
    throw new Error(`Failed to load dashboard data (${res.status})`);
  }
  return res.json();
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const res = await fetch("/api/images/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to generate image (${res.status})`);
  }
  const data: GenerateImageResponse = await res.json();
  return data.image;
}

export async function editImage(file: File, prompt: string): Promise<GeneratedImage> {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("prompt", prompt);

  const res = await fetch("/api/images/edit", { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to edit image (${res.status})`);
  }
  const data: GenerateImageResponse = await res.json();
  return data.image;
}

export async function summarizeDocument(text: string, title: string): Promise<DocumentSummary> {
  const res = await fetch("/api/documents/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, title: title || undefined }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to summarize document (${res.status})`);
  }
  const data: SummarizeDocumentResponse = await res.json();
  return data.summary;
}

export async function transcribeAudio(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("audio", file);

  const res = await fetch("/api/audio/transcribe", { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to transcribe audio (${res.status})`);
  }
  const data: TranscribeAudioResponse = await res.json();
  return data.transcript;
}

export async function generateFlowchart(text: string, title: string): Promise<TorFlowchart> {
  const res = await fetch("/api/flowchart/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, title: title || undefined }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to generate flowchart (${res.status})`);
  }
  const data: GenerateFlowchartResponse = await res.json();
  return data.flowchart;
}

export async function generateLearningPlan(topic: string): Promise<LearningPlan> {
  const res = await fetch("/api/learning/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to generate learning plan (${res.status})`);
  }
  const data: GenerateLearningPlanResponse = await res.json();
  return data.plan;
}

export async function downloadSummaryExport(summary: DocumentSummary, format: "pptx" | "pdf"): Promise<void> {
  const res = await fetch(`/api/documents/export/${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ summary }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to export ${format} (${res.status})`);
  }

  const disposition = res.headers.get("Content-Disposition") || "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `summary.${format}`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
