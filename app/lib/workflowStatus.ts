export type WorkflowHandlingType =
  | "auto_ready"
  | "needs_review"
  | "needs_approval";
export type WorkflowRiskLevel = "low" | "normal" | "high";
export type WorkflowSentiment = "positive" | "neutral" | "negative";
export type WorkflowStatus = "pending" | "needs_review" | "completed";
export type AiWorkMode =
  | "approval_only"
  | "safe_auto"
  | "after_hours_conservative";

export function normalizeAiWorkMode(
  value: string | null | undefined,
): AiWorkMode {
  if (
    value === "approval_only" ||
    value === "safe_auto" ||
    value === "after_hours_conservative"
  ) {
    return value;
  }

  return "safe_auto";
}

function parseTimeToMinutes(value: string | null | undefined) {
  if (!value) return null;

  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function getKoreaMinutes(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour =
    Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );

  return hour * 60 + minute;
}

export function isAiWorkModeInActiveHours({
  startTime,
  endTime,
  now,
}: {
  startTime?: string | null;
  endTime?: string | null;
  now?: Date;
}) {
  const startMinutes = parseTimeToMinutes(startTime) ?? 9 * 60;
  const endMinutes = parseTimeToMinutes(endTime) ?? 22 * 60;
  const currentMinutes = getKoreaMinutes(now);

  if (startMinutes === endMinutes) return true;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function canAutoCompleteInCurrentWorkMode({
  aiWorkMode,
  aiWorkStartTime,
  aiWorkEndTime,
  now,
}: {
  aiWorkMode?: string | null;
  aiWorkStartTime?: string | null;
  aiWorkEndTime?: string | null;
  now?: Date;
}) {
  const mode = normalizeAiWorkMode(aiWorkMode);

  if (mode === "approval_only") return false;
  if (mode === "safe_auto") return true;

  return isAiWorkModeInActiveHours({
    startTime: aiWorkStartTime,
    endTime: aiWorkEndTime,
    now,
  });
}

export function resolveCsWorkflowStatus({
  autoCompleteLowRisk,
  aiWorkMode,
  aiWorkStartTime,
  aiWorkEndTime,
  handlingType,
  riskLevel,
  hasMissingInfo,
}: {
  autoCompleteLowRisk: boolean | null | undefined;
  aiWorkMode?: string | null;
  aiWorkStartTime?: string | null;
  aiWorkEndTime?: string | null;
  handlingType: WorkflowHandlingType;
  riskLevel: WorkflowRiskLevel;
  hasMissingInfo?: boolean;
}): WorkflowStatus {
  if (hasMissingInfo || handlingType === "needs_review") {
    return "needs_review";
  }

  if (
    autoCompleteLowRisk &&
    canAutoCompleteInCurrentWorkMode({
      aiWorkMode,
      aiWorkStartTime,
      aiWorkEndTime,
    }) &&
    handlingType === "auto_ready" &&
    riskLevel === "low"
  ) {
    return "completed";
  }

  return "pending";
}

export function resolveReviewWorkflowStatus({
  autoCompletePositiveReviews,
  aiWorkMode,
  aiWorkStartTime,
  aiWorkEndTime,
  sentiment,
  handlingType,
  riskLevel,
}: {
  autoCompletePositiveReviews: boolean | null | undefined;
  aiWorkMode?: string | null;
  aiWorkStartTime?: string | null;
  aiWorkEndTime?: string | null;
  sentiment: WorkflowSentiment;
  handlingType: WorkflowHandlingType;
  riskLevel: WorkflowRiskLevel;
}): WorkflowStatus {
  if (handlingType === "needs_review") {
    return "needs_review";
  }

  if (
    autoCompletePositiveReviews &&
    canAutoCompleteInCurrentWorkMode({
      aiWorkMode,
      aiWorkStartTime,
      aiWorkEndTime,
    }) &&
    sentiment === "positive" &&
    handlingType === "auto_ready" &&
    riskLevel === "low"
  ) {
    return "completed";
  }

  return "pending";
}
