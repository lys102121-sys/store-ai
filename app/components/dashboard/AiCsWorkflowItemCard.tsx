"use client";

import { buttonClass } from "@/app/lib/uiClasses";
import { storeKnowledgeCategoryLabel } from "@/app/lib/storeKnowledgeUi";
import {
  handlingTypeBadgeClass,
  handlingTypeLabel,
  platformStatusBadgeClass,
  platformStatusLabel,
  riskLevelBadgeClass,
  riskLevelLabel,
  sourcePlatformLabel,
  workflowAttentionTone,
  workflowCardAttentionClass,
  workflowStatusBadgeClass,
  workflowStatusLabel,
  type HandlingType,
  type PlatformStatus,
  type RiskLevel,
  type SourcePlatform,
  type WorkflowItemType,
  type WorkflowStatus,
} from "@/app/lib/workflowUi";

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
  editingReply: string;
  missingInfoAnswer: string;
  missingInfoTargetField: string;
  isResolvingMissingInfo: boolean;
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
    return "답변에 필요한 정보가 비어 있어 멈췄습니다. 답을 입력하면 다음 비슷한 문의에 다시 씁니다.";
  }

  if (item.usedKnowledgeItems.some(isStoreInfoEvidenceItem)) {
    return "저장된 상품/정책/FAQ를 근거로 썼습니다. 검토 필요 지식은 제외했습니다.";
  }

  if (item.usedKnowledgeItems.length > 0) {
    return "사장님이 알려준 지식을 답변 근거로 함께 썼습니다.";
  }

  if (item.handlingType === "auto_ready") {
    return "저장된 정보만으로 답변 가능하다고 판단했습니다.";
  }

  if (item.riskLevel === "high") {
    return "위험 신호가 있어 답변 전 확인이 필요합니다.";
  }

  if (item.handlingType === "needs_review") {
    return "정보가 부족하거나 정확한 확인이 필요합니다.";
  }

  if (item.handlingType === "needs_approval") {
    return "고객 상황에 맞는지 승인 전 확인하세요.";
  }

  return "저장된 가게 정보를 참고해 초안을 만들었습니다.";
}

function workflowNextActionMessage(
  item: AiCsWorkflowItemCardItem,
  isCompleted: boolean,
  isAutoCompleted: boolean,
) {
  if (item.type === "missing_info") {
    return "답을 입력하면 가게 지식에 저장하고 관련 문의 답변에 반영합니다.";
  }

  if (isAutoCompleted) {
    return "AI가 안전하다고 판단해 자동 완료한 항목입니다.";
  }

  if (isCompleted) {
    return "처리가 끝난 답변입니다. 필요하면 복사하거나 수정하세요.";
  }

  if (item.riskLevel === "high") {
    return "위험도가 높습니다. 답변 전 내용을 꼭 확인하세요.";
  }

  if (item.handlingType === "needs_approval") {
    return "승인 필수 항목입니다. 초안을 확인한 뒤 승인하세요.";
  }

  if (item.handlingType === "needs_review") {
    return "정보 확인이 필요합니다. 부족한 기준이 없는지 먼저 보세요.";
  }

  if (item.handlingType === "auto_ready" && item.riskLevel === "low") {
    return "바로 답변 가능한 낮은 위험도 항목입니다.";
  }

  return "초안을 확인한 뒤 승인하거나 수정하세요.";
}

const copyButtonClass = buttonClass("secondary", "sm", "rounded-lg");

const workflowCardSectionClass =
  "rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5";

const workflowCardDetailClass =
  "rounded-xl border px-4 py-3 text-xs leading-5";

