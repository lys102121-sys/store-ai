import { buttonClass } from "@/app/lib/uiClasses";

export type StartGuideItem = {
  id: string;
  step: string;
  title: string;
  description: string;
  isComplete: boolean;
  actionLabel: string;
  onAction: () => void;
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
  statusLabel?: string;
  statusDescription?: string;
  updatedAtLabel?: string;
  statusActionLabel?: string;
  onStatusAction?: () => void;
};

type StartOnboardingProps = {
  isVisible: boolean;
  guideItems: StartGuideItem[];
  recommendedAction: StartRecommendedAction;
  actionLoading: boolean;
  paidAdoptionAction: StartPaidAdoptionAction;
};

const trustHighlights = [
  {
    label: "안전",
    title: "모르면 멈추고 물어봅니다",
    description:
      "가격, 재고, 환불, 건강 이슈처럼 정확해야 하는 질문은 바로 답하지 않습니다.",
  },
  {
    label: "학습",
    title: "사장님 답변을 배웁니다",
    description:
      "사장님이 알려준 답과 수정한 문장을 다음 비슷한 문의에 다시 씁니다.",
  },
  {
    label: "운영",
    title: "할 일을 처리함에 모읍니다",
    description:
      "확인 필요, 승인 대기, 답변 완료를 업무판처럼 나눠 보여줍니다.",
  },
] as const;

