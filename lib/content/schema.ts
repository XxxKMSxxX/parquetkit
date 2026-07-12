import { z } from "zod";
import { parseConversionSlug } from "@/lib/engine/convert/jobs";

export const faqSchema = z.object({
  question: z.string().min(8),
  answer: z.string().min(20),
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD形式の日付のみ許可");

/** convert/[slug] 用コンテンツ。slugはエンジンがサポートする変換ペアに限定する */
export const conversionContentSchema = z.object({
  slug: z.string().refine((slug) => parseConversionSlug(slug) !== null, {
    message: "エンジン未サポートの変換ペアです(SUPPORTED_CONVERSIONSを先に拡張すること)",
  }),
  title: z.string().min(10).max(70),
  description: z.string().min(50).max(170),
  faq: z.array(faqSchema).min(2).max(8),
  date: dateSchema,
});

/** docs/[slug] 用コンテンツ(ガイド記事) */
export const docContentSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-caseのslugのみ許可"),
  title: z.string().min(10).max(70),
  description: z.string().min(50).max(170),
  faq: z.array(faqSchema).max(8).default([]),
  date: dateSchema,
});

export type ConversionContent = z.infer<typeof conversionContentSchema>;
export type DocContent = z.infer<typeof docContentSchema>;