export function AiCsWorkflowItemCard({
  item,
  isEditing,
  isUpdating,
  isDeleting,
  editingReply,
  missingInfoAnswer,
  missingInfoTargetField,
  isResolvingMissingInfo,
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
  const isDemoData = isDemoExternalId(item.externalId);
  const evidenceTitle = workflowEvidenceTitle(item);
  const evidenceMessage = workflowEvidenceMessage(item);
  const nextActionMessage = workflowNextActionMessage(
    item,
    isCompleted,
    isAutoCompleted,
  );
  const primaryUsedKnowledgeItem = item.usedKnowledgeItems[0] ?? null;
  const canApproveWorkflowItem =
    !isCompleted && item.canMutate && item.type !== "missing_info";

  return (
    <article
      className={`flex h-full flex-col rounded-[1.35rem] border bg-white/90 p-4 shadow-[0_18px_65px_-48px_rgba(15,23,42,0.65)] ring-1 ring-slate-950/[0.03] backdrop-blur-xl transition dark:bg-slate-950/70 dark:ring-white/10 sm:p-5 ${workflowCardAttentionClass(
        attentionTone,
      )}`}
    >
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200/70 pb-4 dark:border-white/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10">
              {item.typeLabel}
            </span>
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10">
              {sourcePlatformLabel(item.sourcePlatform)}
            </span>
            {isDemoData ? (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 ring-1 ring-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-900">
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
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${platformStatusBadgeClass(
                item.platformStatus,
              )}`}
            >
              {platformStatusLabel(item.platformStatus)}
            </span>
          </div>
          <time
            dateTime={item.createdAt}
            className="shrink-0 text-xs leading-6 text-slate-500 dark:text-slate-400"
          >
            {formatDate(item.createdAt)}
          </time>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm leading-6 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
          <span className="font-semibold">지금 할 일: </span>
          {nextActionMessage}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="space-y-3 text-sm">
          <div className={workflowCardSectionClass}>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
              <div className="mb-2 flex items-center justify-between gap-3">
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
                  className="min-h-32 w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
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
          <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-xs leading-5 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              <div className="flex flex-wrap gap-2">
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
              </div>
              <div className="mt-3 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-950/50 dark:ring-white/10">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  판단 요약
                </p>
                <p className="mt-1">
                  <span className="font-semibold">AI 판단 이유: </span>
                  {item.aiReason || evidenceMessage}
                </p>
                {item.aiReason ? (
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    {evidenceMessage}
                  </p>
                ) : null}
                {item.usedKnowledgeItems.length > 0 ? (
                  <p className="mt-2 text-slate-500 dark:text-slate-400">
                    {evidenceTitle} ·{" "}
                    <span className="font-semibold">
                      참고 근거{" "}
                      {item.usedKnowledgeItems.length.toLocaleString("ko-KR")}개
                    </span>
                  </p>
                ) : null}
                {primaryUsedKnowledgeItem ? (
                  <p className="mt-2 rounded-lg bg-blue-50 px-2.5 py-2 text-blue-800 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/70">
                    <span className="font-semibold">
                      {storeKnowledgeCategoryLabel(
                        primaryUsedKnowledgeItem.category,
                      )}
                    </span>
                    {" · "}
                    {truncateSummaryText(primaryUsedKnowledgeItem.question, 48)}
                    {item.usedKnowledgeItems.length > 1
                      ? ` 외 ${item.usedKnowledgeItems.length - 1}개`
                      : ""}
                  </p>
                ) : null}
              </div>
            </div>

            {isDemoData ? (
              <p
                className={`${workflowCardDetailClass} border-blue-200 bg-blue-50 font-medium text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200`}
              >
                {item.platformStatus === "posted"
                  ? "샘플 데이터가 등록 완료 상태로 처리됐습니다. 실제 등록은 연동 단계에서 연결됩니다."
                  : "실제 플랫폼 데이터가 아닌 체험용 샘플입니다."}
              </p>
            ) : null}

            {!isDemoData &&
            item.sourcePlatform !== "manual" &&
            item.platformStatus === "posted" ? (
              <p className="px-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                플랫폼 등록 완료 상태입니다. 실제 등록 API는 연동 단계에서 연결됩니다.
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
                    "rounded-lg text-blue-700 dark:text-blue-300",
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
