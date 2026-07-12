"use client";

import { useState } from "react";

interface ShareButtonsProps {
  url: string;
  title: string;
}

// Plain share-intent links only — no third-party SDKs or trackers,
// consistent with the site's no-data-leaves-the-browser promise
export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const targets = [
    {
      name: "X",
      href: `https://x.com/intent/post?text=${encodedTitle}&url=${encodedUrl}`,
    },
    {
      name: "Hacker News",
      href: `https://news.ycombinator.com/submitlink?u=${encodedUrl}&t=${encodedTitle}`,
    },
    {
      name: "Reddit",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      name: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
  ] as const;

  const linkClass =
    "rounded-full border border-neutral-200 px-3 py-1 transition-colors hover:border-sky-500/60 hover:text-sky-600 dark:border-neutral-800 dark:hover:border-sky-400/60 dark:hover:text-sky-400";

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
      <span className="text-neutral-500">Share:</span>
      {targets.map((target) => (
        <a
          key={target.name}
          href={target.href}
          rel="noopener"
          target="_blank"
          className={linkClass}
        >
          {target.name}
        </a>
      ))}
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
        className={linkClass}
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
