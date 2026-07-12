"use client";

import { isValidElement, useRef, useState, type HTMLAttributes } from "react";

// rehype-highlight puts "language-sql" on the inner <code>
function languageOf(children: HTMLAttributes<HTMLPreElement>["children"]): string | null {
  const child = Array.isArray(children) ? children[0] : children;
  if (!isValidElement<{ className?: string }>(child)) return null;
  return child.props.className?.match(/language-(\w+)/)?.[1] ?? null;
}

/** <pre> replacement for Markdown code fences with a hover copy button. */
export function CodeBlock(props: HTMLAttributes<HTMLPreElement>) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const language = languageOf(props.children);

  return (
    <div className="group relative">
      <pre ref={ref} {...props} />
      {/* The language label sits where the copy button appears; they swap on hover */}
      {language ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-2 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-neutral-500 transition-opacity group-hover:opacity-0"
        >
          {language}
        </span>
      ) : null}
      <button
        type="button"
        aria-label="Copy code"
        onClick={() => {
          const text = ref.current?.innerText ?? "";
          void navigator.clipboard.writeText(text.trimEnd()).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
        className="absolute right-2 top-2 rounded-md border border-neutral-200 bg-white/80 px-2 py-1 text-xs text-neutral-600 opacity-0 backdrop-blur transition-opacity focus-visible:opacity-100 group-hover:opacity-100 hover:border-sky-500/60 hover:text-sky-600 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-300 dark:hover:border-sky-400/60 dark:hover:text-sky-400"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
