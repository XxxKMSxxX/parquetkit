import { JsonLd, faqJsonLd } from "./JsonLd";

interface FaqProps {
  items: { question: string; answer: string }[];
}

export function Faq({ items }: FaqProps) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Frequently asked questions</h2>
      <dl className="flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.question}>
            <dt className="max-w-prose font-medium">{item.question}</dt>
            <dd className="mt-1 max-w-prose text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>
      <JsonLd data={faqJsonLd(items)} />
    </section>
  );
}
