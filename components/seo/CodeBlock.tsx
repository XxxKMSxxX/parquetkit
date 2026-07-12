"use client";

import { useRef, useState, type HTMLAttributes } from "react";

/** <pre> replacement for Markdown code fences with a hover copy button. */
export function CodeBlock(props: HTMLAttributes<HTMLPreElement>) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="group relative">
      <pre ref={ref} {...props} />
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
