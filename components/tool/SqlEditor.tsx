"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { sql } from "@codemirror/lang-sql";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, placeholder as placeholderExt } from "@codemirror/view";
import { tags } from "@lezer/highlight";

// A pragmatic keyword list covering the DuckDB SQL surface used across this
// site's docs/samples (window functions, UNION ALL BY NAME, DESCRIBE, SUMMARIZE…)
// rather than pulling in a full dialect's keyword table.
const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "LIMIT", "OFFSET",
  "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN", "ON", "USING",
  "AS", "DISTINCT", "HAVING", "UNION", "UNION ALL", "UNION ALL BY NAME",
  "WITH", "OVER", "PARTITION BY", "CASE", "WHEN", "THEN", "ELSE", "END",
  "AND", "OR", "NOT", "NULL", "IS", "IS NULL", "IS NOT NULL", "IN", "LIKE",
  "BETWEEN", "DESCRIBE", "SUMMARIZE", "EXPLAIN", "COPY", "CREATE TABLE",
  "INSERT INTO", "VALUES",
  "COUNT", "SUM", "AVG", "MIN", "MAX", "ROUND", "CAST", "COALESCE",
] as const;

function sqlCompletions(getFileNames: () => string[]) {
  return (context: CompletionContext) => {
    const quoted = context.matchBefore(/'[^']*/);
    if (quoted) {
      const options: Completion[] = getFileNames().map((name) => ({
        label: `'${name}'`,
        type: "text",
        apply: `'${name}'`,
      }));
      if (options.length === 0) return null;
      return { from: quoted.from, options };
    }

    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    return {
      from: word.from,
      options: SQL_KEYWORDS.map((keyword) => ({ label: keyword, type: "keyword" })),
    };
  };
}

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#38bdf8", fontWeight: 600 },
  { tag: [tags.string, tags.special(tags.string)], color: "#86efac" },
  { tag: [tags.number, tags.bool, tags.null], color: "#fbbf24" },
  { tag: tags.comment, color: "#71717a", fontStyle: "italic" },
  { tag: tags.operator, color: "#e4e4e7" },
  { tag: [tags.function(tags.variableName), tags.typeName], color: "#7dd3fc" },
  { tag: tags.paren, color: "#a1a1aa" },
]);

const editorTheme = EditorView.theme({
  "&": {
    // 16px everywhere: below that iOS Safari force-zooms the page on focus
    fontSize: "16px",
    color: "#f4f4f5",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
    padding: "16px",
    caretColor: "#38bdf8",
  },
  ".cm-scroller": { lineHeight: "1.75", overflow: "auto" },
  "&.cm-focused": { outline: "none" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "#52525b",
    border: "none",
  },
  ".cm-activeLineGutter, .cm-activeLine": { backgroundColor: "rgba(56,189,248,0.06)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(56,189,248,0.25) !important",
  },
  ".cm-placeholder": { color: "#71717a", fontFamily: "inherit" },
  ".cm-tooltip": {
    backgroundColor: "#18181b",
    border: "1px solid #3f3f46",
  },
  ".cm-tooltip-autocomplete ul li": {
    padding: "6px 8px", // roomier hit targets for touch
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "#0369a1",
    color: "#f4f4f5",
  },
}, { dark: true });

export interface SqlEditorHandle {
  insertAtCursor: (text: string) => void;
  focus: () => void;
}

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  fileNames: string[];
  placeholder?: string;
  onFocus?: () => void;
}

export const SqlEditor = forwardRef<SqlEditorHandle, SqlEditorProps>(
  function SqlEditor({ value, onChange, onRun, fileNames, placeholder, onFocus }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    // Callbacks/data read from refs inside extensions so the EditorView is
    // created once and doesn't get torn down on every parent re-render
    const onChangeRef = useRef(onChange);
    const onRunRef = useRef(onRun);
    const onFocusRef = useRef(onFocus);
    const fileNamesRef = useRef(fileNames);
    // Read once for the initial doc; later prop changes flow through the
    // sync effect below instead, so this ref intentionally never updates
    const initialValueRef = useRef(value);
    const initialPlaceholderRef = useRef(placeholder);
    onChangeRef.current = onChange;
    onRunRef.current = onRun;
    onFocusRef.current = onFocus;
    fileNamesRef.current = fileNames;

    useEffect(() => {
      if (!containerRef.current) return;

      const view = new EditorView({
        parent: containerRef.current,
        state: EditorState.create({
          doc: initialValueRef.current,
          extensions: [
            lineNumbers(),
            history(),
            closeBrackets(),
            indentUnit.of("  "),
            EditorView.lineWrapping,
            sql(),
            syntaxHighlighting(highlightStyle),
            autocompletion({ override: [sqlCompletions(() => fileNamesRef.current)] }),
            placeholderExt(initialPlaceholderRef.current ?? ""),
            keymap.of([
              { key: "Mod-Enter", run: () => (onRunRef.current(), true) },
              indentWithTab,
              ...closeBracketsKeymap,
              ...completionKeymap,
              ...historyKeymap,
              ...defaultKeymap,
            ]),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) onChangeRef.current(update.state.doc.toString());
            }),
            EditorView.domEventHandlers({
              focus: () => onFocusRef.current?.(),
            }),
            editorTheme,
          ],
        }),
      });
      viewRef.current = view;
      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    // Sync external value changes (sample query, restored draft, chip buttons)
    // into the doc without fighting the user's own typing
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (current === value) return;
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }, [value]);

    useImperativeHandle(
      ref,
      () => ({
        insertAtCursor(text: string) {
          const view = viewRef.current;
          if (!view) return;
          const { from, to } = view.state.selection.main;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
          });
          view.focus();
        },
        focus() {
          viewRef.current?.focus();
        },
      }),
      [],
    );

    return (
      <div
        ref={containerRef}
        data-testid="sql-editor"
        className="w-full resize-y overflow-auto rounded-lg border border-neutral-700 bg-neutral-950 transition-colors focus-within:border-sky-400/60 [&_.cm-editor]:h-full"
        style={{ height: "11rem" }}
      />
    );
  },
);
