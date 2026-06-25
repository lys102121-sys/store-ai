import type { FormEventHandler } from "react";

import { buttonClass } from "@/app/lib/uiClasses";

type ReviewReplyPanelProps = {
  isVisible: boolean;
  review: string;
  reply: string;
  error: string;
  loading: boolean;
  generationBlocked: boolean;
  needsStoreInfo: boolean;
  onReviewChange: (review: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCopy: () => void;
};

export function ReviewReplyPanel({
  isVisible,
  review,
  reply,
  error,
  loading,
  generationBlocked,
  needsStoreInfo,
  onReviewChange,
  onSubmit,
  onCopy,
}: ReviewReplyPanelProps) {
  return (
    <section
      id="review-reply"
      className={`scroll-mt-32 rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.55)] ring-1 ring-slate-950/[0.04] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75 dark:ring-white/10 sm:p-8 ${
        isVisible ? "order-[31]" : "hidden"
      }`}
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          리뷰 답글
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          리뷰를 붙여넣으면 내용과 사장님 말투에 맞는 답글을 만듭니다.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="review" className="text-sm font-medium">
            리뷰 입력
          </label>
          <textarea
            id="review"
            value={review}
            onChange={(event) => onReviewChange(event.target.value)}
            placeholder="예: 족발이 정말 부드럽고 맛있었어요! 다음에도 주문할게요."
            className="min-h-32 w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        <button
          type="submit"
          disabled={loading || generationBlocked}
          className={buttonClass("primary", "lg", "h-11")}
        >
          {loading ? "생성 중..." : "리뷰 답글 작성하기"}
        </button>

        {needsStoreInfo ? (
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            먼저 우리 가게 정보를 등록해주세요
          </p>
        ) : null}
      </form>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {reply || loading ? (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">AI 답글 출력</h2>
            {reply && !loading ? (
              <button
                type="button"
                onClick={onCopy}
                className={buttonClass("secondary", "sm", "rounded-lg")}
              >
                답글 복사
              </button>
            ) : null}
          </div>
          <div
            className="min-h-28 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            aria-live="polite"
          >
            {loading
              ? "답글을 생성하고 있습니다..."
              : reply || "생성된 답글이 여기에 표시됩니다."}
          </div>
        </div>
      ) : null}
    </section>
  );
}
