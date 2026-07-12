import { JsonLd, faqJsonLd } from "./JsonLd";

interface FaqProps {
  items: { question: string; answer: string }[];
}

export function Faq({ items }: FaqProps) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2
        id="frequently-asked-questions"
        className="scroll-mt-20 border-b border-neutral-200 pb-2 text-xl font-semibold dark:border-neutral-800"
      >
        Frequently asked questions
      </h2>
      <dl className="flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.question}>
            <dt className="font-medium">{item.question}</dt>
            <dd className="mt-1 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>
      <JsonLd data={faqJsonLd(items)} />
    </section>
  );
}
