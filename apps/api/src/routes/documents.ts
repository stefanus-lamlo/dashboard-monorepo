import { Router } from "express";
import PDFDocument from "pdfkit";
import pptxgenjsImport from "pptxgenjs";

// pptxgenjs's CJS build does `module.exports = PptxGenJS`, but its bundled .d.ts merges
// the class with a namespace in a way NodeNext's stricter interop can't cleanly resolve
// to a constructable type - fall back to `any` at this one boundary rather than fighting it.
const PptxGenJS = pptxgenjsImport as any;
import type { DocumentSummary, SummarizeDocumentResponse } from "@dashboard/shared";
import { getOpenAIClient } from "../lib/openaiClient.js";

export const documentsRouter = Router();

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "") || "summary";
}

// Palette/layout choices follow the ppt-visual skill's design principles (visual
// hierarchy, contrast, full-bleed color blocks, numbered chips over bare bullets,
// real tables for tabular data), using this app's own brand colors for cohesion
// with the dashboard's charts rather than the skill's example hex values.
const PPTX_PALETTE = {
  primary: "16324F", // dark navy - title slide bg, headings, table header
  accent: "2A78D6", // bright blue (matches --series-1) - chips, accent bars
  highlight: "EB6834", // warm orange (matches --series-2) - owner emphasis
  background: "F9F9F7", // light warm off-white - content slide bg
  text: "26261F", // near-black body text
  white: "FFFFFF",
} as const;
const PPTX_FONT_HEADING = "Segoe UI Semibold";
const PPTX_FONT_BODY = "Segoe UI";
const PPTX_WIDTH = 13.33; // LAYOUT_WIDE
const PPTX_MARGIN = 0.7;

const SUMMARY_SCHEMA = {
  name: "document_summary",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      overview: { type: "string" },
      keyPoints: { type: "array", items: { type: "string" } },
      decisions: { type: "array", items: { type: "string" } },
      actionItems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            task: { type: "string" },
            owner: { type: ["string", "null"] },
          },
          required: ["task", "owner"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "overview", "keyPoints", "decisions", "actionItems"],
    additionalProperties: false,
  },
} as const;

documentsRouter.post("/summarize", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const titleHint = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!text) {
    res.status(400).json({ error: "Document text is required." });
    return;
  }

  try {
    const openai = getOpenAIClient("document summarization");
    const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You summarize documents and meeting transcripts into structured minutes of meeting (MoM). " +
            "Extract a short title, a 2-4 sentence overview, key discussion points, decisions made, and " +
            "action items with an owner if one is named in the text (otherwise null owner). Be concise " +
            "and factual - don't invent details that aren't in the source text.",
        },
        {
          role: "user",
          content: titleHint ? `Title hint: ${titleHint}\n\nDocument:\n${text}` : `Document:\n${text}`,
        },
      ],
      response_format: { type: "json_schema", json_schema: SUMMARY_SCHEMA },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Model returned no content.");

    const summary: DocumentSummary = JSON.parse(content);
    const body: SummarizeDocumentResponse = { summary };
    res.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to summarize document.";
    console.error("Document summarization failed:", message);
    res.status(502).json({ error: message });
  }
});

