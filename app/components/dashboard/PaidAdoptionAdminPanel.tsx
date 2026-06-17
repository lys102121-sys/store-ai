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

  return (
    <section className="order-[39] rounded-[1.5rem] border border-violet-200/80 bg-gradient-to-br from-white via-violet-50/70 to-cyan-50/60 p-5 shadow-sm dark:border-violet-900/60 dark:from-zinc-900 dark:via-violet-950/25 dark:to-cyan-950/20 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Internal Sales Inbox
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            도입 상담 요청 관리
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            상담 요청은 우리 운영자/세일즈 담당자가 확인합니다. 상담과 결제가
            끝난 요청을 유료 전환으로 바꾸면 해당 계정의 유료 기능이 열립니다.
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
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
          role="status"
        >
          {error || message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3">
        {loading && requests.length === 0 ? (
          <div className="rounded-2xl border border-white/80 bg-white/75 p-5 text-sm text-zinc-500 shadow-sm dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-400">
            상담 요청을 불러오고 있습니다.
          </div>
        ) : null}

        {!loading && requests.length === 0 ? (
          <div className="rounded-2xl border border-white/80 bg-white/75 p-5 text-sm text-zinc-500 shadow-sm dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-400">
            아직 도입 상담 요청이 없습니다.
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
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-900">
                      {statusLabel(request.status)}
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
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:w-80">
                  <select
                    value={request.status}
                    onChange={(event) =>
                      onStatusChange(request.id, event.currentTarget.value)
                    }
                    disabled={isUpdating}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-violet-950"
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
