"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { AppHeader } from "@/app/components/dashboard/AppHeader";
import {
  AnswerModeSelector,
  type AnswerMode,
} from "@/app/components/dashboard/AnswerModeSelector";
import { CsReplyPanel } from "@/app/components/dashboard/CsReplyPanel";
import { CsLearningQualityCard } from "@/app/components/dashboard/CsLearningQualityCard";
import {
  DashboardTabs,
  type DashboardTab,
} from "@/app/components/dashboard/DashboardTabs";
import { ReviewReplyPanel } from "@/app/components/dashboard/ReviewReplyPanel";
import { StartOnboarding } from "@/app/components/dashboard/StartOnboarding";
import type { CsLearningMetrics } from "@/app/lib/csLearningMetrics";
import {
  buildStoreKnowledgeQualityReport,
  createEmptyStoreKnowledgeQuality,
  STORE_KNOWLEDGE_STALE_DAYS,
} from "@/app/lib/storeKnowledgeQuality";
import { buildStoreKnowledgeUsageMap } from "@/app/lib/storeKnowledgeUsage";
import { getSupabase } from "@/app/lib/supabase";
import { buttonClass } from "@/app/lib/uiClasses";

type Sentiment = "positive" | "neutral" | "negative";
type HandlingType = "auto_ready" | "needs_review" | "needs_approval";
type RiskLevel = "low" | "normal" | "high";
type SourcePlatform =
  | "manual"
  | "smartstore"
  | "coupang"
  | "baemin"
  | "yogiyo"
  | "coupangeats"
  | string;
type PlatformStatus = "local" | "synced" | "posted" | "failed" | string;
type AiWorkMode = "approval_only" | "safe_auto" | "after_hours_conservative";
type StoreKnowledgeStatus = "active" | "needs_review" | "archived" | string;
type StoreKnowledgeStatusFilter =
  | "all"
  | "active"
  | "needs_review"
  | "archived";

const FREE_TRIAL_AI_REPLY_LIMIT = 30;
const FREE_TRIAL_BATCH_REVIEW_LIMIT = 10;
const FREE_TRIAL_LIMIT_REACHED_MESSAGE =
  "무료 AI 답변 생성 30건을 모두 사용했습니다. 가게 지식 학습은 계속 가능하고, 계속 자동 응대를 쓰려면 도입 상담을 요청해 주세요.";

type ReviewHistoryItem = {
  id: number;
  review: string;
  reply: string;
  sentiment: Sentiment | string;
  status?: WorkflowStatus | null;
  handling_type?: HandlingType | null;
  risk_level?: RiskLevel | null;
  ai_reason?: string | null;
  source_platform?: SourcePlatform | null;
  external_id?: string | null;
  external_url?: string | null;
  platform_status?: PlatformStatus | null;
  created_at: string;
};

type CsMessageHistoryItem = {
  id: number;
  customer_message: string;
  reply: string;
  status?: WorkflowStatus | null;
  handling_type?: HandlingType | null;
  risk_level?: RiskLevel | null;
  ai_reason?: string | null;
  source_platform?: SourcePlatform | null;
  external_id?: string | null;
  external_url?: string | null;
  platform_status?: PlatformStatus | null;
  used_knowledge_items?: unknown;
  created_at: string;
};

type MissingInfoItem = {
  id: string;
  question: string;
  reason: string;
  source_message: string;
  source_messages?: string[] | null;
  inquiry_count?: number | null;
  status: string;
  topic?: string | null;
  created_at: string;
};

type StoreKnowledgeItem = {
  id: string;
  user_id: string;
  store_id: string | null;
  category: string;
  question: string;
  answer: string;
  source_type: string;
  source_id: string | null;
  source_text: string | null;
  confidence: string;
  status?: StoreKnowledgeStatus | null;
  created_at: string;
  updated_at: string;
};

type RepeatedCorrectionPattern = {
  key: string;
  category: string;
  items: StoreKnowledgeItem[];
  hasDifferentAnswers: boolean;
};

type UsedKnowledgeItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

type ReviewApiResponse = {
  reply?: string;
  status?: WorkflowStatus;
  handling_type?: HandlingType;
  risk_level?: RiskLevel;
  ai_reason?: string;
  error?: string;
  detail?: string;
};

type BatchReviewReplyResult = {
  review: string;
  reply: string;
  sentiment: Sentiment;
  handlingType?: HandlingType;
  riskLevel?: RiskLevel;
  handling_type?: HandlingType;
  risk_level?: RiskLevel;
  aiReason?: string;
  ai_reason?: string;
  status?: WorkflowStatus;
};

type BatchReviewApiResponse = {
  results?: BatchReviewReplyResult[];
  error?: string;
  detail?: string;
};

type CsReplyApiResponse = {
  reply?: string;
  status?: WorkflowStatus;
  handling_type?: HandlingType;
  risk_level?: RiskLevel;
  ai_reason?: string;
  used_knowledge_items?: UsedKnowledgeItem[];
  error?: string;
  detail?: string;
};

type ReviewsListResponse = {
  reviews?: ReviewHistoryItem[];
  error?: string;
  detail?: string;
};

type CsMessagesListResponse = {
  csMessages?: CsMessageHistoryItem[];
  error?: string;
  detail?: string;
};

type MissingInfosListResponse = {
  missingInfos?: MissingInfoItem[];
  error?: string;
  detail?: string;
};

type StoreKnowledgeListResponse = {
  knowledgeItems?: StoreKnowledgeItem[];
  error?: string;
  detail?: string;
};

type StoreKnowledgeMutationResponse = {
  knowledgeItem?: StoreKnowledgeItem;
  success?: boolean;
  error?: string;
  detail?: string;
};

type StoreKnowledgeReprocessResponse = {
  success?: boolean;
  matchedCsMessages?: number;
  updatedCsMessages?: number;
  message?: string;
  error?: string;
  detail?: string;
};

type AiActivityLogItem = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  related_type: string | null;
  related_id: string | null;
  status: WorkflowStatus | string | null;
  handling_type: HandlingType | string | null;
  risk_level: RiskLevel | string | null;
  source_platform: SourcePlatform | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type AiActivityLogsResponse = {
  logs?: AiActivityLogItem[];
  missingTableSql?: string;
  error?: string;
  detail?: string;
};

type CsLearningMetricsResponse = {
  metrics?: CsLearningMetrics;
  missingTableSql?: string;
  error?: string;
  detail?: string;
};

type StoreKnowledgeCreateInput = {
  question: string;
  answer: string;
  category: string;
  sourceId?: string;
  sourceText?: string;
  status?: "active" | "needs_review" | "archived";
};

type ResolveMissingInfoResponse = {
  success?: boolean;
  updatedCsMessages?: number;
  error?: string;
  detail?: string;
};

type DeleteApiResponse = {
  success?: boolean;
  error?: string;
  detail?: string;
};

type WorkflowStatus = "pending" | "needs_review" | "completed" | "answered";
type WorkflowPlatformFilter =
  | "all"
  | "manual"
  | "smartstore"
  | "coupang"
  | "baemin"
  | "yogiyo"
  | "coupangeats";

type WorkflowItemType = "cs" | "review" | "missing_info";

type WorkflowItem = {
  key: string;
  id: number | string;
  type: WorkflowItemType;
  typeLabel: string;
  original: string;
  reply: string;
  status: WorkflowStatus;
  handlingType: HandlingType;
  riskLevel: RiskLevel;
  sourcePlatform: SourcePlatform;
  externalId: string | null;
  externalUrl: string | null;
  platformStatus: PlatformStatus;
  aiReason: string;
  usedKnowledgeItems: UsedKnowledgeItem[];
  createdAt: string;
  canMutate: boolean;
  missingInfo?: MissingInfoItem;
};

const WORKFLOW_PAGE_SIZE = 5;

type UpdateWorkflowItemResponse = {
  review?: ReviewHistoryItem;
  csMessage?: CsMessageHistoryItem;
  success?: boolean;
  mock?: boolean;
  message?: string;
  error?: string;
  detail?: string;
};

type ManageSupportPanel = "store_knowledge" | "insights";

type IntegrationPlatform =
  | "baemin"
  | "yogiyo"
  | "coupangeats"
  | "smartstore"
  | "coupang";

type DeliveryMockReviewPlatform =
  | "baemin"
  | "yogiyo"
  | "coupangeats"
  | "smartstore";

type PlatformIntegrationRequest = {
  id: string;
  user_id: string;
  platform: IntegrationPlatform | string;
  status: string;
  store_url: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type IntegrationDraft = {
  storeUrl: string;
  memo: string;
};

type IntegrationDrafts = Record<IntegrationPlatform, IntegrationDraft>;

type IntegrationsApiResponse = {
  integrations?: PlatformIntegrationRequest[];
  integration?: PlatformIntegrationRequest;
  error?: string;
  detail?: string;
};

type PlatformCredential = {
  id: string;
  user_id: string;
  platform: string;
  vendor_id: string | null;
  access_key: string | null;
  wing_id: string | null;
  status: string;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
  has_secret_key: boolean;
};

type PlatformCredentialsApiResponse = {
  credentials?: PlatformCredential[];
  credential?: PlatformCredential;
  error?: string;
  detail?: string;
};

type PaidAdoptionRequestApiResponse = {
  request?: unknown;
  message?: string;
  error?: string;
  detail?: string;
  missingTableSql?: string;
};

type CoupangConnectionTestApiResponse = {
  success?: boolean;
  status?: string;
  last_tested_at?: string;
  error?: string;
  detail?: string;
};

type CoupangInquiryImportApiResponse = {
  imported?: number;
  skipped?: number;
  message?: string;
  error?: string;
  detail?: string;
};

type CoupangMockInquiriesApiResponse = {
  inserted?: number;
  message?: string;
  error?: string;
  detail?: string;
};

type MockReviewsApiResponse = {
  inserted?: number;
  message?: string;
  error?: string;
  detail?: string;
};

type CoupangCredentialDraft = {
  vendorId: string;
  accessKey: string;
  secretKey: string;
  wingId: string;
};

type StoreSettings = {
  user_id: string | null;
  store_name: string | null;
  business_type: string | null;
  shipping_policy: string | null;
  refund_policy: string | null;
  product_name: string | null;
  product_description: string | null;
  product_details: string | null;
  product_caution: string | null;
  product_catalog: string | null;
  extra_faq: string | null;
  owner_reply_examples: string | null;
  owner_cs_examples: string | null;
  auto_complete_low_risk_cs: boolean | null;
  auto_complete_positive_reviews: boolean | null;
  ai_work_mode?: AiWorkMode | null;
  ai_work_start_time?: string | null;
  ai_work_end_time?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type StoreApiResponse = {
  store?: StoreSettings;
  error?: string;
  detail?: string;
};

type StoreDraft = {
  storeName: string;
  businessType: string;
  shippingPolicy: string;
  refundPolicy: string;
  productName: string;
  productDescription: string;
  productDetails: string;
  productCaution: string;
  productCatalog: string;
  extraFaq: string;
  ownerReplyExamples: string;
  ownerCsExamples: string;
  autoCompleteLowRiskCs: boolean;
  autoCompletePositiveReviews: boolean;
  aiWorkMode: AiWorkMode;
  aiWorkStartTime: string;
  aiWorkEndTime: string;
};

type InsightsApiResponse = {
  insights?: string;
  error?: string;
  detail?: string;
};

function InsightsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="M5.6 5.6l2.1 2.1" />
      <path d="M16.3 16.3l2.1 2.1" />
      <path d="M5.6 18.4l2.1-2.1" />
      <path d="M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function EmptyStateCard({
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-5 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
      <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {actionLabel}
      </button>
      {secondaryActionLabel && onSecondaryAction ? (
        <button
          type="button"
          onClick={onSecondaryAction}
          className="mt-4 ml-2 inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {secondaryActionLabel}
        </button>
      ) : null}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCoupangConnectionStatusLabel(status?: string) {
  if (status === "connected") return "연결됨";
  if (status === "error") return "연결 오류";
  return "연결 전";
}

function sentimentLabel(sentiment: string) {
  switch (sentiment) {
    case "positive":
      return "긍정";
    case "negative":
      return "부정";
    default:
      return "중립";
  }
}

function sentimentCardClass(sentiment: string) {
  switch (sentiment) {
    case "positive":
      return "border border-emerald-300/90 bg-emerald-50/90 shadow-sm ring-1 ring-emerald-100/80 dark:border-emerald-800 dark:bg-emerald-950/45 dark:ring-emerald-900/40";
    case "negative":
      return "border-2 border-red-400 bg-red-50 shadow-sm ring-1 ring-red-100 dark:border-red-500 dark:bg-red-950/55 dark:ring-red-900/50";
    default:
      return "border border-zinc-200 bg-zinc-50/95 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/45";
  }
}

function sentimentBadgeClass(sentiment: string) {
  switch (sentiment) {
    case "positive":
      return semanticBadgeClass("success");
    case "negative":
      return semanticBadgeClass("danger");
    default:
      return semanticBadgeClass("neutral");
  }
}

const urgentBadgeClass =
  "inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm dark:bg-red-500";

const ESTIMATED_CS_HOURLY_VALUE_KRW = 12_000;

type SemanticTone = "neutral" | "info" | "success" | "warning" | "danger";

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

function semanticBadgeClass(tone: SemanticTone) {
  return semanticBadgeClasses[tone];
}

function normalizeWorkflowStatus(status?: string | null): WorkflowStatus {
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

function workflowStatusLabel(status: WorkflowStatus) {
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

function workflowStatusBadgeClass(status: WorkflowStatus) {
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

function workflowStatusTabClass(status: WorkflowStatus, isSelected: boolean) {
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

function normalizeHandlingType(value?: string | null): HandlingType {
  if (
    value === "auto_ready" ||
    value === "needs_review" ||
    value === "needs_approval"
  ) {
    return value;
  }

  return "needs_approval";
}

function normalizeRiskLevel(value?: string | null): RiskLevel {
  if (value === "low" || value === "normal" || value === "high") {
    return value;
  }

  return "normal";
}

function normalizeInquiryText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s.,!?;:'"()[\]{}<>~`·…。，！？、]/g, "");
}

function areInquiryTextsSimilar(left: string, right: string) {
  const normalizedLeft = normalizeInquiryText(left);
  const normalizedRight = normalizeInquiryText(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  return (
    Math.min(normalizedLeft.length, normalizedRight.length) >= 8 &&
    (normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft))
  );
}

function doesMissingInfoRepresentCsMessage(
  missingInfoItem: WorkflowItem,
  csMessageItem: WorkflowItem,
) {
  if (
    missingInfoItem.type !== "missing_info" ||
    !missingInfoItem.missingInfo ||
    csMessageItem.type !== "cs"
  ) {
    return false;
  }

  const missingInfo = missingInfoItem.missingInfo;
  const relatedMessages = [
    missingInfo.source_message,
    ...(missingInfo.source_messages ?? []),
  ].filter(Boolean);

  if (
    relatedMessages.some((message) =>
      areInquiryTextsSimilar(message, csMessageItem.original),
    )
  ) {
    return true;
  }

  if (areInquiryTextsSimilar(missingInfo.question, csMessageItem.original)) {
    return true;
  }

  const createdAtGap = Math.abs(
    new Date(missingInfo.created_at).getTime() -
      new Date(csMessageItem.createdAt).getTime(),
  );

  return (
    createdAtGap <= 5 * 60 * 1000 &&
    areInquiryTextsSimilar(missingInfoItem.original, csMessageItem.original)
  );
}

function handlingTypeLabel(value: HandlingType) {
  switch (value) {
    case "auto_ready":
      return "바로 답변 가능";
    case "needs_review":
      return "사장님 확인 필요";
    default:
      return "승인 필수";
  }
}

function riskLevelLabel(value: RiskLevel) {
  switch (value) {
    case "low":
      return "낮음";
    case "high":
      return "높음";
    default:
      return "보통";
  }
}

function handlingTypeBadgeClass(value: HandlingType) {
  switch (value) {
    case "auto_ready":
      return semanticBadgeClass("success");
    case "needs_review":
      return semanticBadgeClass("warning");
    default:
      return semanticBadgeClass("warning");
  }
}

function riskLevelBadgeClass(value: RiskLevel) {
  switch (value) {
    case "low":
      return semanticBadgeClass("success");
    case "high":
      return semanticBadgeClass("danger");
    default:
      return semanticBadgeClass("neutral");
  }
}

function workflowAttentionTone(
  handlingType: HandlingType,
  riskLevel: RiskLevel,
): "warning" | "danger" | null {
  if (riskLevel === "high") return "danger";
  if (handlingType === "needs_review" || handlingType === "needs_approval") {
    return "warning";
  }

  return null;
}

function workflowCardAttentionClass(tone: "warning" | "danger" | null) {
  if (tone === "danger") {
    return "border-red-300/90 ring-red-100/80 dark:border-red-700/80 dark:ring-red-900/50";
  }
  if (tone === "warning") {
    return "border-amber-300/80 ring-amber-100/70 dark:border-amber-700/70 dark:ring-amber-900/40";
  }

  return "border-white/80 dark:border-white/10";
}

function workflowAttentionNoticeClass(tone: "warning" | "danger") {
  return tone === "danger"
    ? "border-red-200 bg-red-50/90 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
    : "border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200";
}

function sourcePlatformLabel(value?: string | null) {
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

function aiActivityStatusLabel(value?: string | null) {
  if (!value) return "";

  if (
    value === "pending" ||
    value === "needs_review" ||
    value === "completed" ||
    value === "answered"
  ) {
    return workflowStatusLabel(value);
  }

  if (value === "resolved") return "해결됨";

  return value;
}

function aiActivityRiskLabel(value?: string | null) {
  if (!value) return "";

  if (value === "low" || value === "normal" || value === "high") {
    return `위험도: ${riskLevelLabel(value)}`;
  }

  return value;
}

function isStoreKnowledgeCandidateLog(log: AiActivityLogItem) {
  return (
    log.event_type === "store_knowledge_candidate_created" ||
    (log.related_type === "store_knowledge" && log.status === "needs_review")
  );
}

function isDemoExternalId(value?: string | null) {
  return value?.startsWith("mock-") ?? false;
}

function platformStatusLabel(value?: string | null) {
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

function platformStatusBadgeClass(value?: string | null) {
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

function connectionStatusBadgeClass(value?: string | null) {
  if (value === "connected") return semanticBadgeClass("success");
  if (value === "error") return semanticBadgeClass("danger");

  return semanticBadgeClass("neutral");
}

function storeKnowledgeCategoryLabel(value?: string | null) {
  switch (value) {
    case "product_catalog":
      return "상품 목록";
    case "pricing":
      return "가격";
    case "shipping":
      return "배송/출고";
    case "refund_exchange":
      return "환불/교환";
    case "stock":
      return "재고";
    case "reservation":
      return "예약/픽업";
    case "packaging":
      return "포장";
    case "allergy_ingredient":
      return "알레르기/성분";
    case "product":
      return "상품 정보";
    default:
      return "기타 FAQ";
  }
}

function normalizeStoreKnowledgeStatus(
  value?: string | null,
): "active" | "needs_review" | "archived" {
  if (value === "needs_review" || value === "archived") return value;

  return "active";
}

function storeKnowledgeStatusLabel(value?: string | null) {
  switch (normalizeStoreKnowledgeStatus(value)) {
    case "needs_review":
      return "검토 필요";
    case "archived":
      return "보관됨";
    default:
      return "답변 사용 중";
  }
}

function storeKnowledgeStatusBadgeClass(value?: string | null) {
  switch (normalizeStoreKnowledgeStatus(value)) {
    case "needs_review":
      return semanticBadgeClass("warning");
    case "archived":
      return semanticBadgeClass("neutral");
    default:
      return semanticBadgeClass("success");
  }
}

function isStoreInfoEvidenceItem(item: UsedKnowledgeItem) {
  return item.id.startsWith("store:");
}

function parseUsedKnowledgeItems(value: unknown): UsedKnowledgeItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const category =
      typeof record.category === "string" ? record.category : "general";
    const question =
      typeof record.question === "string" ? record.question.trim() : "";
    const answer =
      typeof record.answer === "string" ? record.answer.trim() : "";

    if (!id || !question || !answer) return [];

    return [{ id, category, question, answer }];
  });
}

const aiReasonAttentionPattern =
  /가격|재고|수량|출고|환불|예약|영업시간|알레르기|알러지|건강|위생|법적|분쟁|클레임|확인 필요|확인이 필요|사장님 확인/;

function workflowEvidenceTitle(item: WorkflowItem) {
  if (item.type === "missing_info") return "부족한 정보";
  if (item.usedKnowledgeItems.some(isStoreInfoEvidenceItem)) {
    return "답변에 참고한 가게 정보";
  }
  if (item.usedKnowledgeItems.length > 0) return "답변에 참고한 가게 지식";
  if (item.handlingType === "auto_ready") return "답변 근거";
  if (item.handlingType === "needs_review") return "근거 확인 필요";
  if (item.handlingType === "needs_approval") return "승인 전 확인할 점";

  return "답변 근거";
}

function workflowEvidenceMessage(item: WorkflowItem) {
  if (item.type === "missing_info") {
    return "AI가 답변하기 위해 추가 정보가 필요하다고 판단한 항목입니다. 사장님이 답변을 입력하면 가게 지식으로 저장됩니다.";
  }

  if (item.usedKnowledgeItems.some(isStoreInfoEvidenceItem)) {
    return "저장된 상품 목록, 정책, FAQ 또는 사장님이 확인해준 가게 지식을 답변 근거로 사용했습니다. 충돌 가능성이 있는 지식은 답변 근거에서 제외됩니다.";
  }

  if (item.usedKnowledgeItems.length > 0) {
    return "사장님이 이전에 확인해준 가게 지식을 답변 근거로 함께 사용했습니다. 충돌 가능성이 있는 지식은 답변 근거에서 제외됩니다.";
  }

  if (item.handlingType === "auto_ready") {
    return "저장된 가게 기본 정보, 상품 정보, 정책 또는 FAQ에서 답변 가능한 항목으로 판단했습니다.";
  }

  if (item.riskLevel === "high") {
    return "위험도가 높은 항목이라 등록된 정보가 있더라도 답변 전 확인이 필요합니다.";
  }

  if (item.handlingType === "needs_review") {
    return "답변에 필요한 정보가 충분하지 않거나 더 정확한 확인이 필요한 항목입니다.";
  }

  if (item.handlingType === "needs_approval") {
    return "고객 상황에 맞는 답변인지 사장님이 확인한 뒤 승인하는 것이 안전합니다.";
  }

  return "AI가 저장된 가게 정보와 정책을 참고해 답변 초안을 작성했습니다.";
}

function truncateSummaryText(value: string, maxLength = 64) {
  const normalizedValue = value.trim().replace(/\s+/g, " ");

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength)}...`;
}

function isSameLocalDate(value: string, date = new Date()) {
  const targetDate = new Date(value);

  if (Number.isNaN(targetDate.getTime())) return false;

  return (
    targetDate.getFullYear() === date.getFullYear() &&
    targetDate.getMonth() === date.getMonth() &&
    targetDate.getDate() === date.getDate()
  );
}

function isWithinRecentDays(value: string, days: number, date = new Date()) {
  const targetDate = new Date(value);

  if (Number.isNaN(targetDate.getTime())) return false;

  const boundary = new Date(date);
  boundary.setDate(boundary.getDate() - days);

  return targetDate >= boundary && targetDate <= date;
}

function formatEstimatedMinutes(minutes: number) {
  if (minutes < 60) return `${minutes.toLocaleString("ko-KR")}분`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) return `${hours.toLocaleString("ko-KR")}시간`;

  return `${hours.toLocaleString("ko-KR")}시간 ${remainingMinutes}분`;
}

function formatEstimatedCurrency(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function estimateSavedMinutesForWorkflowItems(items: WorkflowItem[]) {
  const aiDraftItems = items.filter(
    (item) => item.type !== "missing_info" && Boolean(item.reply.trim()),
  );
  const autoCompletedItems = items.filter(
    (item) =>
      item.type !== "missing_info" &&
      (item.status === "completed" || item.status === "answered") &&
      item.handlingType === "auto_ready" &&
      item.riskLevel === "low",
  );
  const knowledgeAssistedItems = items.filter(
    (item) =>
      item.type === "cs" &&
      item.usedKnowledgeItems.some((knowledgeItem) =>
        !isStoreInfoEvidenceItem(knowledgeItem),
      ),
  );

  return Math.round(
    aiDraftItems.length * 1.5 +
      autoCompletedItems.length * 2 +
      knowledgeAssistedItems.length * 2,
  );
}

function estimateSavedValueKrw(minutes: number) {
  const value = (minutes / 60) * ESTIMATED_CS_HOURLY_VALUE_KRW;
  return Math.round(value / 100) * 100;
}

function normalizeReplyForLearning(value: string) {
  return value.toLowerCase().replace(/[\s.,!?()[\]{}'"`~:;·…]+/g, "");
}

function hasMeaningfulReplyCorrection(beforeReply: string, afterReply: string) {
  const before = normalizeReplyForLearning(beforeReply);
  const after = normalizeReplyForLearning(afterReply);

  if (!before || !after || before === after) return false;

  const shorterLength = Math.min(before.length, after.length);
  const longerLength = Math.max(before.length, after.length);
  const lengthGap = Math.abs(before.length - after.length);

  if (lengthGap >= 18 || lengthGap / Math.max(longerLength, 1) >= 0.22) {
    return true;
  }

  let differentCharacters = 0;

  for (let index = 0; index < shorterLength; index += 1) {
    if (before[index] !== after[index]) differentCharacters += 1;
  }

  return differentCharacters / Math.max(shorterLength, 1) >= 0.24;
}

function inferCorrectionKnowledgeCategory(item: WorkflowItem, correctedReply = "") {
  const text =
    `${item.original}\n${item.reply}\n${correctedReply}\n${item.aiReason}`.toLowerCase();

  if (/가격|얼마|금액|비용|몇\s*원|견적/.test(text)) return "pricing";
  if (/배송|출고|발송|도착|택배|수령/.test(text)) return "shipping";
  if (/환불|취소|반품|교환/.test(text)) return "refund_exchange";
  if (/재고|품절|구매 가능|주문 가능/.test(text)) return "stock";
  if (/예약|픽업|방문 수령|수령 시간/.test(text)) return "reservation";
  if (/포장|선물|쇼핑백|옵션|추가|포함|제공|동봉/.test(text)) {
    return "packaging";
  }
  if (/알레르기|알러지|성분|원재료|두드러기|피부|가려움/.test(text)) {
    return "allergy_ingredient";
  }
  if (/상품|제품|구성|용량|사이즈|재질|보관|사용법/.test(text)) {
    return "product";
  }

  return "general";
}

const repeatedCorrectionGenericTokens = new Set([
  "고객",
  "문의",
  "답변",
  "수정",
  "학습",
  "후보",
  "정보",
  "안내",
  "정확",
  "필요",
  "가능",
  "상품",
  "제품",
]);

function normalizeCorrectionPatternText(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function stripCorrectionPatternPostposition(value: string) {
  return value.replace(
    /(으로|에게|에서|까지|부터|은|는|이|가|을|를|의|에|와|과|도|로|만)$/g,
    "",
  );
}

function getCorrectionPatternTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/)
    .map((token) => stripCorrectionPatternPostposition(token.trim()))
    .filter(
      (token) =>
        token.length >= 2 && !repeatedCorrectionGenericTokens.has(token),
    );
}

function areSimilarCorrectionCandidates(
  left: StoreKnowledgeItem,
  right: StoreKnowledgeItem,
) {
  if (left.category !== right.category) return false;

  const normalizedLeft = normalizeCorrectionPatternText(left.question);
  const normalizedRight = normalizeCorrectionPatternText(right.question);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (
    Math.min(normalizedLeft.length, normalizedRight.length) >= 8 &&
    (normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft))
  ) {
    return true;
  }

  const leftTokens = getCorrectionPatternTokens(
    `${left.question}\n${left.source_text ?? ""}`,
  );
  const rightTokens = getCorrectionPatternTokens(
    `${right.question}\n${right.source_text ?? ""}`,
  );

  if (leftTokens.length === 0 || rightTokens.length === 0) return false;

  const overlapCount = leftTokens.filter((leftToken) =>
    rightTokens.some(
      (rightToken) =>
        leftToken === rightToken ||
        (Math.min(leftToken.length, rightToken.length) >= 2 &&
          (leftToken.includes(rightToken) || rightToken.includes(leftToken))),
    ),
  ).length;

  return overlapCount >= Math.min(2, leftTokens.length, rightTokens.length);
}

function cleanCorrectionQuestion(value: string) {
  return value.replace(/^고객 문의:\s*/u, "").trim();
}

function createCorrectionPatternDraftQuestion(pattern: RepeatedCorrectionPattern) {
  const firstQuestion = cleanCorrectionQuestion(pattern.items[0]?.question ?? "");

  if (!firstQuestion) {
    return `${storeKnowledgeCategoryLabel(pattern.category)} 반복 문의 응대 기준`;
  }

  return `${firstQuestion} 문의 응대 기준`;
}

function createCorrectionPatternDraftAnswer(pattern: RepeatedCorrectionPattern) {
  return pattern.items[0]?.answer.trim() ?? "";
}

function workflowAttentionPriority(item: WorkflowItem) {
  if (item.type === "missing_info") return 70;
  if (item.riskLevel === "high") return 100;
  if (item.handlingType === "needs_approval") return 90;
  if (item.status === "needs_review" || item.handlingType === "needs_review") {
    return 80;
  }
  if (aiReasonAttentionPattern.test(item.aiReason)) return 60;
  if (item.status === "pending") return 40;

  return 0;
}

function computeReviewStats(reviews: ReviewHistoryItem[]) {
  const total = reviews.length;
  const positive = reviews.filter((r) => r.sentiment === "positive").length;
  const negative = reviews.filter((r) => r.sentiment === "negative").length;
  const positiveRate =
    total > 0 ? Math.round((positive / total) * 1000) / 10 : 0;

  return { total, positive, negative, positiveRate };
}

async function fetchInsightsData() {
  const response = await fetch("/api/insights", {
    headers: await getAuthenticatedRequestHeaders(),
  });
  const data = (await response.json()) as InsightsApiResponse;

  if (!response.ok || !data.insights) {
    throw new Error(data.error ?? "?몄궗?댄듃瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??");
  }

  return data.insights;
}

async function fetchReviewHistory() {
  const response = await fetch("/api/reviews", {
    headers: await getAuthenticatedRequestHeaders(),
  });
  const data = (await response.json()) as ReviewsListResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "?덉뒪?좊━瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??");
  }

  return data.reviews ?? [];
}

async function fetchCsMessageHistory() {
  const response = await fetch("/api/cs-messages", {
    headers: await getAuthenticatedRequestHeaders(),
  });
  const data = (await response.json()) as CsMessagesListResponse;

  if (!response.ok) {
    throw new Error(
      data.error ?? "CS ?덉뒪?좊━瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??",
    );
  }

  return data.csMessages ?? [];
}

async function fetchAiActivityLogs() {
  const response = await fetch("/api/ai-activity-logs", {
    headers: await getAuthenticatedRequestHeaders(),
  });
  const data = (await response.json()) as AiActivityLogsResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "AI 업무 이력을 불러오지 못했습니다.");
  }

  return data.logs ?? [];
}

async function fetchCsLearningMetrics() {
  const response = await fetch("/api/cs-learning-metrics", {
    headers: await getAuthenticatedRequestHeaders(),
  });
  const data = (await response.json()) as CsLearningMetricsResponse;

  if (!response.ok || !data.metrics) {
    throw new Error(data.error ?? "AI CS 학습 품질을 불러오지 못했습니다.");
  }

  return data.metrics;
}

async function fetchMissingInfoList() {
  const response = await fetch("/api/missing-infos", {
    headers: await getAuthenticatedRequestHeaders(),
  });
  const data = (await response.json()) as MissingInfosListResponse;

  if (!response.ok) {
    throw new Error(
      data.error ?? "확인이 필요한 정보를 불러오지 못했습니다.",
    );
  }

  return data.missingInfos ?? [];
}

async function fetchStoreKnowledgeList() {
  const response = await fetch("/api/store-knowledge", {
    headers: await getAuthenticatedRequestHeaders(),
  });
  const data = (await response.json()) as StoreKnowledgeListResponse;

  if (!response.ok) {
    throw new Error(
      data.error ?? "AI가 학습한 가게 지식을 불러오지 못했습니다.",
    );
  }

  return data.knowledgeItems ?? [];
}

async function createStoreKnowledgeItem(input: StoreKnowledgeCreateInput) {
  const response = await fetch("/api/store-knowledge", {
    method: "POST",
    headers: await getAuthenticatedRequestHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(input),
  });
  const data = (await response.json()) as StoreKnowledgeMutationResponse;

  if (!response.ok || !data.knowledgeItem) {
    throw new Error(data.error ?? "가게 지식으로 저장하지 못했습니다.");
  }

  return data.knowledgeItem;
}

async function getAuthenticatedRequestHeaders(
  headers: HeadersInit = {},
): Promise<HeadersInit> {
  const { data, error } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;

  if (error || !token) {
    throw new Error("로그인이 필요합니다");
  }

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}

async function fetchLatestStore() {
  const response = await fetch("/api/store/latest", {
    headers: await getAuthenticatedRequestHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  const data = (await response.json()) as StoreApiResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "가게 정보를 확인하지 못했습니다.");
  }

  return data.store ?? null;
}

const STORE_DRAFT_STORAGE_KEY_PREFIX = "store-info-draft";

function getStoreDraftStorageKey(userId: string) {
  return `${STORE_DRAFT_STORAGE_KEY_PREFIX}:${userId}`;
}

function normalizeAiWorkMode(value: unknown): AiWorkMode {
  return value === "approval_only" ||
    value === "safe_auto" ||
    value === "after_hours_conservative"
    ? value
    : "safe_auto";
}

function isStoreDraft(value: unknown): value is StoreDraft {
  if (!value || typeof value !== "object") return false;

  const draft = value as Partial<Record<keyof StoreDraft, unknown>>;

  return (
    typeof draft.storeName === "string" &&
    (draft.businessType === undefined ||
      typeof draft.businessType === "string") &&
    typeof draft.shippingPolicy === "string" &&
    typeof draft.refundPolicy === "string" &&
    typeof draft.productName === "string" &&
    typeof draft.productDescription === "string" &&
    typeof draft.productDetails === "string" &&
    typeof draft.productCaution === "string" &&
    (draft.productCatalog === undefined ||
      typeof draft.productCatalog === "string") &&
    typeof draft.extraFaq === "string" &&
    (draft.ownerReplyExamples === undefined ||
      typeof draft.ownerReplyExamples === "string") &&
    (draft.ownerCsExamples === undefined ||
      typeof draft.ownerCsExamples === "string") &&
    (draft.autoCompleteLowRiskCs === undefined ||
      typeof draft.autoCompleteLowRiskCs === "boolean") &&
    (draft.autoCompletePositiveReviews === undefined ||
      typeof draft.autoCompletePositiveReviews === "boolean") &&
    (draft.aiWorkMode === undefined ||
      draft.aiWorkMode === "approval_only" ||
      draft.aiWorkMode === "safe_auto" ||
      draft.aiWorkMode === "after_hours_conservative") &&
    (draft.aiWorkStartTime === undefined ||
      typeof draft.aiWorkStartTime === "string") &&
    (draft.aiWorkEndTime === undefined ||
      typeof draft.aiWorkEndTime === "string")
  );
}

function readStoreDraft(userId: string): StoreDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const rawDraft = window.localStorage.getItem(
      getStoreDraftStorageKey(userId),
    );

    if (!rawDraft) return null;

    const parsedDraft: unknown = JSON.parse(rawDraft);

    return isStoreDraft(parsedDraft)
      ? {
          ...parsedDraft,
          businessType: parsedDraft.businessType ?? "",
          productCatalog: parsedDraft.productCatalog ?? "",
          ownerReplyExamples: parsedDraft.ownerReplyExamples ?? "",
          ownerCsExamples: parsedDraft.ownerCsExamples ?? "",
          autoCompleteLowRiskCs: parsedDraft.autoCompleteLowRiskCs ?? false,
          autoCompletePositiveReviews:
            parsedDraft.autoCompletePositiveReviews ?? false,
          aiWorkMode: normalizeAiWorkMode(parsedDraft.aiWorkMode),
          aiWorkStartTime: parsedDraft.aiWorkStartTime ?? "09:00",
          aiWorkEndTime: parsedDraft.aiWorkEndTime ?? "22:00",
        }
      : null;
  } catch {
    return null;
  }
}

function saveStoreDraft(userId: string, draft: StoreDraft) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getStoreDraftStorageKey(userId),
    JSON.stringify(draft),
  );
}

