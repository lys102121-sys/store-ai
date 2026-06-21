export type WorkflowStatus = "pending" | "needs_review" | "completed" | "answered";
export type HandlingType = "auto_ready" | "needs_review" | "needs_approval";
export type RiskLevel = "low" | "normal" | "high";
export type SourcePlatform =
  | "manual"
  | "smartstore"
  | "coupang"
  | "baemin"
  | "yogiyo"
  | "coupangeats"
  | string;
export type PlatformStatus = "local" | "synced" | "posted" | "failed" | string;
export type WorkflowItemType = "cs" | "review" | "missing_info";
export type WorkflowPlatformFilter =
  | "all"
  | "manual"
  | "smartstore"
  | "coupang"
  | "baemin"
  | "yogiyo"
  | "coupangeats";

export type SemanticTone = "neutral" | "info" | "success" | "warning" | "danger";
export type WorkflowAttentionTone = "warning" | "danger" | null;

const semanticBadgeClasses: Record<SemanticTone, string> = {
  neutral:
    "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
  info:
    "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-200 dark:ring-indigo-800",
  success:
    "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:ring-emerald-800",
  warning:
    "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:ring-amber-800",
  danger:
    "bg-red-100 text-red-800 ring-1 ring-red-200 dark:bg-red-900/50 dark:text-red-200 dark:ring-red-800",
};

export function semanticBadgeClass(tone: SemanticTone) {
  return semanticBadgeClasses[tone];
}

export function normalizeWorkflowStatus(status?: string | null): WorkflowStatus {
  if (
    status === "pending" ||
    status === "needs_review" ||
    status === "completed" ||
    status === "answered"
  ) {
    return status;
  }

  return "pending";
}

export function normalizeHandlingType(value?: string | null): HandlingType {
  if (
    value === "auto_ready" ||
    value === "needs_review" ||
    value === "needs_approval"
  ) {
    return value;
  }

  return "needs_approval";
}

export function normalizeRiskLevel(value?: string | null): RiskLevel {
  if (value === "low" || value === "normal" || value === "high") {
    return value;
  }

  return "normal";
}

export function workflowStatusLabel(status: WorkflowStatus) {
  switch (status) {
    case "needs_review":
      return "확인 필요";
    case "completed":
    case "answered":
      return "답변 완료";
    default:
      return "승인 대기";
  }
}

export function workflowStatusBadgeClass(status: WorkflowStatus) {
  switch (status) {
    case "needs_review":
      return semanticBadgeClass("warning");
    case "completed":
    case "answered":
      return semanticBadgeClass("success");
    default:
      return semanticBadgeClass("info");
  }
}

export function workflowStatusTabClass(status: WorkflowStatus, isSelected: boolean) {
  if (!isSelected) {
    return "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900";
  }

  switch (status) {
    case "needs_review":
      return "border-amber-400 bg-amber-50 text-amber-950 shadow-sm ring-1 ring-amber-200 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900";
    case "completed":
    case "answered":
      return "border-emerald-400 bg-emerald-50 text-emerald-950 shadow-sm ring-1 ring-emerald-200 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900";
    default:
      return "border-indigo-400 bg-indigo-50 text-indigo-950 shadow-sm ring-1 ring-indigo-200 dark:border-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-100 dark:ring-indigo-900";
  }
}

export function handlingTypeLabel(value: HandlingType) {
  switch (value) {
    case "auto_ready":
      return "바로 답변 가능";
    case "needs_review":
      return "사장님 확인 필요";
    default:
      return "승인 필수";
  }
}

export function handlingTypeBadgeClass(value: HandlingType) {
  return value === "auto_ready"
    ? semanticBadgeClass("success")
    : semanticBadgeClass("warning");
}

export function riskLevelLabel(value: RiskLevel) {
  switch (value) {
    case "low":
      return "낮음";
    case "high":
      return "높음";
    default:
      return "보통";
  }
}

export function riskLevelBadgeClass(value: RiskLevel) {
  switch (value) {
    case "low":
      return semanticBadgeClass("success");
    case "high":
      return semanticBadgeClass("danger");
    default:
      return semanticBadgeClass("neutral");
  }
}

export function sourcePlatformLabel(value?: string | null) {
  switch (value) {
    case "manual":
    case undefined:
    case null:
      return "수동 입력";
    case "smartstore":
      return "스마트스토어";
    case "coupang":
      return "쿠팡";
    case "baemin":
      return "배민";
    case "yogiyo":
      return "요기요";
    case "coupangeats":
      return "쿠팡이츠";
    default:
      return value;
  }
}

export function platformStatusLabel(value?: string | null) {
  switch (value) {
    case "local":
    case undefined:
    case null:
      return "앱 내부";
    case "synced":
      return "연동됨";
    case "posted":
      return "플랫폼 등록 완료";
    case "failed":
      return "등록 실패";
    default:
      return value;
  }
}

export function platformStatusBadgeClass(value?: string | null) {
  switch (value) {
    case "posted":
      return semanticBadgeClass("success");
    case "synced":
      return semanticBadgeClass("info");
    case "failed":
      return semanticBadgeClass("danger");
    default:
      return semanticBadgeClass("neutral");
  }
}

export function workflowAttentionTone(
  handlingType: HandlingType,
  riskLevel: RiskLevel,
): WorkflowAttentionTone {
  if (riskLevel === "high") return "danger";
  if (handlingType === "needs_review" || handlingType === "needs_approval") {
    return "warning";
  }

  return null;
}

export function workflowCardAttentionClass(tone: WorkflowAttentionTone) {
  if (tone === "danger") {
    return "border-red-300/90 ring-red-100/80 dark:border-red-700/80 dark:ring-red-900/50";
  }
  if (tone === "warning") {
    return "border-amber-300/80 ring-amber-100/70 dark:border-amber-700/70 dark:ring-amber-900/40";
  }

  return "border-white/80 dark:border-white/10";
}
