import { z } from "zod";

export const recommendationExplanationSchema = z.object({
  summary: z.string().trim().min(1).max(200),
  recommendations: z.array(z.object({
    id: z.string().trim().min(1),
    description: z.string().trim().min(1).max(240),
  })).max(4),
});

export type RecommendationExplanation = z.infer<typeof recommendationExplanationSchema>;

export const recommendationExplanationJsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, description: { type: "string" } },
        required: ["id", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "recommendations"],
  additionalProperties: false,
} as const;
