// On wide viewports a multi-sentence lead wraps mid-sentence at an arbitrary
// point. Breaking at sentence boundaries instead keeps each line meaningful.
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z])/;

export function Lead({ text }: { text: string }) {
  return (
    <div className="flex flex-col text-neutral-600 dark:text-neutral-400">
      {text.split(SENTENCE_BOUNDARY).map((sentence) => (
        <p key={sentence}>{sentence}</p>
      ))}
    </div>
  );
}
