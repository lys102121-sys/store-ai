"use client";

import { buttonClass } from "@/app/lib/uiClasses";

type WorkflowStatus = "pending" | "needs_review" | "completed" | "answered";
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
type WorkflowItemType = "cs" | "review" | "missing_info";

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

type UsedKnowledgeItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

export type AiCsWorkflowItemCardItem = {
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

type WorkflowItemPatch = {
  reply?: string;
  status?: WorkflowStatus;
};

type AiCsWorkflowItemCardProps = {
  item: AiCsWorkflowItemCardItem;
  isEditing: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isDetailExpanded: boolean;
  editingReply: string;
  missingInfoAnswer: string;
  missingInfoTargetField: string;
  isResolvingMissingInfo: boolean;
  onToggleDetail: (itemKey: string) => void;
  onCopyReply: (reply: string) => void;
  onEditingReplyChange: (value: string) => void;
  onMissingInfoAnswerChange: (itemId: string, value: string) => void;
  onMissingInfoTargetFieldChange: (itemId: string, value: string) => void;
  onResolveMissingInfo: (itemId: string) => void | Promise<void>;
  onUpdateItem: (
    item: AiCsWorkflowItemCardItem,
    patch: WorkflowItemPatch,
  ) => void | Promise<void>;
  onDeleteItem: (item: AiCsWorkflowItemCardItem) => void | Promise<void>;
  onStartEdit: (item: AiCsWorkflowItemCardItem) => void;
  onCancelEdit: () => void;
  formatDate: (value: string) => string;
};

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

function handlingTypeBadgeClass(value: HandlingType) {
  return value === "auto_ready"
    ? semanticBadgeClass("success")
    : semanticBadgeClass("warning");
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

function isStoreInfoEvidenceItem(item: UsedKnowledgeItem) {
  return item.id.startsWith("store:");
}

function isDemoExternalId(value?: string | null) {
  return value?.startsWith("mock-") ?? false;
}

function truncateSummaryText(value: string, maxLength = 64) {
  const normalizedValue = value.trim().replace(/\s+/g, " ");

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength)}...`;
}

function workflowEvidenceTitle(item: AiCsWorkflowItemCardItem) {
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

function workflowEvidenceMessage(item: AiCsWorkflowItemCardItem) {
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

const copyButtonClass = buttonClass("secondary", "sm", "rounded-lg");

const workflowCardSectionClass =
  "rounded-xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5";

const workflowCardDetailClass =
  "rounded-xl border px-4 py-3 text-xs leading-5";

export function AiCsWorkflowItemCard({
  item,
  isEditing,
  isUpdating,
  isDeleting,
  isDetailExpanded,
  editingReply,
  missingInfoAnswer,
  missingInfoTargetField,
  isResolvingMissingInfo,
  onToggleDetail,
  onCopyReply,
  onEditingReplyChange,
  onMissingInfoAnswerChange,
  onMissingInfoTargetFieldChange,
  onResolveMissingInfo,
  onUpdateItem,
  onDeleteItem,
  onStartEdit,
  onCancelEdit,
  formatDate,
}: AiCsWorkflowItemCardProps) {
  const isAutoCompleted =
    (item.status === "completed" || item.status === "answered") &&
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
  const canApproveWorkflowItem =
    !isCompleted && item.canMutate && item.type !== "missing_info";

  return (
    <article
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
                          <span className="text-slate-400" aria-hidden>
                            •
                          </span>
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
                  value={missingInfoAnswer}
                  onChange={(event) =>
                    onMissingInfoAnswerChange(String(item.id), event.target.value)
                  }
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
                  value={missingInfoTargetField}
                  onChange={(event) =>
                    onMissingInfoTargetFieldChange(
                      String(item.id),
                      event.target.value,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="extra_faq">기타 FAQ/포장·옵션</option>
                  <option value="product_details">상품 정보</option>
                  <option value="product_caution">주의사항/사용법</option>
                  <option value="shipping_policy">배송 정책</option>
                  <option value="refund_policy">환불 정책</option>
                </select>
                <button
                  type="button"
                  onClick={() => void onResolveMissingInfo(String(item.id))}
                  disabled={isResolvingMissingInfo}
                  className={buttonClass(
                    "warning",
                    "md",
                    "mt-4 w-full sm:w-auto",
                  )}
                >
                  {isResolvingMissingInfo
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
                  onClick={() => onCopyReply(item.reply)}
                  className={copyButtonClass}
                >
                  복사
                </button>
              </div>

              {isEditing ? (
                <textarea
                  value={editingReply}
                  onChange={(event) => onEditingReplyChange(event.target.value)}
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
            onClick={() => onToggleDetail(item.key)}
            className={buttonClass(
              "secondary",
              "sm",
              "mt-4 h-8 w-fit rounded-lg",
            )}
            aria-expanded={isDetailExpanded}
          >
            {isDetailExpanded ? "자세히 접기" : "자세히 보기"}
          </button>
        ) : null}

        {isDetailExpanded ? (
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
                {item.handlingType === "auto_ready" && !isCompleted ? (
                  <p className="mt-2 text-emerald-700 dark:text-emerald-300">
                    AI가 바로 답변 가능하다고 판단했습니다.
                  </p>
                ) : null}
                {isAutoCompleted ? (
                  <p className="mt-2 text-emerald-700 dark:text-emerald-300">
                    AI가 낮은 위험도의 바로 답변 가능한 항목으로 판단해 자동
                    완료 처리했습니다.
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
                <p className="font-semibold">{evidenceTitle}</p>
                {item.usedKnowledgeItems.length > 0 ? (
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-current/10 dark:bg-zinc-950/40">
                    참고 근거{" "}
                    {item.usedKnowledgeItems.length.toLocaleString("ko-KR")}개
                  </span>
                ) : null}
              </div>
              <p className="mt-2">{evidenceMessage}</p>
              {item.usedKnowledgeItems.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {item.usedKnowledgeItems.slice(0, 3).map((knowledgeItem) => (
                    <li
                      key={`${item.key}-${knowledgeItem.id}`}
                      className="rounded-md bg-white/70 px-2.5 py-2 ring-1 ring-emerald-100 dark:bg-zinc-950/40 dark:ring-emerald-900/70"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                          {storeKnowledgeCategoryLabel(knowledgeItem.category)}
                        </span>
                        <span className="font-medium">
                          {truncateSummaryText(knowledgeItem.question, 56)}
                        </span>
                      </div>
                      <p className="text-emerald-800 dark:text-emerald-200">
                        {truncateSummaryText(knowledgeItem.answer, 100)}
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
                <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
              </p>
              <p className="min-w-0 sm:text-right">
                플랫폼 상태: {platformStatusLabel(item.platformStatus)}
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
                승인 완료되어 플랫폼 등록 완료 상태로 표시됩니다. 실제 플랫폼 API
                등록은 연동 단계에서 연결될 예정입니다.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-3 border-t border-slate-200/70 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          {item.type === "missing_info" ? (
            <button
              type="button"
              onClick={() => void onDeleteItem(item)}
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
                onClick={() => void onUpdateItem(item, { reply: editingReply })}
                disabled={isUpdating}
                className={buttonClass("primary", "sm", "rounded-lg")}
              >
                {isUpdating ? "저장 중..." : "수정 저장"}
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
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
                  onClick={() => void onUpdateItem(item, { status: "completed" })}
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
                  onClick={() => onStartEdit(item)}
                  disabled={!item.canMutate || isUpdating}
                  className={buttonClass(
                    "secondary",
                    "sm",
                    "rounded-lg text-indigo-700 dark:text-indigo-300",
                  )}
                >
                  수정하기
                </button>
                {!isCompleted && item.status !== "needs_review" ? (
                  <button
                    type="button"
                    onClick={() =>
                      void onUpdateItem(item, { status: "needs_review" })
                    }
                    disabled={!item.canMutate || isUpdating}
                    className={buttonClass("warning", "sm", "rounded-lg")}
                  >
                    확인 필요
                  </button>
                ) : null}
                {isCompleted && item.canMutate && isDetailExpanded ? (
                  <button
                    type="button"
                    onClick={() =>
                      void onUpdateItem(item, { status: "needs_review" })
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
                  onClick={() => void onDeleteItem(item)}
                  disabled={isUpdating || isDeleting}
                  className={buttonClass("danger", "sm", "rounded-lg")}
                >
                  삭제
                </button>
              </div>
            </>
          )}
        </div>

        {!item.canMutate && item.type !== "missing_info" ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            missing_infos에서 온 확인 필요 항목입니다. 아래 확인 필요 정보
            섹션에서 내용을 보강해 주세요.
          </p>
        ) : null}
      </div>
    </article>
  );
}