const workflowPreviewCards = [
  {
    badge: "1단계",
    title: "도입 상담을 요청합니다",
    body: "우리 가게 플랫폼과 문의량에 맞춰 어떤 일을 AI가 맡을지 먼저 정합니다.",
  },
  {
    badge: "2단계",
    title: "가게 지식을 연결합니다",
    body: "상품, 정책, 말투, 확인 필요 답변을 실제 고객 응대 기준으로 저장합니다.",
  },
  {
    badge: "3단계",
    title: "AI CS 처리함으로 운영합니다",
    body: "문의와 리뷰를 모아 답변 가능 여부, 위험도, 승인 상태까지 관리합니다.",
  },
] as const;

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
      className={`overflow-hidden rounded-[2rem] border border-white/75 bg-white shadow-[0_35px_120px_-65px_rgba(15,23,42,0.8)] ring-1 ring-slate-950/[0.04] dark:border-white/10 dark:bg-slate-950 dark:ring-white/10 ${
        isVisible ? "order-[10]" : "hidden"
      }`}
    >
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f4fbff_50%,#eef2ff_100%)] p-5 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,#020617_0%,#0f172a_58%,#111827_100%)] sm:p-8">
        <div className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full bg-blue-300/35 blur-3xl dark:bg-blue-500/15" />
        <div className="pointer-events-none absolute bottom-[-10rem] left-1/4 h-80 w-80 rounded-full bg-blue-300/35 blur-3xl dark:bg-blue-500/15" />

        <div className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]" />
            처음부터 실제 운영 연결을 전제로 시작합니다
          </span>
          <span>도입 상담 · 가게 지식 세팅 · 플랫폼 연동 준비</span>
        </div>

        <div className="relative mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-stretch">
          <div className="flex min-h-full flex-col justify-between rounded-[1.6rem] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/55 sm:p-7">
            <div>
              <p className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/55 dark:text-blue-200 dark:ring-blue-900">
                AI CS Employee
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-5xl">
                고객 응대 일을 줄이는
                <span className="block bg-gradient-to-r from-blue-600 via-blue-600 to-blue-600 bg-clip-text text-transparent">
                  AI CS 직원을 도입하세요
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
                둘러보기용 도구가 아니라, 실제 문의와 리뷰를 줄이기
                위한 운영 시스템으로 시작합니다. 가게 정보와 플랫폼을 연결하면
                AI가 답변 초안, 위험도, 확인 필요 업무를 처리함에 정리합니다.
              </p>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {trustHighlights.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/55"
                >
                  <p className="text-[11px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    {item.label}
                  </p>
                  <h2 className="mt-2 text-sm font-bold text-slate-950 dark:text-white">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-[1.6rem] border border-slate-200/90 bg-slate-950 p-5 text-white shadow-[0_24px_70px_-45px_rgba(15,23,42,0.9)] dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-blue-300">지금 할 일</p>
                <h2 className="mt-2 text-xl font-black leading-tight">
                  {recommendedAction.title}
                </h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-blue-200 ring-1 ring-white/15">
                {recommendedAction.eyebrow}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {recommendedAction.description}
            </p>
            <button
              type="button"
              onClick={recommendedAction.onAction}
              disabled={actionLoading}
              className={buttonClass(
                "success",
                "lg",
                "mt-5 w-full rounded-xl font-black",
              )}
            >
              {actionLoading ? "처리 중..." : recommendedAction.actionLabel}
            </button>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-300">시작 준비</p>
                <p className="text-xs font-bold text-blue-300">
                  {completedCount}/{guideItems.length} 완료
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-300 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                다음 단계는 <span className="text-white">{nextItem.title}</span>
                입니다.
              </p>
            </div>
          </aside>
        </div>

        <div className="relative mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-[1.5rem] border border-slate-200/90 bg-white/82 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/55">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  How it works
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                  처음 사용자는 이렇게만 해보면 됩니다
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                실제 운영 기준으로 바로 준비
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {workflowPreviewCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/55"
                >
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-blue-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-blue-300 dark:ring-slate-800">
                    {card.badge}
                  </span>
                  <h3 className="mt-3 text-sm font-bold text-slate-950 dark:text-white">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {card.body}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200/90 bg-white/82 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/55">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Setup
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">
              오늘 할 일
            </h2>
            <ol className="mt-4 space-y-2">
              {guideItems.map((item) => {
                const isNextStep = !item.isComplete && nextItem.id === item.id;

                return (
                  <li
                    key={item.id}
                    className={`rounded-xl border px-3 py-3 text-sm transition ${
                      isNextStep
                        ? "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-100"
                        : "border-slate-200 bg-white/70 text-slate-600 dark:border-slate-800 dark:bg-slate-950/35 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                          item.isComplete
                            ? "bg-blue-600 text-white"
                            : isNextStep
                              ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {item.isComplete ? "✓" : item.step}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{item.title}</span>
                          {isNextStep ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/70 dark:text-blue-200 dark:ring-blue-900/70">
                              다음
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 opacity-80">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={item.onAction}
                      className={buttonClass(
                        isNextStep ? "secondary" : "ghost",
                        "sm",
                        "mt-3 w-full rounded-lg",
                      )}
                    >
                      {item.actionLabel}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <div className="relative mt-5 rounded-[1.5rem] border border-blue-200 bg-white/82 p-5 shadow-sm backdrop-blur-xl dark:border-blue-900/60 dark:bg-blue-950/15">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.72fr)_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                유료 도입 상담
              </p>
              <h2 className="mt-2 text-lg font-black text-slate-950 dark:text-white">
                {paidAdoptionAction.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {paidAdoptionAction.description}
              </p>
            </div>
            <ul className="grid gap-2 rounded-xl border border-slate-200 bg-white/85 px-4 py-3 text-left text-xs leading-5 text-slate-600 shadow-sm dark:border-blue-900/60 dark:bg-slate-950/60 dark:text-slate-300">
              {paidAdoptionAction.highlights.map((highlight) => (
                <li key={highlight} className="flex gap-2">
                  <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
            <div className="grid gap-3 lg:justify-self-end">
              {paidAdoptionAction.statusLabel ? (
                <div className="rounded-2xl border border-blue-200 bg-white/85 px-4 py-3 text-sm shadow-sm dark:border-blue-900/60 dark:bg-slate-950/70">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-900">
                      {paidAdoptionAction.statusLabel}
                    </span>
                    {paidAdoptionAction.updatedAtLabel ? (
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {paidAdoptionAction.updatedAtLabel}
                      </span>
                    ) : null}
                  </div>
                  {paidAdoptionAction.statusDescription ? (
                    <p className="mt-2 max-w-64 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {paidAdoptionAction.statusDescription}
                    </p>
                  ) : null}
                  {paidAdoptionAction.statusActionLabel &&
                  paidAdoptionAction.onStatusAction ? (
                    <button
                      type="button"
                      onClick={paidAdoptionAction.onStatusAction}
                      className={buttonClass(
                        "secondary",
                        "sm",
                        "mt-3 w-full rounded-lg",
                      )}
                    >
                      {paidAdoptionAction.statusActionLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={paidAdoptionAction.onAction}
                disabled={paidAdoptionAction.isLoading}
                className={buttonClass("success", "lg", "font-bold")}
              >
                {paidAdoptionAction.isLoading
                  ? "저장 중..."
                  : paidAdoptionAction.actionLabel}
              </button>
            </div>
          </div>
          {paidAdoptionAction.message || paidAdoptionAction.error ? (
            <p
              className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                paidAdoptionAction.error
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                  : "border-blue-200 bg-white/80 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
              }`}
              role="status"
            >
              {paidAdoptionAction.error || paidAdoptionAction.message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
