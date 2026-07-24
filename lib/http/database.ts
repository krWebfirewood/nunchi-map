export function databaseUnavailableResponse(context: string, error: unknown): Response {
  console.error(`[database] ${context}`, error);
  return Response.json(
    { message: "데이터베이스 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요." },
    { status: 503, headers: { "Retry-After": "5" } },
  );
}
