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
