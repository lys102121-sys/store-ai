"use client";

import type {
  CsLearningMetrics,
  CsLearningTrend,
} from "@/app/lib/csLearningMetrics";
import { buttonClass } from "@/app/lib/uiClasses";

type CsLearningQualityCardProps = {
  metrics: CsLearningMetrics | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
};

function trendLabel(trend: CsLearningTrend) {
  switch (trend) {
    case "improving":
      return "개선 중";
    case "stable":
      return "유지 중";
    case "needs_attention":
      return "점검 필요";
    default:
      return "데이터 수집 중";
  }
}

function trendBadgeClass(trend: CsLearningTrend) {
  switch (trend) {
    case "improving":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:ring-emerald-800";
    case "stable":
      return "bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-200 dark:ring-indigo-800";
    case "needs_attention":
      return "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:ring-amber-800";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700";
  }
}

export function CsLearningQualityCard({
  metrics,
  loading,
  error,
  onRefresh,
}: CsLearningQualityCardProps) {
  const summaryItems = metrics
    ? [
        {
          label: "최근 30일 수정률",
          value: `${metrics.correctionRate30d}%`,
          description: `${metrics.generatedReplies30d}건 중 ${metrics.correctedReplies30d}건 수정`,
        },
        {
          label: "학습한 수정",
          value: `${metrics.correctedReplies30d}건`,
          description: "다음 유사 문의의 표현과 처리 순서에 참고",
        },
        {
          label: "평균 수정 폭",
          value: `${metrics.averageChangePercent}%`,
          description: "수정된 답변에서 바뀐 문장 비율",
        },
        {
          label: "최근 7일 수정률",
          value: `${metrics.recentCorrectionRate7d}%`,
          description: `이전 7일 ${metrics.previousCorrectionRate7d}%`,
        },
      ]
    : [];

  return (
    <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/25 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              AI 학습 품질
            </h3>
            {metrics ? (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${trendBadgeClass(
                  metrics.trend,
                )}`}
              >
                {trendLabel(metrics.trend)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            사장님이 고친 답변을 학습한 뒤 같은 실수가 줄어드는지 최근 30일
            기준으로 확인합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={buttonClass("secondary", "sm", "rounded-lg")}
        >
          {loading ? "확인 중" : "새로고침"}
        </button>
      </div>

      {loading ? (
        <p className="mt-4 rounded-xl border border-indigo-100 bg-white/80 px-4 py-5 text-sm text-zinc-500 dark:border-indigo-900/50 dark:bg-zinc-950/70 dark:text-zinc-400">
          수정 학습 기록을 확인하고 있습니다.
        </p>
      ) : error ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {error}
        </p>
      ) : !metrics || metrics.generatedReplies30d === 0 ? (
        <p className="mt-4 rounded-xl border border-indigo-100 bg-white/80 px-4 py-5 text-sm text-zinc-600 dark:border-indigo-900/50 dark:bg-zinc-950/70 dark:text-zinc-300">
          아직 학습 품질을 계산할 답변이 없습니다. AI 답변을 만들고 필요한
          부분을 수정하면 개선 추세가 쌓입니다.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryItems.map((item) => (
              <article
                key={item.label}
                className="rounded-xl border border-white/80 bg-white/90 p-4 dark:border-indigo-900/50 dark:bg-zinc-950/70"
              >
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-950 dark:text-zinc-50">
                  {item.value}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
                  {item.description}
                </p>
              </article>
            ))}
          </div>

          {metrics.topCorrectionTypes.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                자주 고친 문의
              </span>
              {metrics.topCorrectionTypes.map((item) => (
                <span
                  key={item.caseType}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                >
                  {item.label} {item.count}건
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              아직 수정된 답변이 없습니다. 수정이 생기면 반복되는 유형을
              여기에서 알려드립니다.
            </p>
          )}
        </>
      )}
    </div>
  );
}
