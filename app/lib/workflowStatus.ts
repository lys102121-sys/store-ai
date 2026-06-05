export type WorkflowHandlingType =
  | "auto_ready"
  | "needs_review"
  | "needs_approval";
export type WorkflowRiskLevel = "low" | "normal" | "high";
export type WorkflowSentiment = "positive" | "neutral" | "negative";
export type WorkflowStatus = "pending" | "needs_review" | "completed";

export function resolveCsWorkflowStatus({
  autoCompleteLowRisk,
  handlingType,
  riskLevel,
  hasMissingInfo,
}: {
  autoCompleteLowRisk: boolean | null | undefined;
  handlingType: WorkflowHandlingType;
  riskLevel: WorkflowRiskLevel;
  hasMissingInfo?: boolean;
}): WorkflowStatus {
  if (hasMissingInfo || handlingType === "needs_review") {
    return "needs_review";
  }

  if (
    autoCompleteLowRisk &&
    handlingType === "auto_ready" &&
    riskLevel === "low"
  ) {
    return "completed";
  }

  return "pending";
}

export function resolveReviewWorkflowStatus({
  autoCompletePositiveReviews,
  sentiment,
  handlingType,
  riskLevel,
}: {
  autoCompletePositiveReviews: boolean | null | undefined;
  sentiment: WorkflowSentiment;
  handlingType: WorkflowHandlingType;
  riskLevel: WorkflowRiskLevel;
}): WorkflowStatus {
  if (handlingType === "needs_review") {
    return "needs_review";
  }

  if (
    autoCompletePositiveReviews &&
    sentiment === "positive" &&
    handlingType === "auto_ready" &&
    riskLevel === "low"
  ) {
    return "completed";
  }

  return "pending";
}
