"use client";

import { buttonClass } from "@/app/lib/uiClasses";

export type AdminPaidAdoptionRequest = {
  id: string;
  user_id: string;
  status: string;
  source: string;
  store_name: string | null;
  estimated_saved_minutes_today: number | null;
  estimated_saved_minutes_30d: number | null;
  workflow_items_30d: number | null;
  auto_completed_30d: number | null;
  needs_review_active: number | null;
  platform_items_30d: number | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type PaidAdoptionAdminPanelProps = {
  isVisible: boolean;
  requests: AdminPaidAdoptionRequest[];
  loading: boolean;
  error: string;
  message: string;
  updatingRequestId: string | null;
  onRefresh: () => void;
  onStatusChange: (requestId: string, status: string) => void;
};

const statusOptions = [
  { value: "requested", label: "요청 접수" },
  { value: "contacted", label: "상담 중" },
  { value: "active", label: "유료 전환" },
  { value: "cancelled", label: "보류/취소" },
] as const;

const paidFeatureItems = [
  "무료 답변 한도 해제",
  "실제 플랫폼 문의 가져오기",
  "AI 답변 등록/승인 운영",
  "자동 완료와 안전 항목 일괄 승인",
];

function statusLabel(status: string) {
  return (
    statusOptions.find((option) => option.value === status)?.label ?? status
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function numberValue(value: number | null) {
  return Math.max(0, value ?? 0).toLocaleString("ko-KR");
}

function statusCount(requests: AdminPaidAdoptionRequest[], status: string) {
  return requests.filter((request) => request.status === status).length;
}

function adoptionPriorityLabel(request: AdminPaidAdoptionRequest) {
  if (request.status === "active") return "유료 계정";
  if (request.status === "cancelled") return "보류";

  const score =
    (request.workflow_items_30d ?? 0) +
    (request.platform_items_30d ?? 0) * 2 +
    (request.needs_review_active ?? 0) * 2 +
    (request.auto_completed_30d ?? 0);

  if (score >= 30) return "전환 우선";
  if (score >= 10) return "상담 우선";
  if (score > 0) return "체험 진행 중";
  return "초기 문의";
}

function adoptionNextAction(status: string) {
  if (status === "requested") {
    return "먼저 연락해 도입 범위와 결제 의사를 확인하고, 대화가 시작되면 상담 중으로 바꾸세요.";
  }

  if (status === "contacted") {
    return "플랫폼 연동 범위와 결제가 확정되면 유료 전환을 눌러 계정 기능을 열어주세요.";
  }

  if (status === "active") {
    return "유료 기능이 열린 계정입니다. 플랫폼 연동 설정과 자동 처리 운영을 이어가면 됩니다.";
  }

  if (status === "cancelled") {
    return "보류된 요청입니다. 다시 진행하기로 하면 요청 접수 또는 상담 중으로 되돌릴 수 있습니다.";
  }

  return "상담 상태를 확인하고 다음 처리 단계로 바꿔주세요.";
}

export function PaidAdoptionAdminPanel({
  isVisible,
  requests,
  loading,
  error,
  message,
  updatingRequestId,
  onRefresh,
  onStatusChange,
}: PaidAdoptionAdminPanelProps) {
  if (!isVisible) return null;

  const statusSummaryItems = statusOptions.map((option) => ({
    ...option,
    count: statusCount(requests, option.value),
  }));

  return (
    <section className="order-[39] rounded-[1.5rem] border border-blue-200/80 bg-gradient-to-br from-white via-blue-50/70 to-blue-50/60 p-5 shadow-sm dark:border-blue-900/60 dark:from-zinc-900 dark:via-blue-950/25 dark:to-blue-950/20 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Internal Sales Inbox
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            도입 상담 요청 관리
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            상담 요청은 우리 운영자/세일즈 담당자가 확인합니다. 상담과 결제가
            끝난 요청을 유료 전환으로 바꾸면 해당 계정의 유료 기능이 열립니다.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            요청 접수 → 상담 중 → 유료 전환 순서로 관리하면 무료 체험 사용자를
            실제 결제 고객으로 넘기기 쉽습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={buttonClass("secondary", "sm")}
        >
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      {message || error ? (
        <p
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
          }`}
          role="status"
        >
          {error || message}
        </p>
      ) : null}

      {requests.length > 0 ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-2 sm:grid-cols-4">
            {statusSummaryItems.map((item) => (
              <div
                key={item.value}
                className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-zinc-950/60"
              >
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {item.label}
                </p>
                <p className="mt-1 text-xl font-black text-zinc-950 dark:text-zinc-50">
                  {item.count.toLocaleString("ko-KR")}건
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-blue-200/80 bg-blue-50/80 p-4 text-sm shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
            <p className="font-bold text-blue-900 dark:text-blue-100">
              유료 전환 시 열리는 기능
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {paidFeatureItems.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-100 dark:bg-zinc-950/50 dark:text-blue-200 dark:ring-blue-900"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {loading && requests.length === 0 ? (
          <div className="rounded-2xl border border-white/80 bg-white/75 p-5 text-sm text-zinc-500 shadow-sm dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-400">
            상담 요청을 불러오고 있습니다.
          </div>
        ) : null}

        {!loading && requests.length === 0 ? (
          <div className="rounded-2xl border border-white/80 bg-white/75 p-5 text-sm text-zinc-500 shadow-sm dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-400">
            아직 도입 상담 요청이 없습니다. 시작하기 화면에서 사용자가 도입 상담
            요청을 누르면 이곳에 쌓입니다.
          </div>
        ) : null}

        {requests.map((request) => {
          const isUpdating = updatingRequestId === request.id;

          return (
            <article
              key={request.id}
              className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950/70"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-900">
                      {statusLabel(request.status)}
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-900">
                      {adoptionPriorityLabel(request)}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {formatDateTime(request.updated_at)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-zinc-950 dark:text-zinc-50">
                    {request.store_name?.trim() || "가게명 미입력"}
                  </h3>
                  <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">
                    user_id: {request.user_id}
                  </p>
                  {request.memo ? (
                    <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                      {request.memo}
                    </p>
                  ) : null}
                  <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-2 text-sm leading-6 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-200">
                    다음 처리: {adoptionNextAction(request.status)}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:w-80">
                  <select
                    value={request.status}
                    onChange={(event) =>
                      onStatusChange(request.id, event.currentTarget.value)
                    }
                    disabled={isUpdating}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-blue-950"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onStatusChange(request.id, "active")}
                    disabled={isUpdating || request.status === "active"}
                    className={buttonClass("success", "sm")}
                  >
                    {isUpdating ? "처리 중..." : "유료 전환"}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs sm:grid-cols-5">
                <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
                  <p className="text-zinc-500 dark:text-zinc-400">30일 처리</p>
                  <p className="mt-1 font-bold text-zinc-900 dark:text-zinc-100">
                    {numberValue(request.workflow_items_30d)}건
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
                  <p className="text-zinc-500 dark:text-zinc-400">자동 완료</p>
                  <p className="mt-1 font-bold text-zinc-900 dark:text-zinc-100">
                    {numberValue(request.auto_completed_30d)}건
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
                  <p className="text-zinc-500 dark:text-zinc-400">확인 필요</p>
                  <p className="mt-1 font-bold text-zinc-900 dark:text-zinc-100">
                    {numberValue(request.needs_review_active)}건
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
                  <p className="text-zinc-500 dark:text-zinc-400">플랫폼</p>
                  <p className="mt-1 font-bold text-zinc-900 dark:text-zinc-100">
                    {numberValue(request.platform_items_30d)}건
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
                  <p className="text-zinc-500 dark:text-zinc-400">30일 시간</p>
                  <p className="mt-1 font-bold text-zinc-900 dark:text-zinc-100">
                    {numberValue(request.estimated_saved_minutes_30d)}분
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
