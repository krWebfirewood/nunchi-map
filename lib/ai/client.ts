import { ollamaScheduleSchema, parsedScheduleJsonSchema, parsedScheduleSchema, type ParsedSchedule } from "./schemas";
import { scheduleParserPrompt } from "./prompts";
import { normalizeParsedSchedule } from "./normalize";
import { recommendationExplanationJsonSchema, recommendationExplanationSchema, type RecommendationExplanation } from "./recommendationSchemas";
import type { RecommendationCandidate } from "@/lib/recommendations/candidates";

interface ParseScheduleInput {
  text: string;
  today: string;
  timezone: string;
}

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

export interface AiClient {
  parseSchedule(input: ParseScheduleInput): Promise<ParsedSchedule>;
  explainRecommendations(candidates: RecommendationCandidate[]): Promise<RecommendationExplanation>;
}

export class AiConnectionError extends Error {}
export class AiResponseError extends Error {}

class OllamaAiClient implements AiClient {
  constructor(private readonly baseUrl: string, private readonly model: string) {}

  async parseSchedule(input: ParseScheduleInput): Promise<ParsedSchedule> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: parsedScheduleJsonSchema,
          keep_alive: "10m",
          options: { temperature: 0, num_ctx: 2048, num_predict: 160 },
          messages: [
            { role: "system", content: scheduleParserPrompt(input.today, input.timezone) },
            { role: "user", content: input.text },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      throw new AiConnectionError(error instanceof Error ? error.message : "Ollama 연결에 실패했습니다.");
    }

    const payload = await response.json().catch(() => null) as OllamaChatResponse | null;
    if (!response.ok) throw new AiConnectionError(payload?.error ?? `Ollama 응답 오류 (${response.status})`);
    if (!payload?.message?.content) throw new AiResponseError("Ollama 응답에 분석 결과가 없습니다.");

    try {
      const raw = ollamaScheduleSchema.parse(JSON.parse(payload.message.content));
      const parsed = parsedScheduleSchema.parse({
        ...raw,
        preferences: {
          maxTravelMinutes: null,
          needsCinema: input.text.includes("영화") ? true : null,
          needsCafe: input.text.includes("카페") ? true : null,
        },
      });
      return normalizeParsedSchedule(input.text, input.today, parsed);
    } catch {
      throw new AiResponseError("Ollama 응답이 일정 스키마와 일치하지 않습니다.");
    }
  }

  async explainRecommendations(candidates: RecommendationCandidate[]): Promise<RecommendationExplanation> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: recommendationExplanationJsonSchema,
          keep_alive: "10m",
          options: { temperature: 0, num_ctx: 1536, num_predict: 220 },
          messages: [
            {
              role: "system",
              content: "당신은 일정 대안 설명 도우미입니다. 제공된 후보만 사용하세요. id를 바꾸거나 새 후보를 만들지 말고, 개인정보를 추측하지 마세요. 각 설명은 짧은 한국어로 작성하세요.",
            },
            { role: "user", content: JSON.stringify(candidates.map(({ id, title, description }) => ({ id, title, description }))) },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      throw new AiConnectionError(error instanceof Error ? error.message : "Ollama 연결에 실패했습니다.");
    }

    const payload = await response.json().catch(() => null) as OllamaChatResponse | null;
    if (!response.ok) throw new AiConnectionError(payload?.error ?? `Ollama 응답 오류 (${response.status})`);
    if (!payload?.message?.content) throw new AiResponseError("Ollama 추천 설명이 비어 있습니다.");

    try {
      return recommendationExplanationSchema.parse(JSON.parse(payload.message.content));
    } catch {
      throw new AiResponseError("Ollama 추천 설명 형식이 올바르지 않습니다.");
    }
  }
}

export function createAiClient(): AiClient {
  const provider = process.env.AI_PROVIDER ?? "ollama";
  if (provider !== "ollama") throw new AiConnectionError(`지원하지 않는 AI 제공자입니다: ${provider}`);
  const baseUrl = (process.env.AI_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
  const model = process.env.AI_MODEL ?? "qwen2.5:7b";
  return new OllamaAiClient(baseUrl, model);
}
