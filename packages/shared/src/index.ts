export type DateRange = "7d" | "30d" | "90d";

export type StatUnit = "currency" | "percent" | "count";

export interface Stat {
  id: string;
  label: string;
  value: number;
  unit: StatUnit;
  /** signed percent change vs. the previous period */
  delta: number;
  /** whether an increase in this stat is good (e.g. false for "bounce rate") */
  higherIsBetter: boolean;
}

export interface VisitorPoint {
  date: string; // ISO date, e.g. "2026-07-15"
  visitors: number;
}

export interface RevenueByCategory {
  category: string;
  revenue: number;
}

export type OrderStatus = "paid" | "pending" | "refunded";

export interface Order {
  id: string;
  date: string; // ISO date, e.g. "2026-07-15"
  customer: string;
  category: string;
  amount: number;
  status: OrderStatus;
}

export interface MonthlySales {
  month: string; // short label, e.g. "Jan"
  sales2025: number;
  /** null for months in 2026 that haven't happened yet */
  sales2026: number | null;
}

export interface DashboardSummary {
  range: DateRange;
  stats: Stat[];
  visitors: VisitorPoint[];
  revenueByCategory: RevenueByCategory[];
  orders: Order[];
  monthlySales: MonthlySales[];
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  imageDataUrl: string;
  createdAt: string; // ISO timestamp
  /** present when this was an edit of an uploaded photo, rather than generated from scratch */
  sourceImageDataUrl?: string;
}

export interface GenerateImageRequest {
  prompt: string;
}

export interface GenerateImageResponse {
  image: GeneratedImage;
}

export interface ActionItem {
  task: string;
  owner: string | null;
}

export interface DocumentSummary {
  title: string;
  overview: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
}

export interface SummarizeDocumentRequest {
  title?: string;
  text: string;
}

export interface SummarizeDocumentResponse {
  summary: DocumentSummary;
}

export interface TranscribeAudioResponse {
  transcript: string;
}

export interface TorFlowchart {
  title: string;
  /** Mermaid `flowchart` definition, e.g. "flowchart TD\nA[Start] --> B[...]" */
  mermaidDefinition: string;
  /** Plain-text ordered stage list, as a fallback if the diagram fails to render */
  stages: string[];
}

export interface GenerateFlowchartRequest {
  title?: string;
  text: string;
}

export interface GenerateFlowchartResponse {
  flowchart: TorFlowchart;
}

export interface LearningResource {
  name: string;
  /** free-text kind, e.g. "book", "course", "app", "tool", "equipment", "website" */
  type: string;
  note: string | null;
}

export interface LearningStage {
  title: string;
  description: string;
  milestones: string[];
  resources: LearningResource[];
}

export interface LearningPlan {
  topic: string;
  overview: string;
  /** Mermaid `flowchart` definition of the stage sequence */
  pipelineMermaid: string;
  stages: LearningStage[];
}

export interface GenerateLearningPlanRequest {
  topic: string;
}

export interface GenerateLearningPlanResponse {
  plan: LearningPlan;
}
