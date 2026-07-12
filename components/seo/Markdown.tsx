import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface MarkdownProps {
  children: string;
}

// react-markdown does not render raw HTML (rehype-raw is not used),
// so script injection via content is structurally impossible
export function Markdown({ children }: MarkdownProps) {
  return (
    <div className="prose-sm flex max-w-none flex-col gap-4 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400 [&_a]:underline [&_a]:decoration-neutral-400 hover:[&_a]:text-sky-600 dark:hover:[&_a]:text-sky-400 [&_strong]:text-neutral-900 dark:[&_strong]:text-neutral-100 [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-sky-700 dark:[&_code]:text-sky-300 dark:[&_code]:bg-neutral-900 [&_h2]:mt-2 [&_h2]:border-b [&_h2]:border-neutral-200 [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-neutral-900 dark:[&_h2]:border-neutral-800 dark:[&_h2]:text-neutral-100 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-sky-700 dark:[&_h3]:text-sky-300 [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-neutral-200 [&_pre]:bg-neutral-50 [&_pre]:p-4 dark:[&_pre]:border-neutral-800 dark:[&_pre]:bg-neutral-950 [&_pre_code]:block [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[13px] [&_pre_code]:leading-relaxed [&_pre_code]:text-neutral-800 dark:[&_pre_code]:text-neutral-300 [&_table]:w-full [&_td]:border [&_td]:border-neutral-200 [&_td]:px-2 [&_td]:py-1 dark:[&_td]:border-neutral-800 [&_th]:border [&_th]:border-neutral-200 [&_th]:bg-neutral-50 [&_th]:px-2 [&_th]:py-1 dark:[&_th]:border-neutral-800 dark:[&_th]:bg-neutral-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{ pre: CodeBlock }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
