interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function faqJsonLd(faq: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function softwareAppJsonLd(
  site: string,
  overrides?: { name?: string; description?: string; url?: string },
) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: overrides?.name ?? "ParquetKit",
    url: overrides?.url ?? site,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any (web browser)",
    description:
      overrides?.description ??
      "View, query and convert Parquet files entirely in your browser. No upload, no signup — files never leave your device.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export function techArticleJsonLd(args: {
  site: string;
  slug: string;
  title: string;
  description: string;
  datePublished: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: args.title,
    description: args.description,
    url: `${args.site}/docs/${args.slug}`,
    datePublished: args.datePublished,
    author: { "@type": "Organization", name: "ParquetKit" },
    publisher: { "@type": "Organization", name: "ParquetKit", url: args.site },
  };
}
