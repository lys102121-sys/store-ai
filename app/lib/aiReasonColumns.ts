export const aiReasonColumnsSql =
  "alter table reviews add column if not exists ai_reason text; alter table cs_messages add column if not exists ai_reason text;";

export function isMissingAiReasonColumnError(error: { message: string } | null) {
  return Boolean(error && /ai_reason/i.test(error.message));
}

export function warnMissingAiReasonColumns() {
  console.warn(`AI reason columns are missing. Run: ${aiReasonColumnsSql}`);
}

export function withoutAiReason<T extends { ai_reason?: unknown }>(row: T) {
  const fallbackRow = { ...row };
  delete fallbackRow.ai_reason;
  return fallbackRow;
}
