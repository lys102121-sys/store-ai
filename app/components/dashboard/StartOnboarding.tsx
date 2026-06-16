import { buttonClass } from "@/app/lib/uiClasses";

export type StartGuideItem = {
  id: string;
  step: string;
  title: string;
  isComplete: boolean;
};

export type StartRecommendedAction = {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

export type StartPaidAdoptionAction = {
  title: string;
  description: string;
  highlights: string[];
  actionLabel: string;
  onAction: () => void;
  isLoading: boolean;
  message: string;
  error: string;
};

type StartOnboardingProps = {
  isVisible: boolean;
  guideItems: StartGuideItem[];
  recommendedAction: StartRecommendedAction;
  actionLoading: boolean;
  paidAdoptionAction: StartPaidAdoptionAction;
};

export function StartOnboarding({
  isVisible,
  guideItems,
  recommendedAction,
  actionLoading,
  paidAdoptionAction,
}: StartOnboardingProps) {
  const completedCount = guideItems.filter((item) => item.isComplete).length;
  const progressPercent = Math.round(
    (completedCount / guideItems.length) * 100,
  );
  const nextItem =
    guideItems.find((item) => !item.isComplete) ??
    guideItems[guideItems.length - 1];

  return (
    <section
      className={`overflow-hidden rounded-[2rem] border border-white/75 bg-white/90 shadow-[0_35px_120px_-65px_rgba(15,23,42,0.75)] ring-1 ring-slate-950/[0.04] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75 dark:ring-white/10 ${
        isVisible ? "order-[10]" : "hidden"
      }`}
    >
      <div className="relative grid gap-6 overflow-hidden p-6 sm:p-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-200/60 blur-3xl dark:bg-indigo-600/20" />
        <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-cyan-200/60 blur-3xl dark:bg-cyan-500/15" />
        <div className="relative">
          <p className="mb-4 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-200 dark:ring-indigo-900">
            AI 운영 도우미
          </p>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            사장님 대신 밤에도 일하는
            <span className="block bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
              AI CS 직원
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
            문의와 리뷰의 답변 초안을 만들고, 위험하거나 모르는 내용은
            사장님에게 확인합니다. 알려준 정보는 다음 응대에 다시 활용합니다.
          </p>
          <div className="mt-7 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-5 dark:border-indigo-900/60 dark:bg-indigo-950/25">
            <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
              {recommendedAction.eyebrow} · 지금 할 일
            </p>
            <h2 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
              {recommendedAction.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {recommendedAction.description}
            </p>
            <button
              type="button"
              onClick={recommendedAction.onAction}
              disabled={actionLoading}
              className={buttonClass("primary", "lg", "mt-4 font-bold")}
            >
              {actionLoading ? "처리 중..." : recommendedAction.actionLabel}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/25">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  유료 도입 상담
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
                  {paidAdoptionAction.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {paidAdoptionAction.description}
                </p>
              </div>
              <ul className="rounded-xl border border-white/80 bg-white/85 px-4 py-3 text-left text-xs leading-5 text-slate-600 shadow-sm dark:border-emerald-900/60 dark:bg-slate-950/70 dark:text-slate-300 sm:min-w-52">
                {paidAdoptionAction.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-2">
                    <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={paidAdoptionAction.onAction}
              disabled={paidAdoptionAction.isLoading}
              className={buttonClass("success", "lg", "mt-4 font-bold")}
            >
              {paidAdoptionAction.isLoading
                ? "저장 중..."
                : paidAdoptionAction.actionLabel}
            </button>
            {paidAdoptionAction.message || paidAdoptionAction.error ? (
              <p
                className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                  paidAdoptionAction.error
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                    : "border-emerald-200 bg-white/80 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                }`}
                role="status"
              >
                {paidAdoptionAction.error || paidAdoptionAction.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative rounded-[1.35rem] border border-white/75 bg-white/80 p-5 shadow-[0_24px_70px_-45px_rgba(79,70,229,0.55)] ring-1 ring-slate-950/[0.03] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 dark:ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                시작 준비
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {completedCount}/{guideItems.length}단계 완료
              </p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-950 dark:text-indigo-200 dark:ring-indigo-900">
              {progressPercent}%
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-400 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <ol className="mt-5 space-y-2">
            {guideItems.map((item) => {
              const isNextStep = !item.isComplete && nextItem.id === item.id;

              return (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${
                    isNextStep
                      ? "bg-indigo-50 font-semibold text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-100"
                      : "text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      item.isComplete
                        ? "bg-emerald-600 text-white"
                        : isNextStep
                          ? "bg-indigo-700 text-white"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {item.isComplete ? "✓" : item.step}
                  </span>
                  <span className="min-w-0 flex-1">{item.title}</span>
                  {isNextStep ? (
                    <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                      다음
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
