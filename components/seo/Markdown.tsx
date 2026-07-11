import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
  children: string;
}

// react-markdownは生HTMLをレンダリングしない(rehype-raw未使用)ため、
// コンテンツ経由のscript混入は構造的に不可能
export function Markdown({ children }: MarkdownProps) {
  return (
    <div className="prose-sm flex max-w-none flex-col gap-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 [&_a]:underline [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs dark:[&_code]:bg-neutral-900 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-neutral-900 dark:[&_h2]:text-neutral-100 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-neutral-900 dark:[&_h3]:text-neutral-100 [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc [&_table]:w-full [&_td]:border [&_td]:border-neutral-200 [&_td]:px-2 [&_td]:py-1 dark:[&_td]:border-neutral-800 [&_th]:border [&_th]:border-neutral-200 [&_th]:bg-neutral-50 [&_th]:px-2 [&_th]:py-1 dark:[&_th]:border-neutral-800 dark:[&_th]:bg-neutral-900">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
