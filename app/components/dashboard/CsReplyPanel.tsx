import type { FormEventHandler } from "react";

import { buttonClass } from "@/app/lib/uiClasses";

type CsReplyPanelProps = {
  isVisible: boolean;
  customerMessage: string;
  reply: string;
  error: string;
  loading: boolean;
  generationBlocked: boolean;
  needsStoreInfo: boolean;
  onMessageChange: (message: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCopy: () => void;
};

export function CsReplyPanel({
  isVisible,
  customerMessage,
  reply,
  error,
  loading,
  generationBlocked,
  needsStoreInfo,
  onMessageChange,
  onSubmit,
  onCopy,
}: CsReplyPanelProps) {
  const showResult = Boolean(reply || loading);

  return (
    <section
      id="cs-reply"
      className={`scroll-mt-32 rounded-[1.75rem] border border-white/70 border-sky-200/70 bg-white/90 p-6 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.55)] ring-1 ring-slate-950/[0.04] backdrop-blur-xl dark:border-sky-900/50 dark:bg-slate-950/75 dark:ring-white/10 sm:p-8 ${
        isVisible ? "order-[30]" : "hidden"
      }`}
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          고객 문의 답변
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          문의를 붙여넣으면 등록된 가게 정보를 기준으로 답변을 만듭니다. 모르는
          내용은 추측하지 않고 확인 필요로 분리합니다.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className={
          showResult
            ? "grid gap-5 lg:grid-cols-[1.05fr_0.95fr]"
            : "space-y-5"
        }
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="customer_message" className="text-sm font-medium">
              고객 문의 입력
            </label>
            <textarea
              id="customer_message"
              value={customerMessage}
              onChange={(event) => onMessageChange(event.target.value)}
              placeholder="예: 제주도 배송비 얼마예요? / 환불 가능한가요? / 오늘 출고되나요?"
              className="min-h-36 w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>

          <button
            type="submit"
            disabled={loading || generationBlocked}
            className={buttonClass("primary", "lg", "h-11")}
          >
            {loading ? "생성 중..." : "문의 답변 작성하기"}
          </button>

          {needsStoreInfo ? (
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              먼저 우리 가게 정보를 등록해주세요
            </p>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : null}
        </div>

        {showResult ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">생성된 CS 답변</h3>
              <div className="flex items-center gap-2">
                {reply && !loading ? (
                  <button
                    type="button"
                    onClick={onCopy}
                    className={buttonClass("secondary", "sm", "rounded-lg")}
                  >
                    답변 복사
                  </button>
                ) : null}
                {loading ? (
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    작성 중
                  </span>
                ) : null}
              </div>
            </div>
            <div
              className="min-h-56 whitespace-pre-wrap rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm leading-6 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              aria-live="polite"
            >
              {loading
                ? "고객 문의에 맞는 답변을 생성하고 있습니다..."
                : reply}
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}
