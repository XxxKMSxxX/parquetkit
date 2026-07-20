import { formatCell } from "@/lib/engine/format/cell";
import type { QueryResult } from "@/lib/engine/duckdb";
import type { SchemaDiff } from "./schema";
import type { DiffSummary } from "./index";

export interface DiffReportMeta {
  oldFileName: string;
  newFileName: string;
  key: string;
  /** ISO timestamp, supplied by the caller so report output stays deterministic. */
  generatedAt: string;
}

export interface DiffReportRowsInput {
  added: QueryResult;
  removed: QueryResult;
  changed: QueryResult;
  /** True if any status was capped before reaching this report (see MAX_REPORT_ROWS). */
  truncated: boolean;
}

export interface DiffReportInput {
  meta: DiffReportMeta;
  schemaDiff: SchemaDiff;
  summary: DiffSummary;
  /** Omit for the free-tier report: summary + schema only, no row-level detail. */
  rows?: DiffReportRowsInput;
}

const STATUS_LABELS = { added: "Added", removed: "Removed", changed: "Changed" } as const;
const TRUNCATION_NOTE =
  "Row detail was truncated: each status is capped at the maximum rows a report can include.";
const UPGRADE_NOTE =
  "This is a free preview (summary and schema only). Upgrade to Pro to include full row-level detail.";

function schemaDiffLines(diff: SchemaDiff): string[] {
  if (diff.identical) return [`Schemas are identical (${diff.common.length} columns).`];
  const lines: string[] = [];
  for (const column of diff.added) {
    lines.push(`+ ${column.name} (${column.logicalType ?? column.type}) — only in new file`);
  }
  for (const column of diff.removed) {
    lines.push(`− ${column.name} (${column.logicalType ?? column.type}) — only in old file`);
  }
  for (const change of diff.typeChanged) {
    lines.push(
      `~ ${change.name}: ${change.leftLogicalType ?? change.leftType} → ${change.rightLogicalType ?? change.rightType}`,
    );
  }
  return lines;
}

function markdownCell(value: unknown): string {
  return formatCell(value).replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ");
}

function markdownTable(result: QueryResult): string {
  const header = `| ${result.columns.join(" | ")} |`;
  const divider = `| ${result.columns.map(() => "---").join(" | ")} |`;
  const rows = result.rows.map(
    (row) => `| ${result.columns.map((column) => markdownCell(row[column])).join(" | ")} |`,
  );
  return [header, divider, ...rows].join("\n");
}

export function buildDiffReportMarkdown(input: DiffReportInput): string {
  const { meta, schemaDiff, summary, rows } = input;
  const lines: string[] = [
    "# Parquet Diff Report",
    "",
    `- Old file: \`${meta.oldFileName}\``,
    `- New file: \`${meta.newFileName}\``,
    `- Join key: \`${meta.key}\``,
    `- Generated: ${meta.generatedAt}`,
    "",
    "## Summary",
    "",
    "| Status | Count |",
    "| --- | --- |",
    `| Added | ${summary.added} |`,
    `| Removed | ${summary.removed} |`,
    `| Changed | ${summary.changed} |`,
    `| Unchanged | ${summary.unchanged} |`,
    "",
    "## Schema",
    "",
    ...schemaDiffLines(schemaDiff),
    "",
  ];

  if (!rows) {
    lines.push(UPGRADE_NOTE);
    return lines.join("\n");
  }

  lines.push("## Rows", "");
  for (const status of ["added", "removed", "changed"] as const) {
    const result = rows[status];
    lines.push(`### ${STATUS_LABELS[status]} (${result.rows.length})`, "");
    lines.push(result.rows.length > 0 ? markdownTable(result) : "_none_", "");
  }
  if (rows.truncated) lines.push(TRUNCATION_NOTE);

  return lines.join("\n").trimEnd();
}

function escapeHtml(raw: string): string {
  return raw.replaceAll(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function htmlTable(result: QueryResult): string {
  const head = result.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = result.rows
    .map(
      (row) =>
        `<tr>${result.columns
          .map((column) => `<td>${escapeHtml(formatCell(row[column]))}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function buildDiffReportHtml(input: DiffReportInput): string {
  const { meta, schemaDiff, summary, rows } = input;

  const schemaHtml = schemaDiffLines(schemaDiff)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");

  const rowSections = rows
    ? (["added", "removed", "changed"] as const)
        .map((status) => {
          const result = rows[status];
          return (
            `<section id="${status}"><h2>${STATUS_LABELS[status]} (${result.rows.length})</h2>` +
            (result.rows.length > 0 ? htmlTable(result) : "<p><em>none</em></p>") +
            "</section>"
          );
        })
        .join("")
    : `<p>${UPGRADE_NOTE}</p>`;

  const truncationHtml = rows?.truncated ? `<p><strong>${TRUNCATION_NOTE}</strong></p>` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Parquet Diff Report</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.85rem; }
th, td { border: 1px solid #ddd; padding: 0.35rem 0.5rem; text-align: left; }
th { background: #f5f5f5; }
h1, h2 { margin-top: 2rem; }
.meta, .summary { font-size: 0.9rem; }
@media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>Parquet Diff Report</h1>
<ul class="meta">
<li>Old file: <code>${escapeHtml(meta.oldFileName)}</code></li>
<li>New file: <code>${escapeHtml(meta.newFileName)}</code></li>
<li>Join key: <code>${escapeHtml(meta.key)}</code></li>
<li>Generated: ${escapeHtml(meta.generatedAt)}</li>
</ul>
<h2>Summary</h2>
<table class="summary">
<thead><tr><th>Status</th><th>Count</th></tr></thead>
<tbody>
<tr><td>Added</td><td>${summary.added}</td></tr>
<tr><td>Removed</td><td>${summary.removed}</td></tr>
<tr><td>Changed</td><td>${summary.changed}</td></tr>
<tr><td>Unchanged</td><td>${summary.unchanged}</td></tr>
</tbody>
</table>
<h2>Schema</h2>
<ul>${schemaHtml}</ul>
${truncationHtml}
${rowSections}
</body>
</html>`;
}
