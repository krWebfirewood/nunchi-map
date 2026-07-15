import { ollamaScheduleSchema, parsedScheduleJsonSchema, parsedScheduleSchema, type ParsedSchedule } from "./schemas";
import { scheduleParserPrompt } from "./prompts";
import { normalizeParsedSchedule } from "./normalize";

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
}

export function createAiClient(): AiClient {
  const provider = process.env.AI_PROVIDER ?? "ollama";
  if (provider !== "ollama") throw new AiConnectionError(`지원하지 않는 AI 제공자입니다: ${provider}`);
  const baseUrl = (process.env.AI_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
  const model = process.env.AI_MODEL ?? "qwen2.5:7b";
  return new OllamaAiClient(baseUrl, model);
}