documentsRouter.post("/export/pptx", async (req, res) => {
  const summary = req.body?.summary as DocumentSummary | undefined;
  if (!summary?.title) {
    res.status(400).json({ error: "A summary is required." });
    return;
  }

  try {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    const W = PPTX_WIDTH;
    const M = PPTX_MARGIN;
    const contentW = W - M * 2;

    const accentBar = (slide: any, y: number, h: number) =>
      slide.addShape(pptx.ShapeType.rect, { x: M, y, w: 0.06, h, fill: { color: PPTX_PALETTE.accent }, line: { type: "none" } });

    const sectionHeading = (slide: any, heading: string) => {
      accentBar(slide, 0.6, 0.55);
      slide.addText(heading, {
        x: M + 0.25,
        y: 0.55,
        w: contentW,
        h: 0.65,
        fontSize: 26,
        bold: true,
        color: PPTX_PALETTE.primary,
        fontFace: PPTX_FONT_HEADING,
      });
    };

    // Title slide - full-bleed color block, big title, thin accent bar.
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: PPTX_PALETTE.primary };
    titleSlide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 4.55,
      w: W,
      h: 0.05,
      fill: { color: PPTX_PALETTE.accent },
      line: { type: "none" },
    });
    titleSlide.addText("MEETING SUMMARY", {
      x: M,
      y: 2.55,
      w: contentW,
      h: 0.4,
      fontSize: 13,
      bold: true,
      color: PPTX_PALETTE.accent,
      fontFace: PPTX_FONT_BODY,
      charSpacing: 3,
    });
    titleSlide.addText(summary.title, {
      x: M,
      y: 2.95,
      w: contentW,
      h: 1.4,
      fontSize: 34,
      bold: true,
      color: PPTX_PALETTE.white,
      fontFace: PPTX_FONT_HEADING,
    });
    titleSlide.addText(
      `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      { x: M, y: 4.75, w: contentW, h: 0.4, fontSize: 12, color: "9FB3C8", fontFace: PPTX_FONT_BODY },
    );

    // Overview slide.
    const overviewSlide = pptx.addSlide();
    overviewSlide.background = { color: PPTX_PALETTE.background };
    sectionHeading(overviewSlide, "Overview");
    overviewSlide.addText(summary.overview, {
      x: M,
      y: 1.55,
      w: contentW,
      h: 4.5,
      fontSize: 17,
      color: PPTX_PALETTE.text,
      fontFace: PPTX_FONT_BODY,
      lineSpacingMultiple: 1.3,
    });

    // Key points / decisions - numbered chips instead of bare bullets.
    const numberedSlide = (heading: string, lines: string[]) => {
      const slide = pptx.addSlide();
      slide.background = { color: PPTX_PALETTE.background };
      sectionHeading(slide, heading);

      const startY = 1.55;
      const rowH = Math.min(0.95, (7.5 - startY - 0.4) / lines.length);
      lines.forEach((line, i) => {
        const y = startY + i * rowH;
        slide.addShape(pptx.ShapeType.ellipse, {
          x: M,
          y: y + 0.05,
          w: 0.42,
          h: 0.42,
          fill: { color: PPTX_PALETTE.accent },
          line: { type: "none" },
        });
        slide.addText(String(i + 1), {
          x: M,
          y: y + 0.05,
          w: 0.42,
          h: 0.42,
          fontSize: 14,
          bold: true,
          color: PPTX_PALETTE.white,
          align: "center",
          valign: "middle",
          fontFace: PPTX_FONT_BODY,
        });
        slide.addText(line, {
          x: M + 0.65,
          y,
          w: contentW - 0.65,
          h: rowH,
          fontSize: 15,
          color: PPTX_PALETTE.text,
          fontFace: PPTX_FONT_BODY,
          valign: "middle",
        });
      });
    };

    if (summary.keyPoints.length > 0) numberedSlide("Key points", summary.keyPoints);
    if (summary.decisions.length > 0) numberedSlide("Decisions", summary.decisions);

    // Action items - a real table (task | owner) rather than a bullet list.
    if (summary.actionItems.length > 0) {
      const slide = pptx.addSlide();
      slide.background = { color: PPTX_PALETTE.background };
      sectionHeading(slide, "Action items");

      const cellStyle = (color: string, opts: Record<string, unknown> = {}) => ({
        color,
        fontFace: PPTX_FONT_BODY,
        fontSize: 14,
        ...opts,
      });
      const headerRow = [
        { text: "Task", options: cellStyle(PPTX_PALETTE.white, { bold: true, fill: { color: PPTX_PALETTE.primary } }) },
        { text: "Owner", options: cellStyle(PPTX_PALETTE.white, { bold: true, fill: { color: PPTX_PALETTE.primary } }) },
      ];
      const bodyRows = summary.actionItems.map((item) => [
        { text: item.task, options: cellStyle(PPTX_PALETTE.text) },
        { text: item.owner || "—", options: cellStyle(PPTX_PALETTE.highlight, { bold: true }) },
      ]);

      slide.addTable([headerRow, ...bodyRows], {
        x: M,
        y: 1.55,
        w: contentW,
        colW: [contentW * 0.72, contentW * 0.28],
        border: { type: "solid", color: "E1E0D9", pt: 1 },
        autoPage: true,
      });
    }

    const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${slugify(summary.title)}.pptx"`);
    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate PPTX.";
    console.error("PPTX export failed:", message);
    res.status(500).json({ error: message });
  }
});

documentsRouter.post("/export/pdf", (req, res) => {
  const summary = req.body?.summary as DocumentSummary | undefined;
  if (!summary?.title) {
    res.status(400).json({ error: "A summary is required." });
    return;
  }

  try {
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${slugify(summary.title)}.pdf"`);
    doc.pipe(res);

    doc.fontSize(22).font("Helvetica-Bold").text(summary.title);
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#666666")
      .text(`Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
    doc.fillColor("#000000");
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").text("Overview");
    doc.moveDown(0.2);
    doc.fontSize(11).font("Helvetica").text(summary.overview);
    doc.moveDown(1);

    const bulletSection = (heading: string, lines: string[]) => {
      doc.fontSize(14).font("Helvetica-Bold").text(heading);
      doc.moveDown(0.2);
      doc.fontSize(11).font("Helvetica");
      lines.forEach((line) => doc.text(`-  ${line}`));
      doc.moveDown(1);
    };

    if (summary.keyPoints.length > 0) bulletSection("Key points", summary.keyPoints);
    if (summary.decisions.length > 0) bulletSection("Decisions", summary.decisions);
    if (summary.actionItems.length > 0) {
      bulletSection(
        "Action items",
        summary.actionItems.map((a) => `${a.task}${a.owner ? `  (Owner: ${a.owner})` : ""}`),
      );
    }

    doc.end();
  } catch (err) {
    console.error("PDF export failed:", err instanceof Error ? err.message : err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate PDF." });
    } else {
      res.end();
    }
  }
});
