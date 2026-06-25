"use client";

type AiCsWorkflowInboxEmptyStateProps = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

export function AiCsWorkflowInboxEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: AiCsWorkflowInboxEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-5 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
      <p className="mx-auto mb-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700">
        지금 할 일
      </p>
      <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-zinc-500 dark:text-zinc-500">
        먼저 샘플 문의를 넣어보면 AI가 초안 작성, 확인 필요 판단, 승인 완료까지
        어떻게 처리하는지 바로 볼 수 있습니다.
      </p>
      <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {actionLabel}
        </button>
        {secondaryActionLabel && onSecondaryAction ? (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {secondaryActionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