function removeStoreDraft(userId: string) {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(getStoreDraftStorageKey(userId));
}

function hasStoreDraftContent(draft: StoreDraft) {
  const {
    aiWorkMode,
    aiWorkStartTime,
    aiWorkEndTime,
    autoCompleteLowRiskCs,
    autoCompletePositiveReviews,
    ...textDraft
  } = draft;

  return (
    Object.values(textDraft).some((value) =>
      typeof value === "string" ? value.trim().length > 0 : value,
    ) ||
    autoCompleteLowRiskCs ||
    autoCompletePositiveReviews ||
    aiWorkMode !== "safe_auto" ||
    aiWorkStartTime !== "09:00" ||
    aiWorkEndTime !== "22:00"
  );
}

const kpiCardClass =
  "rounded-[1.35rem] border border-white/70 bg-white/85 p-5 shadow-[0_22px_70px_-42px_rgba(79,70,229,0.55)] ring-1 ring-slate-950/[0.03] backdrop-blur-xl transition dark:border-white/10 dark:bg-slate-950/70 dark:ring-white/10";

const cardClass =
  "rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.55)] ring-1 ring-slate-950/[0.04] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75 dark:ring-white/10 sm:p-8";

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white/90 px-4 text-sm outline-none shadow-sm transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/80 dark:border-white/10 dark:bg-slate-950/80 dark:focus:border-indigo-500 dark:focus:ring-indigo-950/60";

const textareaClass =
  "min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm outline-none shadow-sm transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/80 dark:border-white/10 dark:bg-slate-950/80 dark:focus:border-indigo-500 dark:focus:ring-indigo-950/60";

const copyButtonClass = buttonClass("secondary", "sm", "rounded-lg");

const workflowCardSectionClass =
  "rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.04]";

const workflowCardDetailClass =
  "rounded-xl border px-4 py-3 text-xs leading-5";

const integrationPlatforms: ReadonlyArray<{
  id: IntegrationPlatform;
  name: string;
  description: string;
}> = [
  {
    id: "baemin",
    name: "배민",
    description:
      "배민 리뷰와 고객 응대를 AI CS 처리함에서 관리할 수 있도록 준비 중입니다.",
  },
  {
    id: "yogiyo",
    name: "요기요",
    description:
      "요기요 리뷰와 고객 응대를 AI CS 처리함에서 관리할 수 있도록 준비 중입니다.",
  },
  {
    id: "coupangeats",
    name: "쿠팡이츠",
    description:
      "쿠팡이츠 리뷰와 고객 응대를 AI CS 처리함에서 관리할 수 있도록 준비 중입니다.",
  },
  {
    id: "smartstore",
    name: "스마트스토어",
    description:
      "스마트스토어 상품 문의와 리뷰 응대를 AI CS 처리함에서 관리할 수 있도록 준비 중입니다.",
  },
  {
    id: "coupang",
    name: "쿠팡",
    description:
      "쿠팡 상품 문의와 고객 응대를 AI CS 처리함에서 관리할 수 있도록 준비 중입니다.",
  },
];

function createEmptyIntegrationDrafts(): IntegrationDrafts {
  return {
    baemin: { storeUrl: "", memo: "" },
    yogiyo: { storeUrl: "", memo: "" },
    coupangeats: { storeUrl: "", memo: "" },
    smartstore: { storeUrl: "", memo: "" },
    coupang: { storeUrl: "", memo: "" },
  };
}

function createEmptyCoupangCredentialDraft(): CoupangCredentialDraft {
  return {
    vendorId: "",
    accessKey: "",
    secretKey: "",
    wingId: "",
  };
}

function isIntegrationPlatform(value: string): value is IntegrationPlatform {
  return integrationPlatforms.some((platform) => platform.id === value);
}

function isDeliveryMockReviewPlatform(
  value: IntegrationPlatform,
): value is DeliveryMockReviewPlatform {
  return (
    value === "baemin" ||
    value === "yogiyo" ||
    value === "coupangeats" ||
    value === "smartstore"
  );
}

const businessTypeInputGuides = {
  "배달 음식점": [
    "대표 메뉴명",
    "맵기/양/구성",
    "원산지 또는 알레르기 성분",
    "배달 가능 지역",
    "포장/재가열 방법",
  ],
  "디저트/카페": [
    "대표 상품명",
    "보관 방법",
    "알레르기 성분",
    "픽업/예약 가능 여부",
    "선물 포장 가능 여부",
  ],
  "공방/핸드메이드": [
    "대표 상품명",
    "재질/소재",
    "제작 기간",
    "사이즈 조절 가능 여부",
    "보관/변색 주의사항",
    "선물 포장 가능 여부",
  ],
  "의류/잡화": [
    "대표 상품명",
    "사이즈 정보",
    "소재/세탁 방법",
    "교환/반품 기준",
    "재고/입고 일정",
  ],
  "생활용품": [
    "대표 상품명",
    "구성품",
    "사용 방법",
    "A/S 또는 교환 기준",
    "주의사항",
  ],
  "기타 스마트스토어": [
    "대표 상품명",
    "상품 구성",
    "배송/교환/환불 기준",
    "자주 묻는 질문",
    "주의사항",
  ],
} as const;

type ExampleStorePreset = {
  label: string;
  storeName: string;
  businessType: string;
  productName: string;
  productDescription: string;
  productDetails: string;
  productCaution: string;
  productCatalog: string;
  extraFaq: string;
  shippingPolicy: string;
  refundPolicy: string;
  ownerReplyExamples: string;
  ownerCsExamples: string;
};

const exampleStorePresets: readonly ExampleStorePreset[] = [
  {
    label: "디저트/카페",
    storeName: "모아 디저트",
    businessType: "디저트/카페",
    productName: "딸기 생크림 케이크",
    productDescription:
      "제철 딸기와 부드러운 생크림으로 준비하는 예약 케이크입니다.",
    productDetails: "1호(2~3인용), 우유/계란/밀 포함, 레터링 문구 가능",
    productCaution: "수령 후 냉장 보관해 주세요. 당일 섭취를 권장합니다.",
    productCatalog: [
      "[딸기 생크림 케이크]",
      "- 1호, 2~3인용",
      "- 우유, 계란, 밀 포함",
      "- 냉장 보관, 당일 섭취 권장",
      "- 레터링 문구 가능",
      "",
      "[레터링 쿠키]",
      "- 6개 세트",
      "- 예약 주문 필요",
      "- 실온 보관, 수령 후 3일 이내 섭취 권장",
    ].join("\n"),
    extraFaq:
      "선물 포장 가능합니다. 케이크 레터링 문구는 주문 요청사항에 남겨주세요.",
    shippingPolicy:
      "픽업 하루 전 오후 6시까지 예약해 주시면 매장 픽업으로 준비합니다. 케이크는 택배 배송을 제공하지 않습니다.",
    refundPolicy:
      "제작 시작 전에는 취소 가능합니다. 제작 시작 후에는 취소 및 환불이 어렵습니다. 수령한 제품에 문제가 있는 경우 바로 문의해 주세요.",
    ownerReplyExamples: [
      "맛있게 드셔주셔서 감사합니다 :) 다음에도 예쁘고 맛있게 준비해드릴게요.",
      "선물용으로 골라주셨는데 만족하셨다니 정말 다행이에요. 감사합니다.",
      "기대하셨을 텐데 아쉬움을 드려 죄송합니다. 말씀해주신 부분은 꼭 확인해보겠습니다.",
    ].join("\n\n"),
    ownerCsExamples: [
      "안녕하세요, 모아 디저트입니다. 케이크는 픽업 하루 전 오후 6시까지 예약해 주시면 준비 가능합니다.",
      "선물 포장 가능합니다. 주문 시 요청사항에 남겨주시면 확인 후 준비해드리겠습니다.",
      "해당 내용은 정확한 안내를 위해 확인 후 다시 말씀드리겠습니다.",
    ].join("\n\n"),
  },
  {
    label: "배달 음식점",
    storeName: "해담 반찬",
    businessType: "배달 음식점",
    productName: "오늘의 집밥 반찬 세트",
    productDescription:
      "매일 준비하는 메인 반찬 1종과 곁들임 반찬 3종 구성입니다.",
    productDetails: "2인 기준, 메뉴는 당일 구성에 따라 달라질 수 있음",
    productCaution:
      "수령 후 바로 냉장 보관해 주세요. 조리 당일 섭취를 권장합니다.",
    productCatalog: [
      "[오늘의 집밥 반찬 세트]",
      "- 메인 반찬 1종, 곁들임 반찬 3종",
      "- 2인 기준",
      "- 수령 후 냉장 보관, 조리 당일 섭취 권장",
      "",
      "[소불고기 도시락]",
      "- 밥, 소불고기, 기본 반찬 구성",
      "- 주문 당일 조리",
    ].join("\n"),
    extraFaq:
      "일회용 수저가 필요하시면 주문 요청사항에 남겨주세요. 알레르기 관련 문의는 주문 전 확인해 주세요.",
    shippingPolicy:
      "오후 5시 이전 접수된 주문은 당일 배달 가능합니다. 주문량과 배달 지역에 따라 도착 시간이 달라질 수 있습니다.",
    refundPolicy:
      "조리 시작 전에는 취소 가능합니다. 조리 시작 후에는 취소가 어렵습니다. 누락이나 오배송, 음식 상태 문제가 있는 경우 주문 정보와 함께 문의해 주세요.",
    ownerReplyExamples: [
      "맛있게 드셔주셔서 감사합니다 :) 다음에도 든든하게 챙겨드릴게요.",
      "반찬 구성을 좋게 봐주셔서 감사합니다. 맛있게 드셨다니 다행이에요.",
      "배달이 늦어 기다리셨을 텐데 죄송합니다. 다음에는 준비 과정을 더 꼼꼼히 챙기겠습니다.",
    ].join("\n\n"),
    ownerCsExamples: [
      "안녕하세요, 해담 반찬입니다. 오후 5시 이전 주문은 당일 배달 가능합니다.",
      "누락된 메뉴가 있다면 주문 정보와 함께 알려주시면 확인 후 안내드리겠습니다.",
      "정확한 안내를 위해 주문 상태를 확인한 뒤 다시 말씀드리겠습니다.",
    ].join("\n\n"),
  },
  {
    label: "스마트스토어/생활용품",
    storeName: "하루살림",
    businessType: "생활용품",
    productName: "실리콘 밀폐용기 3종 세트",
    productDescription:
      "주방에서 간편하게 사용하는 접이식 실리콘 밀폐용기 세트입니다.",
    productDetails: "소/중/대 3종 구성, BPA FREE 실리콘 소재",
    productCaution:
      "첫 사용 전 세척해 주세요. 화기 근처나 날카로운 도구 사용은 피해주세요.",
    productCatalog: [
      "[실리콘 밀폐용기 3종 세트]",
      "- 소/중/대 3종 구성",
      "- BPA FREE 실리콘 소재",
      "- 전자레인지 사용 시 뚜껑을 열고 사용",
      "",
      "[대나무 키친타월 홀더]",
      "- 원목 소재",
      "- 물기에 장시간 노출되지 않도록 주의",
    ].join("\n"),
    extraFaq:
      "선물 포장 가능합니다. 묶음 구매 관련 문의는 주문 전에 남겨주세요.",
    shippingPolicy:
      "평일 오후 2시 이전 주문은 당일 출고됩니다. 제주/도서산간 지역은 추가 배송비 3,000원이 발생합니다.",
    refundPolicy:
      "사용 흔적이 없는 상품은 수령 후 7일 이내 교환 및 반품 문의가 가능합니다. 단순 변심 반품 배송비는 고객 부담입니다.",
    ownerReplyExamples: [
      "일상에서 편하게 사용하고 계시다니 기뻐요. 후기 남겨주셔서 감사합니다 :)",
      "깔끔하게 받아보셨다니 다행입니다. 다음에도 꼼꼼히 보내드릴게요.",
      "사용하시며 불편을 드려 죄송합니다. 말씀해주신 부분은 확인해보겠습니다.",
    ].join("\n\n"),
    ownerCsExamples: [
      "안녕하세요, 하루살림입니다. 평일 오후 2시 이전 주문은 당일 출고됩니다.",
      "사용 흔적이 없는 상품은 수령 후 7일 이내 교환 및 반품 문의가 가능합니다.",
      "해당 사용 가능 여부는 정확한 안내를 위해 확인 후 다시 말씀드리겠습니다.",
    ].join("\n\n"),
  },
];

type InterpretedBusinessType = keyof typeof businessTypeInputGuides;

function includesAnyKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function interpretBusinessType(value: string): InterpretedBusinessType {
  const trimmedValue = value.trim();

  if (trimmedValue in businessTypeInputGuides) {
    return trimmedValue as InterpretedBusinessType;
  }

  const normalizedValue = trimmedValue.replace(/\s+/g, "").toLowerCase();

  if (
    includesAnyKeyword(normalizedValue, [
      "카페",
      "디저트",
      "베이커리",
      "케이크",
      "쿠키",
      "마카롱",
      "빵집",
      "커피",
      "음료",
      "수제청",
      "티",
      "브런치",
    ])
  ) {
    return "디저트/카페";
  }

  if (
    includesAnyKeyword(normalizedValue, [
      "음식점",
      "식당",
      "배달",
      "치킨",
      "피자",
      "족발",
      "보쌈",
      "분식",
      "한식",
      "중식",
      "일식",
      "도시락",
      "샐러드",
      "밀키트",
    ])
  ) {
    return "배달 음식점";
  }

  if (
    includesAnyKeyword(normalizedValue, [
      "공방",
      "핸드메이드",
      "수제",
      "반지",
      "악세사리",
      "주얼리",
      "캔들",
      "비누",
      "도자기",
      "가죽",
      "꽃",
      "플라워",
    ])
  ) {
    return "공방/핸드메이드";
  }

  if (
    includesAnyKeyword(normalizedValue, [
      "의류",
      "옷",
      "패션",
      "잡화",
      "가방",
      "신발",
      "모자",
      "양말",
      "액세서리",
      "키링",
    ])
  ) {
    return "의류/잡화";
  }

  if (
    includesAnyKeyword(normalizedValue, [
      "생활용품",
      "주방용품",
      "욕실용품",
      "인테리어",
      "문구",
      "반려동물용품",
      "애견용품",
      "청소용품",
    ])
  ) {
    return "생활용품";
  }

  return "기타 스마트스토어";
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("start");
  const [selectedAnswerMode, setSelectedAnswerMode] =
    useState<AnswerMode>("cs");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [review, setReview] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [batchReviewsInput, setBatchReviewsInput] = useState("");
  const [batchReviewResults, setBatchReviewResults] = useState<
    BatchReviewReplyResult[]
  >([]);
  const [batchReviewError, setBatchReviewError] = useState("");
  const [batchReviewLoading, setBatchReviewLoading] = useState(false);
  const [batchReviewCopyMessages, setBatchReviewCopyMessages] = useState<
    Record<number, { type: "success" | "error"; message: string }>
  >({});

  const [customerMessage, setCustomerMessage] = useState("");
  const [csReply, setCsReply] = useState("");
  const [csError, setCsError] = useState("");
  const [csLoading, setCsLoading] = useState(false);

  const [storeName, setStoreName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productDetails, setProductDetails] = useState("");
  const [productCaution, setProductCaution] = useState("");
  const [productCatalog, setProductCatalog] = useState("");
  const [extraFaq, setExtraFaq] = useState("");
  const [ownerReplyExamples, setOwnerReplyExamples] = useState("");
  const [ownerCsExamples, setOwnerCsExamples] = useState("");
  const [autoCompleteLowRiskCs, setAutoCompleteLowRiskCs] = useState(false);
  const [autoCompletePositiveReviews, setAutoCompletePositiveReviews] =
    useState(false);
  const [aiWorkMode, setAiWorkMode] = useState<AiWorkMode>("safe_auto");
  const [aiWorkStartTime, setAiWorkStartTime] = useState("09:00");
  const [aiWorkEndTime, setAiWorkEndTime] = useState("22:00");
  const [shippingCutoffTime, setShippingCutoffTime] = useState("");
  const [sameDayShipping, setSameDayShipping] = useState("가능");
  const [courierName, setCourierName] = useState("");
  const [remoteAreaFee, setRemoteAreaFee] = useState("");
  const [changeOfMindRefund, setChangeOfMindRefund] = useState("불가능");
  const [defectContactDeadline, setDefectContactDeadline] = useState("");
  const [returnShippingFee, setReturnShippingFee] = useState("");
  const [cafeCancelBeforeProduction, setCafeCancelBeforeProduction] =
    useState("가능");
  const [cafeCancelAfterProduction, setCafeCancelAfterProduction] =
    useState("불가능");
  const [cafeRefundAfterPickup, setCafeRefundAfterPickup] =
    useState("확인 필요");
  const [cafeProductIssueStandard, setCafeProductIssueStandard] = useState("");
  const [cafeReservationCancelDeadline, setCafeReservationCancelDeadline] =
    useState("");
  const [foodCancelBeforeCooking, setFoodCancelBeforeCooking] =
    useState("가능");
  const [foodCancelAfterCooking, setFoodCancelAfterCooking] =
    useState("불가능");
  const [foodRefundAfterDelivery, setFoodRefundAfterDelivery] = useState("");
  const [foodMissingWrongStandard, setFoodMissingWrongStandard] = useState("");
  const [foodConditionIssueStandard, setFoodConditionIssueStandard] =
    useState("");
  const [storeError, setStoreError] = useState("");
  const [storeExampleMessage, setStoreExampleMessage] = useState("");
  const [storeSuccessMessage, setStoreSuccessMessage] = useState("");
  const [isExamplePickerOpen, setIsExamplePickerOpen] = useState(false);
  const [storeSaving, setStoreSaving] = useState(false);
  const [hasStore, setHasStore] = useState(false);
  const [storeStatusLoading, setStoreStatusLoading] = useState(true);
  const [storeDraftReady, setStoreDraftReady] = useState(false);

  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [deletingReviewId, setDeletingReviewId] = useState<number | null>(null);

  const [csMessages, setCsMessages] = useState<CsMessageHistoryItem[]>([]);
  const [csMessagesLoading, setCsMessagesLoading] = useState(true);
  const [csMessagesError, setCsMessagesError] = useState("");
  const [deletingCsMessageId, setDeletingCsMessageId] = useState<
    number | null
  >(null);
  const [aiActivityLogs, setAiActivityLogs] = useState<AiActivityLogItem[]>([]);
  const [aiActivityLogsLoading, setAiActivityLogsLoading] = useState(true);
  const [aiActivityLogsError, setAiActivityLogsError] = useState("");
  const [csLearningMetrics, setCsLearningMetrics] =
    useState<CsLearningMetrics | null>(null);
  const [csLearningMetricsLoading, setCsLearningMetricsLoading] =
    useState(true);
  const [csLearningMetricsError, setCsLearningMetricsError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [copyError, setCopyError] = useState("");
  const [workflowError, setWorkflowError] = useState("");
  const [workflowBulkApprovalResult, setWorkflowBulkApprovalResult] = useState<{
    message: string;
    hasFailures: boolean;
  } | null>(null);
  const [workflowBulkApproving, setWorkflowBulkApproving] = useState(false);
  const [workflowUpdatingKey, setWorkflowUpdatingKey] = useState<string | null>(
    null,
  );
  const [editingWorkflowKey, setEditingWorkflowKey] = useState<string | null>(
    null,
  );
  const [editingWorkflowReply, setEditingWorkflowReply] = useState("");
  const [expandedWorkflowDetailKeys, setExpandedWorkflowDetailKeys] = useState<
    Record<string, boolean>
  >({});
  const [selectedWorkflowStatus, setSelectedWorkflowStatus] =
    useState<WorkflowStatus>("needs_review");
  const [selectedWorkflowPlatform, setSelectedWorkflowPlatform] =
    useState<WorkflowPlatformFilter>("all");
  const [visibleWorkflowCount, setVisibleWorkflowCount] =
    useState(WORKFLOW_PAGE_SIZE);

  const [missingInfos, setMissingInfos] = useState<MissingInfoItem[]>([]);
  const [missingInfosLoading, setMissingInfosLoading] = useState(true);
  const [missingInfosError, setMissingInfosError] = useState("");
  const [missingInfoAnswers, setMissingInfoAnswers] = useState<
    Record<string, string>
  >({});
  const [missingInfoTargetFields, setMissingInfoTargetFields] = useState<
    Record<string, string>
  >({});
  const [missingInfoResolvingId, setMissingInfoResolvingId] = useState<
    string | null
  >(null);
  const [missingInfoResolveMessage, setMissingInfoResolveMessage] =
    useState("");
  const [storeKnowledgeItems, setStoreKnowledgeItems] = useState<
    StoreKnowledgeItem[]
  >([]);
  const [storeKnowledgeLoading, setStoreKnowledgeLoading] = useState(true);
  const [storeKnowledgeError, setStoreKnowledgeError] = useState("");
  const [storeKnowledgeMessage, setStoreKnowledgeMessage] = useState("");
  const [selectedStoreKnowledgeStatus, setSelectedStoreKnowledgeStatus] =
    useState<StoreKnowledgeStatusFilter>("all");
  const [editingStoreKnowledgeId, setEditingStoreKnowledgeId] = useState<
    string | null
  >(null);
  const [editingStoreKnowledgeQuestion, setEditingStoreKnowledgeQuestion] =
    useState("");
  const [editingStoreKnowledgeAnswer, setEditingStoreKnowledgeAnswer] =
    useState("");
  const [savingStoreKnowledgeId, setSavingStoreKnowledgeId] = useState<
    string | null
  >(null);
  const [deletingStoreKnowledgeId, setDeletingStoreKnowledgeId] = useState<
    string | null
  >(null);
  const [resolvingStoreKnowledgeConflictId, setResolvingStoreKnowledgeConflictId] =
    useState<string | null>(null);
  const [mergingCorrectionPatternKey, setMergingCorrectionPatternKey] =
    useState<string | null>(null);
  const [correctionPatternDrafts, setCorrectionPatternDrafts] = useState<
    Record<string, { question: string; answer: string }>
  >({});
  const [isStoreKnowledgePanelOpen, setIsStoreKnowledgePanelOpen] =
    useState(false);
  const [isInsightsPanelOpen, setIsInsightsPanelOpen] = useState(false);

  const [insights, setInsights] = useState("");
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState("");
  const [integrationRequests, setIntegrationRequests] = useState<
    PlatformIntegrationRequest[]
  >([]);
  const [integrationDrafts, setIntegrationDrafts] = useState<IntegrationDrafts>(
    createEmptyIntegrationDrafts,
  );
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [integrationsError, setIntegrationsError] = useState("");
  const [integrationsMessage, setIntegrationsMessage] = useState("");
  const [paidAdoptionRequestLoading, setPaidAdoptionRequestLoading] =
    useState(false);
  const [paidAdoptionRequestMessage, setPaidAdoptionRequestMessage] =
    useState("");
  const [paidAdoptionRequestError, setPaidAdoptionRequestError] = useState("");
  const [savingIntegrationPlatform, setSavingIntegrationPlatform] =
    useState<IntegrationPlatform | null>(null);
  const [coupangCredential, setCoupangCredential] =
    useState<PlatformCredential | null>(null);
  const [coupangCredentialDraft, setCoupangCredentialDraft] =
    useState<CoupangCredentialDraft>(createEmptyCoupangCredentialDraft);
  const [isCoupangSettingsOpen, setIsCoupangSettingsOpen] = useState(false);
  const [coupangCredentialsLoading, setCoupangCredentialsLoading] =
    useState(false);
  const [coupangCredentialsSaving, setCoupangCredentialsSaving] =
    useState(false);
  const [coupangCredentialsError, setCoupangCredentialsError] = useState("");
  const [coupangCredentialsMessage, setCoupangCredentialsMessage] =
    useState("");
  const [coupangConnectionTesting, setCoupangConnectionTesting] =
    useState(false);
  const [coupangConnectionTestError, setCoupangConnectionTestError] =
    useState("");
  const [coupangConnectionTestMessage, setCoupangConnectionTestMessage] =
    useState("");
  const [coupangInquiryImportLoading, setCoupangInquiryImportLoading] =
    useState(false);
  const [coupangInquiryImportError, setCoupangInquiryImportError] =
    useState("");
  const [coupangInquiryImportMessage, setCoupangInquiryImportMessage] =
    useState("");
  const [coupangMockInquiriesLoading, setCoupangMockInquiriesLoading] =
    useState(false);
  const [coupangMockInquiriesError, setCoupangMockInquiriesError] =
    useState("");
  const [coupangMockInquiriesMessage, setCoupangMockInquiriesMessage] =
    useState("");
  const [coupangMockReviewsLoading, setCoupangMockReviewsLoading] =
    useState(false);
  const [coupangMockReviewsError, setCoupangMockReviewsError] = useState("");
  const [coupangMockReviewsMessage, setCoupangMockReviewsMessage] =
    useState("");
  const [smartstoreMockInquiriesLoading, setSmartstoreMockInquiriesLoading] =
    useState(false);
  const [smartstoreMockInquiriesError, setSmartstoreMockInquiriesError] =
    useState("");
  const [smartstoreMockInquiriesMessage, setSmartstoreMockInquiriesMessage] =
    useState("");
  const [
    deliveryMockReviewsLoadingPlatform,
    setDeliveryMockReviewsLoadingPlatform,
  ] = useState<DeliveryMockReviewPlatform | null>(null);
  const [deliveryMockReviewsErrors, setDeliveryMockReviewsErrors] = useState<
    Partial<Record<DeliveryMockReviewPlatform, string>>
  >({});
  const [deliveryMockReviewsMessages, setDeliveryMockReviewsMessages] = useState<
    Partial<Record<DeliveryMockReviewPlatform, string>>
  >({});

  const storeDraft = useMemo<StoreDraft>(
    () => ({
      storeName,
      businessType,
      shippingPolicy,
      refundPolicy,
      productName,
      productDescription,
      productDetails,
      productCaution,
      productCatalog,
      extraFaq,
      ownerReplyExamples,
      ownerCsExamples,
      autoCompleteLowRiskCs,
      autoCompletePositiveReviews,
      aiWorkMode,
      aiWorkStartTime,
      aiWorkEndTime,
    }),
    [
      storeName,
      businessType,
      shippingPolicy,
      refundPolicy,
      productName,
      productDescription,
      productDetails,
      productCaution,
      productCatalog,
      extraFaq,
      ownerReplyExamples,
      ownerCsExamples,
      autoCompleteLowRiskCs,
      autoCompletePositiveReviews,
      aiWorkMode,
      aiWorkStartTime,
      aiWorkEndTime,
    ],
  );

  const applyStoreToForm = useCallback((store: StoreSettings | null) => {
    setHasStore(Boolean(store));
    setStoreExampleMessage("");
    setIsExamplePickerOpen(false);

    if (store) {
      setStoreName(store.store_name ?? "");
      setBusinessType(store.business_type ?? "");
      setShippingPolicy(store.shipping_policy ?? "");
      setRefundPolicy(store.refund_policy ?? "");
      setProductName(store.product_name ?? "");
      setProductDescription(store.product_description ?? "");
      setProductDetails(store.product_details ?? "");
      setProductCaution(store.product_caution ?? "");
      setProductCatalog(store.product_catalog ?? "");
      setExtraFaq(store.extra_faq ?? "");
      setOwnerReplyExamples(store.owner_reply_examples ?? "");
      setOwnerCsExamples(store.owner_cs_examples ?? "");
      setAutoCompleteLowRiskCs(Boolean(store.auto_complete_low_risk_cs));
      setAutoCompletePositiveReviews(
        Boolean(store.auto_complete_positive_reviews),
      );
      setAiWorkMode(normalizeAiWorkMode(store.ai_work_mode));
      setAiWorkStartTime(store.ai_work_start_time ?? "09:00");
      setAiWorkEndTime(store.ai_work_end_time ?? "22:00");
      return;
    }

    setStoreName("");
    setBusinessType("");
    setShippingPolicy("");
    setRefundPolicy("");
    setProductName("");
    setProductDescription("");
    setProductDetails("");
    setProductCaution("");
    setProductCatalog("");
    setExtraFaq("");
    setOwnerReplyExamples("");
    setOwnerCsExamples("");
    setAutoCompleteLowRiskCs(false);
    setAutoCompletePositiveReviews(false);
    setAiWorkMode("safe_auto");
    setAiWorkStartTime("09:00");
    setAiWorkEndTime("22:00");
  }, []);

  useEffect(() => {
    let isActive = true;
    let unsubscribe: (() => void) | undefined;

    void Promise.resolve()
      .then(() => {
        const supabaseClient = getSupabase();
        const {
          data: { subscription },
        } = supabaseClient.auth.onAuthStateChange((_event, session) => {
          if (!isActive) return;
          setAuthUser(session?.user ?? null);
          setAuthError("");
          setAuthLoading(false);
        });

        unsubscribe = () => subscription.unsubscribe();

        return supabaseClient.auth.getSession();
      })
      .then(({ data, error }) => {
        if (!isActive) return;

        if (error) {
          setAuthError(error.message);
        }

        setAuthUser(data.session?.user ?? null);
      })
      .catch((error) => {
        if (!isActive) return;
        setAuthError(
          error instanceof Error
            ? error.message
            : "로그인 상태를 확인하지 못했습니다.",
        );
        setAuthUser(null);
      })
      .finally(() => {
        if (!isActive) return;
        setAuthLoading(false);
      });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, []);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError("");

    try {
      const response = await fetch("/api/insights", {
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as InsightsApiResponse;

      if (!response.ok || !data.insights) {
        setInsights("");
        setInsightsError(data.error ?? "인사이트를 불러오지 못했습니다.");
        return;
      }

      setInsights(data.insights);
    } catch {
      setInsights("");
      setInsightsError(
        "네트워크 오류로 인사이트를 불러오지 못했습니다.",
      );
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await fetch("/api/reviews", {
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as ReviewsListResponse;

      if (!response.ok) {
        setHistoryError(data.error ?? "히스토리를 불러오지 못했습니다.");
        setHistory([]);
        return;
      }

      setHistory(data.reviews ?? []);
    } catch {
      setHistoryError("네트워크 오류로 히스토리를 불러오지 못했습니다.");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadCsMessages = useCallback(async () => {
    setCsMessagesLoading(true);
    setCsMessagesError("");

    try {
      const response = await fetch("/api/cs-messages", {
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as CsMessagesListResponse;

      if (!response.ok) {
        setCsMessagesError(
          data.error ?? "CS 히스토리를 불러오지 못했습니다.",
        );
        setCsMessages([]);
        return;
      }

      setCsMessages(data.csMessages ?? []);
    } catch {
      setCsMessagesError(
        "네트워크 오류로 CS 히스토리를 불러오지 못했습니다.",
      );
      setCsMessages([]);
    } finally {
      setCsMessagesLoading(false);
    }
  }, []);

  const loadAiActivityLogs = useCallback(async () => {
    setAiActivityLogsLoading(true);
    setAiActivityLogsError("");

    try {
      const logs = await fetchAiActivityLogs();
      setAiActivityLogs(logs);
    } catch (error) {
      setAiActivityLogsError(
        error instanceof Error
          ? error.message
          : "AI 업무 이력을 불러오지 못했습니다.",
      );
      setAiActivityLogs([]);
    } finally {
      setAiActivityLogsLoading(false);
    }
  }, []);

  const loadCsLearningMetrics = useCallback(async () => {
    setCsLearningMetricsLoading(true);
    setCsLearningMetricsError("");

    try {
      setCsLearningMetrics(await fetchCsLearningMetrics());
    } catch (error) {
      setCsLearningMetricsError(
        error instanceof Error
          ? error.message
          : "AI CS 학습 품질을 불러오지 못했습니다.",
      );
      setCsLearningMetrics(null);
    } finally {
      setCsLearningMetricsLoading(false);
    }
  }, []);

  const loadMissingInfos = useCallback(async () => {
    setMissingInfosLoading(true);
    setMissingInfosError("");

    try {
      const infos = await fetchMissingInfoList();
      setMissingInfos(infos);
    } catch (error) {
      setMissingInfosError(
        error instanceof Error
          ? error.message
          : "확인이 필요한 정보를 불러오지 못했습니다.",
      );
      setMissingInfos([]);
    } finally {
      setMissingInfosLoading(false);
    }
  }, []);

  const loadStoreKnowledge = useCallback(async () => {
    setStoreKnowledgeLoading(true);
    setStoreKnowledgeError("");

    try {
      const items = await fetchStoreKnowledgeList();
      setStoreKnowledgeItems(items);
    } catch (error) {
      setStoreKnowledgeError(
        error instanceof Error
          ? error.message
          : "AI가 학습한 가게 지식을 불러오지 못했습니다.",
      );
      setStoreKnowledgeItems([]);
    } finally {
      setStoreKnowledgeLoading(false);
    }
  }, []);

  const loadIntegrationRequests = useCallback(async () => {
    setIntegrationsLoading(true);
    setIntegrationsError("");

    try {
      const response = await fetch("/api/integrations", {
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as IntegrationsApiResponse;

      if (!response.ok) {
        setIntegrationsError(
          data.error ?? "연동 희망 목록을 불러오지 못했습니다.",
        );
        setIntegrationRequests([]);
        return;
      }

      const integrations = data.integrations ?? [];
      setIntegrationRequests(integrations);
      setIntegrationDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };

        for (const integration of integrations) {
          if (!isIntegrationPlatform(integration.platform)) continue;

          nextDrafts[integration.platform] = {
            storeUrl: integration.store_url ?? "",
            memo: integration.memo ?? "",
          };
        }

        return nextDrafts;
      });
    } catch {
      setIntegrationsError("연동 희망 목록을 불러오지 못했습니다.");
      setIntegrationRequests([]);
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  const loadPlatformCredentials = useCallback(async () => {
    setCoupangCredentialsLoading(true);
    setCoupangCredentialsError("");

    try {
      const response = await fetch("/api/integrations/credentials", {
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as PlatformCredentialsApiResponse;

      if (!response.ok) {
        setCoupangCredentialsError(
          data.error ?? "쿠팡 연동 설정을 불러오지 못했습니다.",
        );
        setCoupangCredential(null);
        return;
      }

      const credential =
        data.credentials?.find((item) => item.platform === "coupang") ?? null;
      setCoupangCredential(credential);
      setCoupangCredentialDraft({
        vendorId: credential?.vendor_id ?? "",
        accessKey: credential?.access_key ?? "",
        secretKey: "",
        wingId: credential?.wing_id ?? "",
      });
    } catch {
      setCoupangCredentialsError("쿠팡 연동 설정을 불러오지 못했습니다.");
      setCoupangCredential(null);
    } finally {
      setCoupangCredentialsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    if (!authUser) {
      void Promise.resolve().then(() => {
        if (!isActive) return;

        setIntegrationRequests([]);
        setIntegrationDrafts(createEmptyIntegrationDrafts());
        setIntegrationsLoading(false);
        setIntegrationsError("");
        setIntegrationsMessage("");
        setPaidAdoptionRequestLoading(false);
        setPaidAdoptionRequestMessage("");
        setPaidAdoptionRequestError("");
        setSavingIntegrationPlatform(null);
        setCoupangCredential(null);
        setCoupangCredentialDraft(createEmptyCoupangCredentialDraft());
        setIsCoupangSettingsOpen(false);
        setCoupangCredentialsLoading(false);
        setCoupangCredentialsSaving(false);
        setCoupangCredentialsError("");
        setCoupangCredentialsMessage("");
        setCoupangConnectionTesting(false);
        setCoupangConnectionTestError("");
        setCoupangConnectionTestMessage("");
        setCoupangInquiryImportLoading(false);
        setCoupangInquiryImportError("");
        setCoupangInquiryImportMessage("");
        setCoupangMockInquiriesLoading(false);
        setCoupangMockInquiriesError("");
        setCoupangMockInquiriesMessage("");
        setCoupangMockReviewsLoading(false);
        setCoupangMockReviewsError("");
        setCoupangMockReviewsMessage("");
        setSmartstoreMockInquiriesLoading(false);
        setSmartstoreMockInquiriesError("");
        setSmartstoreMockInquiriesMessage("");
        setDeliveryMockReviewsLoadingPlatform(null);
        setDeliveryMockReviewsErrors({});
        setDeliveryMockReviewsMessages({});
      });

      return () => {
        isActive = false;
      };
    }

    void Promise.resolve().then(() => {
      if (!isActive) return;
      void loadIntegrationRequests();
      void loadPlatformCredentials();
    });

    return () => {
      isActive = false;
    };
  }, [authUser, loadIntegrationRequests, loadPlatformCredentials]);

  useEffect(() => {
    let isActive = true;

    if (authLoading) {
      return () => {
        isActive = false;
      };
    }

    if (!authUser) {
      void Promise.resolve().then(() => {
        if (!isActive) return;

        setHistory([]);
        setHistoryError("");
        setHistoryLoading(false);
        setHasStore(false);
        setStoreStatusLoading(false);
        setStoreDraftReady(false);
        setStoreName("");
        setBusinessType("");
        setShippingPolicy("");
        setRefundPolicy("");
        setProductName("");
        setProductDescription("");
        setProductDetails("");
        setProductCaution("");
        setProductCatalog("");
        setExtraFaq("");
        setOwnerReplyExamples("");
        setOwnerCsExamples("");
        setAutoCompleteLowRiskCs(false);
        setAutoCompletePositiveReviews(false);
        setAiWorkMode("safe_auto");
        setAiWorkStartTime("09:00");
        setAiWorkEndTime("22:00");
        setStoreExampleMessage("");
        setIsExamplePickerOpen(false);
        setCsMessages([]);
        setCsMessagesError("");
        setCsMessagesLoading(false);
        setAiActivityLogs([]);
        setAiActivityLogsError("");
        setAiActivityLogsLoading(false);
        setCsLearningMetrics(null);
        setCsLearningMetricsError("");
        setCsLearningMetricsLoading(false);
        setDeletingCsMessageId(null);
        setWorkflowError("");
        setWorkflowUpdatingKey(null);
        setEditingWorkflowKey(null);
        setEditingWorkflowReply("");
        setSelectedWorkflowStatus("needs_review");
        setSelectedWorkflowPlatform("all");
        setVisibleWorkflowCount(WORKFLOW_PAGE_SIZE);
        setMissingInfos([]);
        setMissingInfosError("");
        setMissingInfosLoading(false);
        setMissingInfoAnswers({});
        setMissingInfoTargetFields({});
        setMissingInfoResolvingId(null);
        setMissingInfoResolveMessage("");
        setStoreKnowledgeItems([]);
        setStoreKnowledgeLoading(false);
        setStoreKnowledgeError("");
        setStoreKnowledgeMessage("");
        setSelectedStoreKnowledgeStatus("all");
        setEditingStoreKnowledgeId(null);
        setEditingStoreKnowledgeQuestion("");
        setEditingStoreKnowledgeAnswer("");
        setSavingStoreKnowledgeId(null);
        setDeletingStoreKnowledgeId(null);
        setInsights("");
        setInsightsError("");
        setInsightsLoading(false);
        setDeletingReviewId(null);
      });

      return () => {
        isActive = false;
      };
    }

    void Promise.resolve().then(() => {
      if (!isActive) return;
      setStoreStatusLoading(true);
      setMissingInfosLoading(true);
      setStoreKnowledgeLoading(true);
      setAiActivityLogsLoading(true);
      setCsLearningMetricsLoading(true);
      setStoreDraftReady(false);

      const draft = readStoreDraft(authUser.id);

      if (draft) {
        setStoreName(draft.storeName);
        setBusinessType(draft.businessType ?? "");
        setShippingPolicy(draft.shippingPolicy);
        setRefundPolicy(draft.refundPolicy);
        setProductName(draft.productName);
        setProductDescription(draft.productDescription);
        setProductDetails(draft.productDetails);
        setProductCaution(draft.productCaution);
        setProductCatalog(draft.productCatalog);
        setExtraFaq(draft.extraFaq);
        setOwnerReplyExamples(draft.ownerReplyExamples);
        setOwnerCsExamples(draft.ownerCsExamples);
        setAutoCompleteLowRiskCs(draft.autoCompleteLowRiskCs);
        setAutoCompletePositiveReviews(draft.autoCompletePositiveReviews);
        setAiWorkMode(draft.aiWorkMode);
        setAiWorkStartTime(draft.aiWorkStartTime);
        setAiWorkEndTime(draft.aiWorkEndTime);
      }

      setStoreDraftReady(true);
    });

    void fetchReviewHistory()
      .then((reviews) => {
        if (!isActive) return;
        setHistory(reviews);
      })
      .catch((error) => {
        if (!isActive) return;
        setHistoryError(
          error instanceof Error
            ? error.message
            : "?ㅽ듃?뚰겕 ?ㅻ쪟濡??덉뒪?좊━瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??",
        );
        setHistory([]);
      })
      .finally(() => {
        if (!isActive) return;
        setHistoryLoading(false);
      });

    void fetchLatestStore()
      .then((store) => {
        if (!isActive) return;
        setHasStore(Boolean(store));

        const draft = readStoreDraft(authUser.id);

        if (store && !draft) {
          applyStoreToForm(store);
        } else if (!store && !draft) {
          applyStoreToForm(null);
        } else {
          setHasStore(Boolean(store));
        }
      })
      .catch((error) => {
        if (!isActive) return;
        setHasStore(false);
        setStoreError(
          error instanceof Error
            ? error.message
            : "가게 정보를 확인하지 못했습니다.",
        );
      })
      .finally(() => {
        if (!isActive) return;
        setStoreStatusLoading(false);
      });

    void fetchCsMessageHistory()
      .then((messages) => {
        if (!isActive) return;
        setCsMessages(messages);
      })
      .catch((error) => {
        if (!isActive) return;
        setCsMessagesError(
          error instanceof Error
            ? error.message
            : "?ㅽ듃?뚰겕 ?ㅻ쪟濡?CS ?덉뒪?좊━瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??",
        );
        setCsMessages([]);
      })
      .finally(() => {
        if (!isActive) return;
        setCsMessagesLoading(false);
      });

    void fetchAiActivityLogs()
      .then((logs) => {
        if (!isActive) return;
        setAiActivityLogs(logs);
      })
      .catch((error) => {
        if (!isActive) return;
        setAiActivityLogsError(
          error instanceof Error
            ? error.message
            : "AI 업무 이력을 불러오지 못했습니다.",
        );
        setAiActivityLogs([]);
      })
      .finally(() => {
        if (!isActive) return;
        setAiActivityLogsLoading(false);
      });

    void fetchMissingInfoList()
      .then((infos) => {
        if (!isActive) return;
        setMissingInfos(infos);
      })
      .catch((error) => {
        if (!isActive) return;
        setMissingInfosError(
          error instanceof Error
            ? error.message
            : "확인이 필요한 정보를 불러오지 못했습니다.",
        );
        setMissingInfos([]);
      })
      .finally(() => {
        if (!isActive) return;
        setMissingInfosLoading(false);
      });

    void fetchStoreKnowledgeList()
      .then((items) => {
        if (!isActive) return;
        setStoreKnowledgeItems(items);
      })
      .catch((error) => {
        if (!isActive) return;
        setStoreKnowledgeError(
          error instanceof Error
            ? error.message
            : "AI가 학습한 가게 지식을 불러오지 못했습니다.",
        );
        setStoreKnowledgeItems([]);
      })
      .finally(() => {
        if (!isActive) return;
        setStoreKnowledgeLoading(false);
      });

    void fetchInsightsData()
      .then((nextInsights) => {
        if (!isActive) return;
        setInsights(nextInsights);
      })
      .catch((error) => {
        if (!isActive) return;
        setInsights("");
        setInsightsError(
          error instanceof Error
            ? error.message
            : "?ㅽ듃?뚰겕 ?ㅻ쪟濡??몄궗?댄듃瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??",
        );
      })
      .finally(() => {
        if (!isActive) return;
        setInsightsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [applyStoreToForm, authLoading, authUser]);

  useEffect(() => {
    let isActive = true;

    if (!authUser || csMessagesLoading) {
      return () => {
        isActive = false;
      };
    }

    void Promise.resolve().then(() => {
      if (!isActive) return;
      void loadCsLearningMetrics();
    });

    return () => {
      isActive = false;
    };
  }, [authUser, csMessages, csMessagesLoading, loadCsLearningMetrics]);

  useEffect(() => {
    if (!authUser || !storeDraftReady) return;

    if (hasStoreDraftContent(storeDraft)) {
      saveStoreDraft(authUser.id, storeDraft);
      return;
    }

    removeStoreDraft(authUser.id);
  }, [authUser, storeDraft, storeDraftReady]);

  const stats = useMemo(() => computeReviewStats(history), [history]);
  const needsStoreInfo = Boolean(authUser && !storeStatusLoading && !hasStore);
  const aiGenerationBlocked = Boolean(
    authUser && (storeStatusLoading || !hasStore),
  );

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedReview = review.trim();

    if (!trimmedReview) {
      setError("리뷰를 입력해 주세요.");
      setReply("");
      return;
    }

    if (!authUser) {
      setError("로그인이 필요합니다");
      setReply("");
      return;
    }

    if (!hasStore) {
      setError("가게 정보를 먼저 등록해야 AI가 정확히 답변할 수 있습니다.");
      setReply("");
      return;
    }

    if (freeTrialAiReplyLimitReached) {
      setError(FREE_TRIAL_LIMIT_REACHED_MESSAGE);
      setReply("");
      return;
    }

    setIsLoading(true);
    setError("");
    setReply("");

    try {
      const response = await fetch("/api/review-reply", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          review: trimmedReview,
        }),
      });

      const data = (await response.json()) as ReviewApiResponse;

      if (!response.ok || !data.reply) {
        setError(data.error ?? "답글 생성에 실패했습니다.");
        return;
      }

      setReply(data.reply);
      void loadHistory();
      void loadInsights();
      void loadAiActivityLogs();
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBatchReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const reviews = batchReviewsInput
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (reviews.length === 0) {
      setBatchReviewError("리뷰를 한 개 이상 입력해 주세요.");
      setBatchReviewResults([]);
      return;
    }

    if (reviews.length > 10) {
      setBatchReviewError("한 번에 최대 10개까지 생성할 수 있습니다.");
      setBatchReviewResults([]);
      return;
    }

    if (reviews.length > trialAiReplyRemainingCount) {
      setBatchReviewError(
        `무료 체험 남은 AI 답변 생성 ${trialAiReplyRemainingCount.toLocaleString(
          "ko-KR",
        )}건으로는 ${reviews.length.toLocaleString(
          "ko-KR",
        )}개 리뷰를 일괄 생성할 수 없습니다. 도입 상담을 요청해 주세요.`,
      );
      setBatchReviewResults([]);
      return;
    }

    const tooLongReview = reviews.find((item) => item.length > 1000);

    if (tooLongReview) {
      setBatchReviewError("각 리뷰는 1,000자 이하로 입력해 주세요.");
      setBatchReviewResults([]);
      return;
    }

    if (!authUser) {
      setBatchReviewError("로그인이 필요합니다.");
      setBatchReviewResults([]);
      return;
    }

    if (needsStoreInfo) {
      setBatchReviewError(
        "가게 정보를 먼저 등록해야 AI가 정확히 답변할 수 있습니다.",
      );
      setBatchReviewResults([]);
      return;
    }

    if (freeTrialAiReplyLimitReached) {
      setBatchReviewError(FREE_TRIAL_LIMIT_REACHED_MESSAGE);
      setBatchReviewResults([]);
      return;
    }

    setBatchReviewLoading(true);
    setBatchReviewError("");
    setBatchReviewResults([]);
    setBatchReviewCopyMessages({});

    try {
      const response = await fetch("/api/review-reply/batch", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          reviews,
        }),
      });
      const data = (await response.json()) as BatchReviewApiResponse;

      if (!response.ok || !data.results) {
        setBatchReviewError(
          data.error ?? "리뷰 답글을 일괄 생성하지 못했습니다.",
        );
        return;
      }

      setBatchReviewResults(data.results);
      await Promise.all([loadHistory(), loadInsights(), loadAiActivityLogs()]);
    } catch {
      setBatchReviewError(
        "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setBatchReviewLoading(false);
    }
  }

  async function handleCsReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedCustomerMessage = customerMessage.trim();

    if (!trimmedCustomerMessage) {
      setCsError("고객 문의를 입력해 주세요.");
      setCsReply("");
      return;
    }

    if (!authUser) {
      setCsError("로그인이 필요합니다");
      setCsReply("");
      return;
    }

    if (!hasStore) {
      setCsError("가게 정보를 먼저 등록해야 AI가 정확히 답변할 수 있습니다.");
      setCsReply("");
      return;
    }

    if (freeTrialAiReplyLimitReached) {
      setCsError(FREE_TRIAL_LIMIT_REACHED_MESSAGE);
      setCsReply("");
      return;
    }

    setCsLoading(true);
    setCsError("");
    setCsReply("");

    try {
      const response = await fetch("/api/cs-reply", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          customerMessage: trimmedCustomerMessage,
        }),
      });

      const data = (await response.json()) as CsReplyApiResponse;

      if (!response.ok || !data.reply) {
        setCsError(data.error ?? "CS 답변 생성에 실패했습니다.");
        return;
      }

      setCsReply(data.reply);
      void loadCsMessages();
      void loadMissingInfos();
      void loadAiActivityLogs();
    } catch {
      setCsError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setCsLoading(false);
    }
  }

  function handleUseExampleStore(preset: ExampleStorePreset) {
    setStoreName(preset.storeName);
    setBusinessType(preset.businessType);
    setProductName(preset.productName);
    setProductDescription(preset.productDescription);
    setProductDetails(preset.productDetails);
    setProductCaution(preset.productCaution);
    setProductCatalog(preset.productCatalog);
    setExtraFaq(preset.extraFaq);
    setShippingPolicy(preset.shippingPolicy);
    setRefundPolicy(preset.refundPolicy);
    setOwnerReplyExamples(preset.ownerReplyExamples);
    setOwnerCsExamples(preset.ownerCsExamples);
    setAutoCompleteLowRiskCs(false);
    setAutoCompletePositiveReviews(false);
    setAiWorkMode("safe_auto");
    setAiWorkStartTime("09:00");
    setAiWorkEndTime("22:00");
    setStoreError("");
    setStoreSuccessMessage("");
    setStoreExampleMessage(
      "예시 정보가 입력되었습니다. 내용을 수정하거나 바로 저장한 뒤 AI 답변을 테스트해보세요.",
    );
    setIsExamplePickerOpen(false);
  }

  async function handleStoreSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = storeName.trim();
    if (!name) {
      setStoreError("가게명을 입력해 주세요.");
      return;
    }

    if (!authUser) {
      setStoreError("로그인이 필요합니다");
      return;
    }

    setStoreSaving(true);
    setStoreError("");
    setStoreSuccessMessage("");

    try {
      const response = await fetch("/api/store", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          store_name: name,
          business_type: businessType,
          shipping_policy: shippingPolicy,
          refund_policy: refundPolicy,
          product_name: productName,
          product_description: productDescription,
          product_details: productDetails,
          product_caution: productCaution,
          product_catalog: productCatalog,
          extra_faq: extraFaq,
          owner_reply_examples: ownerReplyExamples,
          owner_cs_examples: ownerCsExamples,
          auto_complete_low_risk_cs: autoCompleteLowRiskCs,
          auto_complete_positive_reviews: autoCompletePositiveReviews,
          ai_work_mode: aiWorkMode,
          ai_work_start_time: aiWorkStartTime,
          ai_work_end_time: aiWorkEndTime,
        }),
      });

      const data = (await response.json()) as StoreApiResponse;

      if (!response.ok) {
        setStoreError(data.error ?? "저장에 실패했습니다.");
        return;
      }

      setHasStore(true);
      removeStoreDraft(authUser.id);
      setStoreExampleMessage("");
      setStoreSuccessMessage(
        "가게 정보가 저장되었습니다.",
      );
    } catch {
      setStoreError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setStoreSaving(false);
    }
  }

  async function handleResolveMissingInfo(missingInfoId: string) {
    const answer = (missingInfoAnswers[missingInfoId] ?? "").trim();
    const targetField = missingInfoTargetFields[missingInfoId] ?? "extra_faq";

    if (!answer) {
      setMissingInfosError("반영할 답변을 입력해 주세요.");
      setWorkflowError("반영할 답변을 입력해 주세요.");
      setMissingInfoResolveMessage("");
      return;
    }

    setMissingInfoResolvingId(missingInfoId);
    setMissingInfosError("");
    setWorkflowError("");
    setMissingInfoResolveMessage("");

    try {
      const response = await fetch("/api/missing-infos/resolve", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          missingInfoId,
          answer,
          targetField,
        }),
      });

      const data = (await response.json()) as ResolveMissingInfoResponse;

      if (!response.ok || !data.success) {
        const errorMessage =
          data.error ?? "정보 저장 또는 답변 반영에 실패했습니다.";
        setMissingInfosError(errorMessage);
        setWorkflowError(errorMessage);
        return;
      }

      setMissingInfos((currentInfos) =>
        currentInfos.filter((item) => item.id !== missingInfoId),
      );
      setMissingInfoAnswers((currentAnswers) => {
        const nextAnswers = { ...currentAnswers };
        delete nextAnswers[missingInfoId];
        return nextAnswers;
      });
      setMissingInfoTargetFields((currentFields) => {
        const nextFields = { ...currentFields };
        delete nextFields[missingInfoId];
        return nextFields;
      });

      const latestStore = await fetchLatestStore();
      applyStoreToForm(latestStore);

      if (authUser) {
        removeStoreDraft(authUser.id);
      }

      setMissingInfoResolveMessage(
        "정보가 저장되었고 관련 문의 답변에 반영되었습니다.",
      );
      await Promise.allSettled([
        loadMissingInfos(),
        loadCsMessages(),
        loadStoreKnowledge(),
        loadInsights(),
        loadAiActivityLogs(),
      ]);
    } catch {
      const errorMessage = "정보 저장 또는 답변 반영에 실패했습니다.";
      setMissingInfosError(errorMessage);
      setWorkflowError(errorMessage);
    } finally {
      setMissingInfoResolvingId(null);
    }
  }

  function handleStartStoreKnowledgeEdit(item: StoreKnowledgeItem) {
    setEditingStoreKnowledgeId(item.id);
    setEditingStoreKnowledgeQuestion(item.question);
    setEditingStoreKnowledgeAnswer(item.answer);
    setStoreKnowledgeMessage("");
    setStoreKnowledgeError("");
  }

  function handleCancelStoreKnowledgeEdit() {
    setEditingStoreKnowledgeId(null);
    setEditingStoreKnowledgeQuestion("");
    setEditingStoreKnowledgeAnswer("");
  }

  async function handleSaveStoreKnowledgeItem(item: StoreKnowledgeItem) {
    const question = editingStoreKnowledgeQuestion.trim();
    const answer = editingStoreKnowledgeAnswer.trim();

    if (!question || !answer) {
      setStoreKnowledgeError("질문과 답변을 모두 입력해 주세요.");
      return;
    }

    setSavingStoreKnowledgeId(item.id);
    setStoreKnowledgeError("");
    setStoreKnowledgeMessage("");

    try {
      const response = await fetch(`/api/store-knowledge/${item.id}`, {
        method: "PATCH",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          question,
          answer,
          category: item.category,
          status: "active",
        }),
      });
      const data = (await response.json()) as StoreKnowledgeMutationResponse;

      if (!response.ok || !data.knowledgeItem) {
        setStoreKnowledgeError(
          data.error ?? "학습한 가게 지식을 수정하지 못했습니다.",
        );
        return;
      }

      setStoreKnowledgeItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id ? data.knowledgeItem! : currentItem,
        ),
      );
      const reprocessResult = await reprocessRelatedCsMessagesForKnowledge(
        data.knowledgeItem,
      );

      if (reprocessResult.success) {
        setStoreKnowledgeMessage(
          reprocessResult.updatedCount > 0
            ? `AI가 학습한 가게 지식을 수정했습니다. 관련 문의 ${reprocessResult.updatedCount.toLocaleString(
                "ko-KR",
              )}건의 답변 초안을 새 지식 기준으로 다시 만들었습니다.`
            : "AI가 학습한 가게 지식을 수정했습니다. 새로 반영할 관련 문의는 없었습니다.",
        );
        await Promise.allSettled([
          loadCsMessages(),
          loadMissingInfos(),
          loadInsights(),
        ]);
      } else {
        setStoreKnowledgeMessage("AI가 학습한 가게 지식을 수정했습니다.");
        setStoreKnowledgeError(reprocessResult.error ?? "");
      }
      handleCancelStoreKnowledgeEdit();
    } catch {
      setStoreKnowledgeError(
        "네트워크 오류로 학습한 가게 지식을 수정하지 못했습니다.",
      );
    } finally {
      setSavingStoreKnowledgeId(null);
    }
  }

  async function handleUpdateStoreKnowledgeStatus(
    item: StoreKnowledgeItem,
    status: "active" | "needs_review" | "archived",
  ) {
    setSavingStoreKnowledgeId(item.id);
    setStoreKnowledgeError("");
    setStoreKnowledgeMessage("");

    try {
      const response = await fetch(`/api/store-knowledge/${item.id}`, {
        method: "PATCH",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as StoreKnowledgeMutationResponse;

      if (!response.ok || !data.knowledgeItem) {
        setStoreKnowledgeError(
          data.error ?? "학습한 가게 지식 상태를 변경하지 못했습니다.",
        );
        return;
      }

      setStoreKnowledgeItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id ? data.knowledgeItem! : currentItem,
        ),
      );

      let reprocessResult: Awaited<
        ReturnType<typeof reprocessRelatedCsMessagesForKnowledge>
      > | null = null;

      if (status === "active") {
        reprocessResult = await reprocessRelatedCsMessagesForKnowledge(
          data.knowledgeItem,
        );
      }

      setStoreKnowledgeMessage(
        status === "active"
          ? reprocessResult?.success
            ? reprocessResult.updatedCount > 0
              ? `이 지식을 다시 답변 근거로 사용합니다. 관련 문의 ${reprocessResult.updatedCount.toLocaleString(
                  "ko-KR",
                )}건의 답변 초안을 새 지식 기준으로 다시 만들었습니다.`
              : "이 지식을 다시 답변 근거로 사용합니다. 새로 반영할 관련 문의는 없었습니다."
            : "이 지식을 다시 답변 근거로 사용합니다."
          : status === "needs_review"
            ? "이 지식을 검토 필요 상태로 표시했습니다. 답변 근거에서는 제외됩니다."
            : "이 지식을 보관했습니다. 답변 근거에서는 제외됩니다.",
      );

      if (reprocessResult?.success) {
        await Promise.allSettled([
          loadCsMessages(),
          loadMissingInfos(),
          loadInsights(),
        ]);
      } else if (reprocessResult && !reprocessResult.success) {
        setStoreKnowledgeError(reprocessResult.error ?? "");
      }
    } catch {
      setStoreKnowledgeError(
        "네트워크 오류로 학습한 가게 지식 상태를 변경하지 못했습니다.",
      );
    } finally {
      setSavingStoreKnowledgeId(null);
    }
  }

  function handleStartMergeCorrectionPattern(pattern: RepeatedCorrectionPattern) {
    setCorrectionPatternDrafts((currentDrafts) => ({
      ...currentDrafts,
      [pattern.key]: currentDrafts[pattern.key] ?? {
        question: createCorrectionPatternDraftQuestion(pattern),
        answer: createCorrectionPatternDraftAnswer(pattern),
      },
    }));
    setStoreKnowledgeError("");
    setStoreKnowledgeMessage("");
  }

  function handleCancelMergeCorrectionPattern(patternKey: string) {
    setCorrectionPatternDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[patternKey];
      return nextDrafts;
    });
  }

  async function handleSaveMergedCorrectionPattern(
    pattern: RepeatedCorrectionPattern,
  ) {
    const draft = correctionPatternDrafts[pattern.key];
    const question = draft?.question.trim() ?? "";
    const answer = draft?.answer.trim() ?? "";

    if (!question || !answer) {
      setStoreKnowledgeError("정리할 질문과 답변을 모두 입력해 주세요.");
      return;
    }

    if (
      !window.confirm(
        `반복 수정 후보 ${pattern.items.length.toLocaleString(
          "ko-KR",
        )}건을 하나의 지식으로 정리하고 기존 후보는 보관할까요?`,
      )
    ) {
      return;
    }

    setMergingCorrectionPatternKey(pattern.key);
    setStoreKnowledgeError("");
    setStoreKnowledgeMessage("");

    try {
      const sourceText = [
        "반복 수정 후보를 하나의 지식으로 정리했습니다.",
        ...pattern.items.map((item, index) =>
          [
            `후보 ${index + 1}`,
            `질문: ${item.question}`,
            `답변: ${item.answer}`,
            item.source_text ? `출처: ${item.source_text}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      ].join("\n\n");
      const mergedItem = await createStoreKnowledgeItem({
        question,
        answer,
        category: pattern.category,
        sourceId: `merged-correction-${pattern.items
          .map((item) => item.id)
          .join("-")}`,
        sourceText,
        status: "active",
      });
      const headers = await getAuthenticatedRequestHeaders({
        "Content-Type": "application/json",
      });
      const archiveResults = await Promise.allSettled(
        pattern.items.map(async (item) => {
          const response = await fetch(`/api/store-knowledge/${item.id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ status: "archived" }),
          });
          const data = (await response.json()) as StoreKnowledgeMutationResponse;

          if (!response.ok || !data.knowledgeItem) {
            throw new Error(data.error ?? "기존 후보를 보관하지 못했습니다.");
          }

          return data.knowledgeItem;
        }),
      );
      const archivedItems = archiveResults
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<StoreKnowledgeItem> =>
            result.status === "fulfilled",
        )
        .map((result) => result.value);
      const failedArchiveCount = archiveResults.length - archivedItems.length;

      setStoreKnowledgeItems((currentItems) => {
        const archivedItemMap = new Map(
          archivedItems.map((item) => [item.id, item]),
        );
        return [
          mergedItem,
          ...currentItems.map(
            (item) => archivedItemMap.get(item.id) ?? item,
          ),
        ];
      });
      handleCancelMergeCorrectionPattern(pattern.key);
      setSelectedStoreKnowledgeStatus("active");

      const reprocessResult =
        await reprocessRelatedCsMessagesForKnowledge(mergedItem);
      const reprocessMessage = reprocessResult.success
        ? reprocessResult.updatedCount > 0
          ? ` 관련 문의 ${reprocessResult.updatedCount.toLocaleString(
              "ko-KR",
            )}건의 답변 초안을 새 지식 기준으로 다시 만들었습니다.`
          : " 새로 반영할 관련 문의는 없었습니다."
        : " 다만 관련 문의 답변 재생성은 실패했습니다.";
      const archiveMessage =
        failedArchiveCount > 0
          ? ` 기존 후보 ${failedArchiveCount.toLocaleString(
              "ko-KR",
            )}건은 보관하지 못했습니다.`
          : "";

      setStoreKnowledgeMessage(
        `반복 수정 후보를 하나의 지식으로 정리했습니다.${reprocessMessage}${archiveMessage}`,
      );

      await Promise.allSettled([
        loadCsMessages(),
        loadMissingInfos(),
        loadInsights(),
        loadAiActivityLogs(),
      ]);

      if (!reprocessResult.success) {
        setStoreKnowledgeError(reprocessResult.error ?? "");
      }
    } catch (error) {
      setStoreKnowledgeError(
        error instanceof Error
          ? error.message
          : "반복 수정 후보를 정리하지 못했습니다.",
      );
    } finally {
      setMergingCorrectionPatternKey(null);
    }
  }

  async function reprocessRelatedCsMessagesForKnowledge(
    item: StoreKnowledgeItem,
  ) {
    try {
      const response = await fetch(`/api/store-knowledge/${item.id}/reprocess`, {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as StoreKnowledgeReprocessResponse;

      if (!response.ok || data.success === false) {
        return {
          success: false,
          updatedCount: 0,
          error:
            data.error ??
            "관련 문의 답변을 새 지식 기준으로 다시 생성하지 못했습니다.",
        };
      }

      return {
        success: true,
        updatedCount: data.updatedCsMessages ?? 0,
      };
    } catch {
      return {
        success: false,
        updatedCount: 0,
        error:
          "네트워크 오류로 관련 문의 답변을 새 지식 기준으로 다시 생성하지 못했습니다.",
      };
    }
  }

  async function markUsedWorkflowKnowledgeItemsForReview(item: WorkflowItem) {
    const knowledgeIds = [
      ...new Set(
        item.usedKnowledgeItems
          .filter((knowledgeItem) => !isStoreInfoEvidenceItem(knowledgeItem))
          .map((knowledgeItem) => knowledgeItem.id.trim())
          .filter(Boolean),
      ),
    ];

    if (knowledgeIds.length === 0) {
      return {
        reviewedItems: [] as StoreKnowledgeItem[],
        failedCount: 0,
      };
    }

    try {
      const headers = await getAuthenticatedRequestHeaders({
        "Content-Type": "application/json",
      });
      const results = await Promise.all(
        knowledgeIds.map(async (knowledgeId) => {
          try {
            const response = await fetch(`/api/store-knowledge/${knowledgeId}`, {
              method: "PATCH",
              headers,
              body: JSON.stringify({ status: "needs_review" }),
            });
            const data =
              (await response.json()) as StoreKnowledgeMutationResponse;

            return {
              success: response.ok && Boolean(data.knowledgeItem),
              knowledgeItem: data.knowledgeItem ?? null,
            };
          } catch {
            return {
              success: false,
              knowledgeItem: null,
            };
          }
        }),
      );

      return {
        reviewedItems: results
          .map((result) => result.knowledgeItem)
          .filter((knowledgeItem): knowledgeItem is StoreKnowledgeItem =>
            Boolean(knowledgeItem),
          ),
        failedCount: results.filter((result) => !result.success).length,
      };
    } catch {
      return {
        reviewedItems: [] as StoreKnowledgeItem[],
        failedCount: knowledgeIds.length,
      };
    }
  }

  async function handleDeleteStoreKnowledgeItem(item: StoreKnowledgeItem) {
    if (!window.confirm("이 학습 지식을 삭제할까요?")) return;

    setDeletingStoreKnowledgeId(item.id);
    setStoreKnowledgeError("");
    setStoreKnowledgeMessage("");

    try {
      const response = await fetch(`/api/store-knowledge/${item.id}`, {
        method: "DELETE",
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as StoreKnowledgeMutationResponse;

      if (!response.ok || !data.success) {
        setStoreKnowledgeError(
          data.error ?? "학습한 가게 지식을 삭제하지 못했습니다.",
        );
        return;
      }

      setStoreKnowledgeItems((currentItems) =>
        currentItems.filter((currentItem) => currentItem.id !== item.id),
      );
      setStoreKnowledgeMessage("AI가 학습한 가게 지식을 삭제했습니다.");

      if (editingStoreKnowledgeId === item.id) {
        handleCancelStoreKnowledgeEdit();
      }
    } catch {
      setStoreKnowledgeError(
        "네트워크 오류로 학습한 가게 지식을 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingStoreKnowledgeId(null);
    }
  }

  async function handleResolveStoreKnowledgeConflicts(
    item: StoreKnowledgeItem,
    conflictItems: Array<{ id: string; question: string; answer: string }>,
  ) {
    const conflictIds = [
      ...new Set(
        conflictItems
          .map((conflictItem) => conflictItem.id)
          .filter((id) => id && id !== item.id),
      ),
    ];

    if (conflictIds.length === 0) {
      setStoreKnowledgeMessage("정리할 충돌 지식이 없습니다.");
      return;
    }

    if (
      !window.confirm(
        `이 지식을 기준으로 삼고 충돌 가능 지식 ${conflictIds.length.toLocaleString(
          "ko-KR",
        )}개를 삭제할까요?`,
      )
    ) {
      return;
    }

    setResolvingStoreKnowledgeConflictId(item.id);
    setStoreKnowledgeError("");
    setStoreKnowledgeMessage("");

    try {
      const results = await Promise.all(
        conflictIds.map(async (conflictId) => {
          const response = await fetch(`/api/store-knowledge/${conflictId}`, {
            method: "DELETE",
            headers: await getAuthenticatedRequestHeaders(),
          });
          const data = (await response.json()) as StoreKnowledgeMutationResponse;

          return {
            conflictId,
            success: response.ok && Boolean(data.success),
            error: data.error,
          };
        }),
      );
      const failedResults = results.filter((result) => !result.success);
      const deletedIds = results
        .filter((result) => result.success)
        .map((result) => result.conflictId);
      let resolvedItem: StoreKnowledgeItem | null = null;

      if (deletedIds.length > 0) {
        setStoreKnowledgeItems((currentItems) =>
          currentItems.filter(
            (currentItem) => !deletedIds.includes(currentItem.id),
          ),
        );
      }

      if (failedResults.length === 0) {
        const response = await fetch(`/api/store-knowledge/${item.id}`, {
          method: "PATCH",
          headers: await getAuthenticatedRequestHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ status: "active" }),
        });
        const data = (await response.json()) as StoreKnowledgeMutationResponse;

        if (response.ok && data.knowledgeItem) {
          resolvedItem = data.knowledgeItem;
        }
      }

      if (failedResults.length > 0) {
        setStoreKnowledgeError(
          failedResults[0]?.error ??
            "일부 충돌 지식을 정리하지 못했습니다.",
        );
        return;
      }

      if (resolvedItem) {
        setStoreKnowledgeItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === item.id ? resolvedItem! : currentItem,
          ),
        );
      }

      setStoreKnowledgeMessage(
        `충돌 가능 지식 ${deletedIds.length.toLocaleString(
          "ko-KR",
        )}개를 정리했습니다.`,
      );
    } catch {
      setStoreKnowledgeError(
        "네트워크 오류로 충돌 지식을 정리하지 못했습니다.",
      );
    } finally {
      setResolvingStoreKnowledgeConflictId(null);
    }
  }

  async function handleDeleteReview(reviewId: number) {
    if (!window.confirm("이 항목을 삭제할까요?")) return;

    setDeletingReviewId(reviewId);
    setHistoryError("");

    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as DeleteApiResponse;

      if (!response.ok) {
        setHistoryError(data.error ?? "리뷰 항목을 삭제하지 못했습니다.");
        return;
      }

      await Promise.all([loadHistory(), loadInsights()]);
    } catch {
      setHistoryError("네트워크 오류로 리뷰 항목을 삭제하지 못했습니다.");
    } finally {
      setDeletingReviewId(null);
    }
  }

  async function handleDeleteCsMessage(csMessageId: number) {
    if (!window.confirm("이 항목을 삭제할까요?")) return;

    setDeletingCsMessageId(csMessageId);
    setCsMessagesError("");

    try {
      const response = await fetch(`/api/cs-messages/${csMessageId}`, {
        method: "DELETE",
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as DeleteApiResponse;

      if (!response.ok) {
        setCsMessagesError(data.error ?? "CS 문의 항목을 삭제하지 못했습니다.");
        return;
      }

      await loadCsMessages();
    } catch {
      setCsMessagesError("네트워크 오류로 CS 문의 항목을 삭제하지 못했습니다.");
    } finally {
      setDeletingCsMessageId(null);
    }
  }

  async function requestWorkflowItemUpdate(
    item: WorkflowItem,
    payload: { reply?: string; status?: WorkflowStatus },
  ) {
    const shouldRegisterCoupangReply =
      item.type === "cs" &&
      payload.status === "completed" &&
      item.sourcePlatform === "coupang" &&
      (item.platformStatus === "synced" ||
        item.platformStatus === "failed") &&
      Boolean(item.externalId?.trim());

    try {
      const endpoint = shouldRegisterCoupangReply
        ? "/api/integrations/coupang/reply"
        : item.type === "review"
          ? `/api/reviews/${item.id}`
          : `/api/cs-messages/${item.id}`;
      const response = await fetch(endpoint, {
        method: shouldRegisterCoupangReply ? "POST" : "PATCH",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(
          shouldRegisterCoupangReply
            ? { csMessageId: String(item.id) }
            : payload,
        ),
      });
      const data = (await response.json()) as UpdateWorkflowItemResponse;

      if (!response.ok || data.success === false) {
        return {
          success: false,
          shouldRefreshAfterFailure: shouldRegisterCoupangReply,
          error: shouldRegisterCoupangReply
            ? data.message ??
                data.error ??
                "쿠팡 답변 등록에 실패했습니다. 쿠팡 연동 설정을 확인해 주세요."
            : data.error ?? "처리 항목을 업데이트하지 못했습니다.",
        };
      }

      return { success: true, shouldRefreshAfterFailure: false };
    } catch {
      return {
        success: false,
        shouldRefreshAfterFailure: shouldRegisterCoupangReply,
        error: shouldRegisterCoupangReply
          ? "쿠팡 답변 등록에 실패했습니다. 쿠팡 연동 설정을 확인해 주세요."
          : "네트워크 오류로 처리 항목을 업데이트하지 못했습니다.",
      };
    }
  }

  async function maybeSaveWorkflowReplyCorrectionAsKnowledge(
    item: WorkflowItem,
    correctedReply: string,
  ) {
    if (item.type !== "cs") return;

    const trimmedReply = correctedReply.trim();

    if (!hasMeaningfulReplyCorrection(item.reply, trimmedReply)) return;

    const shouldSave = window.confirm(
      "수정한 답변이 기존 AI 답변과 많이 달라졌습니다. 이 내용을 검토 필요 학습 후보로 저장할까요?",
    );

    if (!shouldSave) return;

    const knowledgeItem = await createStoreKnowledgeItem({
      question: `고객 문의: ${truncateSummaryText(item.original, 120)}`,
      answer: trimmedReply,
      category: inferCorrectionKnowledgeCategory(item, trimmedReply),
      sourceId: `cs-${item.id}`,
      sourceText: [
        `고객 문의: ${item.original}`,
        `AI 기존 답변: ${item.reply}`,
        `사장님 수정 답변: ${trimmedReply}`,
      ].join("\n\n"),
      status: "needs_review",
    });

    const suspectKnowledgeReviewResult =
      await markUsedWorkflowKnowledgeItemsForReview(item);
    const reviewedKnowledgeMap = new Map(
      suspectKnowledgeReviewResult.reviewedItems.map((reviewedItem) => [
        reviewedItem.id,
        reviewedItem,
      ]),
    );
    const currentStoreKnowledgeItems = storeKnowledgeItems.map(
      (currentItem) => reviewedKnowledgeMap.get(currentItem.id) ?? currentItem,
    );
    const suspectKnowledgeMessage =
      suspectKnowledgeReviewResult.reviewedItems.length > 0
        ? ` 기존 답변에 사용된 지식 ${suspectKnowledgeReviewResult.reviewedItems.length.toLocaleString(
            "ko-KR",
          )}개는 검토 필요로 표시했습니다.`
        : "";
    const suspectKnowledgeFailureMessage =
      suspectKnowledgeReviewResult.failedCount > 0
        ? ` 다만 참고 지식 ${suspectKnowledgeReviewResult.failedCount.toLocaleString(
            "ko-KR",
          )}개는 검토 필요로 표시하지 못했습니다.`
        : "";

    const nextStoreKnowledgeItems = [
      knowledgeItem,
      ...currentStoreKnowledgeItems,
    ];
    const nextQualityReport = buildStoreKnowledgeQualityReport(
      nextStoreKnowledgeItems,
    );
    const newItemQuality =
      nextQualityReport.byId[knowledgeItem.id] ??
      createEmptyStoreKnowledgeQuality();

    setStoreKnowledgeItems(nextStoreKnowledgeItems);
    setStoreKnowledgeMessage(
      `수정한 답변을 검토 필요 학습 후보로 저장했습니다. 내용을 확인한 뒤 다시 사용으로 바꾸면 다음 비슷한 문의에 참고됩니다.${
        newItemQuality.conflictCount > 0
          ? " 기존 지식과 충돌 가능성도 함께 표시했습니다."
          : ""
      }${suspectKnowledgeMessage}${suspectKnowledgeFailureMessage}`,
    );
    setSelectedStoreKnowledgeStatus("needs_review");
    setIsStoreKnowledgePanelOpen(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => scrollToSection("store-knowledge"));
    });
  }

  async function handleUpdateWorkflowItem(
    item: WorkflowItem,
    payload: { reply?: string; status?: WorkflowStatus },
  ) {
    if (!item.canMutate || item.type === "missing_info") return;

    setWorkflowUpdatingKey(item.key);
    setWorkflowError("");
    setWorkflowBulkApprovalResult(null);

    try {
      const result = await requestWorkflowItemUpdate(item, payload);

      if (!result.success) {
        setWorkflowError(
          result.error ?? "처리 항목을 업데이트하지 못했습니다.",
        );

        if (result.shouldRefreshAfterFailure) {
          await Promise.allSettled([
            loadHistory(),
            loadCsMessages(),
            loadInsights(),
            loadAiActivityLogs(),
          ]);
        }
        return;
      }

      if (payload.reply !== undefined) {
        try {
          await maybeSaveWorkflowReplyCorrectionAsKnowledge(
            item,
            payload.reply,
          );
        } catch (error) {
          setWorkflowError(
            error instanceof Error
              ? `답변은 저장됐지만 지식 저장에 실패했습니다. ${error.message}`
              : "답변은 저장됐지만 지식 저장에 실패했습니다.",
          );
        }
      }

      await Promise.all([
        loadHistory(),
        loadCsMessages(),
        loadInsights(),
        loadAiActivityLogs(),
      ]);
      setEditingWorkflowKey(null);
      setEditingWorkflowReply("");
    } finally {
      setWorkflowUpdatingKey(null);
    }
  }

  async function handleBulkApproveSafeWorkflowItems() {
    if (safeWorkflowApprovalItems.length === 0) {
      setWorkflowError("");
      setWorkflowBulkApprovalResult({
        message: "현재 필터에서 일괄 승인 가능한 안전 항목이 없습니다.",
        hasFailures: false,
      });
      return;
    }

    if (
      !window.confirm(
        "바로 답변 가능하고 위험도 낮음으로 판단된 항목만 일괄 승인합니다. 진행할까요?",
      )
    ) {
      return;
    }

    setWorkflowBulkApproving(true);
    setWorkflowError("");
    setWorkflowBulkApprovalResult(null);
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const item of safeWorkflowApprovalItems) {
        const result = await requestWorkflowItemUpdate(item, {
          status: "completed",
        });

        if (result.success) {
          successCount += 1;
        } else {
          failureCount += 1;
        }
      }

      await Promise.allSettled([
        loadHistory(),
        loadCsMessages(),
        loadInsights(),
        loadAiActivityLogs(),
      ]);
      setWorkflowBulkApprovalResult({
        message:
          failureCount === 0
            ? `안전 항목 ${successCount}건을 승인 완료했습니다.`
            : `${successCount}건은 승인 완료했고, ${failureCount}건은 처리하지 못했습니다.`,
        hasFailures: failureCount > 0,
      });
      setEditingWorkflowKey(null);
      setEditingWorkflowReply("");
    } catch {
      await Promise.allSettled([
        loadHistory(),
        loadCsMessages(),
        loadInsights(),
        loadAiActivityLogs(),
      ]);
      setWorkflowBulkApprovalResult({
        message: `${successCount}건은 승인 완료했고, ${
          safeWorkflowApprovalItems.length - successCount
        }건은 처리하지 못했습니다.`,
        hasFailures: true,
      });
    } finally {
      setWorkflowBulkApproving(false);
    }
  }

  function handleStartWorkflowEdit(item: WorkflowItem) {
    if (!item.canMutate) return;

    setEditingWorkflowKey(item.key);
    setEditingWorkflowReply(item.reply);
    setWorkflowError("");
  }

  function scrollToWorkflowInbox() {
    document
      .getElementById("ai-cs-inbox")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCollapseWorkflowItems() {
    setVisibleWorkflowCount(WORKFLOW_PAGE_SIZE);
    scrollToWorkflowInbox();
  }

  async function handleDeleteWorkflowItem(item: WorkflowItem) {
    const id = String(item.id ?? "").trim();

    if (!id) {
      setWorkflowError("삭제에 실패했습니다.");
      return;
    }

    if (!window.confirm("이 항목을 삭제할까요?")) return;

    const endpoint =
      item.type === "review"
        ? `/api/reviews/${id}`
        : item.type === "cs"
          ? `/api/cs-messages/${id}`
          : `/api/missing-infos/${id}`;

    setWorkflowUpdatingKey(item.key);
    setWorkflowError("");

    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as DeleteApiResponse;

      if (!response.ok || data.success === false) {
        setWorkflowError(data.error ?? "삭제에 실패했습니다.");
        return;
      }

      if (item.type === "review") {
        setHistory((currentItems) =>
          currentItems.filter((currentItem) => String(currentItem.id) !== id),
        );
      } else if (item.type === "cs") {
        setCsMessages((currentItems) =>
          currentItems.filter((currentItem) => String(currentItem.id) !== id),
        );
      } else {
        setMissingInfos((currentItems) =>
          currentItems.filter((currentItem) => String(currentItem.id) !== id),
        );
        setMissingInfoAnswers((currentAnswers) => {
          const nextAnswers = { ...currentAnswers };
          delete nextAnswers[id];
          return nextAnswers;
        });
        setMissingInfoTargetFields((currentFields) => {
          const nextFields = { ...currentFields };
          delete nextFields[id];
          return nextFields;
        });
      }

      await Promise.allSettled([
        loadHistory(),
        loadCsMessages(),
        loadMissingInfos(),
        loadInsights(),
      ]);
    } catch {
      setWorkflowError("삭제에 실패했습니다.");
    } finally {
      setWorkflowUpdatingKey(null);
    }
  }

  async function handleCopyText(
    text: string,
    successMessage = "복사되었습니다",
  ) {
    const copyTarget = text.trim();

    if (!copyTarget) {
      setCopyMessage("");
      setCopyError("복사할 답변이 없습니다.");
      window.setTimeout(() => setCopyError(""), 2000);
      return;
    }

    try {
      await navigator.clipboard.writeText(copyTarget);
      setCopyError("");
      setCopyMessage(successMessage);
      window.setTimeout(() => setCopyMessage(""), 2000);
    } catch {
      setCopyMessage("");
      setCopyError("복사에 실패했습니다. 다시 시도해 주세요.");
      window.setTimeout(() => setCopyError(""), 2500);
    }
  }

  async function handleBatchReviewCopy(index: number, text: string) {
    const copyTarget = text.trim();

    if (!copyTarget) {
      setBatchReviewCopyMessages({
        [index]: { type: "error", message: "복사할 답글이 없습니다." },
      });
      window.setTimeout(() => {
        setBatchReviewCopyMessages((current) => {
          const next = { ...current };
          delete next[index];
          return next;
        });
      }, 2500);
      return;
    }

    try {
      await navigator.clipboard.writeText(copyTarget);
      setBatchReviewCopyMessages({
        [index]: { type: "success", message: "답글이 복사되었습니다" },
      });
    } catch {
      setBatchReviewCopyMessages({
        [index]: { type: "error", message: "복사에 실패했습니다" },
      });
    }

    window.setTimeout(() => {
      setBatchReviewCopyMessages((current) => {
        const next = { ...current };
        delete next[index];
        return next;
      });
    }, 2500);
  }

  const pendingMissingInfoCount = missingInfos.filter(
    (item) => item.status === "pending",
  ).length;
  const negativeReviews = history
    .filter((item) => item.sentiment === "negative")
    .slice(0, 3);
  const recentCsMessages = csMessages.slice(0, 5);
  const recentReviews = history.slice(0, 5);
  const storeKnowledgeQualityReport = useMemo(
    () =>
      buildStoreKnowledgeQualityReport(
        storeKnowledgeItems.filter(
          (item) => normalizeStoreKnowledgeStatus(item.status) !== "archived",
        ),
      ),
    [storeKnowledgeItems],
  );
  const repeatedCorrectionPatterns = useMemo(() => {
    const candidates = storeKnowledgeItems
      .filter(
        (item) =>
          item.source_type === "owner_correction" &&
          normalizeStoreKnowledgeStatus(item.status) === "needs_review",
      )
      .sort(
        (left, right) =>
          new Date(right.updated_at).getTime() -
          new Date(left.updated_at).getTime(),
      );
    const visitedIds = new Set<string>();
    const patterns: RepeatedCorrectionPattern[] = [];

    for (const candidate of candidates) {
      if (visitedIds.has(candidate.id)) continue;

      const relatedItems = candidates.filter(
        (otherCandidate) =>
          candidate.id === otherCandidate.id ||
          areSimilarCorrectionCandidates(candidate, otherCandidate),
      );

      if (relatedItems.length < 2) continue;

      relatedItems.forEach((item) => visitedIds.add(item.id));

      const normalizedAnswers = new Set(
        relatedItems.map((item) => normalizeReplyForLearning(item.answer)),
      );

      patterns.push({
        key: `${candidate.category}-${candidate.id}`,
        category: candidate.category,
        items: relatedItems,
        hasDifferentAnswers: normalizedAnswers.size > 1,
      });
    }

    return patterns.slice(0, 3);
  }, [storeKnowledgeItems]);
  const storeKnowledgeReviewItemCount = useMemo(() => {
    const reviewIds = new Set<string>();

    for (const item of storeKnowledgeItems) {
      if (normalizeStoreKnowledgeStatus(item.status) === "archived") continue;
      const quality =
        storeKnowledgeQualityReport.byId[item.id] ??
        createEmptyStoreKnowledgeQuality();

      if (
        normalizeStoreKnowledgeStatus(item.status) === "needs_review" ||
        quality.isStale ||
        quality.duplicateCount > 0 ||
        quality.conflictCount > 0
      ) {
        reviewIds.add(item.id);
      }
    }

    return reviewIds.size;
  }, [storeKnowledgeItems, storeKnowledgeQualityReport]);
  const storeKnowledgeFilterCounts = useMemo(() => {
    let active = 0;
    let needsReview = 0;
    let archived = 0;

    for (const item of storeKnowledgeItems) {
      const status = normalizeStoreKnowledgeStatus(item.status);
      const quality =
        storeKnowledgeQualityReport.byId[item.id] ??
        createEmptyStoreKnowledgeQuality();
      const needsReviewByQuality =
        status === "needs_review" ||
        quality.isStale ||
        quality.duplicateCount > 0 ||
        quality.conflictCount > 0;

      if (status === "archived") {
        archived += 1;
      } else if (needsReviewByQuality) {
        needsReview += 1;
      } else {
        active += 1;
      }
    }

    return {
      all: storeKnowledgeItems.length,
      active,
      needs_review: needsReview,
      archived,
    };
  }, [storeKnowledgeItems, storeKnowledgeQualityReport]);
  const filteredStoreKnowledgeItems = useMemo(
    () =>
      storeKnowledgeItems.filter((item) => {
        const status = normalizeStoreKnowledgeStatus(item.status);
        const quality =
          storeKnowledgeQualityReport.byId[item.id] ??
          createEmptyStoreKnowledgeQuality();
        const needsReview =
          status === "needs_review" ||
          quality.isStale ||
          quality.duplicateCount > 0 ||
          quality.conflictCount > 0;

        switch (selectedStoreKnowledgeStatus) {
          case "active":
            return status === "active" && !needsReview;
          case "needs_review":
            return status !== "archived" && needsReview;
          case "archived":
            return status === "archived";
          default:
            return true;
        }
      }),
    [selectedStoreKnowledgeStatus, storeKnowledgeItems, storeKnowledgeQualityReport],
  );
  const storeKnowledgeUsageMap = useMemo(
    () =>
      buildStoreKnowledgeUsageMap(
        csMessages.map((item) => ({
          id: item.id,
          customerMessage: item.customer_message,
          reply: item.reply,
          status: normalizeWorkflowStatus(item.status),
          sourcePlatform: item.source_platform ?? "manual",
          createdAt: item.created_at,
          usedKnowledgeItems: parseUsedKnowledgeItems(
            item.used_knowledge_items,
          ),
        })),
      ),
    [csMessages],
  );
  const workflowItems = useMemo<WorkflowItem[]>(() => {
    const reviewItems = history.map((item) => ({
      key: `review-${item.id}`,
      id: item.id,
      type: "review" as const,
      typeLabel: "리뷰",
      original: item.review,
      reply: item.reply,
      status: normalizeWorkflowStatus(item.status),
      handlingType: normalizeHandlingType(item.handling_type),
      riskLevel: normalizeRiskLevel(item.risk_level),
      sourcePlatform: item.source_platform ?? "manual",
      externalId: item.external_id ?? null,
      externalUrl: item.external_url ?? null,
      platformStatus: item.platform_status ?? "local",
      aiReason: item.ai_reason?.trim() ?? "",
      usedKnowledgeItems: [],
      createdAt: item.created_at,
      canMutate: true,
    }));

    const csItems = csMessages.map((item) => ({
      key: `cs-${item.id}`,
      id: item.id,
      type: "cs" as const,
      typeLabel: "고객 문의",
      original: item.customer_message,
      reply: item.reply,
      status: normalizeWorkflowStatus(item.status),
      handlingType: normalizeHandlingType(item.handling_type),
      riskLevel: normalizeRiskLevel(item.risk_level),
      sourcePlatform: item.source_platform ?? "manual",
      externalId: item.external_id ?? null,
      externalUrl: item.external_url ?? null,
      platformStatus: item.platform_status ?? "local",
      aiReason: item.ai_reason?.trim() ?? "",
      usedKnowledgeItems: parseUsedKnowledgeItems(item.used_knowledge_items),
      createdAt: item.created_at,
      canMutate: true,
    }));

    const missingInfoItems = missingInfos.map((item) => ({
      key: `missing-${item.id}`,
      id: item.id,
      type: "missing_info" as const,
      typeLabel: "고객 문의",
      original: item.source_message || item.question,
      reply: item.reason,
      status: "needs_review" as const,
      handlingType: "needs_review" as const,
      riskLevel: "normal" as const,
      sourcePlatform: "manual",
      externalId: null,
      externalUrl: null,
      platformStatus: "local",
      aiReason: item.reason,
      usedKnowledgeItems: [],
      createdAt: item.created_at,
      canMutate: false,
      missingInfo: item,
    }));

    return [...reviewItems, ...csItems, ...missingInfoItems].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [csMessages, history, missingInfos]);

  const workflowPlatformFilters = [
    { id: "all" as const, label: "전체" },
    { id: "manual" as const, label: "수동 입력" },
    { id: "smartstore" as const, label: "스마트스토어" },
    { id: "coupang" as const, label: "쿠팡" },
    { id: "baemin" as const, label: "배민" },
    { id: "yogiyo" as const, label: "요기요" },
    { id: "coupangeats" as const, label: "쿠팡이츠" },
  ].map((filter) => ({
    ...filter,
    count:
      filter.id === "all"
        ? workflowItems.length
        : workflowItems.filter((item) => item.sourcePlatform === filter.id)
            .length,
  }));
  const platformFilteredWorkflowItems =
    selectedWorkflowPlatform === "all"
      ? workflowItems
      : workflowItems.filter(
          (item) => item.sourcePlatform === selectedWorkflowPlatform,
        );
  const workflowPendingItems = platformFilteredWorkflowItems.filter(
    (item) => item.status === "pending",
  );
  const safeWorkflowApprovalItems = workflowPendingItems.filter(
    (item) =>
      item.type !== "missing_info" &&
      item.canMutate &&
      item.handlingType === "auto_ready" &&
      item.riskLevel === "low" &&
      Boolean(item.reply.trim()),
  );
  const visibleMissingInfoItems = platformFilteredWorkflowItems.filter(
    (item) => item.type === "missing_info",
  );
  const workflowNeedsReviewItems = platformFilteredWorkflowItems.filter(
    (item) =>
      item.status === "needs_review" &&
      !(
        item.type === "cs" &&
        visibleMissingInfoItems.some((missingInfoItem) =>
          doesMissingInfoRepresentCsMessage(missingInfoItem, item),
        )
      ),
  );
  const workflowCompletedItems = platformFilteredWorkflowItems.filter(
    (item) => item.status === "completed" || item.status === "answered",
  );
  const workflowSummaryItems = workflowItems.filter(
    (item) =>
      !(
        item.type === "cs" &&
        item.status === "needs_review" &&
        workflowItems.some((missingInfoItem) =>
          doesMissingInfoRepresentCsMessage(missingInfoItem, item),
        )
      ),
  );
  const trialCountedWorkflowItems = workflowSummaryItems.filter(
    (item) =>
      item.type !== "missing_info" &&
      Boolean(item.reply.trim()) &&
      !isDemoExternalId(item.externalId),
  );
  const trialAiReplyUsedCount = trialCountedWorkflowItems.length;
  const trialAiReplyRemainingCount = Math.max(
    0,
    FREE_TRIAL_AI_REPLY_LIMIT - trialAiReplyUsedCount,
  );
  const trialAiReplyUsagePercent = Math.min(
    100,
    Math.round((trialAiReplyUsedCount / FREE_TRIAL_AI_REPLY_LIMIT) * 100),
  );
  const freeTrialAiReplyLimitReached =
    trialAiReplyUsedCount >= FREE_TRIAL_AI_REPLY_LIMIT;
  const answerGenerationBlocked =
    aiGenerationBlocked || freeTrialAiReplyLimitReached;
  const trialLearningSignalCount =
    [
      storeName,
      businessType,
      productName,
      productDescription,
      productDetails,
      productCaution,
      productCatalog,
      extraFaq,
      shippingPolicy,
      refundPolicy,
      ownerReplyExamples,
      ownerCsExamples,
    ].filter((value) => value.trim().length > 0).length +
    storeKnowledgeItems.filter(
      (item) => normalizeStoreKnowledgeStatus(item.status) === "active",
    ).length;
  const activeWorkflowSummaryItems = workflowSummaryItems.filter(
    (item) => item.status !== "completed" && item.status !== "answered",
  );
  const workflowAttentionItems = [...activeWorkflowSummaryItems]
    .filter((item) => workflowAttentionPriority(item) > 0)
    .sort((a, b) => {
      const priorityGap =
        workflowAttentionPriority(b) - workflowAttentionPriority(a);

      if (priorityGap !== 0) return priorityGap;

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })
    .slice(0, 3);
  const workflowSummaryLoading =
    historyLoading || csMessagesLoading || missingInfosLoading;
  const aiCsWorkSummaryItems = [
    {
      label: "확인 필요",
      value: workflowSummaryItems.filter(
        (item) =>
          item.status === "needs_review" ||
          item.handlingType === "needs_review",
      ).length,
      description: "AI가 혼자 답하기 어려운 항목",
      className:
        "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
      valueClassName: "text-amber-700 dark:text-amber-300",
    },
    {
      label: "승인 대기",
      value: workflowSummaryItems.filter(
        (item) => item.type !== "missing_info" && item.status === "pending",
      ).length,
      description: "사장님 승인 후 완료할 답변",
      className:
        "border-indigo-200 bg-indigo-50/80 text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100",
      valueClassName: "text-indigo-700 dark:text-indigo-300",
    },
    {
      label: "위험도 높음",
      value: workflowSummaryItems.filter(
        (item) => item.type !== "missing_info" && item.riskLevel === "high",
      ).length,
      description: "건강, 환불, 강한 클레임 등",
      className:
        "border-red-200 bg-red-50/80 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100",
      valueClassName: "text-red-700 dark:text-red-300",
    },
    {
      label: "자동 완료",
      value: workflowSummaryItems.filter(
        (item) =>
          item.type !== "missing_info" &&
          (item.status === "completed" || item.status === "answered") &&
          item.handlingType === "auto_ready" &&
          item.riskLevel === "low",
      ).length,
      description: "낮은 위험도로 자동 완료된 항목",
      className:
        "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
      valueClassName: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "플랫폼 연동",
      value: workflowSummaryItems.filter(
        (item) =>
          item.type !== "missing_info" && item.sourcePlatform !== "manual",
      ).length,
      description: "외부 플랫폼 출처 항목",
      className:
        "border-indigo-200 bg-indigo-50/80 text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100",
      valueClassName: "text-indigo-700 dark:text-indigo-300",
    },
  ] as const;

  const todayWorkflowSummaryItems = workflowSummaryItems.filter((item) =>
    isSameLocalDate(item.createdAt),
  );
  const recent30WorkflowSummaryItems = workflowSummaryItems.filter((item) =>
    isWithinRecentDays(item.createdAt, 30),
  );
  const todayAiDraftItems = todayWorkflowSummaryItems.filter(
    (item) => item.type !== "missing_info" && Boolean(item.reply.trim()),
  );
  const todayAutoCompletedItems = todayWorkflowSummaryItems.filter(
    (item) =>
      item.type !== "missing_info" &&
      (item.status === "completed" || item.status === "answered") &&
      item.handlingType === "auto_ready" &&
      item.riskLevel === "low",
  );
  const todayOwnerReviewItems = todayWorkflowSummaryItems.filter(
    (item) =>
      item.status === "needs_review" ||
      item.handlingType === "needs_review" ||
      item.handlingType === "needs_approval" ||
      item.riskLevel === "high",
  );
  const todayKnowledgeAssistedItems = todayWorkflowSummaryItems.filter(
    (item) =>
      item.type === "cs" &&
      item.usedKnowledgeItems.some((knowledgeItem) =>
        !isStoreInfoEvidenceItem(knowledgeItem),
      ),
  );
  const todayEstimatedSavedMinutes = estimateSavedMinutesForWorkflowItems(
    todayWorkflowSummaryItems,
  );
  const recent30EstimatedSavedMinutes = estimateSavedMinutesForWorkflowItems(
    recent30WorkflowSummaryItems,
  );
  const todayEstimatedSavedValueKrw = estimateSavedValueKrw(
    todayEstimatedSavedMinutes,
  );
  const recent30EstimatedSavedValueKrw = estimateSavedValueKrw(
    recent30EstimatedSavedMinutes,
  );
  const aiCsValueSummaryItems = [
    {
      label: "AI 초안 작성",
      value: todayAiDraftItems.length.toLocaleString("ko-KR"),
      description: "오늘 AI가 먼저 써둔 문의/리뷰 답변",
    },
    {
      label: "자동 완료",
      value: todayAutoCompletedItems.length.toLocaleString("ko-KR"),
      description: "낮은 위험도로 앱 안에서 완료 처리",
    },
    {
      label: "확인 필요 분류",
      value: todayOwnerReviewItems.length.toLocaleString("ko-KR"),
      description: "사장님이 먼저 봐야 할 항목을 분리",
    },
    {
      label: "학습 지식 활용",
      value: todayKnowledgeAssistedItems.length.toLocaleString("ko-KR"),
      description: "사장님이 알려준 지식을 답변에 재사용",
    },
  ] as const;
  const allSafePendingApprovalItems = workflowSummaryItems.filter(
    (item) =>
      item.type !== "missing_info" &&
      item.status === "pending" &&
      item.handlingType === "auto_ready" &&
      item.riskLevel === "low" &&
      Boolean(item.reply.trim()),
  );
  const activeHighRiskHoldItems = activeWorkflowSummaryItems.filter(
    (item) => item.type !== "missing_info" && item.riskLevel === "high",
  );
  const activeMissingInfoHoldItems = activeWorkflowSummaryItems.filter(
    (item) => item.type === "missing_info",
  );
  const needsReviewSummaryCount = aiCsWorkSummaryItems[0].value;
  const pendingSummaryCount = aiCsWorkSummaryItems[1].value;
  const completedSummaryCount = aiCsWorkSummaryItems[3].value;
  const urgentWorkCount = needsReviewSummaryCount + pendingSummaryCount;
  const blockedWorkCount =
    activeHighRiskHoldItems.length + activeMissingInfoHoldItems.length;
  const aiCsTopSummaryItems = [
    {
      label: "지금 확인할 일",
      value: urgentWorkCount,
      description: "확인 필요 + 승인 대기",
      targetStatus:
        needsReviewSummaryCount > 0 ? "needs_review" : "pending",
      className:
        urgentWorkCount > 0
          ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
          : "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
      valueClassName:
        urgentWorkCount > 0
          ? "text-amber-700 dark:text-amber-300"
          : "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "AI가 처리한 일",
      value: completedSummaryCount,
      description: "답변 완료",
      targetStatus: "completed",
      className:
        "border-emerald-200 bg-white text-emerald-950 dark:border-emerald-900/60 dark:bg-zinc-950 dark:text-emerald-100",
      valueClassName: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "위험해서 멈춘 일",
      value: blockedWorkCount,
      description: "고위험 + 정보 부족",
      targetStatus: "needs_review",
      className:
        blockedWorkCount > 0
          ? "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
          : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
      valueClassName:
        blockedWorkCount > 0
          ? "text-red-700 dark:text-red-300"
          : "text-zinc-950 dark:text-zinc-50",
    },
  ] as const;
  const postedPlatformItems = workflowSummaryItems.filter(
    (item) =>
      item.type !== "missing_info" &&
      item.sourcePlatform !== "manual" &&
      item.platformStatus === "posted",
  );
  const latestWorkflowItem = workflowSummaryItems[0] ?? null;
  const automationModeLabel =
    aiWorkMode === "approval_only"
      ? "승인 대기 모드"
      : aiWorkMode === "after_hours_conservative"
        ? "영업시간 중심 근무"
        : autoCompleteLowRiskCs || autoCompletePositiveReviews
          ? "자동 근무 중"
          : "승인 대기 모드";
  const autoCompletionScopeDescription =
    autoCompleteLowRiskCs && autoCompletePositiveReviews
      ? "낮은 위험도의 반복 문의와 단순 긍정 리뷰"
      : autoCompleteLowRiskCs
        ? "낮은 위험도의 반복 문의"
        : autoCompletePositiveReviews
          ? "단순 긍정 리뷰"
          : "";
  const automationModeDescription =
    aiWorkMode === "approval_only"
      ? "모든 AI 답변을 사장님 승인 대기로 모아두고 있습니다."
      : aiWorkMode === "after_hours_conservative"
        ? `${aiWorkStartTime}~${aiWorkEndTime}에는 ${
            autoCompletionScopeDescription || "안전한 항목"
          }만 자동 완료하고, 그 외 시간에는 승인 대기로 모읍니다.`
        : autoCompletionScopeDescription
          ? `${autoCompletionScopeDescription}는 앱 안에서 자동 완료 처리합니다.`
          : "자동 완료 옵션이 꺼져 있어 모든 AI 답변을 승인 대기로 모읍니다.";
  const aiWorkGuardrailItems = [
    {
      label: "고위험 자동 보류",
      value: activeHighRiskHoldItems.length.toLocaleString("ko-KR"),
      description: "건강, 환불, 강한 클레임 등은 자동 완료하지 않음",
      className:
        activeHighRiskHoldItems.length > 0
          ? "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
          : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
    },
    {
      label: "정보 부족 보류",
      value: activeMissingInfoHoldItems.length.toLocaleString("ko-KR"),
      description: "모르는 질문은 답을 지어내지 않고 확인 필요로 분리",
      className:
        activeMissingInfoHoldItems.length > 0
          ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
          : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
    },
    {
      label: "안전 승인 후보",
      value: allSafePendingApprovalItems.length.toLocaleString("ko-KR"),
      description: "바로 답변 가능 + 위험도 낮음으로 일괄 승인 가능",
      className:
        "border-emerald-200 bg-white text-emerald-950 dark:border-emerald-900/60 dark:bg-zinc-950 dark:text-emerald-100",
    },
    {
      label: "플랫폼 완료 표시",
      value: postedPlatformItems.length.toLocaleString("ko-KR"),
      description: "승인 후 플랫폼 등록 완료 상태로 관리된 항목",
      className:
        "border-indigo-200 bg-white text-indigo-950 dark:border-indigo-900/60 dark:bg-zinc-950 dark:text-indigo-100",
    },
  ] as const;

  const workflowColumns = [
    {
      status: "needs_review" as const,
      title: "확인 필요",
      items: workflowNeedsReviewItems,
    },
    {
      status: "pending" as const,
      title: "승인 대기",
      items: workflowPendingItems,
    },
    {
      status: "completed" as const,
      title: "답변 완료",
      items: workflowCompletedItems,
    },
  ];
  const selectedWorkflowColumn =
    workflowColumns.find((column) => column.status === selectedWorkflowStatus) ??
    workflowColumns[0];
  const visibleWorkflowItems = selectedWorkflowColumn.items.slice(
    0,
    visibleWorkflowCount,
  );
  const visibleWorkflowItemCount = visibleWorkflowItems.length;
  const selectedWorkflowTotalCount = selectedWorkflowColumn.items.length;
  const canShowMoreWorkflowItems =
    visibleWorkflowItemCount < selectedWorkflowTotalCount;
  const canCollapseWorkflowItems = visibleWorkflowCount > WORKFLOW_PAGE_SIZE;
  const selectedWorkflowEmptyState = {
    needs_review: {
      title: "현재 확인이 필요한 항목이 없습니다",
      description:
        "AI가 답변하기 어려운 질문을 발견하면 이곳에 표시됩니다. 지금은 샘플 데이터나 첫 문의로 처리함 흐름을 만들어볼 수 있어요.",
    },
    pending: {
      title: "현재 승인 대기 중인 답변이 없습니다",
      description:
        "AI가 새 답변 초안을 만들면 이곳에서 확인할 수 있습니다. 고객 문의를 하나 입력하거나 샘플 데이터를 불러와 테스트해보세요.",
    },
    completed: {
      title: "아직 답변 완료된 항목이 없습니다",
      description:
        "승인 완료한 답변이 이곳에 쌓입니다. 승인 대기 항목이 있다면 먼저 승인해보세요.",
    },
    answered: {
      title: "아직 답변 완료된 항목이 없습니다",
      description:
        "승인 완료한 답변이 이곳에 쌓입니다. 승인 대기 항목이 있다면 먼저 승인해보세요.",
    },
  }[selectedWorkflowColumn.status];
  const openWorkflowStatus = (status: WorkflowStatus) => {
    setSelectedWorkflowStatus(status);
    setVisibleWorkflowCount(WORKFLOW_PAGE_SIZE);
    setEditingWorkflowKey(null);
    setEditingWorkflowReply("");
    setWorkflowBulkApprovalResult(null);
  };
  const selectedWorkflowEmptyAction =
    !authUser
      ? {
          actionLabel: "카카오로 로그인",
          onAction: () => void handleKakaoLogin(),
          secondaryActionLabel: undefined,
          onSecondaryAction: undefined,
        }
      : !hasStore
      ? {
          actionLabel: "가게 정보 입력하기",
          onAction: () => goToTabSection("store", "store-info"),
          secondaryActionLabel: undefined,
          onSecondaryAction: undefined,
        }
      : selectedWorkflowColumn.status === "needs_review"
        ? workflowPendingItems.length > 0
          ? {
              actionLabel: "승인 대기 보기",
              onAction: () => openWorkflowStatus("pending"),
              secondaryActionLabel: "샘플 데이터로 체험",
              onSecondaryAction: () =>
                goToTabSection("integrations", "platform-integrations"),
            }
          : {
              actionLabel: "샘플 데이터로 체험",
              onAction: () =>
                goToTabSection("integrations", "platform-integrations"),
              secondaryActionLabel: "문의 답변 테스트",
              onSecondaryAction: () => goToTabSection("answer", "cs-reply"),
            }
        : selectedWorkflowColumn.status === "pending"
          ? workflowNeedsReviewItems.length > 0
            ? {
                actionLabel: "확인 필요 보기",
                onAction: () => openWorkflowStatus("needs_review"),
                secondaryActionLabel: "문의 답변 테스트",
                onSecondaryAction: () => goToTabSection("answer", "cs-reply"),
              }
            : {
                actionLabel: "문의 답변 테스트",
                onAction: () => goToTabSection("answer", "cs-reply"),
                secondaryActionLabel: "샘플 데이터로 체험",
                onSecondaryAction: () =>
                  goToTabSection("integrations", "platform-integrations"),
              }
          : workflowPendingItems.length > 0
            ? {
                actionLabel: "승인 대기 보기",
                onAction: () => openWorkflowStatus("pending"),
                secondaryActionLabel: "문의 답변 테스트",
                onSecondaryAction: () => goToTabSection("answer", "cs-reply"),
              }
            : workflowNeedsReviewItems.length > 0
              ? {
                  actionLabel: "확인 필요 보기",
                  onAction: () => openWorkflowStatus("needs_review"),
                  secondaryActionLabel: "샘플 데이터로 체험",
                  onSecondaryAction: () =>
                    goToTabSection("integrations", "platform-integrations"),
                }
              : {
                  actionLabel: "샘플 데이터로 체험",
                  onAction: () =>
                    goToTabSection("integrations", "platform-integrations"),
                  secondaryActionLabel: "문의 답변 테스트",
                  onSecondaryAction: () => goToTabSection("answer", "cs-reply"),
                };

  const kpiItems = [
    {
      label: "전체 리뷰",
      value: historyLoading ? "—" : stats.total.toLocaleString("ko-KR"),
      hint: "저장된 리뷰 합계",
      valueClass: "text-zinc-900 dark:text-zinc-50",
      accent: "bg-zinc-100 dark:bg-zinc-800",
    },
    {
      label: "긍정 리뷰",
      value: historyLoading ? "—" : stats.positive.toLocaleString("ko-KR"),
      hint: "positive",
      valueClass: "text-emerald-600 dark:text-emerald-400",
      accent: "bg-emerald-50 dark:bg-emerald-950/50",
    },
    {
      label: "부정 리뷰",
      value: historyLoading ? "—" : stats.negative.toLocaleString("ko-KR"),
      hint: "negative",
      valueClass: "text-red-600 dark:text-red-400",
      accent: "bg-red-50 dark:bg-red-950/50",
    },
    {
      label: "긍정률",
      value: historyLoading ? "—" : `${stats.positiveRate}%`,
      hint: "긍정 / 전체",
      valueClass: "text-indigo-600 dark:text-indigo-400",
      accent: "bg-indigo-50 dark:bg-indigo-950/50",
    },
  ] as const;
  const recentAiActivityLogs = aiActivityLogs.slice(0, 5);
  const todayAiActivityLogs = aiActivityLogs.filter((log) =>
    isSameLocalDate(log.created_at),
  );
  const todayGeneratedActivityCount = todayAiActivityLogs.filter((log) =>
    /generated/.test(log.event_type),
  ).length;
  const todayCompletedActivityCount = todayAiActivityLogs.filter((log) =>
    /completed/.test(log.event_type),
  ).length;
  const todayStoppedActivityLogs = todayAiActivityLogs.filter(
    (log) =>
      log.event_type === "cs_reply_needs_info" ||
      log.event_type === "cs_reply_auto_completion_paused" ||
      log.event_type === "platform_inquiries_auto_completion_paused" ||
      log.status === "needs_review" ||
      log.handling_type === "needs_review" ||
      log.handling_type === "needs_approval" ||
      log.risk_level === "high",
  );
  const todayLearningActivityCount = todayAiActivityLogs.filter(
    (log) =>
      log.event_type === "missing_info_resolved" ||
      log.event_type === "store_knowledge_candidate_created",
  ).length;
  const todayOwnerInterventionLogs = todayAiActivityLogs.filter((log) =>
    /edited|completed|marked_needs_review|resolved|candidate_created/.test(
      log.event_type,
    ),
  );
  const aiStaffDiarySummaryItems = [
    {
      label: "초안 작성",
      value: todayGeneratedActivityCount,
      description: "AI가 먼저 작성한 답변",
    },
    {
      label: "완료 처리",
      value: todayCompletedActivityCount,
      description: "승인 또는 완료된 업무",
    },
    {
      label: "멈추고 확인",
      value: todayStoppedActivityLogs.length,
      description: "위험하거나 정보가 부족한 업무",
    },
    {
      label: "학습 반영",
      value: todayLearningActivityCount,
      description: "사장님 답변을 지식에 저장",
    },
  ] as const;
  const aiStaffDiarySentence =
    todayAiActivityLogs.length === 0
      ? "오늘 기록된 AI 업무가 아직 없습니다. 문의 답변을 만들거나 처리함에서 승인하면 일지가 쌓입니다."
      : `오늘 AI는 답변 초안 ${todayGeneratedActivityCount}건을 만들고, ${todayCompletedActivityCount}건을 완료 처리했으며, ${todayStoppedActivityLogs.length}건은 안전을 위해 멈췄습니다.`;
  const stoppedReasonLogs = todayStoppedActivityLogs.slice(0, 3);
  const ownerInterventionLogs = todayOwnerInterventionLogs.slice(0, 3);

  const categoryItems = [
    { label: "우리 가게 정보", targetId: "store-info" },
    { label: "AI CS 처리함", targetId: "ai-cs-inbox" },
    { label: "문의에 답변하기", targetId: "cs-reply" },
    { label: "리뷰에 답글 달기", targetId: "review-reply" },
    { label: "리뷰 히스토리", targetId: "review-history" },
    { label: "최근 CS 문의", targetId: "cs-history" },
    { label: "확인 필요 정보", targetId: "missing-infos" },
    { label: "학습한 가게 지식", targetId: "store-knowledge" },
    { label: "AI 운영 분석", targetId: "ai-insights" },
  ] as const;

  const businessTypeOptions = [
    "배달 음식점",
    "디저트/카페",
    "공방/핸드메이드",
    "의류/잡화",
    "생활용품",
    "기타 스마트스토어",
  ] as const;

  const interpretedBusinessType = interpretBusinessType(businessType);
  const businessTypeGuideItems =
    businessTypeInputGuides[interpretedBusinessType];
  const isCafePolicyHelper = interpretedBusinessType === "디저트/카페";
  const isFoodPolicyHelper = interpretedBusinessType === "배달 음식점";

  const policyOptionButtonClass =
    "inline-flex min-h-9 items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-indigo-950";

  const onboardingWorkflowItems = workflowSummaryItems.filter(
    (item) => item.type !== "missing_info",
  );
  const onboardingPendingWorkflowItems = onboardingWorkflowItems.filter(
    (item) => item.status === "pending",
  );
  const hasOnboardingWorkflowItem =
    onboardingWorkflowItems.length > 0 || pendingMissingInfoCount > 0;
  const hasOnboardingCompletedItem = onboardingWorkflowItems.some(
    (item) => item.status === "completed" || item.status === "answered",
  );

  const startGuideItems = [
    {
      id: "login",
      step: "1",
      title: "로그인",
      description: "가게 정보, 답변 기록, 학습 지식을 내 계정에 저장합니다.",
      isComplete: Boolean(authUser),
      actionLabel: authUser ? "가게 정보 보기" : "카카오로 로그인",
      onAction: authUser
        ? () => goToTabSection("store", "store-info")
        : () => void handleKakaoLogin(),
    },
    {
      id: "store",
      step: "2",
      title: "가게 정보 저장",
      description: "가게명, 업종, 대표 상품만 입력해도 먼저 시작할 수 있습니다.",
      isComplete: Boolean(authUser && hasStore),
      actionLabel: hasStore ? "가게 설정 확인" : "가게 정보 입력",
      onAction: () => goToTabSection("store", "store-info"),
    },
    {
      id: "sample",
      step: "3",
      title: "샘플이나 첫 문의 넣어보기",
      description:
        "샘플 데이터 또는 실제 문의로 AI가 초안을 만드는 흐름을 확인합니다.",
      isComplete: hasOnboardingWorkflowItem,
      actionLabel: "샘플로 체험",
      onAction: () => goToTabSection("integrations", "platform-integrations"),
    },
    {
      id: "complete",
      step: "4",
      title: "첫 답변 처리 완료",
      description:
        "승인하거나 수정해 답변 하나가 완료되는 과정을 확인합니다.",
      isComplete: hasOnboardingCompletedItem,
      actionLabel: "처리함에서 확인",
      onAction: () => {
        setSelectedWorkflowStatus(
          pendingMissingInfoCount > 0 ? "needs_review" : "pending",
        );
        goToTabSection("manage", "ai-cs-inbox");
      },
    },
  ];
  const startRecommendedAction = !authUser
    ? {
        eyebrow: "먼저 할 일",
        title: "카카오 로그인으로 내 가게 공간 만들기",
        description:
          "로그인하면 가게 정보, 답변 기록, 학습 지식이 내 계정 기준으로 저장됩니다.",
        actionLabel: "카카오로 로그인",
        onAction: () => void handleKakaoLogin(),
      }
    : storeStatusLoading
      ? {
          eyebrow: "확인 중",
          title: "가게 정보를 확인하고 있어요",
          description:
            "잠시 후 현재 가게 정보 상태에 맞춰 다음 작업을 추천해드릴게요.",
          actionLabel: "가게 설정 보기",
          onAction: () => goToTabSection("store", "store-info"),
        }
      : !hasStore
        ? {
            eyebrow: "추천 시작",
            title: "예시 데이터로 먼저 체험해보기",
            description:
              "처음부터 모두 입력하기 부담스럽다면 예시 업종을 골라 AI 답변 흐름을 먼저 확인해보세요.",
            actionLabel: "예시 데이터 선택하기",
            onAction: () => {
              setIsExamplePickerOpen(true);
              goToTabSection("store", "store-info");
            },
          }
        : pendingMissingInfoCount > 0
          ? {
              eyebrow: "우선 처리",
              title: "AI가 모르는 질문에 답변해주기",
              description:
                "확인 필요한 정보를 채우면 가게 지식에 저장되고 비슷한 문의 답변에도 반영됩니다.",
              actionLabel: "확인 필요 보기",
              onAction: () => {
                setSelectedWorkflowStatus("needs_review");
                goToTabSection("manage", "ai-cs-inbox");
              },
            }
          : onboardingPendingWorkflowItems.length > 0
            ? {
                eyebrow: "다음 작업",
                title: "승인 대기 답변 확인하기",
                description:
                  "AI가 작성한 답변 초안을 확인하고 승인하거나 수정해보세요.",
                actionLabel: "승인 대기 보기",
                onAction: () => {
                  setSelectedWorkflowStatus("pending");
                  goToTabSection("manage", "ai-cs-inbox");
                },
              }
            : hasOnboardingCompletedItem
              ? {
                  eyebrow: "준비 완료",
                  title: "이제 AI CS 처리함을 업무판처럼 쓰면 됩니다",
                  description:
                    "새 문의와 리뷰가 쌓이면 AI가 답변 가능 여부와 위험도를 나눠 정리해드립니다.",
                  actionLabel: "운영 관리 보기",
                  onAction: () => goToTabSection("manage", "ai-cs-inbox"),
                }
              : {
                eyebrow: "다음 테스트",
                title: "문의 답변을 하나 만들어보기",
                description:
                  "새 고객 문의를 입력해 AI가 현재 가게 정보를 어떻게 활용하는지 확인해보세요.",
                actionLabel: "문의 답변 테스트",
                onAction: () => goToTabSection("answer", "cs-reply"),
              };
  const startPaidAdoptionAction = {
    title: "AI CS 직원을 우리 가게에 도입하고 싶다면",
    description:
      "아직 데이터가 없어도 괜찮아요. 우리 가게 문의와 리뷰를 AI가 어떻게 처리할지, 어떤 플랫폼 연동이 필요한지 먼저 상담 요청할 수 있습니다.",
    highlights: [
      "무료 체험 후 도입 범위 확인",
      "스마트스토어·배달앱 연동 상담",
      "계정 비밀번호 없이 요청만 저장",
    ],
    actionLabel: authUser ? "도입 상담 요청" : "로그인 후 상담 요청",
    onAction: authUser
      ? () => void handleRequestPaidAdoption()
      : () => void handleKakaoLogin(),
    isLoading: authUser ? paidAdoptionRequestLoading : authActionLoading,
    message: paidAdoptionRequestMessage,
    error: paidAdoptionRequestError,
  };

  function scrollToSection(targetId: string) {
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function goToTabSection(tab: DashboardTab, targetId: string) {
    if (tab === "answer") {
      if (targetId === "review-reply") {
        setSelectedAnswerMode("review");
      } else if (targetId === "batch-review-reply") {
        setSelectedAnswerMode("batch_review");
      } else {
        setSelectedAnswerMode("cs");
      }
    }

    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => scrollToSection(targetId));
    });
  }

  function toggleManageSupportPanel(panel: ManageSupportPanel) {
    const targetId =
      panel === "store_knowledge" ? "store-knowledge" : "ai-insights";
    const isOpen =
      panel === "store_knowledge"
        ? isStoreKnowledgePanelOpen
        : isInsightsPanelOpen;

    if (panel === "store_knowledge") {
      setIsStoreKnowledgePanelOpen((current) => !current);
    } else {
      setIsInsightsPanelOpen((current) => !current);
    }

    if (!isOpen) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => scrollToSection(targetId));
      });
    }
  }

  function openStoreKnowledgeReviewCandidates() {
    setActiveTab("manage");
    setSelectedStoreKnowledgeStatus("needs_review");
    setIsStoreKnowledgePanelOpen(true);
    void loadStoreKnowledge();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => scrollToSection("store-knowledge"));
    });
  }

  async function handleKakaoLogin() {
    setAuthActionLoading(true);
    setAuthError("");

    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        setAuthError(error.message);
      }
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "카카오 로그인을 시작하지 못했습니다.",
      );
    } finally {
      setAuthActionLoading(false);
    }
  }

  async function handleLogout() {
    setAuthActionLoading(true);
    setAuthError("");

    try {
      const { error } = await getSupabase().auth.signOut();

      if (error) {
        setAuthError(error.message);
        return;
      }

      setAuthUser(null);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "로그아웃하지 못했습니다.",
      );
    } finally {
      setAuthActionLoading(false);
    }
  }

  function updateIntegrationDraft(
    platform: IntegrationPlatform,
    field: keyof IntegrationDraft,
    value: string,
  ) {
    setIntegrationDrafts((currentDrafts) => ({
      ...currentDrafts,
      [platform]: {
        ...currentDrafts[platform],
        [field]: value,
      },
    }));
  }

  function updateCoupangCredentialDraft(
    field: keyof CoupangCredentialDraft,
    value: string,
  ) {
    setCoupangCredentialDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  async function handleRequestIntegration(platform: IntegrationPlatform) {
    if (!authUser) {
      setIntegrationsMessage("");
      setIntegrationsError("로그인이 필요합니다");
      return;
    }

    setSavingIntegrationPlatform(platform);
    setIntegrationsMessage("");
    setIntegrationsError("");

    try {
      const draft = integrationDrafts[platform];
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          platform,
          store_url: draft.storeUrl,
          memo: draft.memo,
        }),
      });
      const data = (await response.json()) as IntegrationsApiResponse;

      if (!response.ok || !data.integration) {
        setIntegrationsError("연동 희망 등록에 실패했습니다.");
        return;
      }

      setIntegrationsMessage(
        "연동 희망이 등록되었습니다. 해당 플랫폼 연동이 준비되면 우선 안내드릴게요.",
      );
      await loadIntegrationRequests();
    } catch {
      setIntegrationsError("연동 희망 등록에 실패했습니다.");
    } finally {
      setSavingIntegrationPlatform(null);
    }
  }

  async function handleRequestPaidAdoption() {
    if (!authUser) {
      setPaidAdoptionRequestMessage("");
      setPaidAdoptionRequestError("로그인이 필요합니다.");
      return;
    }

    setPaidAdoptionRequestLoading(true);
    setPaidAdoptionRequestMessage("");
    setPaidAdoptionRequestError("");

    try {
      const autoCompleted30d = recent30WorkflowSummaryItems.filter(
        (item) =>
          item.type !== "missing_info" &&
          (item.status === "completed" || item.status === "answered") &&
          item.handlingType === "auto_ready" &&
          item.riskLevel === "low",
      ).length;
      const platformItems30d = recent30WorkflowSummaryItems.filter(
        (item) =>
          item.type !== "missing_info" && item.sourcePlatform !== "manual",
      ).length;

      const response = await fetch("/api/paid-adoption-requests", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          store_name: storeName,
          estimated_saved_minutes_today: todayEstimatedSavedMinutes,
          estimated_saved_value_krw_today: todayEstimatedSavedValueKrw,
          estimated_saved_minutes_30d: recent30EstimatedSavedMinutes,
          estimated_saved_value_krw_30d: recent30EstimatedSavedValueKrw,
          workflow_items_30d: recent30WorkflowSummaryItems.filter(
            (item) => item.type !== "missing_info",
          ).length,
          auto_completed_30d: autoCompleted30d,
          needs_review_active: needsReviewSummaryCount,
          platform_items_30d: platformItems30d,
          memo: "시작하기 화면에서 도입 상담을 요청했습니다.",
        }),
      });
      const data = (await response.json()) as PaidAdoptionRequestApiResponse;

      if (!response.ok || !data.request) {
        setPaidAdoptionRequestError(
          data.missingTableSql
            ? "도입 상담 요청 저장 테이블이 아직 없습니다. Supabase SQL 적용이 필요합니다."
            : "도입 상담 요청 저장에 실패했습니다.",
        );
        return;
      }

      setPaidAdoptionRequestMessage(
        "도입 상담 요청이 저장되었습니다. 운영 데이터를 기준으로 우선 검토할 수 있어요.",
      );
    } catch {
      setPaidAdoptionRequestError("도입 상담 요청 저장에 실패했습니다.");
    } finally {
      setPaidAdoptionRequestLoading(false);
    }
  }

  async function handleSaveCoupangCredentials() {
    if (!authUser) {
      setCoupangCredentialsMessage("");
      setCoupangCredentialsError("로그인이 필요합니다");
      return;
    }

    setCoupangCredentialsSaving(true);
    setCoupangCredentialsMessage("");
    setCoupangCredentialsError("");

    try {
      const response = await fetch("/api/integrations/credentials", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          vendor_id: coupangCredentialDraft.vendorId,
          access_key: coupangCredentialDraft.accessKey,
          secret_key: coupangCredentialDraft.secretKey,
          wing_id: coupangCredentialDraft.wingId,
        }),
      });
      const data = (await response.json()) as PlatformCredentialsApiResponse;

      if (!response.ok || !data.credential) {
        setCoupangCredentialsError("쿠팡 연동 설정 저장에 실패했습니다.");
        return;
      }

      setCoupangCredential(data.credential);
      setCoupangCredentialDraft((currentDraft) => ({
        ...currentDraft,
        secretKey: "",
      }));
      setCoupangCredentialsMessage("쿠팡 연동 설정이 저장되었습니다.");
    } catch {
      setCoupangCredentialsError("쿠팡 연동 설정 저장에 실패했습니다.");
    } finally {
      setCoupangCredentialsSaving(false);
    }
  }

  async function handleTestCoupangConnection() {
    if (!authUser) {
      setCoupangConnectionTestMessage("");
      setCoupangConnectionTestError("로그인이 필요합니다");
      return;
    }

    setCoupangConnectionTesting(true);
    setCoupangConnectionTestMessage("");
    setCoupangConnectionTestError("");
    setCoupangInquiryImportError("");
    setCoupangInquiryImportMessage("");

    try {
      const response = await fetch("/api/integrations/coupang/test", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as CoupangConnectionTestApiResponse;

      if (!response.ok || !data.success) {
        setCoupangConnectionTestError(
          "쿠팡 연결 테스트에 실패했습니다. vendorId/accessKey/secretKey를 확인해 주세요.",
        );
        await loadPlatformCredentials();
        return;
      }

      setCoupangCredential((currentCredential) =>
        currentCredential
          ? {
              ...currentCredential,
              status: data.status ?? "connected",
              last_tested_at:
                data.last_tested_at ?? currentCredential.last_tested_at,
            }
          : currentCredential,
      );
      setCoupangConnectionTestMessage("쿠팡 연결 테스트에 성공했습니다.");
    } catch {
      setCoupangConnectionTestError(
        "쿠팡 연결 테스트에 실패했습니다. vendorId/accessKey/secretKey를 확인해 주세요.",
      );
      await loadPlatformCredentials();
    } finally {
      setCoupangConnectionTesting(false);
    }
  }

  async function handleImportCoupangInquiries() {
    if (!authUser) {
      setCoupangInquiryImportMessage("");
      setCoupangInquiryImportError("로그인이 필요합니다");
      return;
    }

    if (coupangCredential?.status !== "connected") return;

    setCoupangInquiryImportLoading(true);
    setCoupangInquiryImportMessage("");
    setCoupangInquiryImportError("");

    try {
      const response = await fetch("/api/integrations/coupang/inquiries", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as CoupangInquiryImportApiResponse;

      if (!response.ok || data.imported === undefined) {
        setCoupangInquiryImportError(
          "쿠팡 문의 가져오기에 실패했습니다. 쿠팡 연결 설정을 확인해 주세요.",
        );
        await loadPlatformCredentials();
        return;
      }

      setCoupangInquiryImportMessage(
        `쿠팡 문의를 AI CS 처리함에 추가했습니다. 새 문의 ${data.imported}개, 중복 제외 ${data.skipped ?? 0}개`,
      );
      await Promise.all([
        loadCsMessages(),
        loadMissingInfos(),
        loadInsights(),
        loadPlatformCredentials(),
      ]);
    } catch {
      setCoupangInquiryImportError(
        "쿠팡 문의 가져오기에 실패했습니다. 쿠팡 연결 설정을 확인해 주세요.",
      );
      await loadPlatformCredentials();
    } finally {
      setCoupangInquiryImportLoading(false);
    }
  }

  async function handleLoadCoupangMockInquiries() {
    if (!authUser) {
      setCoupangMockInquiriesMessage("");
      setCoupangMockInquiriesError("로그인이 필요합니다");
      return;
    }

    setCoupangMockInquiriesLoading(true);
    setCoupangMockInquiriesMessage("");
    setCoupangMockInquiriesError("");

    try {
      const response = await fetch("/api/integrations/coupang/mock-inquiries", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as CoupangMockInquiriesApiResponse;

      if (!response.ok || !data.inserted) {
        setCoupangMockInquiriesError(
          "쿠팡 샘플 문의 불러오기에 실패했습니다.",
        );
        return;
      }

      setCoupangMockInquiriesMessage(
        "쿠팡 샘플 문의가 AI CS 처리함에 추가되었습니다.",
      );
      await Promise.all([loadCsMessages(), loadMissingInfos()]);
    } catch {
      setCoupangMockInquiriesError("쿠팡 샘플 문의 불러오기에 실패했습니다.");
    } finally {
      setCoupangMockInquiriesLoading(false);
    }
  }

  async function handleLoadCoupangMockReviews() {
    if (!authUser) {
      setCoupangMockReviewsMessage("");
      setCoupangMockReviewsError("로그인이 필요합니다");
      return;
    }

    setCoupangMockReviewsLoading(true);
    setCoupangMockReviewsMessage("");
    setCoupangMockReviewsError("");

    try {
      const response = await fetch("/api/integrations/coupang/mock-reviews", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as MockReviewsApiResponse;

      if (!response.ok || !data.inserted) {
        setCoupangMockReviewsError("쿠팡 샘플 리뷰 불러오기에 실패했습니다.");
        return;
      }

      setCoupangMockReviewsMessage(
        "쿠팡 샘플 리뷰가 AI CS 처리함에 추가되었습니다.",
      );
      await Promise.all([loadHistory(), loadInsights()]);
    } catch {
      setCoupangMockReviewsError("쿠팡 샘플 리뷰 불러오기에 실패했습니다.");
    } finally {
      setCoupangMockReviewsLoading(false);
    }
  }

  async function handleLoadSmartstoreMockInquiries() {
    if (!authUser) {
      setSmartstoreMockInquiriesMessage("");
      setSmartstoreMockInquiriesError("로그인이 필요합니다");
      return;
    }

    setSmartstoreMockInquiriesLoading(true);
    setSmartstoreMockInquiriesMessage("");
    setSmartstoreMockInquiriesError("");

    try {
      const response = await fetch(
        "/api/integrations/smartstore/mock-inquiries",
        {
          method: "POST",
          headers: await getAuthenticatedRequestHeaders(),
        },
      );
      const data = (await response.json()) as CoupangMockInquiriesApiResponse;

      if (!response.ok || !data.inserted) {
        setSmartstoreMockInquiriesError(
          "스마트스토어 샘플 문의 불러오기에 실패했습니다.",
        );
        return;
      }

      setSmartstoreMockInquiriesMessage(
        "스마트스토어 샘플 문의가 AI CS 처리함에 추가되었습니다.",
      );
      await Promise.all([loadCsMessages(), loadMissingInfos(), loadInsights()]);
    } catch {
      setSmartstoreMockInquiriesError(
        "스마트스토어 샘플 문의 불러오기에 실패했습니다.",
      );
    } finally {
      setSmartstoreMockInquiriesLoading(false);
    }
  }

  async function handleLoadDeliveryMockReviews(
    platform: DeliveryMockReviewPlatform,
    platformName: string,
  ) {
    if (!authUser) {
      setDeliveryMockReviewsMessages((current) => ({
        ...current,
        [platform]: "",
      }));
      setDeliveryMockReviewsErrors((current) => ({
        ...current,
        [platform]: "로그인이 필요합니다",
      }));
      return;
    }

    setDeliveryMockReviewsLoadingPlatform(platform);
    setDeliveryMockReviewsMessages((current) => ({
      ...current,
      [platform]: "",
    }));
    setDeliveryMockReviewsErrors((current) => ({
      ...current,
      [platform]: "",
    }));

    try {
      const response = await fetch(
        `/api/integrations/${platform}/mock-reviews`,
        {
          method: "POST",
          headers: await getAuthenticatedRequestHeaders(),
        },
      );
      const data = (await response.json()) as MockReviewsApiResponse;

      if (!response.ok || !data.inserted) {
        setDeliveryMockReviewsErrors((current) => ({
          ...current,
          [platform]: `${platformName} 샘플 리뷰 불러오기에 실패했습니다.`,
        }));
        return;
      }

      setDeliveryMockReviewsMessages((current) => ({
        ...current,
        [platform]: `${platformName} 샘플 리뷰가 AI CS 처리함에 추가되었습니다.`,
      }));
      await Promise.all([loadHistory(), loadInsights()]);
    } catch {
      setDeliveryMockReviewsErrors((current) => ({
        ...current,
        [platform]: `${platformName} 샘플 리뷰 불러오기에 실패했습니다.`,
      }));
    } finally {
      setDeliveryMockReviewsLoadingPlatform(null);
    }
  }

  function handleBuildShippingPolicy() {
    const cutoff = shippingCutoffTime.trim() || "출고 마감 시간";
    const courier = courierName.trim() || "택배사";
    const remoteFee = remoteAreaFee.trim() || "추가 배송비";

    if (isCafePolicyHelper) {
      const pickupGuide = courierName.trim() || "픽업/예약 안내";
      const reservationGuide = remoteAreaFee.trim() || "예약 가능 일정";

      setShippingPolicy(
        `${cutoff} 기준으로 픽업 또는 예약 준비 시간이 달라질 수 있습니다. ${pickupGuide}를 확인해 주시고, ${reservationGuide}은 주문 전 문의해 주세요.`,
      );
      return;
    }

    if (isFoodPolicyHelper) {
      const deliveryArea = remoteAreaFee.trim() || "배달 가능 지역";
      const deliveryGuide = courierName.trim() || "조리/배달 상황";

      setShippingPolicy(
        `${cutoff} 기준으로 주문 접수와 조리 시간이 달라질 수 있습니다. ${deliveryArea}과 ${deliveryGuide}에 따라 배달 시간이 달라질 수 있습니다.`,
      );
      return;
    }

    const shippingSentence =
      sameDayShipping === "가능"
        ? `${cutoff} 이전 주문은 당일 출고되며, ${courier}을 통해 발송됩니다.`
        : `${cutoff} 이전 주문도 당일 출고가 어려울 수 있으며, ${courier}을 통해 순차 발송됩니다.`;

    setShippingPolicy(
      `${shippingSentence} 제주/도서산간 지역은 추가 배송비 ${remoteFee}이 발생합니다.`,
    );
  }

  function handleBuildRefundPolicy() {
    if (isCafePolicyHelper) {
      const beforeProduction =
        cafeCancelBeforeProduction === "가능"
          ? "제조 시작 전에는 취소가 가능합니다."
          : "제조 시작 전에도 취소가 어려울 수 있습니다.";
      const afterProduction =
        cafeCancelAfterProduction === "가능"
          ? "제조가 시작된 이후에도 취소 가능 여부를 확인해 드립니다."
          : "제조가 시작된 이후에는 취소가 어려울 수 있습니다.";
      const afterPickup =
        cafeRefundAfterPickup === "가능"
          ? "픽업/수령 후에도 제품 상태를 확인한 뒤 환불 가능 여부를 안내드립니다."
          : cafeRefundAfterPickup === "불가능"
            ? "픽업/수령 후에는 환불이 어려울 수 있습니다."
            : "픽업/수령 후 환불은 제품 상태를 확인한 뒤 안내드립니다.";
      const issueStandard =
        cafeProductIssueStandard.trim() ||
        "제품에 문제가 있는 경우 수령 후 가능한 빠르게 문의해 주시면 확인 후 안내드리겠습니다.";
      const reservationDeadline = cafeReservationCancelDeadline.trim();

      setRefundPolicy(
        [
          beforeProduction,
          afterProduction,
          afterPickup,
          issueStandard,
          reservationDeadline
            ? `예약 주문 취소는 ${reservationDeadline}까지 문의해 주세요.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      return;
    }

    if (isFoodPolicyHelper) {
      const beforeCooking =
        foodCancelBeforeCooking === "가능"
          ? "조리 시작 전에는 취소가 가능합니다."
          : "조리 시작 전에도 취소가 어려울 수 있습니다.";
      const afterCooking =
        foodCancelAfterCooking === "가능"
          ? "조리가 시작된 이후에도 취소 가능 여부를 확인해 드립니다."
          : "조리가 시작된 이후에는 취소가 어려울 수 있습니다.";
      const afterDelivery =
        foodRefundAfterDelivery.trim() ||
        "배달 완료 후 환불은 주문 상태와 사유를 확인한 뒤 안내드리겠습니다.";
      const missingWrong =
        foodMissingWrongStandard.trim() ||
        "음식 누락이나 오배송이 있는 경우 주문 정보를 확인한 뒤 안내드리겠습니다.";
      const conditionIssue =
        foodConditionIssueStandard.trim() ||
        "음식 상태 문제가 있는 경우 사진과 주문 정보를 함께 알려주시면 확인 후 안내드리겠습니다.";

      setRefundPolicy(
        `${beforeCooking} ${afterCooking} ${afterDelivery} ${missingWrong} ${conditionIssue}`,
      );
      return;
    }

    const deadline = defectContactDeadline.trim() || "문의 기한";
    const returnFee = returnShippingFee.trim() || "반품 배송비";
    const changeOfMindSentence =
      changeOfMindRefund === "가능"
        ? "단순 변심으로 인한 환불은 가능합니다."
        : "단순 변심으로 인한 환불은 불가합니다.";

    setRefundPolicy(
      `${changeOfMindSentence} 상품 하자가 있는 경우 ${deadline} 문의해 주세요. 반품 배송비는 ${returnFee}입니다.`,
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f8ff] px-4 py-4 text-slate-950 dark:bg-[#070817] dark:text-slate-100 sm:py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[-10rem] h-80 w-80 rounded-full bg-indigo-300/40 blur-3xl dark:bg-indigo-600/25" />
        <div className="absolute right-[-8rem] top-20 h-96 w-96 rounded-full bg-cyan-200/55 blur-3xl dark:bg-cyan-500/15" />
        <div className="absolute bottom-[-12rem] left-1/3 h-96 w-96 rounded-full bg-fuchsia-200/45 blur-3xl dark:bg-fuchsia-600/15" />
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.7),rgba(15,23,42,0))]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <AppHeader
          isAuthenticated={Boolean(authUser)}
          storeName={storeName}
          authLoading={authLoading}
          authActionLoading={authActionLoading}
          authError={authError}
          onLogin={() => void handleKakaoLogin()}
          onLogout={() => void handleLogout()}
        />

        <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />

        {copyMessage || copyError ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              copyError
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
            }`}
            role="status"
          >
            {copyError || copyMessage}
          </div>
        ) : null}

        <StartOnboarding
          isVisible={activeTab === "start"}
          guideItems={startGuideItems}
          recommendedAction={startRecommendedAction}
          actionLoading={authActionLoading}
          paidAdoptionAction={startPaidAdoptionAction}
        />

        {activeTab === "start" ? (
          <section
            className={`${cardClass} order-[11] border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/50 to-cyan-50/60 dark:border-emerald-900/50 dark:from-zinc-900 dark:via-emerald-950/20 dark:to-cyan-950/20`}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Free Trial
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  무료 체험은 AI를 가르치는 시간까지 포함합니다
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  가게 정보, 상품/정책, 말투, 확인 필요 답변을 입력하는 학습
                  과정은 막지 않습니다. 실제 고객 응대 업무를 AI가 대신
                  수행하는 단계부터 사용량과 유료 전환 기준을 봅니다.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white/85 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-zinc-950/70 lg:min-w-72">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      무료 AI 답변 생성
                    </p>
                    <p className="mt-1 text-3xl font-black tracking-tight text-emerald-700 dark:text-emerald-300">
                      {trialAiReplyRemainingCount}
                      <span className="ml-1 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                        건 남음
                      </span>
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900">
                    {trialAiReplyUsedCount}/{FREE_TRIAL_AI_REPLY_LIMIT}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-cyan-500 transition-all"
                    style={{ width: `${trialAiReplyUsagePercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  샘플 데이터와 가게 지식 학습은 이 카운트에서 제외합니다.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {[
                {
                  title: "무료로 열어둘 것",
                  tone: "emerald",
                  items: [
                    "가게 정보와 상품/정책 입력",
                    "사장님 말투 학습",
                    "확인 필요 답변을 지식으로 저장",
                    `학습 신호 ${trialLearningSignalCount.toLocaleString("ko-KR")}개 반영 중`,
                  ],
                },
                {
                  title: "무료 체험 사용량",
                  tone: "sky",
                  items: [
                    `AI 답변 생성 ${FREE_TRIAL_AI_REPLY_LIMIT}건`,
                    `일괄 리뷰 답글 ${FREE_TRIAL_BATCH_REVIEW_LIMIT}건까지 체험`,
                    "샘플 문의/리뷰는 카운트 제외",
                    "답변 수정 학습은 막지 않음",
                  ],
                },
                {
                  title: "유료 전환 후보",
                  tone: "amber",
                  items: [
                    "실제 플랫폼 연동과 답변 등록",
                    "자동 완료 처리",
                    "안전 항목 일괄 승인",
                    "월 사용량 초과 후 계속 운영",
                  ],
                },
              ].map((column) => (
                <article
                  key={column.title}
                  className={`rounded-2xl border p-4 ${
                    column.tone === "emerald"
                      ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/25"
                      : column.tone === "sky"
                        ? "border-sky-200 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/25"
                        : "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/25"
                  }`}
                >
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                    {column.title}
                  </h3>
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                    {column.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => goToTabSection("answer", "cs-reply")}
                className={buttonClass("success", "md", "rounded-lg")}
              >
                무료 답변 생성 체험하기
              </button>
              <button
                type="button"
                onClick={
                  authUser
                    ? () => void handleRequestPaidAdoption()
                    : () => void handleKakaoLogin()
                }
                disabled={authUser ? paidAdoptionRequestLoading : authActionLoading}
                className={buttonClass("secondary", "md", "rounded-lg")}
              >
                {authUser
                  ? paidAdoptionRequestLoading
                    ? "상담 요청 저장 중..."
                    : "도입 상담 요청"
                  : "로그인 후 상담 요청"}
              </button>
            </div>
          </section>
        ) : null}

        {activeTab === "manage" && authUser ? (
          <section
            className={`${cardClass} order-[40] border-indigo-200/70 bg-gradient-to-br from-white via-white to-indigo-50/70 dark:border-indigo-900/50 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/25`}
          >
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                  AI CS Priority
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  오늘의 AI CS 업무 요약
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  지금 처리할 일과 AI가 멈춘 항목만 먼저 보여드립니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => scrollToSection("ai-cs-inbox")}
                className={buttonClass("primary")}
              >
                AI CS 처리함에서 확인하기
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {aiCsTopSummaryItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setSelectedWorkflowStatus(item.targetStatus);
                    setVisibleWorkflowCount(WORKFLOW_PAGE_SIZE);
                    scrollToSection("ai-cs-inbox");
                  }}
                  className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 dark:focus-visible:ring-indigo-950 ${item.className}`}
                >
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        {item.label}
                      </p>
                      <p
                        className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${item.valueClassName}`}
                      >
                        {workflowSummaryLoading
                          ? "—"
                          : item.value.toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      보기
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {item.description}
                  </p>
                </button>
              ))}
            </div>

            <details className="mt-5 rounded-2xl border border-zinc-200 bg-white/85 p-4 dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-5">
              <summary className="cursor-pointer list-none">
                <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  성과와 자동화 기록
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  자동 완료, 절약 시간, 안전장치가 궁금할 때 펼쳐보세요.
                </span>
              </summary>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {aiCsWorkSummaryItems.map((item) => (
                  <article
                    key={item.label}
                    className={`rounded-xl border p-4 ${item.className}`}
                  >
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {item.label}
                    </p>
                    <p
                      className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${item.valueClassName}`}
                    >
                      {workflowSummaryLoading
                        ? "—"
                        : item.value.toLocaleString("ko-KR")}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {item.description}
                    </p>
                  </article>
                ))}
              </div>

              <CsLearningQualityCard
                metrics={csLearningMetrics}
                loading={csLearningMetricsLoading}
                error={csLearningMetricsError}
                onRefresh={() => void loadCsLearningMetrics()}
              />

            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    AI CS Impact
                  </p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    AI가 오늘 줄여준 업무
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    오늘 생성된 답변 초안, 자동 완료, 사장님이 알려준 지식
                    활용을 기준으로 절약한 시간과 운영비 가치를 추정했습니다.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[26rem]">
                  <div className="rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-left shadow-sm dark:border-emerald-900/70 dark:bg-zinc-950">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      오늘 절약 시간
                    </p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
                      {workflowSummaryLoading
                        ? "—"
                        : formatEstimatedMinutes(todayEstimatedSavedMinutes)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      약{" "}
                      {workflowSummaryLoading
                        ? "—"
                        : formatEstimatedCurrency(todayEstimatedSavedValueKrw)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-white px-5 py-4 text-left shadow-sm dark:border-cyan-900/70 dark:bg-zinc-950">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      최근 30일 절감 가치
                    </p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight text-cyan-700 dark:text-cyan-300">
                      {workflowSummaryLoading
                        ? "—"
                        : formatEstimatedCurrency(recent30EstimatedSavedValueKrw)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {workflowSummaryLoading
                        ? "불러오는 중"
                        : formatEstimatedMinutes(recent30EstimatedSavedMinutes)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {aiCsValueSummaryItems.map((item) => (
                  <article
                    key={item.label}
                    className="rounded-xl border border-emerald-100 bg-white/85 p-4 dark:border-emerald-900/50 dark:bg-zinc-950/70"
                  >
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-950 dark:text-zinc-50">
                      {workflowSummaryLoading ? "—" : item.value}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {item.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-zinc-200 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    AI Work Mode
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${semanticBadgeClass(
                        aiWorkMode !== "approval_only" &&
                          (autoCompleteLowRiskCs || autoCompletePositiveReviews)
                          ? "success"
                          : "info",
                      )}`}
                    >
                      {automationModeLabel}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${semanticBadgeClass(
                        "neutral",
                      )}`}
                    >
                      실수 방지 우선
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    자는 동안에도 안전 기준대로 일합니다
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {automationModeDescription}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    마지막 처리 항목:{" "}
                    {workflowSummaryLoading
                      ? "불러오는 중..."
                      : latestWorkflowItem
                        ? formatDate(latestWorkflowItem.createdAt)
                        : "아직 처리 항목이 없습니다"}
                  </p>
                </div>

                <div>
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        자동 처리 안전장치
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        AI가 확실한 일은 처리하고, 애매하거나 위험한 일은
                        일부러 멈춰둔 내역입니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToTabSection("store", "store-info")}
                      className={buttonClass("secondary", "sm", "rounded-lg")}
                    >
                      자동 처리 설정 보기
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {aiWorkGuardrailItems.map((item) => (
                      <article
                        key={item.label}
                        className={`rounded-xl border p-4 ${item.className}`}
                      >
                        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          {item.label}
                        </p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                          {workflowSummaryLoading ? "—" : item.value}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                          {item.description}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </details>

            <div className="mt-5 rounded-xl border border-zinc-200 bg-white/85 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
              <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                먼저 확인할 항목
              </h3>

              {workflowSummaryLoading ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  AI CS 업무 요약을 불러오는 중...
                </p>
              ) : workflowAttentionItems.length === 0 ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                  현재 먼저 확인해야 할 위험 항목은 없습니다.
                </p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-3">
                  {workflowAttentionItems.map((item) => (
                    <article
                      key={item.key}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-700">
                          {item.typeLabel}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-700">
                          {sourcePlatformLabel(item.sourcePlatform)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${workflowStatusBadgeClass(
                            item.status,
                          )}`}
                        >
                          {workflowStatusLabel(item.status)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskLevelBadgeClass(
                            item.riskLevel,
                          )}`}
                        >
                          위험도: {riskLevelLabel(item.riskLevel)}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-6 text-zinc-800 dark:text-zinc-100">
                        {truncateSummaryText(item.original)}
                      </p>
                      {item.aiReason ? (
                        <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                          {truncateSummaryText(item.aiReason, 82)}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWorkflowStatus(
                            item.status === "pending"
                              ? "pending"
                              : "needs_review",
                          );
                          setVisibleWorkflowCount(WORKFLOW_PAGE_SIZE);
                          scrollToSection("ai-cs-inbox");
                        }}
                        className={buttonClass(
                          item.riskLevel === "high" ? "danger" : "secondary",
                          "sm",
                          "mt-3 w-full rounded-lg",
                        )}
                      >
                        처리함에서 확인
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <details className="mt-5 rounded-xl border border-zinc-200 bg-white/85 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
              <summary className="cursor-pointer list-none">
                <span className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      AI 직원 일지
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                      오늘 AI가 처리하고 멈춘 기록
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    펼쳐보기
                  </span>
                </span>
              </summary>

              <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void loadAiActivityLogs()}
                  disabled={aiActivityLogsLoading}
                  className={buttonClass(
                    "secondary",
                    "sm",
                    "h-8 rounded-lg",
                  )}
                >
                  {aiActivityLogsLoading ? "불러오는 중" : "새로고침"}
                </button>
                </div>

              {aiActivityLogsLoading ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  AI 업무 이력을 불러오는 중...
                </p>
              ) : aiActivityLogsError ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  {aiActivityLogsError}
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/25">
                    <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">
                      {aiStaffDiarySentence}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {aiStaffDiarySummaryItems.map((item) => (
                        <article
                          key={item.label}
                          className="rounded-lg border border-white/80 bg-white/85 p-3 dark:border-indigo-900/50 dark:bg-zinc-950/70"
                        >
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {item.label}
                          </p>
                          <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                            {item.value.toLocaleString("ko-KR")}
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
                            {item.description}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/25">
                      <h4 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                        AI가 멈춘 이유
                      </h4>
                      {stoppedReasonLogs.length === 0 ? (
                        <p className="mt-2 text-xs leading-5 text-amber-800 dark:text-amber-200">
                          오늘은 위험하거나 정보 부족으로 멈춘 기록이 없습니다.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {stoppedReasonLogs.map((log) => (
                            <li
                              key={log.id}
                              className="rounded-lg border border-amber-200 bg-white/85 p-3 text-xs leading-5 text-zinc-700 dark:border-amber-900/60 dark:bg-zinc-950/70 dark:text-zinc-300"
                            >
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {truncateSummaryText(log.title, 58)}
                              </p>
                              {log.description ? (
                                <p className="mt-1">
                                  {truncateSummaryText(log.description, 96)}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
                      <h4 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                        사장님 개입 패턴
                      </h4>
                      {ownerInterventionLogs.length === 0 ? (
                        <p className="mt-2 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
                          오늘은 수정, 승인, 학습 반영 기록이 아직 없습니다.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {ownerInterventionLogs.map((log) => (
                            <li
                              key={log.id}
                              className="rounded-lg border border-emerald-200 bg-white/85 p-3 text-xs leading-5 text-zinc-700 dark:border-emerald-900/60 dark:bg-zinc-950/70 dark:text-zinc-300"
                            >
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {truncateSummaryText(log.title, 58)}
                              </p>
                              {isStoreKnowledgeCandidateLog(log) ? (
                                <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                                  확인하면 다음 비슷한 문의에 사용할 수 있는 학습
                                  후보입니다.
                                </p>
                              ) : null}
                              <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                                {formatDate(log.created_at)}
                              </p>
                              {isStoreKnowledgeCandidateLog(log) ? (
                                <button
                                  type="button"
                                  onClick={openStoreKnowledgeReviewCandidates}
                                  className="mt-2 inline-flex h-8 items-center justify-center rounded-lg bg-emerald-700 px-3 text-xs font-medium text-white transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                >
                                  검토 필요 지식 보기
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {recentAiActivityLogs.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-sm leading-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                      아직 기록된 AI 업무 이력이 없습니다. 문의 답변을 만들거나
                      처리함에서 답변을 승인하면 이곳에 이력이 쌓입니다.
                    </p>
                  ) : (
                    <details className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        최근 이력 자세히 보기
                      </summary>
                      <ol className="mt-3 space-y-3">
                        {recentAiActivityLogs.map((log) => (
                          <li
                            key={log.id}
                            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                  {log.title}
                                </p>
                                {log.description ? (
                                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                    {truncateSummaryText(log.description, 110)}
                                  </p>
                                ) : null}
                              </div>
                              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                                {formatDate(log.created_at)}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-700">
                                {sourcePlatformLabel(log.source_platform)}
                              </span>
                              {log.status ? (
                                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-700">
                                  {aiActivityStatusLabel(log.status)}
                                </span>
                              ) : null}
                              {log.risk_level ? (
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    log.risk_level === "low" ||
                                    log.risk_level === "normal" ||
                                    log.risk_level === "high"
                                      ? riskLevelBadgeClass(log.risk_level)
                                      : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
                                  }`}
                                >
                                  {aiActivityRiskLabel(log.risk_level)}
                                </span>
                              ) : null}
                            </div>
                            {isStoreKnowledgeCandidateLog(log) ? (
                              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                                <p>
                                  이 후보를 확인해 다시 사용으로 바꾸면 AI가 다음
                                  비슷한 문의에 참고합니다.
                                </p>
                                <button
                                  type="button"
                                  onClick={openStoreKnowledgeReviewCandidates}
                                  className="mt-2 inline-flex h-8 items-center justify-center rounded-lg bg-emerald-700 px-3 text-xs font-medium text-white transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                >
                                  검토 필요 지식 보기
                                </button>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
              )}
              </div>
            </details>
          </section>
        ) : null}

        <section className="hidden">
          <div className="mb-3">
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              카테고리 / 빠른 이동
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              필요한 작업으로 바로 이동합니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
            {categoryItems.map((item) => (
              <button
                key={item.targetId}
                type="button"
                onClick={() => scrollToSection(item.targetId)}
                className="min-h-12 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="hidden">
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              리뷰 통계
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              reviews 테이블 기준 실시간 KPI
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpiItems.map((item) => (
              <article key={item.label} className={kpiCardClass}>
                <div
                  className={`mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg ${item.accent}`}
                >
                  <span className="h-2 w-2 rounded-full bg-current opacity-40" />
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {item.label}
                </p>
                <p
                  className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${item.valueClass}`}
                >
                  {item.value}
                </p>
                <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                  {item.hint}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="ai-insights"
          className={`${cardClass} scroll-mt-32 border-indigo-200/60 dark:border-indigo-900/50 ${
            activeTab === "manage" && isInsightsPanelOpen
              ? "order-[44]"
              : "hidden"
          }`}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400">
                <InsightsIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  AI 운영 분석
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  최근 리뷰 20건을 바탕으로 생성된 운영 인사이트입니다.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadInsights()}
              disabled={insightsLoading}
              className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950"
            >
              {insightsLoading ? "분석 중..." : "다시 분석"}
            </button>
          </div>

          {insightsLoading ? (
            <div
              className="space-y-3"
              aria-busy="true"
              aria-label="인사이트 로딩"
            >
              <div className="h-4 w-3/4 animate-pulse rounded-md bg-indigo-100 dark:bg-indigo-950/60" />
              <div className="h-4 w-full animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-4 w-5/6 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-4 w-2/3 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
              <p className="pt-2 text-xs text-indigo-600/80 dark:text-indigo-400/80">
                AI가 리뷰를 분석하고 있습니다...
              </p>
            </div>
          ) : insightsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {insightsError}
            </div>
          ) : (
            <div className="rounded-xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/50 via-white to-zinc-50 px-5 py-4 dark:border-indigo-900/40 dark:from-indigo-950/20 dark:via-zinc-900 dark:to-zinc-900">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                {insights}
              </pre>
            </div>
          )}
        </section>

        <section
          id="store-info"
          className={`${cardClass} scroll-mt-32 ${
            activeTab === "store" ? "order-[20]" : "hidden"
          }`}
        >
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                가게 정보
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                가게명, 업종, 대표 상품만 입력하면 바로 AI 답변을 테스트할 수
                있어요. 나머지 정보는 필요할 때 천천히 보강하세요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsExamplePickerOpen((current) => !current)}
              className={buttonClass("secondary")}
              aria-expanded={isExamplePickerOpen}
            >
              예시 데이터로 체험하기
            </button>
          </div>

          {hasStore ? (
            <p className="-mt-4 mb-6 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              현재 등록된 가게 정보를 수정할 수 있습니다
            </p>
          ) : null}

          {isExamplePickerOpen ? (
            <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
              <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                체험할 업종을 선택해 주세요
              </h3>
              <p className="mt-1 text-xs leading-5 text-emerald-800/90 dark:text-emerald-200/80">
                선택한 예시 정보는 폼에만 입력됩니다. 확인하거나 수정한 뒤
                저장할 수 있습니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {exampleStorePresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleUseExampleStore(preset)}
                    className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-900 transition hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-100 dark:hover:bg-emerald-950/60"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {storeExampleMessage ? (
            <p
              className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200"
              role="status"
            >
              {storeExampleMessage}
            </p>
          ) : null}

          <form onSubmit={handleStoreSubmit} className="space-y-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  기본 정보
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                  가게명, 업종, 대표 상품을 입력하고 먼저 저장해 보세요.
                </p>
              </div>

              <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="store_name" className="text-sm font-medium">
                가게명
              </label>
              <input
                id="store_name"
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="예) 행복한 빵집"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="business_type" className="text-sm font-medium">
                업종
              </label>
              <select
                id="business_type"
                value={businessType}
                onChange={(event) => setBusinessType(event.target.value)}
                className={inputClass}
              >
                <option value="">업종을 선택해 주세요</option>
                {businessTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {businessType &&
              !businessTypeOptions.some((option) => option === businessType) ? (
                <input
                  type="text"
                  value={businessType}
                  onChange={(event) => setBusinessType(event.target.value)}
                  placeholder="예: 반려동물 용품"
                  className={inputClass}
                  aria-label="업종 직접 입력"
                />
              ) : (
                <details className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <summary className="cursor-pointer list-none text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    목록에 없는 업종 직접 입력
                  </summary>
                  <input
                    type="text"
                    value=""
                    onChange={(event) => setBusinessType(event.target.value)}
                    placeholder="예: 반려동물 용품"
                    className={`${inputClass} mt-3`}
                    aria-label="업종 직접 입력"
                  />
                </details>
              )}

              <details className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                <summary className="cursor-pointer list-none text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                  업종별 입력 가이드 보기
                </summary>
                <div className="mt-3">
                  <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                    이 업종은 이런 정보를 입력하면 좋아요
                  </p>
                  <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                    아래 정보를 채워두면 AI가 고객 문의에 더 정확하게 답변할 수 있어요.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {businessTypeGuideItems.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-100"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </details>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  대표 상품 정보
                </h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  처음에는 대표 상품명과 한 줄 설명만 입력해도 됩니다.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="product_name"
                    className="text-sm font-medium"
                  >
                    대표 상품명
                  </label>
                  <input
                    id="product_name"
                    type="text"
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    placeholder="예: 수제 견과 강정 세트"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="product_description"
                    className="text-sm font-medium"
                  >
                    상품 설명
                  </label>
                  <textarea
                    id="product_description"
                    value={productDescription}
                    onChange={(event) =>
                      setProductDescription(event.target.value)
                    }
                    placeholder="대표 상품의 특징, 맛, 용도 등을 적어주세요."
                    className={textareaClass}
                  />
                </div>

                <details className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <summary className="cursor-pointer list-none">
                    <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      정확도를 높이는 추가 정보
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      가격, 구성, 주의사항, 포장 가능 여부처럼 정확히 답해야
                      하는 내용을 더 적어둘 수 있어요.
                    </span>
                  </summary>

                  <div className="mt-4 grid gap-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="product_details"
                        className="text-sm font-medium"
                      >
                        구성/용량/재질/사이즈 등
                      </label>
                      <textarea
                        id="product_details"
                        value={productDetails}
                        onChange={(event) =>
                          setProductDetails(event.target.value)
                        }
                        placeholder="예: 8개입, 240g, 국내산 견과류 사용"
                        className={textareaClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="product_caution"
                        className="text-sm font-medium"
                      >
                        보관방법/주의사항/알레르기/사용법 등
                      </label>
                      <textarea
                        id="product_caution"
                        value={productCaution}
                        onChange={(event) =>
                          setProductCaution(event.target.value)
                        }
                        placeholder="예: 직사광선을 피해 서늘한 곳에 보관, 견과류 알레르기 주의"
                        className={textareaClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="extra_faq"
                        className="text-sm font-medium"
                      >
                        기타 FAQ/포장·옵션
                      </label>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        선물 포장, 옵션, 자주 묻는 질문처럼 별도로 기억해야 할
                        내용을 입력하세요.
                      </p>
                      <textarea
                        id="extra_faq"
                        value={extraFaq}
                        onChange={(event) => setExtraFaq(event.target.value)}
                        placeholder="예: 선물 포장 가능합니다. 각인 옵션은 주문 요청사항에 남겨주세요."
                        className={textareaClass}
                      />
                    </div>
                  </div>
                </details>
              </div>
            </div>
              </div>
            </div>

            <details className="rounded-xl border border-violet-100 bg-violet-50/60 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
              <summary className="cursor-pointer list-none">
                <span className="block text-sm font-semibold text-violet-950 dark:text-violet-100">
                  AI 자동 처리 설정
                </span>
                <span className="mt-1 block text-xs leading-5 text-violet-800/90 dark:text-violet-200/80">
                  낮은 위험도의 문의와 긍정 리뷰를 자동 완료할지 정합니다.
                  처음에는 나중에 설정해도 괜찮아요.
                </span>
              </summary>
              <div className="space-y-4">
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-violet-950 dark:text-violet-100">
                    자동 처리 범위
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-violet-800/90 dark:text-violet-200/80">
                    AI가 바로 답변 가능하다고 판단한 낮은 위험도의 문의나
                    긍정 리뷰를 자동으로 답변 완료 처리할 수 있습니다. 근무
                    모드를 정하면 부재중에도 어디까지 맡길지 조절할 수 있어요.
                  </p>
                </div>

                <div className="rounded-xl border border-violet-100 bg-white p-3 dark:border-violet-900/60 dark:bg-zinc-950">
                  <label
                    htmlFor="ai_work_mode"
                    className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    AI 근무 모드
                  </label>
                  <select
                    id="ai_work_mode"
                    value={aiWorkMode}
                    onChange={(event) =>
                      setAiWorkMode(normalizeAiWorkMode(event.target.value))
                    }
                    className={`${inputClass} mt-2`}
                  >
                    <option value="approval_only">
                      항상 승인 대기로 모으기
                    </option>
                    <option value="safe_auto">
                      안전 항목은 항상 자동 완료
                    </option>
                    <option value="after_hours_conservative">
                      영업시간 안에서만 자동 완료
                    </option>
                  </select>
                  <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    고위험, 정보 부족, 승인 필수 항목은 어떤 모드에서도 자동
                    완료하지 않습니다.
                  </p>

                  {aiWorkMode === "after_hours_conservative" ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        자동 근무 시작
                        <input
                          type="time"
                          value={aiWorkStartTime}
                          onChange={(event) =>
                            setAiWorkStartTime(event.target.value)
                          }
                          className={inputClass}
                        />
                      </label>
                      <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        자동 근무 종료
                        <input
                          type="time"
                          value={aiWorkEndTime}
                          onChange={(event) =>
                            setAiWorkEndTime(event.target.value)
                          }
                          className={inputClass}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>

                <label className="flex gap-3 rounded-xl border border-violet-100 bg-white p-3 text-sm text-zinc-800 dark:border-violet-900/60 dark:bg-zinc-950 dark:text-zinc-100">
                  <input
                    type="checkbox"
                    checked={autoCompleteLowRiskCs}
                    onChange={(event) =>
                      setAutoCompleteLowRiskCs(event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-violet-700 focus:ring-violet-500"
                  />
                  <span>
                    위험도 낮고 바로 답변 가능한 고객 문의는 자동으로 답변 완료
                    처리
                  </span>
                </label>

                <label className="flex gap-3 rounded-xl border border-violet-100 bg-white p-3 text-sm text-zinc-800 dark:border-violet-900/60 dark:bg-zinc-950 dark:text-zinc-100">
                  <input
                    type="checkbox"
                    checked={autoCompletePositiveReviews}
                    onChange={(event) =>
                      setAutoCompletePositiveReviews(event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-violet-700 focus:ring-violet-500"
                  />
                  <span>단순 긍정 리뷰는 자동으로 답변 완료 처리</span>
                </label>
              </div>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <summary className="cursor-pointer list-none">
                <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  AI 답변 정확도 높이기
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  상품 목록과 평소 말투를 추가하면 더 정확하고 사장님다운 답변을
                  만들 수 있어요.
                </span>
              </summary>

              <div className="mt-4 space-y-4">
            <details className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
              <summary className="cursor-pointer list-none">
                <span className="block text-sm font-semibold text-sky-950 dark:text-sky-100">
                  상품 목록 학습
                </span>
                <span className="mt-1 block text-xs leading-5 text-sky-800/90 dark:text-sky-200/80">
                  여러 상품이 있을 때 열어서 상품별 구성, 가격, 옵션, 주의사항을
                  입력합니다.
                </span>
              </summary>
              <div className="mt-4 space-y-2">
                <label
                  htmlFor="product_catalog"
                  className="sr-only"
                >
                  상품 목록 학습
                </label>
                <div className="rounded-lg border border-sky-200 bg-white/80 p-3 dark:border-sky-900/70 dark:bg-zinc-950/60">
                  <p className="text-xs font-semibold text-sky-950 dark:text-sky-100">
                    추천 입력 형식
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                    상품명은 [ ] 안에 적고, 상품 정보는 - 로 줄마다 나눠 적으면
                    AI가 더 정확하게 답변할 수 있어요.
                  </p>
                  <pre className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100">
                    {"[상품명]\n- 구성/용량\n- 옵션/가격\n- 보관법\n- 알레르기/주의사항"}
                  </pre>
                  <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    필수 형식은 아니지만, 상품별로 줄을 나눠 입력하면 AI가 어떤
                    상품의 정보인지 더 잘 구분합니다.
                  </p>
                </div>
                <textarea
                  id="product_catalog"
                  value={productCatalog}
                  onChange={(event) => setProductCatalog(event.target.value)}
                  placeholder={[
                    "[딸기 생크림 케이크]",
                    "- 1호, 2~3인용",
                    "- 우유, 계란, 밀 포함",
                    "- 냉장 보관, 당일 섭취 권장",
                    "- 선물 포장 가능, 추가 1,000원",
                    "",
                    "[초코 케이크]",
                    "- 1호, 2~3인용",
                    "- 우유, 계란, 밀, 카카오 포함",
                    "- 냉장 보관, 당일 섭취 권장",
                    "- 초코판 문구 가능",
                    "",
                    "[레터링 쿠키]",
                    "- 6개 세트",
                    "- 예약 주문 필요",
                    "- 파손 우려로 택배 불가, 픽업 권장",
                  ].join("\n")}
                  className="min-h-64 w-full resize-y rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 dark:border-sky-900/70 dark:bg-zinc-950"
                />
              </div>
            </details>

            <details className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <summary className="cursor-pointer list-none">
                <span className="block text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                  사장님 말투 학습
                </span>
                <span className="mt-1 block text-xs leading-5 text-emerald-800/90 dark:text-emerald-200/80">
                  리뷰 답글과 CS 응대 예시를 넣으면 AI가 사장님 말투를 더 잘
                  따라갑니다.
                </span>
              </summary>

              <div className="mt-4 space-y-2">
                <label
                  htmlFor="owner_reply_examples"
                  className="text-sm font-semibold text-emerald-950 dark:text-emerald-100"
                >
                  사장님 리뷰 말투 학습
                </label>
                <p className="text-xs leading-5 text-emerald-800/90 dark:text-emerald-200/80">
                  평소 직접 쓰셨던 리뷰 답글을 3개 이상 붙여넣어 주세요. AI가
                  문장 길이, 말투, 이모지 사용, 감사/사과 표현을 참고해 리뷰
                  답글을 작성합니다.
                </p>
                <textarea
                  id="owner_reply_examples"
                  value={ownerReplyExamples}
                  onChange={(event) =>
                    setOwnerReplyExamples(event.target.value)
                  }
                  placeholder={[
                    "예:",
                    "맛있게 드셔주셔서 감사합니다 :) 다음에도 정성껏 준비하겠습니다.",
                    "",
                    "기다리셨을 텐데 배송이 늦어 죄송합니다. 다음에는 더 빠르게 준비해드릴게요.",
                    "",
                    "솔직한 후기 남겨주셔서 감사합니다. 말씀해주신 부분은 꼭 확인해보겠습니다.",
                  ].join("\n")}
                  className="min-h-40 w-full resize-y rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 dark:border-emerald-900/70 dark:bg-zinc-950"
                />
              </div>

              <p className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                예시를 입력하지 않아도 AI가 기본적으로 친절하고 자연스럽게
                작성합니다. 예시를 입력하면 사장님이 평소 쓰는 말투를 더 잘
                따라갑니다.
              </p>

              <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
                <div className="space-y-2">
                  <label
                    htmlFor="owner_cs_examples"
                    className="text-sm font-semibold text-sky-950 dark:text-sky-100"
                  >
                    CS 응대 말투 학습
                  </label>
                  <p className="text-xs leading-5 text-sky-800/90 dark:text-sky-200/80">
                    평소 고객 문의에 답변하실 때 쓰는 문장을 3개 이상 붙여넣어
                    주세요. AI가 문장 길이, 안내 방식, 마무리 표현을 참고해 문의
                    답변을 작성합니다.
                  </p>
                  <textarea
                    id="owner_cs_examples"
                    value={ownerCsExamples}
                    onChange={(event) => setOwnerCsExamples(event.target.value)}
                    placeholder={[
                      "예:",
                      "안녕하세요. 문의주신 상품은 오늘 오후 2시 이전 주문 시 당일 출고됩니다.",
                      "",
                      "선물 포장 가능합니다. 주문 시 요청사항에 남겨주시면 확인 후 준비해드리겠습니다.",
                      "",
                      "해당 내용은 정확한 안내를 위해 확인 후 다시 말씀드리겠습니다.",
                    ].join("\n")}
                    className="min-h-40 w-full resize-y rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 dark:border-sky-900/70 dark:bg-zinc-950"
                  />
                </div>
              </div>
            </details>
              </div>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <summary className="cursor-pointer list-none">
                <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  운영 정책 입력
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  배송, 픽업, 취소, 환불처럼 정확한 안내가 필요한 기준을
                  입력합니다.
                </span>
              </summary>

              <div className="mt-4 space-y-4">
            <details className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <summary className="cursor-pointer list-none">
                <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  배송정책
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  출고, 배송, 픽업, 배달 기준을 자세히 입력할 때 열어주세요.
                </span>
              </summary>
              <label htmlFor="shipping_policy" className="sr-only">
                배송정책
              </label>
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      배송정책 작성 도우미
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      자주 묻는 배송 정보를 문장으로 정리합니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBuildShippingPolicy}
                    className="mt-2 inline-flex h-9 w-fit items-center justify-center rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 sm:mt-0"
                  >
                    배송정책 문장 만들기
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="shipping_cutoff"
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                    >
                      {isCafePolicyHelper
                        ? "예약/픽업 기준 시간"
                        : isFoodPolicyHelper
                          ? "주문 접수 기준 시간"
                          : "출고 마감 시간"}
                    </label>
                    <input
                      id="shipping_cutoff"
                      type="text"
                      value={shippingCutoffTime}
                      onChange={(event) =>
                        setShippingCutoffTime(event.target.value)
                      }
                      placeholder={
                        isCafePolicyHelper
                          ? "예: 픽업 하루 전 오후 6시"
                          : isFoodPolicyHelper
                            ? "예: 오후 8시"
                            : "예: 오후 2시"
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {isCafePolicyHelper
                        ? "당일 픽업/예약 가능 여부"
                        : isFoodPolicyHelper
                          ? "당일 주문 가능 여부"
                          : "당일 출고 여부"}
                    </p>
                    <div className="flex gap-2">
                      {["가능", "불가능"].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSameDayShipping(option)}
                          className={`${policyOptionButtonClass} ${
                            sameDayShipping === option
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                          }`}
                          aria-pressed={sameDayShipping === option}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="courier_name"
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                    >
                      {isCafePolicyHelper
                        ? "픽업/예약 안내"
                        : isFoodPolicyHelper
                          ? "조리/배달 안내"
                          : "택배사"}
                    </label>
                    <input
                      id="courier_name"
                      type="text"
                      value={courierName}
                      onChange={(event) => setCourierName(event.target.value)}
                      placeholder={
                        isCafePolicyHelper
                          ? "예: 매장 픽업 가능"
                          : isFoodPolicyHelper
                            ? "예: 주문량에 따라 배달 시간 변동"
                            : "예: CJ대한통운"
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="remote_area_fee"
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                    >
                      {isCafePolicyHelper
                        ? "예약 가능 일정"
                        : isFoodPolicyHelper
                          ? "배달 가능 지역"
                          : "제주/도서산간 추가 배송비"}
                    </label>
                    <input
                      id="remote_area_fee"
                      type="text"
                      value={remoteAreaFee}
                      onChange={(event) => setRemoteAreaFee(event.target.value)}
                      placeholder={
                        isCafePolicyHelper
                          ? "예: 최소 2일 전 예약"
                          : isFoodPolicyHelper
                            ? "예: 매장 반경 3km"
                            : "예: 3,000원"
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
              <textarea
                id="shipping_policy"
                value={shippingPolicy}
                onChange={(e) => setShippingPolicy(e.target.value)}
                placeholder="배송 안내, 기간, 지역 등"
                className={textareaClass}
              />
            </details>

            <details className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <summary className="cursor-pointer list-none">
                <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  환불정책
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  취소, 환불, 교환 기준을 자세히 입력할 때 열어주세요.
                </span>
              </summary>
              <label htmlFor="refund_policy" className="sr-only">
                환불정책
              </label>
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      환불정책 작성 도우미
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      환불 가능 여부와 문의 기준을 문장으로 정리합니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBuildRefundPolicy}
                    className="mt-2 inline-flex h-9 w-fit items-center justify-center rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 sm:mt-0"
                  >
                    환불정책 문장 만들기
                  </button>
                </div>

                {isCafePolicyHelper ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        제조 시작 전 취소 가능 여부
                      </p>
                      <div className="flex gap-2">
                        {["가능", "불가능"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setCafeCancelBeforeProduction(option)
                            }
                            className={`${policyOptionButtonClass} ${
                              cafeCancelBeforeProduction === option
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            }`}
                            aria-pressed={
                              cafeCancelBeforeProduction === option
                            }
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        제조 시작 후 취소 가능 여부
                      </p>
                      <div className="flex gap-2">
                        {["가능", "불가능"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setCafeCancelAfterProduction(option)
                            }
                            className={`${policyOptionButtonClass} ${
                              cafeCancelAfterProduction === option
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            }`}
                            aria-pressed={
                              cafeCancelAfterProduction === option
                            }
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        픽업/수령 후 환불 가능 여부
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {["가능", "불가능", "확인 필요"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setCafeRefundAfterPickup(option)}
                            className={`${policyOptionButtonClass} ${
                              cafeRefundAfterPickup === option
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            }`}
                            aria-pressed={cafeRefundAfterPickup === option}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="cafe_reservation_cancel_deadline"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        예약 주문 취소 마감 시간
                      </label>
                      <input
                        id="cafe_reservation_cancel_deadline"
                        type="text"
                        value={cafeReservationCancelDeadline}
                        onChange={(event) =>
                          setCafeReservationCancelDeadline(event.target.value)
                        }
                        placeholder="예: 픽업 하루 전 오후 6시까지"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label
                        htmlFor="cafe_product_issue_standard"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        제품 이상 시 처리 기준
                      </label>
                      <input
                        id="cafe_product_issue_standard"
                        type="text"
                        value={cafeProductIssueStandard}
                        onChange={(event) =>
                          setCafeProductIssueStandard(event.target.value)
                        }
                        placeholder="예: 제품에 문제가 있는 경우 수령 후 가능한 빠르게 문의"
                        className={inputClass}
                      />
                    </div>
                  </div>
                ) : isFoodPolicyHelper ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        조리 시작 전 취소 가능 여부
                      </p>
                      <div className="flex gap-2">
                        {["가능", "불가능"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setFoodCancelBeforeCooking(option)}
                            className={`${policyOptionButtonClass} ${
                              foodCancelBeforeCooking === option
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            }`}
                            aria-pressed={foodCancelBeforeCooking === option}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        조리 시작 후 취소 가능 여부
                      </p>
                      <div className="flex gap-2">
                        {["가능", "불가능"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setFoodCancelAfterCooking(option)}
                            className={`${policyOptionButtonClass} ${
                              foodCancelAfterCooking === option
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            }`}
                            aria-pressed={foodCancelAfterCooking === option}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="food_refund_after_delivery"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        배달 완료 후 환불 기준
                      </label>
                      <input
                        id="food_refund_after_delivery"
                        type="text"
                        value={foodRefundAfterDelivery}
                        onChange={(event) =>
                          setFoodRefundAfterDelivery(event.target.value)
                        }
                        placeholder="예: 주문 상태와 사유 확인 후 안내"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="food_missing_wrong_standard"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        음식 누락/오배송 처리 기준
                      </label>
                      <input
                        id="food_missing_wrong_standard"
                        type="text"
                        value={foodMissingWrongStandard}
                        onChange={(event) =>
                          setFoodMissingWrongStandard(event.target.value)
                        }
                        placeholder="예: 누락 메뉴와 주문 정보 확인 후 안내"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label
                        htmlFor="food_condition_issue_standard"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        음식 상태 문제 처리 기준
                      </label>
                      <input
                        id="food_condition_issue_standard"
                        type="text"
                        value={foodConditionIssueStandard}
                        onChange={(event) =>
                          setFoodConditionIssueStandard(event.target.value)
                        }
                        placeholder="예: 사진과 주문 정보를 확인한 뒤 안내"
                        className={inputClass}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        단순 변심 환불 가능 여부
                      </p>
                      <div className="flex gap-2">
                        {["가능", "불가능"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setChangeOfMindRefund(option)}
                            className={`${policyOptionButtonClass} ${
                              changeOfMindRefund === option
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            }`}
                            aria-pressed={changeOfMindRefund === option}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="defect_deadline"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        상품 하자 문의 기한
                      </label>
                      <input
                        id="defect_deadline"
                        type="text"
                        value={defectContactDeadline}
                        onChange={(event) =>
                          setDefectContactDeadline(event.target.value)
                        }
                        placeholder="예: 수령 후 24시간 이내"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="return_shipping_fee"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        반품 배송비
                      </label>
                      <input
                        id="return_shipping_fee"
                        type="text"
                        value={returnShippingFee}
                        onChange={(event) =>
                          setReturnShippingFee(event.target.value)
                        }
                        placeholder="예: 고객 부담 3,000원"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </div>
              <textarea
                id="refund_policy"
                value={refundPolicy}
                onChange={(e) => setRefundPolicy(e.target.value)}
                placeholder="환불·교환 조건 등"
                className={textareaClass}
              />
            </details>
              </div>
            </details>

            <button
              type="submit"
              disabled={storeSaving}
              className={buttonClass("success", "lg", "h-11")}
            >
              {storeSaving ? "저장 중..." : "가게 정보 저장"}
            </button>
          </form>

          {storeSuccessMessage ? (
            <div
              className="mt-6 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-5 text-sm text-emerald-900 shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-cyan-950/20 dark:text-emerald-100"
              role="status"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    다음 행동
                  </p>
                  <h3 className="mt-1 text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                    첫 AI 답변을 바로 만들어보세요
                  </h3>
                  <p className="mt-2 max-w-2xl leading-6 text-emerald-800/90 dark:text-emerald-100/80">
                    {storeSuccessMessage} 지금 문의 하나를 입력하면 AI가
                    방금 저장한 가게 정보를 어떻게 참고하는지 바로 확인할 수
                    있습니다.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                  <button
                    type="button"
                    onClick={() => goToTabSection("answer", "cs-reply")}
                    className={buttonClass("success", "md", "rounded-lg")}
                  >
                    첫 문의 답변 만들기
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      goToTabSection("integrations", "platform-integrations")
                    }
                    className={buttonClass("secondary", "md", "rounded-lg")}
                  >
                    샘플 데이터로 체험
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {storeError ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {storeError}
            </div>
          ) : null}
        </section>

        <section
          id="platform-integrations"
          className={`${cardClass} ${
            activeTab === "integrations" ? "order-[20]" : "hidden"
          }`}
        >
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              연결할 플랫폼을 선택하세요
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              플랫폼 카드를 열면 샘플 데이터로 먼저 체험하거나 연동 희망을
              등록할 수 있습니다. 실제 API 설정은 지원되는 플랫폼에서만
              표시됩니다.
            </p>
          </div>

          {!authUser ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              연동 희망을 등록하려면 로그인이 필요합니다.
            </div>
          ) : null}

          {integrationsMessage ? (
            <div
              className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
              role="status"
            >
              {integrationsMessage}
            </div>
          ) : null}

          {integrationsError ? (
            <div
              className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              role="alert"
            >
              {integrationsError}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {integrationPlatforms.map((platform) => {
              const request = integrationRequests.find(
                (integration) => integration.platform === platform.id,
              );
              const draft = integrationDrafts[platform.id];
              const isRegistered = Boolean(request);
              const isSaving = savingIntegrationPlatform === platform.id;
              const canTestCoupangConnection = Boolean(
                coupangCredential?.vendor_id &&
                  coupangCredential.access_key &&
                  coupangCredential.has_secret_key,
              );
              const isCoupangConnected =
                coupangCredential?.status === "connected";
              const deliveryMockReviewPlatform =
                isDeliveryMockReviewPlatform(platform.id) ? platform.id : null;

              return (
                <details
                  key={platform.id}
                  className="group rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 transition open:border-indigo-200 open:bg-white dark:border-zinc-800 dark:bg-zinc-950/50 dark:open:border-indigo-900/70 dark:open:bg-zinc-900"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold">
                          {platform.name}
                        </h3>
                        {platform.id === "coupang" ? (
                          <span
                            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${connectionStatusBadgeClass(
                              coupangCredential?.status,
                            )}`}
                          >
                            {getCoupangConnectionStatusLabel(
                              coupangCredential?.status,
                            )}
                          </span>
                        ) : (
                          <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                            연동 준비 중
                          </span>
                        )}
                      </div>
                      {isRegistered ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          희망 등록됨
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      {platform.description}
                    </p>
                    <span className="mt-3 inline-flex text-xs font-semibold text-indigo-700 group-open:hidden dark:text-indigo-300">
                      설정과 샘플 체험 보기
                    </span>
                    <span className="mt-3 hidden text-xs font-semibold text-indigo-700 group-open:inline-flex dark:text-indigo-300">
                      접기
                    </span>
                  </summary>

                  <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">

                  <details className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <summary className="cursor-pointer list-none">
                      <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        연동 희망 등록
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        실제 연동이 준비되면 안내받고 싶을 때만 입력하세요.
                      </span>
                    </summary>

                    <div className="mt-4 space-y-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`${platform.id}_store_url`}
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        가게/스토어 링크 또는 이름
                      </label>
                      <input
                        id={`${platform.id}_store_url`}
                        type="text"
                        value={draft.storeUrl}
                        disabled={isRegistered}
                        onChange={(event) =>
                          updateIntegrationDraft(
                            platform.id,
                            "storeUrl",
                            event.target.value,
                          )
                        }
                        placeholder="선택 입력"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor={`${platform.id}_memo`}
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        연동 관련 메모
                      </label>
                      <textarea
                        id={`${platform.id}_memo`}
                        value={draft.memo}
                        disabled={isRegistered}
                        onChange={(event) =>
                          updateIntegrationDraft(
                            platform.id,
                            "memo",
                            event.target.value,
                          )
                        }
                        placeholder="선택 입력"
                        className={textareaClass}
                      />
                    </div>
                    </div>

                    <button
                      type="button"
                      disabled={isRegistered || isSaving || integrationsLoading}
                      onClick={() => void handleRequestIntegration(platform.id)}
                      className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                    >
                      {isRegistered
                        ? "등록 완료"
                        : isSaving
                          ? "등록 중..."
                          : "연동 희망 등록"}
                    </button>
                  </details>

                  {deliveryMockReviewPlatform ? (
                    <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                      <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-4 dark:border-violet-900/60 dark:bg-violet-950/30">
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                          데모 체험
                        </p>
                        <h4 className="mt-1 text-sm font-semibold text-violet-950 dark:text-violet-100">
                          샘플 리뷰로 흐름 확인
                        </h4>
                        <p className="mt-2 text-xs leading-5 text-violet-900 dark:text-violet-100">
                          샘플 데이터는 실제 플랫폼에서 가져온 데이터가 아니며, AI
                          CS 처리함 흐름을 체험하기 위한 데모용입니다.
                        </p>
                        <button
                          type="button"
                          disabled={deliveryMockReviewsLoadingPlatform !== null}
                          onClick={() =>
                            void handleLoadDeliveryMockReviews(
                              deliveryMockReviewPlatform,
                              platform.name,
                            )
                          }
                          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-violet-600 dark:hover:bg-violet-500"
                        >
                          {deliveryMockReviewsLoadingPlatform ===
                          deliveryMockReviewPlatform
                            ? "샘플 리뷰 불러오는 중..."
                            : "샘플 리뷰 불러오기"}
                        </button>

                        {deliveryMockReviewsMessages[
                          deliveryMockReviewPlatform
                        ] ? (
                          <p
                            className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                            role="status"
                          >
                            {
                              deliveryMockReviewsMessages[
                                deliveryMockReviewPlatform
                              ]
                            }
                          </p>
                        ) : null}

                        {deliveryMockReviewsErrors[
                          deliveryMockReviewPlatform
                        ] ? (
                          <p
                            className="mt-3 text-sm font-medium text-red-700 dark:text-red-300"
                            role="alert"
                          >
                            {
                              deliveryMockReviewsErrors[
                                deliveryMockReviewPlatform
                              ]
                            }
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {platform.id === "smartstore" ? (
                    <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                        데모 체험
                      </p>
                      <h4 className="mt-1 text-sm font-semibold text-sky-950 dark:text-sky-100">
                        샘플 문의로 흐름 확인
                      </h4>
                      <p className="mt-2 text-xs leading-5 text-sky-900 dark:text-sky-100">
                        샘플 데이터는 실제 스마트스토어에서 가져온 데이터가
                        아니며, 상품 문의가 AI CS 처리함에 모이는 흐름을 체험하기
                        위한 데모용입니다.
                      </p>
                      <button
                        type="button"
                        disabled={smartstoreMockInquiriesLoading}
                        onClick={() =>
                          void handleLoadSmartstoreMockInquiries()
                        }
                        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
                      >
                        {smartstoreMockInquiriesLoading
                          ? "샘플 문의 불러오는 중..."
                          : "샘플 문의 불러오기"}
                      </button>

                      {smartstoreMockInquiriesMessage ? (
                        <p
                          className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                          role="status"
                        >
                          {smartstoreMockInquiriesMessage}
                        </p>
                      ) : null}

                      {smartstoreMockInquiriesError ? (
                        <p
                          className="mt-3 text-sm font-medium text-red-700 dark:text-red-300"
                          role="alert"
                        >
                          {smartstoreMockInquiriesError}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {platform.id === "coupang" ? (
                    <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                      <details className="rounded-xl border border-indigo-200 bg-white p-4 dark:border-indigo-900/60 dark:bg-zinc-950">
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                                고급 설정
                              </p>
                              <h4 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                                쿠팡 실제 연동 설정
                              </h4>
                              <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                                쿠팡 Open API 키가 있을 때만 열어 설정합니다.
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${connectionStatusBadgeClass(
                                coupangCredential?.status,
                              )}`}
                            >
                              {getCoupangConnectionStatusLabel(
                                coupangCredential?.status,
                              )}
                            </span>
                          </div>
                        </summary>

                        <div className="mt-4">

                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <div>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            쿠팡 Open API 연결 상태
                          </p>
                          {coupangCredential?.last_tested_at ? (
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              마지막 테스트:{" "}
                              {formatDate(coupangCredential.last_tested_at)}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${connectionStatusBadgeClass(
                            coupangCredential?.status,
                          )}`}
                        >
                          {getCoupangConnectionStatusLabel(
                            coupangCredential?.status,
                          )}
                        </span>
                        </div>

                      <button
                        type="button"
                        onClick={() =>
                          setIsCoupangSettingsOpen((isOpen) => !isOpen)
                        }
                        className={buttonClass(
                          "secondary",
                          "md",
                          "w-full text-indigo-700 dark:text-indigo-300",
                        )}
                        aria-expanded={isCoupangSettingsOpen}
                      >
                        {isCoupangSettingsOpen
                          ? "연동 설정 닫기"
                          : "연동 설정 열기"}
                      </button>

                      {isCoupangSettingsOpen ? (
                        <div className="mt-4 rounded-xl border border-indigo-200 bg-white p-4 dark:border-indigo-900/70 dark:bg-zinc-950">
                          <h4 className="text-sm font-semibold">
                            쿠팡 연동 설정
                          </h4>
                          <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                            쿠팡 Open API 연동을 위해 필요한 정보입니다. 실제 운영
                            전에는 secretKey를 암호화 저장하도록 개선할 예정입니다.
                          </p>

                          <div className="mt-4 space-y-4">
                            <div className="space-y-1.5">
                              <label
                                htmlFor="coupang_vendor_id"
                                className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                              >
                                vendorId
                              </label>
                              <input
                                id="coupang_vendor_id"
                                type="text"
                                value={coupangCredentialDraft.vendorId}
                                onChange={(event) =>
                                  updateCoupangCredentialDraft(
                                    "vendorId",
                                    event.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label
                                htmlFor="coupang_access_key"
                                className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                              >
                                accessKey
                              </label>
                              <input
                                id="coupang_access_key"
                                type="text"
                                value={coupangCredentialDraft.accessKey}
                                onChange={(event) =>
                                  updateCoupangCredentialDraft(
                                    "accessKey",
                                    event.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label
                                htmlFor="coupang_secret_key"
                                className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                              >
                                secretKey
                              </label>
                              <input
                                id="coupang_secret_key"
                                type="password"
                                value={coupangCredentialDraft.secretKey}
                                onChange={(event) =>
                                  updateCoupangCredentialDraft(
                                    "secretKey",
                                    event.target.value,
                                  )
                                }
                                placeholder={
                                  coupangCredential?.has_secret_key
                                    ? "저장된 secretKey가 있습니다. 변경하려면 새로 입력하세요."
                                    : ""
                                }
                                autoComplete="new-password"
                                className={inputClass}
                              />
                              {coupangCredential?.has_secret_key ? (
                                <p className="text-xs leading-5 text-emerald-700 dark:text-emerald-300">
                                  저장된 secretKey가 있습니다. 변경하려면 새로
                                  입력하세요.
                                </p>
                              ) : null}
                            </div>

                            <div className="space-y-1.5">
                              <label
                                htmlFor="coupang_wing_id"
                                className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                              >
                                wingId
                              </label>
                              <input
                                id="coupang_wing_id"
                                type="text"
                                value={coupangCredentialDraft.wingId}
                                onChange={(event) =>
                                  updateCoupangCredentialDraft(
                                    "wingId",
                                    event.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </div>
                          </div>

                          {coupangCredentialsMessage ? (
                            <p
                              className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                              role="status"
                            >
                              {coupangCredentialsMessage}
                            </p>
                          ) : null}

                          {coupangCredentialsError ? (
                            <p
                              className="mt-4 text-sm font-medium text-red-700 dark:text-red-300"
                              role="alert"
                            >
                              {coupangCredentialsError}
                            </p>
                          ) : null}

                          <button
                            type="button"
                            disabled={
                              coupangCredentialsLoading ||
                              coupangCredentialsSaving
                            }
                            onClick={() => void handleSaveCoupangCredentials()}
                            className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                          >
                            {coupangCredentialsSaving
                              ? "저장 중..."
                              : "설정 저장"}
                          </button>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        disabled={
                          !canTestCoupangConnection ||
                          coupangCredentialsLoading ||
                          coupangCredentialsSaving ||
                          coupangConnectionTesting
                        }
                        onClick={() => void handleTestCoupangConnection()}
                        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                      >
                        {coupangConnectionTesting
                          ? "연결 테스트 중..."
                          : "연결 테스트"}
                      </button>

                      {!canTestCoupangConnection ? (
                        <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                          vendorId, accessKey, secretKey를 저장하면 연결 테스트를 할
                          수 있습니다.
                        </p>
                      ) : null}

                      {coupangConnectionTestMessage ? (
                        <p
                          className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                          role="status"
                        >
                          {coupangConnectionTestMessage}
                        </p>
                      ) : null}

                      {coupangConnectionTestError ? (
                        <p
                          className="mt-3 text-sm font-medium text-red-700 dark:text-red-300"
                          role="alert"
                        >
                          {coupangConnectionTestError}
                        </p>
                      ) : null}

                      <button
                        type="button"
                        disabled={
                          !isCoupangConnected || coupangInquiryImportLoading
                        }
                        onClick={() => void handleImportCoupangInquiries()}
                        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                      >
                        {coupangInquiryImportLoading
                          ? "쿠팡 문의 가져오는 중..."
                          : "쿠팡 문의 가져오기"}
                      </button>
                      <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        실제 플랫폼 문의 가져오기와 답변 등록은 유료 플랜 또는
                        도입 상담 후 연결할 핵심 기능입니다. 샘플 데이터 체험은
                        무료 사용량에 포함하지 않습니다.
                      </p>

                      {!isCoupangConnected ? (
                        <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                          쿠팡 연결 테스트가 완료되면 실제 문의 가져오기를 사용할
                          수 있습니다.
                        </p>
                      ) : null}

                      {coupangInquiryImportMessage ? (
                        <p
                          className="mt-3 text-sm font-medium text-indigo-700 dark:text-indigo-300"
                          role="status"
                        >
                          {coupangInquiryImportMessage}
                        </p>
                      ) : null}

                      {coupangInquiryImportError ? (
                        <p
                          className="mt-3 text-sm font-medium text-red-700 dark:text-red-300"
                          role="alert"
                        >
                          {coupangInquiryImportError}
                        </p>
                      ) : null}
                      </div>
                      </details>

                      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900/60 dark:bg-violet-950/25">
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                          데모 체험
                        </p>
                        <h4 className="mt-1 text-sm font-semibold text-violet-950 dark:text-violet-100">
                          샘플 데이터로 AI CS 처리함 흐름 확인
                        </h4>
                        <p className="mt-2 text-xs leading-5 text-violet-900 dark:text-violet-100">
                          샘플 데이터는 실제 쿠팡에서 가져온 데이터가 아니며, 실제
                          API 키가 없어도 처리함 흐름을 체험하기 위한 데모용입니다.
                        </p>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-sky-200 bg-white/80 p-4 dark:border-sky-900/60 dark:bg-zinc-950/50">
                            <p className="text-xs font-semibold text-sky-900 dark:text-sky-100">
                              샘플 문의
                            </p>
                            <p className="mt-1 text-xs leading-5 text-sky-800 dark:text-sky-200">
                              쿠팡 상품 문의 3개를 AI 답변 초안과 함께 처리함에
                              추가합니다.
                            </p>
                            <button
                              type="button"
                              disabled={coupangMockInquiriesLoading}
                              onClick={() =>
                                void handleLoadCoupangMockInquiries()
                              }
                              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
                            >
                              {coupangMockInquiriesLoading
                                ? "샘플 문의 불러오는 중..."
                                : "샘플 문의 불러오기"}
                            </button>

                            {coupangMockInquiriesMessage ? (
                              <p
                                className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                                role="status"
                              >
                                {coupangMockInquiriesMessage}
                              </p>
                            ) : null}

                            {coupangMockInquiriesError ? (
                              <p
                                className="mt-3 text-sm font-medium text-red-700 dark:text-red-300"
                                role="alert"
                              >
                                {coupangMockInquiriesError}
                              </p>
                            ) : null}
                          </div>

                          <div
                            className="rounded-xl border border-violet-200 bg-white/80 p-4 dark:border-violet-900/60 dark:bg-zinc-950/50"
                          >
                            <p className="text-xs font-semibold text-violet-900 dark:text-violet-100">
                              샘플 리뷰
                            </p>
                            <p className="mt-1 text-xs leading-5 text-violet-800 dark:text-violet-200">
                              쿠팡 리뷰 3개를 AI 답글 초안과 함께 처리함에
                              추가합니다.
                            </p>
                            <button
                              type="button"
                              disabled={coupangMockReviewsLoading}
                              onClick={() => void handleLoadCoupangMockReviews()}
                              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-violet-600 dark:hover:bg-violet-500"
                            >
                              {coupangMockReviewsLoading
                                ? "샘플 리뷰 불러오는 중..."
                                : "샘플 리뷰 불러오기"}
                            </button>

                            {coupangMockReviewsMessage ? (
                              <p
                                className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                                role="status"
                              >
                                {coupangMockReviewsMessage}
                              </p>
                            ) : null}

                            {coupangMockReviewsError ? (
                              <p
                                className="mt-3 text-sm font-medium text-red-700 dark:text-red-300"
                                role="alert"
                              >
                                {coupangMockReviewsError}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                        <h4 className="text-sm font-semibold">
                          쿠팡 연동 흐름
                        </h4>
                        <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                          연결 테스트가 성공하면 쿠팡 문의를 불러오고, AI가 답변
                          초안과 위험도를 판단한 뒤 AI CS 처리함에 등록합니다.
                          사장님이 승인하면 플랫폼 등록 완료 상태로 관리됩니다.
                        </p>
                      </div>
                    </div>
                  ) : null}
                  </div>
                </details>
              );
            })}
          </div>

          <p className="mt-6 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            연동된 문의와 리뷰는 AI CS 처리함에 모이고, AI가 답변 가능 여부와
            위험도를 판단합니다.
          </p>
        </section>

        {activeTab === "answer" && needsStoreInfo ? (
          <section className="order-[29] rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/25">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                먼저 가게 설정을 완료하면 AI 답변을 더 정확하게 만들 수 있어요
              </p>
              <button
                type="button"
                onClick={() => goToTabSection("store", "store-info")}
                className={buttonClass("success", "sm", "w-fit rounded-lg")}
              >
                가게 설정하기
              </button>
            </div>
          </section>
        ) : null}

        {activeTab === "answer" && freeTrialAiReplyLimitReached ? (
          <section className="order-[29] rounded-2xl border border-amber-200 bg-amber-50/90 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/25">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  무료 AI 답변 생성 30건을 모두 사용했습니다
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">
                  가게 정보와 지식 학습은 계속 사용할 수 있습니다. 실제 고객
                  응대를 계속 맡기려면 도입 상담을 요청해 주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={
                  authUser
                    ? () => void handleRequestPaidAdoption()
                    : () => void handleKakaoLogin()
                }
                disabled={authUser ? paidAdoptionRequestLoading : authActionLoading}
                className={buttonClass("warning", "sm", "w-fit rounded-lg")}
              >
                {authUser ? "도입 상담 요청" : "로그인 후 상담 요청"}
              </button>
            </div>
          </section>
        ) : null}

        <AnswerModeSelector
          isVisible={activeTab === "answer"}
          selectedMode={selectedAnswerMode}
          onChange={setSelectedAnswerMode}
        />

        <CsReplyPanel
          isVisible={activeTab === "answer" && selectedAnswerMode === "cs"}
          customerMessage={customerMessage}
          reply={csReply}
          error={csError}
          loading={csLoading}
          generationBlocked={answerGenerationBlocked}
          needsStoreInfo={needsStoreInfo}
          onMessageChange={setCustomerMessage}
          onSubmit={handleCsReplySubmit}
          onCopy={() =>
            void handleCopyText(csReply, "답변이 복사되었습니다")
          }
        />

        <section
          id="ai-cs-inbox"
          className={`${cardClass} scroll-mt-32 border-indigo-200/70 dark:border-indigo-900/50 ${
            activeTab === "manage" ? "order-[41]" : "hidden"
          }`}
        >
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="mb-2 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900">
                AI CS 직원
              </p>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                AI CS 처리함
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                상태를 고르고 답변을 승인하거나 수정하세요. 세부 판단은 카드의
                자세히 보기에서 확인할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                void Promise.all([
                  loadHistory(),
                  loadCsMessages(),
                  loadMissingInfos(),
                ])
              }
              disabled={historyLoading || csMessagesLoading || missingInfosLoading}
              className={buttonClass("secondary", "sm", "rounded-lg")}
            >
              새로고침
            </button>
          </div>

          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              플랫폼 출처
            </p>
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2">
                {workflowPlatformFilters.map((filter) => {
                  const isSelected = selectedWorkflowPlatform === filter.id;

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => {
                        setSelectedWorkflowPlatform(filter.id);
                        setVisibleWorkflowCount(WORKFLOW_PAGE_SIZE);
                        setEditingWorkflowKey(null);
                        setEditingWorkflowReply("");
                        setWorkflowBulkApprovalResult(null);
                      }}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 dark:focus-visible:ring-indigo-950 ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-600 text-white shadow-sm dark:border-indigo-400 dark:bg-indigo-500"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40"
                      }`}
                      aria-pressed={isSelected}
                    >
                      <span>{filter.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {filter.count.toLocaleString("ko-KR")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mb-5 overflow-x-auto">
            <div className="grid min-w-full grid-cols-3 gap-2 sm:gap-3">
              {workflowColumns.map((column) => {
                const isSelected = selectedWorkflowStatus === column.status;

                return (
                  <button
                    key={column.status}
                    type="button"
                    onClick={() => {
                      setSelectedWorkflowStatus(column.status);
                      setVisibleWorkflowCount(WORKFLOW_PAGE_SIZE);
                      setEditingWorkflowKey(null);
                      setEditingWorkflowReply("");
                      setWorkflowBulkApprovalResult(null);
                    }}
                    className={`rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 dark:focus-visible:ring-indigo-950 ${workflowStatusTabClass(
                      column.status,
                      isSelected,
                    )}`}
                    aria-pressed={isSelected}
                  >
                    <span className="block text-xs font-medium">
                      {column.title}
                    </span>
                    <span className="mt-1 block text-xl font-semibold sm:text-2xl">
                      {column.items.length.toLocaleString("ko-KR")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedWorkflowStatus === "pending" ? (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                    안전 항목 일괄 승인
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
                    일괄 승인은 AI가 바로 답변 가능하고 위험도 낮음으로 판단한
                    항목만 처리합니다. 확인 필요 또는 위험 항목은 제외됩니다.
                  </p>
                  <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    실제 운영에서는 반복 업무를 대신 처리하는 자동화 기능으로,
                    유료 플랜 기준에 포함될 예정입니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleBulkApproveSafeWorkflowItems()}
                  disabled={
                    workflowBulkApproving ||
                    workflowUpdatingKey !== null ||
                    editingWorkflowKey !== null
                  }
                  className={buttonClass(
                    "success",
                    "lg",
                    "h-11 w-full sm:w-auto",
                  )}
                >
                  {workflowBulkApproving
                    ? "안전 항목 일괄 승인 중..."
                    : `안전 항목 ${safeWorkflowApprovalItems.length}건 일괄 승인`}
                </button>
              </div>
            </div>
          ) : null}

          {workflowBulkApprovalResult ? (
            <div
              className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
                workflowBulkApprovalResult.hasFailures
                  ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
              }`}
              role="status"
            >
              {workflowBulkApprovalResult.message}
            </div>
          ) : null}

          {workflowError ? (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {workflowError}
            </div>
          ) : null}

          {missingInfoResolveMessage ? (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              {missingInfoResolveMessage}
            </div>
          ) : null}

          {historyLoading || csMessagesLoading || missingInfosLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              AI CS 처리 항목을 불러오는 중...
            </p>
          ) : selectedWorkflowColumn.items.length === 0 ? (
            <EmptyStateCard
              title={selectedWorkflowEmptyState.title}
              description={selectedWorkflowEmptyState.description}
              actionLabel={selectedWorkflowEmptyAction.actionLabel}
              onAction={selectedWorkflowEmptyAction.onAction}
              secondaryActionLabel={
                selectedWorkflowEmptyAction.secondaryActionLabel
              }
              onSecondaryAction={selectedWorkflowEmptyAction.onSecondaryAction}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedWorkflowColumn.title} 항목
                </h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${workflowStatusBadgeClass(
                    selectedWorkflowColumn.status,
                  )}`}
                >
                  {selectedWorkflowTotalCount}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                최근 {visibleWorkflowItemCount.toLocaleString("ko-KR")}개 / 전체{" "}
                {selectedWorkflowTotalCount.toLocaleString("ko-KR")}개 표시 중
              </p>

              <div className="grid items-stretch gap-5 xl:grid-cols-2">
                {visibleWorkflowItems.map((item) => {
                  const isEditing = editingWorkflowKey === item.key;
                  const isUpdating =
                    workflowBulkApproving || workflowUpdatingKey === item.key;
                  const isAutoCompleted =
                    (item.status === "completed" ||
                      item.status === "answered") &&
                    item.handlingType === "auto_ready" &&
                    item.riskLevel === "low";
                  const isCompleted =
                    item.status === "completed" || item.status === "answered";
                  const attentionTone = workflowAttentionTone(
                    item.handlingType,
                    item.riskLevel,
                  );
                  const needsAttention = attentionTone !== null;
                  const isDemoData = isDemoExternalId(item.externalId);
                  const evidenceTitle = workflowEvidenceTitle(item);
                  const evidenceMessage = workflowEvidenceMessage(item);
                  const isWorkflowDetailExpanded =
                    Boolean(expandedWorkflowDetailKeys[item.key]) ||
                    item.type === "missing_info";
                  const canApproveWorkflowItem =
                    !isCompleted &&
                    item.canMutate &&
                    item.type !== "missing_info";

                  return (
                    <article
                      key={item.key}
                      className={`flex h-full flex-col rounded-[1.35rem] border bg-white/90 p-4 shadow-[0_18px_65px_-48px_rgba(15,23,42,0.65)] ring-1 ring-slate-950/[0.03] backdrop-blur-xl transition dark:bg-slate-950/70 dark:ring-white/10 sm:p-5 ${workflowCardAttentionClass(
                        attentionTone,
                      )}`}
                    >
                      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200/70 pb-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10">
                            {item.typeLabel}
                          </span>
                          <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10">
                            {sourcePlatformLabel(item.sourcePlatform)}
                          </span>
                          {isDemoData ? (
                            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800 ring-1 ring-violet-200 dark:bg-violet-950/60 dark:text-violet-200 dark:ring-violet-900">
                              데모 데이터
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${workflowStatusBadgeClass(
                              item.status,
                            )}`}
                          >
                            {workflowStatusLabel(item.status)}
                          </span>
                        </div>
                        <time
                          dateTime={item.createdAt}
                          className="shrink-0 text-xs leading-6 text-slate-500 dark:text-slate-400"
                        >
                          {formatDate(item.createdAt)}
                        </time>
                      </div>

                      {attentionTone && item.type !== "missing_info" ? (
                        <p
                          className={`mb-4 rounded-xl border px-4 py-3 text-xs font-semibold leading-5 ${workflowAttentionNoticeClass(
                            attentionTone,
                          )}`}
                        >
                          {attentionTone === "danger"
                            ? "위험도가 높은 항목입니다. 답변과 관련 정책을 반드시 확인해 주세요."
                            : "사장님 확인 후 처리해야 하는 항목입니다."}
                        </p>
                      ) : null}

                      <div className="flex flex-1 flex-col">
                        <div className="space-y-4 text-sm">
                          <div className={workflowCardSectionClass}>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              원문
                            </p>
                            <p className="whitespace-pre-wrap leading-6 text-slate-700 dark:text-slate-200">
                              {item.original}
                            </p>
                          </div>

                            {item.type === "missing_info" && item.missingInfo ? (
                              <>
                                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                    확인 필요한 질문
                                  </p>
                                  <p className="whitespace-pre-wrap leading-6 text-zinc-800 dark:text-zinc-200">
                                    {item.missingInfo.question}
                                  </p>
                                </div>
                                {item.missingInfo.source_messages &&
                                item.missingInfo.source_messages.length > 0 ? (
                                  <div className={workflowCardSectionClass}>
                                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      관련 문의 예시
                                    </p>
                                    <ul className="space-y-2 text-zinc-700 dark:text-zinc-300">
                                      {item.missingInfo.source_messages
                                        .slice(0, 3)
                                        .map((message) => (
                                          <li key={message} className="flex gap-2.5">
                                            <span className="text-slate-400" aria-hidden>•</span>
                                            <span className="whitespace-pre-wrap leading-6">
                                              {message}
                                            </span>
                                          </li>
                                        ))}
                                    </ul>
                                  </div>
                                ) : null}
                                <div className={workflowCardSectionClass}>
                                  <label
                                    htmlFor={`workflow_missing_info_answer_${item.id}`}
                                    className="mb-2 block font-medium text-zinc-800 dark:text-zinc-200"
                                  >
                                    답변 입력
                                  </label>
                                  <textarea
                                    id={`workflow_missing_info_answer_${item.id}`}
                                    value={missingInfoAnswers[String(item.id)] ?? ""}
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      setMissingInfoAnswers((currentAnswers) => ({
                                        ...currentAnswers,
                                        [String(item.id)]: nextValue,
                                      }));
                                    }}
                                    placeholder="예: 선물 포장 가능합니다. 주문 시 요청사항에 남겨주세요."
                                    className="min-h-24 w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900"
                                  />
                                  <label
                                    htmlFor={`workflow_missing_info_target_${item.id}`}
                                    className="mb-2 mt-3 block font-medium text-zinc-800 dark:text-zinc-200"
                                  >
                                    저장 위치
                                  </label>
                                  <select
                                    id={`workflow_missing_info_target_${item.id}`}
                                    value={
                                      missingInfoTargetFields[String(item.id)] ??
                                      "extra_faq"
                                    }
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      setMissingInfoTargetFields(
                                        (currentFields) => ({
                                          ...currentFields,
                                          [String(item.id)]: nextValue,
                                        }),
                                      );
                                    }}
                                    className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900"
                                  >
                                    <option value="extra_faq">
                                      기타 FAQ/포장·옵션
                                    </option>
                                    <option value="product_details">
                                      상품 정보
                                    </option>
                                    <option value="product_caution">
                                      주의사항/사용법
                                    </option>
                                    <option value="shipping_policy">
                                      배송 정책
                                    </option>
                                    <option value="refund_policy">
                                      환불 정책
                                    </option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleResolveMissingInfo(
                                        String(item.id),
                                      )
                                    }
                                    disabled={
                                      missingInfoResolvingId === String(item.id)
                                    }
                                    className={buttonClass(
                                      "warning",
                                      "md",
                                      "mt-4 w-full sm:w-auto",
                                    )}
                                  >
                                    {missingInfoResolvingId === String(item.id)
                                      ? "반영 중..."
                                      : "저장하고 답변에 반영"}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className={workflowCardSectionClass}>
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    AI 답변 초안
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleCopyText(
                                        item.reply,
                                        "답변이 복사되었습니다",
                                      )
                                    }
                                    className={copyButtonClass}
                                  >
                                    복사
                                  </button>
                                </div>

                                {isEditing ? (
                                  <textarea
                                    value={editingWorkflowReply}
                                    onChange={(event) =>
                                      setEditingWorkflowReply(event.target.value)
                                    }
                                    className="min-h-32 w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
                                  />
                                ) : (
                                  <p className="whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">
                                    {item.reply}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {item.type !== "missing_info" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedWorkflowDetailKeys((current) => ({
                                  ...current,
                                  [item.key]: !current[item.key],
                                }))
                              }
                              className={buttonClass(
                                "secondary",
                                "sm",
                                "mt-4 h-8 w-fit rounded-lg",
                              )}
                              aria-expanded={isWorkflowDetailExpanded}
                            >
                              {isWorkflowDetailExpanded
                                ? "자세히 접기"
                                : "자세히 보기"}
                            </button>
                          ) : null}

                          {isWorkflowDetailExpanded ? (
                            <div className="mt-4 space-y-3 border-t border-slate-200/70 pt-4 dark:border-white/10">
                              {item.type !== "missing_info" ? (
                                <div
                                  className={`${workflowCardDetailClass} border-slate-200 bg-slate-50/80 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200`}
                                >
                                  <p className="font-bold text-slate-900 dark:text-white">
                                    AI 판단
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${handlingTypeBadgeClass(
                                        item.handlingType,
                                      )}`}
                                    >
                                      {handlingTypeLabel(item.handlingType)}
                                    </span>
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${riskLevelBadgeClass(
                                        item.riskLevel,
                                      )}`}
                                    >
                                      위험도: {riskLevelLabel(item.riskLevel)}
                                    </span>
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${platformStatusBadgeClass(
                                        item.platformStatus,
                                      )}`}
                                    >
                                      {platformStatusLabel(item.platformStatus)}
                                    </span>
                                  </div>
                                  {item.handlingType === "auto_ready" &&
                                  !isCompleted ? (
                                    <p className="mt-2 text-emerald-700 dark:text-emerald-300">
                                      AI가 바로 답변 가능하다고 판단했습니다.
                                    </p>
                                  ) : null}
                                  {isAutoCompleted ? (
                                    <p className="mt-2 text-emerald-700 dark:text-emerald-300">
                                      AI가 낮은 위험도의 바로 답변 가능한 항목으로
                                      판단해 자동 완료 처리했습니다.
                                    </p>
                                  ) : null}
                                  {needsAttention ? (
                                    <p
                                      className={`mt-2 ${
                                        attentionTone === "danger"
                                          ? "text-red-700 dark:text-red-300"
                                          : "text-amber-700 dark:text-amber-300"
                                      }`}
                                    >
                                      {attentionTone === "danger"
                                        ? "고위험 항목입니다. 승인 전 답변 내용과 관련 정책을 반드시 확인해 주세요."
                                        : "사장님 확인이 필요한 항목입니다. 답변 내용과 정책을 한 번 더 확인해 주세요."}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}

                              {item.aiReason ? (
                                <div
                                  className={`${workflowCardDetailClass} border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200`}
                                >
                                  <p className="font-semibold">AI 판단 이유</p>
                                  <p className="mt-1">{item.aiReason}</p>
                                </div>
                              ) : null}

                              <div
                                className={`${workflowCardDetailClass} ${
                                  item.usedKnowledgeItems.length > 0 ||
                                  item.handlingType === "auto_ready"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100"
                                    : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
                                }`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-semibold">
                                    {evidenceTitle}
                                  </p>
                                  {item.usedKnowledgeItems.length > 0 ? (
                                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-current/10 dark:bg-zinc-950/40">
                                      참고 근거{" "}
                                      {item.usedKnowledgeItems.length.toLocaleString(
                                        "ko-KR",
                                      )}
                                      개
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2">{evidenceMessage}</p>
                                {item.usedKnowledgeItems.length > 0 ? (
                                  <ul className="mt-3 space-y-2">
                                    {item.usedKnowledgeItems
                                      .slice(0, 3)
                                      .map((knowledgeItem) => (
                                        <li
                                          key={`${item.key}-${knowledgeItem.id}`}
                                          className="rounded-md bg-white/70 px-2.5 py-2 ring-1 ring-emerald-100 dark:bg-zinc-950/40 dark:ring-emerald-900/70"
                                        >
                                          <div className="mb-1 flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                                              {storeKnowledgeCategoryLabel(
                                                knowledgeItem.category,
                                              )}
                                            </span>
                                            <span className="font-medium">
                                              {truncateSummaryText(
                                                knowledgeItem.question,
                                                56,
                                              )}
                                            </span>
                                          </div>
                                          <p className="text-emerald-800 dark:text-emerald-200">
                                            {truncateSummaryText(
                                              knowledgeItem.answer,
                                              100,
                                            )}
                                          </p>
                                        </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>

                              <div
                                className={`${workflowCardDetailClass} grid gap-2 border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 sm:grid-cols-2`}
                              >
                                <p className="min-w-0">
                                  생성 시간:{" "}
                                  <time dateTime={item.createdAt}>
                                    {formatDate(item.createdAt)}
                                  </time>
                                </p>
                                <p className="min-w-0 sm:text-right">
                                  플랫폼 상태:{" "}
                                  {platformStatusLabel(item.platformStatus)}
                                </p>
                              </div>

                              {isDemoData ? (
                                <p
                                  className={`${workflowCardDetailClass} border-violet-200 bg-violet-50 font-medium text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200`}
                                >
                                  {item.platformStatus === "posted"
                                    ? "샘플 데이터가 플랫폼 등록 완료 상태로 처리되었습니다. 실제 플랫폼 API 등록은 실연동 단계에서 연결됩니다."
                                    : "이 항목은 실제 플랫폼에서 가져온 데이터가 아니라, 연동 흐름을 체험하기 위한 샘플 데이터입니다."}
                                </p>
                              ) : null}

                              {!isDemoData &&
                              item.sourcePlatform !== "manual" &&
                              item.platformStatus === "posted" ? (
                                <p className="px-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                  승인 완료되어 플랫폼 등록 완료 상태로 표시됩니다.
                                  실제 플랫폼 API 등록은 연동 단계에서 연결될
                                  예정입니다.
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="mt-auto flex flex-col gap-3 border-t border-slate-200/70 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                            {item.type === "missing_info" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteWorkflowItem(item)
                                }
                                disabled={isUpdating}
                                className={buttonClass(
                                  "danger",
                                  "sm",
                                  "w-full rounded-lg sm:ml-auto sm:w-auto",
                                )}
                              >
                                삭제
                              </button>
                            ) : isEditing ? (
                              <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto sm:flex-wrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleUpdateWorkflowItem(item, {
                                      reply: editingWorkflowReply,
                                    })
                                  }
                                  disabled={isUpdating}
                                  className={buttonClass("primary", "sm", "rounded-lg")}
                                >
                                  {isUpdating ? "저장 중..." : "수정 저장"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingWorkflowKey(null);
                                    setEditingWorkflowReply("");
                                  }}
                                  className={buttonClass("secondary", "sm", "rounded-lg")}
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <>
                                {canApproveWorkflowItem ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleUpdateWorkflowItem(item, {
                                        status: "completed",
                                      })
                                    }
                                    disabled={!item.canMutate || isUpdating}
                                    className={buttonClass(
                                      "success",
                                      "md",
                                      "w-full font-bold sm:w-auto",
                                    )}
                                  >
                                    {isUpdating ? "처리 중..." : "승인 완료"}
                                  </button>
                                ) : null}
                                <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex sm:flex-wrap sm:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleStartWorkflowEdit(item)}
                                    disabled={!item.canMutate || isUpdating}
                                    className={buttonClass(
                                      "secondary",
                                      "sm",
                                      "rounded-lg text-indigo-700 dark:text-indigo-300",
                                    )}
                                  >
                                    수정하기
                                  </button>
                                  {!isCompleted &&
                                  item.status !== "needs_review" ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleUpdateWorkflowItem(item, {
                                          status: "needs_review",
                                        })
                                      }
                                      disabled={!item.canMutate || isUpdating}
                                      className={buttonClass(
                                        "warning",
                                        "sm",
                                        "rounded-lg",
                                      )}
                                    >
                                      확인 필요
                                    </button>
                                  ) : null}
                                  {isCompleted &&
                                  item.canMutate &&
                                  isWorkflowDetailExpanded ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleUpdateWorkflowItem(item, {
                                          status: "needs_review",
                                        })
                                      }
                                      disabled={isUpdating}
                                      className={buttonClass(
                                        "secondary",
                                        "sm",
                                        "rounded-lg text-slate-500 dark:text-slate-400",
                                      )}
                                    >
                                      확인 필요로 되돌리기
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleDeleteWorkflowItem(item)
                                    }
                                    disabled={
                                      isUpdating ||
                                      (item.type === "review" &&
                                        deletingReviewId === item.id) ||
                                      (item.type === "cs" &&
                                        deletingCsMessageId === item.id)
                                    }
                                    className={buttonClass(
                                      "danger",
                                      "sm",
                                      "rounded-lg",
                                    )}
                                  >
                                    삭제
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {!item.canMutate && item.type !== "missing_info" ? (
                            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                              missing_infos에서 온 확인 필요 항목입니다. 아래
                              확인 필요 정보 섹션에서 내용을 보강해 주세요.
                            </p>
                          ) : null}
                          </div>
                        </article>
                      );
                    })}
              </div>

              {canShowMoreWorkflowItems || canCollapseWorkflowItems ? (
                <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    최근 {visibleWorkflowItemCount.toLocaleString("ko-KR")}개 /
                    전체 {selectedWorkflowTotalCount.toLocaleString("ko-KR")}개
                    표시 중
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {canShowMoreWorkflowItems ? (
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleWorkflowCount((current) =>
                            Math.min(
                              current + WORKFLOW_PAGE_SIZE,
                              selectedWorkflowTotalCount,
                            ),
                          )
                        }
                        className={buttonClass(
                          "secondary",
                          "md",
                          "text-indigo-700 dark:text-indigo-300",
                        )}
                      >
                        더 보기
                      </button>
                    ) : null}
                    {canCollapseWorkflowItems ? (
                      <button
                        type="button"
                        onClick={handleCollapseWorkflowItems}
                        className={buttonClass("secondary")}
                      >
                        접기
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section
          id="manage-support"
          className={`${cardClass} scroll-mt-32 border-zinc-200/80 dark:border-zinc-800 ${
            activeTab === "manage" ? "order-[42]" : "hidden"
          }`}
        >
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              더 보기
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              필요할 때만 지식과 분석을 열어보세요.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <article className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                    가게 지식
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
                    AI가 답변에 사용하는 정보를 점검합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleManageSupportPanel("store_knowledge")}
                  className={buttonClass("success", "sm", "rounded-lg")}
                  aria-expanded={isStoreKnowledgePanelOpen}
                  aria-controls="store-knowledge"
                >
                  {isStoreKnowledgePanelOpen ? "접기" : "열기"}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-3 py-1.5 ${semanticBadgeClass("neutral")}`}>
                  전체 {storeKnowledgeQualityReport.summary.totalCount.toLocaleString("ko-KR")}
                </span>
                <span className={`rounded-full px-3 py-1.5 ${semanticBadgeClass("warning")}`}>
                  검토 {storeKnowledgeQualityReport.summary.reviewCount.toLocaleString("ko-KR")}
                </span>
                <span className={`rounded-full px-3 py-1.5 ${semanticBadgeClass("warning")}`}>
                  충돌 {storeKnowledgeQualityReport.summary.conflictCount.toLocaleString("ko-KR")}
                </span>
                <span className={`rounded-full px-3 py-1.5 ${semanticBadgeClass("info")}`}>
                  반복 수정 {repeatedCorrectionPatterns.length.toLocaleString("ko-KR")}
                </span>
              </div>
            </article>

            <article className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/25">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">
                    AI 운영 분석
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-indigo-800 dark:text-indigo-200">
                    최근 리뷰에서 운영 신호를 찾습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleManageSupportPanel("insights")}
                  className={buttonClass("primary", "sm", "rounded-lg")}
                  aria-expanded={isInsightsPanelOpen}
                  aria-controls="ai-insights"
                >
                  {isInsightsPanelOpen ? "접기" : "열기"}
                </button>
              </div>
              <p className="mt-4 text-xs font-medium text-indigo-800 dark:text-indigo-200">
                {insightsLoading
                  ? "불러오는 중"
                  : insightsError
                    ? "다시 분석 필요"
                    : "분석 준비됨"}
              </p>
            </article>
          </div>
        </section>

        <section
          id="store-knowledge"
          className={`${cardClass} scroll-mt-32 border-emerald-200/70 dark:border-emerald-900/50 ${
            activeTab === "manage" && isStoreKnowledgePanelOpen
              ? "order-[43]"
              : "hidden"
          }`}
        >
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900">
                AI Memory
              </p>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                AI가 학습한 가게 지식
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                사장님이 확인 필요 항목에 답변하며 알려준 내용을 AI가 기억하는
                공간입니다. 답변에 사용할 지식과 검토가 필요한 지식, 보관할
                지식을 나눠 관리할 수 있어요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadStoreKnowledge()}
              disabled={storeKnowledgeLoading}
              className={buttonClass("secondary", "sm", "rounded-lg")}
            >
              {storeKnowledgeLoading ? "불러오는 중..." : "새로고침"}
            </button>
          </div>

          {storeKnowledgeMessage ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              {storeKnowledgeMessage}
            </div>
          ) : null}

          {storeKnowledgeError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {storeKnowledgeError}
            </div>
          ) : null}

          {!storeKnowledgeLoading && repeatedCorrectionPatterns.length > 0 ? (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                    반복 수정 감지
                  </p>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-800 dark:text-amber-200">
                    비슷한 문의에서 사장님이 여러 번 답변을 고쳤습니다. 하나의
                    기준으로 정리해 다시 사용하면 AI가 다음 답변에서 같은 실수를
                    줄일 수 있어요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openStoreKnowledgeReviewCandidates}
                  className={buttonClass("warning", "sm", "rounded-lg")}
                >
                  후보 검토하기
                </button>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {repeatedCorrectionPatterns.map((pattern) => {
                    const draft = correctionPatternDrafts[pattern.key];
                    const isMerging =
                      mergingCorrectionPatternKey === pattern.key;

                    return (
                      <article
                        key={pattern.key}
                        className="rounded-xl border border-amber-200 bg-white/85 p-3 text-xs leading-5 text-zinc-700 dark:border-amber-900/60 dark:bg-zinc-950/70 dark:text-zinc-300"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900">
                            {storeKnowledgeCategoryLabel(pattern.category)}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700">
                            {pattern.items.length.toLocaleString("ko-KR")}건 반복
                          </span>
                        </div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {pattern.hasDifferentAnswers
                            ? "서로 다른 수정 답변이 쌓였습니다"
                            : "같은 방향의 수정이 반복됐습니다"}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {pattern.items.slice(0, 3).map((item) => (
                            <li key={item.id}>
                              {truncateSummaryText(item.question, 70)}
                            </li>
                          ))}
                        </ul>

                        {draft ? (
                          <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                            <p className="font-semibold text-amber-950 dark:text-amber-100">
                              하나의 지식으로 정리
                            </p>
                            <label className="block">
                              <span className="font-medium text-amber-900 dark:text-amber-100">
                                AI가 기억할 질문
                              </span>
                              <input
                                type="text"
                                value={draft.question}
                                onChange={(event) =>
                                  setCorrectionPatternDrafts((currentDrafts) => ({
                                    ...currentDrafts,
                                    [pattern.key]: {
                                      ...draft,
                                      question: event.target.value,
                                    },
                                  }))
                                }
                                className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-amber-500 dark:border-amber-900 dark:bg-zinc-950"
                              />
                            </label>
                            <label className="block">
                              <span className="font-medium text-amber-900 dark:text-amber-100">
                                AI가 참고할 답변
                              </span>
                              <textarea
                                value={draft.answer}
                                onChange={(event) =>
                                  setCorrectionPatternDrafts((currentDrafts) => ({
                                    ...currentDrafts,
                                    [pattern.key]: {
                                      ...draft,
                                      answer: event.target.value,
                                    },
                                  }))
                                }
                                className="mt-1 min-h-24 w-full resize-y rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-amber-500 dark:border-amber-900 dark:bg-zinc-950"
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleSaveMergedCorrectionPattern(pattern)
                                }
                                disabled={isMerging}
                                className={buttonClass(
                                  "warning",
                                  "sm",
                                  "h-8 rounded-lg",
                                )}
                              >
                                {isMerging ? "정리 중..." : "저장하고 다시 사용"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCancelMergeCorrectionPattern(pattern.key)
                                }
                                disabled={isMerging}
                                className={buttonClass(
                                  "secondary",
                                  "sm",
                                  "h-8 rounded-lg",
                                )}
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleStartMergeCorrectionPattern(pattern)
                            }
                            className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-xs font-medium text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-amber-950/60"
                          >
                            정리 제안 열기
                          </button>
                        )}
                      </article>
                    );
                  })}
              </div>
            </div>
          ) : null}

          {!storeKnowledgeLoading && storeKnowledgeItems.length > 0 ? (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                    지식 품질 점검
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
                    비슷한 질문에 다른 답변이 있거나 오래 업데이트되지 않은
                    지식을 찾아 정리할 수 있습니다.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    {
                      label: "답변 사용 중",
                      value: storeKnowledgeFilterCounts.active,
                    },
                    {
                      label: "검토 필요",
                      value: storeKnowledgeReviewItemCount,
                    },
                    {
                      label: "충돌 가능",
                      value: storeKnowledgeQualityReport.summary.conflictCount,
                    },
                    {
                      label: "보관됨",
                      value: storeKnowledgeFilterCounts.archived,
                    },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-lg bg-white/80 px-3 py-2 text-center ring-1 ring-emerald-100 dark:bg-zinc-950/40 dark:ring-emerald-900/70"
                    >
                      <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        {metric.label}
                      </p>
                      <p className="mt-0.5 text-lg font-semibold text-emerald-950 dark:text-emerald-100">
                        {metric.value.toLocaleString("ko-KR")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {storeKnowledgeReviewItemCount > 0 ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                  검토 필요 배지가 있는 지식은 수정하거나 삭제해 주세요. AI가
                  비슷한 문의에 답할 때는 충돌 가능 지식, 검토 필요 지식, 보관된
                  지식을 답변 근거에서 제외합니다.
                </p>
              ) : null}
            </div>
          ) : null}

          {!storeKnowledgeLoading && storeKnowledgeItems.length > 0 ? (
            <div className="mb-4 overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2">
                {[
                  {
                    id: "all" as const,
                    label: "전체",
                    count: storeKnowledgeFilterCounts.all,
                  },
                  {
                    id: "active" as const,
                    label: "답변 사용 중",
                    count: storeKnowledgeFilterCounts.active,
                  },
                  {
                    id: "needs_review" as const,
                    label: "검토 필요",
                    count: storeKnowledgeFilterCounts.needs_review,
                  },
                  {
                    id: "archived" as const,
                    label: "보관됨",
                    count: storeKnowledgeFilterCounts.archived,
                  },
                ].map((filter) => {
                  const isSelected =
                    selectedStoreKnowledgeStatus === filter.id;

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setSelectedStoreKnowledgeStatus(filter.id)}
                      className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
                        isSelected
                          ? "bg-emerald-700 text-white shadow-sm dark:bg-emerald-500 dark:text-emerald-950"
                          : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {filter.label}
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                          isSelected
                            ? "bg-white/20 text-white dark:bg-emerald-950/20 dark:text-emerald-950"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {filter.count.toLocaleString("ko-KR")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {storeKnowledgeLoading ? (
            <div className="space-y-3" aria-busy="true">
              <div className="h-24 animate-pulse rounded-xl bg-emerald-50 dark:bg-emerald-950/30" />
              <div className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ) : storeKnowledgeItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                아직 AI가 학습한 가게 지식이 없습니다
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                확인 필요 항목에서 사장님이 답변을 입력하면 이곳에 지식으로
                쌓입니다.
              </p>
            </div>
          ) : filteredStoreKnowledgeItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                선택한 상태의 지식이 없습니다
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                다른 상태 필터를 선택하거나, AI CS 처리함에서 새 정보를 학습하면
                이곳에 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredStoreKnowledgeItems.map((item) => {
                const isEditing = editingStoreKnowledgeId === item.id;
                const isSaving = savingStoreKnowledgeId === item.id;
                const isDeleting = deletingStoreKnowledgeId === item.id;
                const isResolvingConflict =
                  resolvingStoreKnowledgeConflictId === item.id;
                const knowledgeStatus = normalizeStoreKnowledgeStatus(
                  item.status,
                );
                const quality =
                  storeKnowledgeQualityReport.byId[item.id] ??
                  createEmptyStoreKnowledgeQuality();
                const recentKnowledgeUsages =
                  storeKnowledgeUsageMap[item.id] ?? [];
                const needsKnowledgeReview =
                  knowledgeStatus === "needs_review" ||
                  quality.isStale ||
                  quality.duplicateCount > 0 ||
                  quality.conflictCount > 0;
                const isArchivedKnowledge = knowledgeStatus === "archived";

                return (
                  <article
                    key={item.id}
                    className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-zinc-900 ${
                      isArchivedKnowledge
                        ? "border-zinc-200 opacity-80 dark:border-zinc-800"
                        : needsKnowledgeReview
                        ? "border-amber-300 ring-1 ring-amber-200 dark:border-amber-800 dark:ring-amber-900/60"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900">
                          {storeKnowledgeCategoryLabel(item.category)}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                          {item.confidence === "owner_confirmed"
                            ? "사장님 확인"
                            : item.confidence}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${storeKnowledgeStatusBadgeClass(
                            item.status,
                          )}`}
                        >
                          {storeKnowledgeStatusLabel(item.status)}
                        </span>
                        {quality.conflictCount > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-900">
                            충돌 가능
                          </span>
                        ) : null}
                        {quality.duplicateCount > 0 ? (
                          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:ring-sky-900">
                            중복 가능
                          </span>
                        ) : null}
                        {quality.isStale ? (
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
                            오래됨
                          </span>
                        ) : null}
                      </div>
                      <time
                        dateTime={item.updated_at}
                        className="text-xs text-zinc-500 dark:text-zinc-400"
                      >
                        {formatDate(item.updated_at)}
                      </time>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                          기억할 질문
                          <input
                            value={editingStoreKnowledgeQuestion}
                            onChange={(event) =>
                              setEditingStoreKnowledgeQuestion(
                                event.target.value,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                          AI가 참고할 답변
                          <textarea
                            value={editingStoreKnowledgeAnswer}
                            onChange={(event) =>
                              setEditingStoreKnowledgeAnswer(event.target.value)
                            }
                            className="mt-1 min-h-28 w-full resize-y rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {needsKnowledgeReview ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                            <p className="font-semibold">
                              먼저 판단해 주세요
                            </p>
                            <p className="mt-1">
                              이 지식은 최근 수정 답변이나 품질 점검에서 확인이
                              필요하다고 표시됐습니다. 맞는 내용이면 다시
                              사용하고, 틀렸다면 수정하거나 보관해 주세요.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleUpdateStoreKnowledgeStatus(
                                    item,
                                    "active",
                                  )
                                }
                                disabled={isDeleting || isSaving}
                                className={buttonClass("success", "sm", "h-auto py-1.5")}
                              >
                                {isSaving ? "처리 중..." : "문제 없음, 다시 사용"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleStartStoreKnowledgeEdit(item)
                                }
                                disabled={isDeleting || isSaving}
                                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-800 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-amber-950/60"
                              >
                                수정하기
                              </button>
                              {knowledgeStatus !== "archived" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleUpdateStoreKnowledgeStatus(
                                      item,
                                      "archived",
                                    )
                                  }
                                  disabled={isDeleting || isSaving}
                                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                >
                                  {isSaving ? "처리 중..." : "보관"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        <div>
                          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            기억한 질문
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6 text-zinc-900 dark:text-zinc-100">
                            {item.question}
                          </p>
                        </div>
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            AI가 참고할 답변
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                            {item.answer}
                          </p>
                        </div>
                        {item.source_text ? (
                          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                            출처 문의: {truncateSummaryText(item.source_text, 90)}
                          </p>
                        ) : null}
                        {knowledgeStatus !== "active" ? (
                          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                            {knowledgeStatus === "needs_review"
                              ? "이 지식은 검토 필요 상태라 AI 답변 근거에서 제외됩니다. 내용을 확인한 뒤 다시 사용으로 바꿀 수 있어요."
                              : "이 지식은 보관 상태라 AI 답변 근거에서 제외됩니다. 필요하면 다시 사용으로 바꿀 수 있어요."}
                          </p>
                        ) : null}
                        {needsKnowledgeReview ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                            <p className="font-semibold">검토가 필요한 지식</p>
                            <ul className="mt-1 space-y-1">
                              {quality.conflictCount > 0 ? (
                                <li>
                                  비슷한 질문에 다른 답변이 저장되어 있습니다.
                                </li>
                              ) : null}
                              {quality.duplicateCount > 0 ? (
                                <li>
                                  같은 내용으로 보이는 지식이{" "}
                                  {quality.duplicateCount.toLocaleString(
                                    "ko-KR",
                                  )}
                                  개 더 있습니다.
                                </li>
                              ) : null}
                              {quality.isStale ? (
                                <li>
                                  마지막 수정 후{" "}
                                  {quality.ageDays?.toLocaleString("ko-KR") ??
                                    STORE_KNOWLEDGE_STALE_DAYS.toLocaleString(
                                      "ko-KR",
                                    )}
                                  일 이상 지났습니다.
                                </li>
                              ) : null}
                            </ul>
                            {quality.conflictItems.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                {quality.conflictItems
                                  .slice(0, 2)
                                  .map((conflictItem) => (
                                    <div
                                      key={`${item.id}-${conflictItem.id}`}
                                      className="rounded-md bg-white/70 px-2.5 py-2 ring-1 ring-amber-100 dark:bg-zinc-950/40 dark:ring-amber-900/70"
                                    >
                                      <p className="font-medium">
                                        충돌 질문:{" "}
                                        {truncateSummaryText(
                                          conflictItem.question,
                                          64,
                                        )}
                                      </p>
                                      <p className="mt-1">
                                        다른 답변:{" "}
                                        {truncateSummaryText(
                                          conflictItem.answer,
                                          96,
                                        )}
                                      </p>
                                    </div>
                                  ))}
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleResolveStoreKnowledgeConflicts(
                                      item,
                                      quality.conflictItems,
                                    )
                                  }
                                  disabled={isResolvingConflict || isDeleting}
                                  className={buttonClass(
                                    "warning",
                                    "sm",
                                    "h-8 rounded-lg",
                                  )}
                                >
                                  {isResolvingConflict
                                    ? "정리 중..."
                                    : "이 답변을 기준으로 정리"}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs leading-5 text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold">
                              최근 이 지식이 사용된 답변
                            </p>
                            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-indigo-100 dark:bg-zinc-950/40 dark:ring-indigo-900/70">
                              {recentKnowledgeUsages.length.toLocaleString(
                                "ko-KR",
                              )}
                              건
                            </span>
                          </div>
                          {recentKnowledgeUsages.length > 0 ? (
                            <ul className="mt-2 space-y-2">
                              {recentKnowledgeUsages.map((usage) => (
                                <li
                                  key={`${item.id}-${usage.id}`}
                                  className="rounded-md bg-white/70 px-2.5 py-2 ring-1 ring-indigo-100 dark:bg-zinc-950/40 dark:ring-indigo-900/70"
                                >
                                  <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">
                                      {sourcePlatformLabel(
                                        usage.sourcePlatform,
                                      )}
                                    </span>
                                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-100 dark:bg-zinc-900 dark:text-indigo-200 dark:ring-indigo-900">
                                      {workflowStatusLabel(
                                        normalizeWorkflowStatus(usage.status),
                                      )}
                                    </span>
                                    <time
                                      dateTime={usage.createdAt}
                                      className="text-[11px] text-indigo-700/80 dark:text-indigo-200/80"
                                    >
                                      {formatDate(usage.createdAt)}
                                    </time>
                                  </div>
                                  <p className="font-medium text-indigo-950 dark:text-indigo-100">
                                    문의:{" "}
                                    {truncateSummaryText(
                                      usage.customerMessage,
                                      72,
                                    )}
                                  </p>
                                  <p className="mt-1 text-indigo-800 dark:text-indigo-200">
                                    답변:{" "}
                                    {truncateSummaryText(usage.reply, 96)}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-indigo-800 dark:text-indigo-200">
                              아직 최근 CS 답변에서 사용된 기록이 없습니다. 비슷한
                              문의가 들어오면 이곳에 사용 이력이 쌓입니다.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              void handleSaveStoreKnowledgeItem(item)
                            }
                            disabled={isSaving}
                            className={buttonClass("success", "sm", "h-auto py-1.5")}
                          >
                            {isSaving ? "저장 중..." : "수정 저장"}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelStoreKnowledgeEdit}
                            disabled={isSaving}
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          {!needsKnowledgeReview ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleStartStoreKnowledgeEdit(item)
                                }
                                disabled={isDeleting || isSaving}
                                className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/60 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                              >
                                수정하기
                              </button>
                              {knowledgeStatus === "active" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleUpdateStoreKnowledgeStatus(
                                      item,
                                      "needs_review",
                                    )
                                  }
                                  disabled={isDeleting || isSaving}
                                  className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900/60 dark:bg-zinc-900 dark:text-amber-300 dark:hover:bg-amber-950/30"
                                >
                                  {isSaving ? "처리 중..." : "사용 중지"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleUpdateStoreKnowledgeStatus(
                                      item,
                                      "active",
                                    )
                                  }
                                  disabled={isDeleting || isSaving}
                                  className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/60 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                                >
                                  {isSaving ? "처리 중..." : "다시 사용"}
                                </button>
                              )}
                              {knowledgeStatus !== "archived" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleUpdateStoreKnowledgeStatus(
                                      item,
                                      "archived",
                                    )
                                  }
                                  disabled={isDeleting || isSaving}
                                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                >
                                  {isSaving ? "처리 중..." : "보관"}
                                </button>
                              ) : null}
                            </>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteStoreKnowledgeItem(item)
                            }
                            disabled={isDeleting || isSaving}
                            className={buttonClass("danger", "sm", "h-auto py-1.5")}
                          >
                            {isDeleting ? "삭제 중..." : "삭제"}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section
          id="cs-history"
          className={`${cardClass} scroll-mt-32 ${
            "hidden"
          }`}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                최근 CS 문의
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                저장된 고객 문의와 AI 답변을 최신순으로 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadCsMessages()}
              disabled={csMessagesLoading}
              className={buttonClass("secondary", "sm", "h-auto py-1.5")}
            >
              새로고침
            </button>
          </div>

          {csMessagesError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {csMessagesError}
            </div>
          ) : null}

          {csMessagesLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              CS 문의를 불러오는 중...
            </p>
          ) : csMessages.length === 0 ? (
            <EmptyStateCard
              title="아직 고객 문의 기록이 없습니다"
              description="자주 들어오는 문의를 입력하고 AI 답변을 생성해보세요."
              actionLabel="문의 답변 작성하기"
              onAction={() => goToTabSection("answer", "cs-reply")}
            />
          ) : (
            <>
              <ul className="space-y-4">
              {recentCsMessages.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 shadow-sm dark:border-sky-900/50 dark:bg-sky-950/25"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => void handleDeleteCsMessage(item.id)}
                      disabled={deletingCsMessageId === item.id}
                      className={buttonClass("danger", "sm", "h-auto py-1.5")}
                    >
                      {deletingCsMessageId === item.id ? "삭제 중..." : "삭제"}
                    </button>
                    <time
                      dateTime={item.created_at}
                      className="text-xs text-zinc-500 dark:text-zinc-400"
                    >
                      {formatDate(item.created_at)}
                    </time>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-1 font-medium text-sky-700 dark:text-sky-300">
                        문의
                      </p>
                      <p className="whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.customer_message}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="font-medium text-emerald-700 dark:text-emerald-300">
                          답변
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyText(
                              item.reply,
                              "답변이 복사되었습니다",
                            )
                          }
                          className={copyButtonClass}
                        >
                          복사
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.reply}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
              </ul>
              <p className="pt-2 text-xs text-zinc-500 dark:text-zinc-400">
                최근 5개만 표시 중입니다
              </p>
            </>
          )}
        </section>

        <section
          id="missing-infos"
          className={`${cardClass} scroll-mt-32 ${
            "hidden"
          }`}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                AI가 추가로 확인이 필요한 정보
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                등록된 가게, 상품, 정책 정보만으로 답하기 어려웠던 문의를 모아둡니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadMissingInfos()}
              disabled={missingInfosLoading}
              className={buttonClass("secondary", "sm", "h-auto py-1.5")}
            >
              새로고침
            </button>
          </div>

          {missingInfosError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {missingInfosError}
            </div>
          ) : null}

          {missingInfoResolveMessage ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              {missingInfoResolveMessage}
            </div>
          ) : null}

          {missingInfosLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              확인이 필요한 정보를 불러오는 중...
            </p>
          ) : missingInfos.length === 0 ? (
            <EmptyStateCard
              title="현재 확인이 필요한 정보가 없습니다"
              description="AI가 답변하기 어려운 질문을 발견하면 이곳에 표시됩니다."
              actionLabel="가게 정보 보강하기"
              onAction={() => goToTabSection("store", "store-info")}
            />
          ) : (
            <ul className="space-y-4">
              {missingInfos.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/25"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:ring-amber-800">
                      {item.status}
                    </span>
                    {(item.inquiry_count ?? 1) >= 2 ? (
                      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800 ring-1 ring-orange-200 dark:bg-orange-900/50 dark:text-orange-200 dark:ring-orange-800">
                        관련 문의 총 {item.inquiry_count}건
                      </span>
                    ) : null}
                    <time
                      dateTime={item.created_at}
                      className="text-xs text-zinc-500 dark:text-zinc-400"
                    >
                      {formatDate(item.created_at)}
                    </time>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-900/50 dark:bg-zinc-900">
                      <p className="mb-1 font-medium text-amber-800 dark:text-amber-200">
                        사장님에게 필요한 질문
                      </p>
                      <p className="whitespace-pre-wrap leading-6 text-zinc-800 dark:text-zinc-200">
                        {item.question}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-1 font-medium text-sky-700 dark:text-sky-300">
                        원래 고객 문의
                      </p>
                      <p className="whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.source_message}
                      </p>
                    </div>
                    {item.source_messages && item.source_messages.length > 0 ? (
                      <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                        <p className="mb-2 font-medium text-zinc-700 dark:text-zinc-200">
                          유사 문의 예시
                        </p>
                        <ul className="space-y-1.5 text-zinc-700 dark:text-zinc-300">
                          {item.source_messages.slice(0, 3).map((message) => (
                            <li key={message} className="flex gap-2">
                              <span aria-hidden> - </span>
                              <span className="whitespace-pre-wrap leading-6">
                                {message}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-1 font-medium text-zinc-700 dark:text-zinc-200">
                        필요한 이유
                      </p>
                      <p className="whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.reason}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <label
                        htmlFor={`missing_info_answer_${item.id}`}
                        className="mb-2 block font-medium text-zinc-700 dark:text-zinc-200"
                      >
                        답변 입력
                      </label>
                      <textarea
                        id={`missing_info_answer_${item.id}`}
                        value={missingInfoAnswers[item.id] ?? ""}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setMissingInfoAnswers((currentAnswers) => ({
                            ...currentAnswers,
                            [item.id]: nextValue,
                          }));
                        }}
                        placeholder="예: 선물 포장 가능합니다. 추가 비용은 1,000원입니다."
                        className="min-h-24 w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <label
                        htmlFor={`missing_info_target_${item.id}`}
                        className="mb-2 mt-3 block font-medium text-zinc-700 dark:text-zinc-200"
                      >
                        저장 위치
                      </label>
                      <select
                        id={`missing_info_target_${item.id}`}
                        value={missingInfoTargetFields[item.id] ?? "extra_faq"}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setMissingInfoTargetFields((currentFields) => ({
                            ...currentFields,
                            [item.id]: nextValue,
                          }));
                        }}
                        className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        <option value="extra_faq">기타 FAQ/포장·옵션</option>
                        <option value="product_details">상품 정보</option>
                        <option value="product_caution">
                          주의사항/사용법
                        </option>
                        <option value="shipping_policy">배송 정책</option>
                        <option value="refund_policy">환불 정책</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleResolveMissingInfo(item.id)}
                        disabled={missingInfoResolvingId === item.id}
                        className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-amber-700 px-4 text-sm font-medium text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
                      >
                        {missingInfoResolvingId === item.id
                          ? "반영 중..."
                          : "저장하고 답변에 반영"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className={`${cardClass} scroll-mt-32 border-red-200/70 dark:border-red-900/50 ${
            "hidden"
          }`}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                주의 필요한 리뷰
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                부정 리뷰 중 우선 확인이 필요한 최신 항목입니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={historyLoading}
              className={buttonClass("secondary", "sm", "h-auto py-1.5")}
            >
              새로고침
            </button>
          </div>

          {historyError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {historyError}
            </div>
          ) : null}

          {historyLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              주의 필요한 리뷰를 불러오는 중...
            </p>
          ) : negativeReviews.length === 0 ? (
            <EmptyStateCard
              title="현재 주의가 필요한 부정 리뷰가 없습니다"
              description="부정 리뷰가 생기면 이곳에서 먼저 확인할 수 있습니다."
              actionLabel="리뷰 답글 작성하기"
              onAction={() => goToTabSection("answer", "review-reply")}
            />
          ) : (
            <ul className="space-y-4">
              {negativeReviews.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-xl border p-4 ${sentimentCardClass(item.sentiment)}`}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className={urgentBadgeClass}>우선 확인</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleDeleteReview(item.id)}
                        disabled={deletingReviewId === item.id}
                        className={buttonClass("danger", "sm", "h-auto py-1.5")}
                      >
                        {deletingReviewId === item.id ? "삭제 중..." : "삭제"}
                      </button>
                      <time
                        dateTime={item.created_at}
                        className="text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        {formatDate(item.created_at)}
                      </time>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">
                        리뷰
                      </p>
                      <p className="leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.review}
                      </p>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">
                          답글
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyText(
                              item.reply,
                              "답글이 복사되었습니다",
                            )
                          }
                          className={copyButtonClass}
                        >
                          복사
                        </button>
                      </div>
                      <p className="leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.reply}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ReviewReplyPanel
          isVisible={
            activeTab === "answer" && selectedAnswerMode === "review"
          }
          review={review}
          reply={reply}
          error={error}
          loading={isLoading}
          generationBlocked={answerGenerationBlocked}
          needsStoreInfo={needsStoreInfo}
          onReviewChange={setReview}
          onSubmit={handleReviewSubmit}
          onCopy={() =>
            void handleCopyText(reply, "답글이 복사되었습니다")
          }
        />

        <section
          id="batch-review-reply"
          className={`${cardClass} scroll-mt-32 ${
            activeTab === "answer" && selectedAnswerMode === "batch_review"
              ? "order-[32]"
              : "hidden"
          }`}
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              여러 리뷰 답글 만들기
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              여러 리뷰를 줄바꿈으로 붙여넣으면, 각 리뷰에 맞는 답글을 한
              번에 생성합니다.
            </p>
          </div>

          <form onSubmit={handleBatchReviewSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="batch_reviews"
                className="text-sm font-medium"
              >
                여러 리뷰 입력
              </label>
              <textarea
                id="batch_reviews"
                value={batchReviewsInput}
                onChange={(event) => setBatchReviewsInput(event.target.value)}
                placeholder={[
                  "예: 포장이 깔끔하고 배송도 빨랐어요.",
                  "맛은 좋았는데 양이 조금 아쉬웠어요.",
                  "상품은 예쁜데 배송이 조금 늦었어요.",
                ].join("\n")}
                className="min-h-40 w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                빈 줄은 자동으로 무시되며, 한 번에 최대 10개까지 생성할 수
                있습니다.
              </p>
            </div>

            <button
              type="submit"
              disabled={batchReviewLoading || answerGenerationBlocked}
              className={buttonClass("primary", "lg", "h-11")}
            >
              {batchReviewLoading ? "일괄 생성 중..." : "일괄 답글 생성"}
            </button>

            {needsStoreInfo ? (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                먼저 우리 가게 정보를 등록해주세요
              </p>
            ) : null}

            {batchReviewError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {batchReviewError}
              </div>
            ) : null}
          </form>

          {batchReviewResults.length > 0 ? (
            <div className="mt-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  생성 결과
                </h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  각 답글은 바로 복사해서 실제 플랫폼에 붙여넣을 수 있습니다.
                </p>
              </div>

              <ul className="space-y-4">
                {batchReviewResults.map((item, index) => {
                  const copyStatus = batchReviewCopyMessages[index];

                  return (
                    <li
                      key={`${item.review}-${index}`}
                      className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/20"
                    >
                      {copyStatus ? (
                        <div
                          className={`mb-3 rounded-lg border px-3 py-2 text-xs font-medium ${
                            copyStatus.type === "error"
                              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                          }`}
                          role="status"
                        >
                          {copyStatus.message}
                        </div>
                      ) : null}

                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${sentimentBadgeClass(item.sentiment)}`}
                        >
                          {sentimentLabel(item.sentiment)}
                        </span>
                      </div>

                      <div className="space-y-4 text-sm">
                        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                          <p className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">
                            원본 리뷰
                          </p>
                          <p className="whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">
                            {item.review}
                          </p>
                        </div>
                        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <p className="font-medium text-indigo-700 dark:text-indigo-300">
                              AI 답글
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                void handleBatchReviewCopy(index, item.reply)
                              }
                              className={copyButtonClass}
                            >
                              답글 복사
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">
                            {item.reply}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>

        <section
          id="review-history"
          className={`${cardClass} scroll-mt-32 ${
            "hidden"
          }`}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                리뷰 히스토리
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                저장된 리뷰와 AI 답글을 최신순으로 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={historyLoading}
              className={buttonClass("secondary", "sm", "h-auto py-1.5")}
            >
              새로고침
            </button>
          </div>

          {historyError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {historyError}
            </div>
          ) : null}

          {!historyLoading && stats.negative >= 3 ? (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5 shadow-sm dark:border-amber-900/50 dark:from-amber-950/40 dark:to-orange-950/30"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-sm font-bold text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                !
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  최근 부정 리뷰가 증가하고 있습니다.
                </p>
                <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/80">
                  부정 리뷰 {stats.negative}건 · 빠른 대응이 필요한 항목을
                  확인하세요.
                </p>
              </div>
            </div>
          ) : null}

          {historyLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              히스토리를 불러오는 중...
            </p>
          ) : history.length === 0 ? (
            <EmptyStateCard
              title="아직 리뷰 답글 기록이 없습니다"
              description="고객 리뷰를 입력하고 첫 AI 답글을 생성해보세요."
              actionLabel="리뷰 답글 작성하기"
              onAction={() => goToTabSection("answer", "review-reply")}
            />
          ) : (
            <>
              <ul className="space-y-4">
                {recentReviews.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-xl border p-4 ${sentimentCardClass(item.sentiment)}`}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${sentimentBadgeClass(item.sentiment)}`}
                      >
                        {sentimentLabel(item.sentiment)}
                      </span>
                      {item.sentiment === "negative" ? (
                        <span className={urgentBadgeClass}>
                          긴급 대응 필요
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleDeleteReview(item.id)}
                        disabled={deletingReviewId === item.id}
                        className={buttonClass("danger", "sm", "h-auto py-1.5")}
                      >
                        {deletingReviewId === item.id ? "삭제 중..." : "삭제"}
                      </button>
                      <time
                        dateTime={item.created_at}
                        className="text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        {formatDate(item.created_at)}
                      </time>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">
                        리뷰
                      </p>
                      <p className="leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.review}
                      </p>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">
                          답글
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyText(
                              item.reply,
                              "답글이 복사되었습니다",
                            )
                          }
                          className={copyButtonClass}
                        >
                          복사
                        </button>
                      </div>
                      <p className="leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.reply}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
              </ul>
              <p className="pt-2 text-xs text-zinc-500 dark:text-zinc-400">
                최근 5개만 표시 중입니다
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
