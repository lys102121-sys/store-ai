"use client";

import { buttonClass } from "@/app/lib/uiClasses";
import {
  workflowStatusTabClass,
  type WorkflowPlatformFilter,
  type WorkflowStatus,
} from "@/app/lib/workflowUi";

type WorkflowPlatformFilterItem = {
  id: WorkflowPlatformFilter;
  label: string;
  count: number;
};

type WorkflowStatusColumn = {
  status: WorkflowStatus;
  title: string;
  count: number;
};

type AiCsWorkflowInboxControlsProps = {
  platformFilters: WorkflowPlatformFilterItem[];
  selectedPlatform: WorkflowPlatformFilter;
  statusColumns: WorkflowStatusColumn[];
  selectedStatus: WorkflowStatus;
  isPaidPlan: boolean;
  safeApprovalCount: number;
  bulkApproving: boolean;
  bulkApprovalDisabled: boolean;
  onPlatformChange: (platform: WorkflowPlatformFilter) => void;
  onStatusChange: (status: WorkflowStatus) => void;
  onBulkApprove: () => void | Promise<void>;
};

export function AiCsWorkflowInboxControls({
  platformFilters,
  selectedPlatform,
  statusColumns,
  selectedStatus,
  isPaidPlan,
  safeApprovalCount,
  bulkApproving,
  bulkApprovalDisabled,
  onPlatformChange,
  onStatusChange,
  onBulkApprove,
}: AiCsWorkflowInboxControlsProps) {
  return (
    <>
      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          플랫폼 출처
        </p>
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {platformFilters.map((filter) => {
              const isSelected = selectedPlatform === filter.id;

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => onPlatformChange(filter.id)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:focus-visible:ring-blue-950 ${
                    isSelected
                      ? "border-blue-500 bg-blue-600 text-white shadow-sm dark:border-blue-400 dark:bg-blue-500"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/40"
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
          {statusColumns.map((column) => {
            const isSelected = selectedStatus === column.status;

            return (
              <button
                key={column.status}
                type="button"
                onClick={() => onStatusChange(column.status)}
                className={`rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:focus-visible:ring-blue-950 ${workflowStatusTabClass(
                  column.status,
                  isSelected,
                )}`}
                aria-pressed={isSelected}
              >
                <span className="block text-xs font-medium">
                  {column.title}
                </span>
                <span className="mt-1 block text-xl font-semibold sm:text-2xl">
                  {column.count.toLocaleString("ko-KR")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedStatus === "pending" ? (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                안전 항목 일괄 승인
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-800 dark:text-blue-200">
                바로 답해도 안전한 초안만 한 번에 완료합니다. 확인 필요와
                위험 항목은 제외합니다.
              </p>
              <p className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-300">
                {isPaidPlan
                  ? "반복 문의를 빠르게 정리할 수 있습니다."
                  : "유료 도입 후 반복 문의를 한 번에 정리할 수 있습니다."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onBulkApprove()}
              disabled={bulkApprovalDisabled}
              className={buttonClass("success", "lg", "h-11 w-full sm:w-auto")}
            >
              {bulkApproving
                ? "안전 항목 일괄 승인 중..."
                : isPaidPlan
                  ? `안전 항목 ${safeApprovalCount}건 일괄 승인`
                  : "유료 플랜에서 일괄 승인"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
