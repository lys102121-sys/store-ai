"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Sentiment = "positive" | "neutral" | "negative";

type ReviewHistoryItem = {
  id: number;
  review: string;
  reply: string;
  sentiment: Sentiment | string;
  created_at: string;
};

type CsMessageHistoryItem = {
  id: number;
  customer_message: string;
  reply: string;
  created_at: string;
};

type ReviewApiResponse = {
  reply?: string;
  error?: string;
  detail?: string;
};

type CsReplyApiResponse = {
  reply?: string;
  error?: string;
  detail?: string;
};

type ReviewsListResponse = {
  reviews?: ReviewHistoryItem[];
  error?: string;
  detail?: string;
};

type CsMessagesListResponse = {
  csMessages?: CsMessageHistoryItem[];
  error?: string;
  detail?: string;
};

type StoreApiResponse = {
  store?: unknown;
  error?: string;
  detail?: string;
};

type InsightsApiResponse = {
  insights?: string;
  error?: string;
  detail?: string;
};

function InsightsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="M5.6 5.6l2.1 2.1" />
      <path d="M16.3 16.3l2.1 2.1" />
      <path d="M5.6 18.4l2.1-2.1" />
      <path d="M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sentimentLabel(sentiment: string) {
  switch (sentiment) {
    case "positive":
      return "긍정";
    case "negative":
      return "부정";
    default:
      return "중립";
  }
}

function sentimentCardClass(sentiment: string) {
  switch (sentiment) {
    case "positive":
      return "border border-emerald-300/90 bg-emerald-50/90 shadow-sm ring-1 ring-emerald-100/80 dark:border-emerald-800 dark:bg-emerald-950/45 dark:ring-emerald-900/40";
    case "negative":
      return "border-2 border-red-400 bg-red-50 shadow-sm ring-1 ring-red-100 dark:border-red-500 dark:bg-red-950/55 dark:ring-red-900/50";
    default:
      return "border border-zinc-200 bg-zinc-50/95 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/45";
  }
}

function sentimentBadgeClass(sentiment: string) {
  switch (sentiment) {
    case "positive":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-900/50 dark:text-emerald-200 dark:ring-emerald-800";
    case "negative":
      return "bg-red-100 text-red-800 ring-1 ring-red-200/80 dark:bg-red-900/50 dark:text-red-200 dark:ring-red-800";
    default:
      return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700";
  }
}

const urgentBadgeClass =
  "inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm dark:bg-red-500";

function computeReviewStats(reviews: ReviewHistoryItem[]) {
  const total = reviews.length;
  const positive = reviews.filter((r) => r.sentiment === "positive").length;
  const negative = reviews.filter((r) => r.sentiment === "negative").length;
  const positiveRate =
    total > 0 ? Math.round((positive / total) * 1000) / 10 : 0;

  return { total, positive, negative, positiveRate };
}

async function fetchInsightsData() {
  const response = await fetch("/api/insights");
  const data = (await response.json()) as InsightsApiResponse;

  if (!response.ok || !data.insights) {
    throw new Error(data.error ?? "?몄궗?댄듃瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??");
  }

  return data.insights;
}

async function fetchReviewHistory() {
  const response = await fetch("/api/reviews");
  const data = (await response.json()) as ReviewsListResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "?덉뒪?좊━瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??");
  }

  return data.reviews ?? [];
}

async function fetchCsMessageHistory() {
  const response = await fetch("/api/cs-messages");
  const data = (await response.json()) as CsMessagesListResponse;

  if (!response.ok) {
    throw new Error(
      data.error ?? "CS ?덉뒪?좊━瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??",
    );
  }

  return data.csMessages ?? [];
}

const kpiCardClass =
  "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm transition dark:border-zinc-800 dark:bg-zinc-900";

const cardClass =
  "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8";

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950";

const textareaClass =
  "min-h-28 w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950";

export default function Home() {
  const [review, setReview] = useState("");
  const [tone, setTone] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [customerMessage, setCustomerMessage] = useState("");
  const [csTone, setCsTone] = useState("");
  const [csReply, setCsReply] = useState("");
  const [csError, setCsError] = useState("");
  const [csLoading, setCsLoading] = useState(false);

  const [storeName, setStoreName] = useState("");
  const [storeTone, setStoreTone] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");
  const [storeError, setStoreError] = useState("");
  const [storeSaving, setStoreSaving] = useState(false);

  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  const [csMessages, setCsMessages] = useState<CsMessageHistoryItem[]>([]);
  const [csMessagesLoading, setCsMessagesLoading] = useState(true);
  const [csMessagesError, setCsMessagesError] = useState("");

  const [insights, setInsights] = useState("");
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState("");

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError("");

    try {
      const response = await fetch("/api/insights");
      const data = (await response.json()) as InsightsApiResponse;

      if (!response.ok || !data.insights) {
        setInsights("");
        setInsightsError(data.error ?? "인사이트를 불러오지 못했습니다.");
        return;
      }

      setInsights(data.insights);
    } catch {
      setInsights("");
      setInsightsError(
        "네트워크 오류로 인사이트를 불러오지 못했습니다.",
      );
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await fetch("/api/reviews");
      const data = (await response.json()) as ReviewsListResponse;

      if (!response.ok) {
        setHistoryError(data.error ?? "히스토리를 불러오지 못했습니다.");
        setHistory([]);
        return;
      }

      setHistory(data.reviews ?? []);
    } catch {
      setHistoryError("네트워크 오류로 히스토리를 불러오지 못했습니다.");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadCsMessages = useCallback(async () => {
    setCsMessagesLoading(true);
    setCsMessagesError("");

    try {
      const response = await fetch("/api/cs-messages");
      const data = (await response.json()) as CsMessagesListResponse;

      if (!response.ok) {
        setCsMessagesError(
          data.error ?? "CS 히스토리를 불러오지 못했습니다.",
        );
        setCsMessages([]);
        return;
      }

      setCsMessages(data.csMessages ?? []);
    } catch {
      setCsMessagesError(
        "네트워크 오류로 CS 히스토리를 불러오지 못했습니다.",
      );
      setCsMessages([]);
    } finally {
      setCsMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    void fetchReviewHistory()
      .then((reviews) => {
        if (!isActive) return;
        setHistory(reviews);
      })
      .catch((error) => {
        if (!isActive) return;
        setHistoryError(
          error instanceof Error
            ? error.message
            : "?ㅽ듃?뚰겕 ?ㅻ쪟濡??덉뒪?좊━瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??",
        );
        setHistory([]);
      })
      .finally(() => {
        if (!isActive) return;
        setHistoryLoading(false);
      });

    void fetchCsMessageHistory()
      .then((messages) => {
        if (!isActive) return;
        setCsMessages(messages);
      })
      .catch((error) => {
        if (!isActive) return;
        setCsMessagesError(
          error instanceof Error
            ? error.message
            : "?ㅽ듃?뚰겕 ?ㅻ쪟濡?CS ?덉뒪?좊━瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??",
        );
        setCsMessages([]);
      })
      .finally(() => {
        if (!isActive) return;
        setCsMessagesLoading(false);
      });

    void fetchInsightsData()
      .then((nextInsights) => {
        if (!isActive) return;
        setInsights(nextInsights);
      })
      .catch((error) => {
        if (!isActive) return;
        setInsights("");
        setInsightsError(
          error instanceof Error
            ? error.message
            : "?ㅽ듃?뚰겕 ?ㅻ쪟濡??몄궗?댄듃瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??",
        );
      })
      .finally(() => {
        if (!isActive) return;
        setInsightsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const stats = useMemo(() => computeReviewStats(history), [history]);

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedReview = review.trim();
    const trimmedTone = tone.trim();

    if (!trimmedReview || !trimmedTone) {
      setError("리뷰와 톤을 모두 입력해 주세요.");
      setReply("");
      return;
    }

    setIsLoading(true);
    setError("");
    setReply("");

    try {
      const response = await fetch("/api/review-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          review: trimmedReview,
          tone: trimmedTone,
        }),
      });

      const data = (await response.json()) as ReviewApiResponse;

      if (!response.ok || !data.reply) {
        setError(data.error ?? "답글 생성에 실패했습니다.");
        return;
      }

      setReply(data.reply);
      void loadHistory();
      void loadInsights();
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCsReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedCustomerMessage = customerMessage.trim();
    const trimmedTone = csTone.trim();

    if (!trimmedCustomerMessage || !trimmedTone) {
      setCsError("고객 문의와 답변 톤을 모두 입력해 주세요.");
      setCsReply("");
      return;
    }

    setCsLoading(true);
    setCsError("");
    setCsReply("");

    try {
      const response = await fetch("/api/cs-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerMessage: trimmedCustomerMessage,
          tone: trimmedTone,
        }),
      });

      const data = (await response.json()) as CsReplyApiResponse;

      if (!response.ok || !data.reply) {
        setCsError(data.error ?? "CS 답변 생성에 실패했습니다.");
        return;
      }

      setCsReply(data.reply);
      void loadCsMessages();
    } catch {
      setCsError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setCsLoading(false);
    }
  }

  async function handleStoreSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = storeName.trim();
    if (!name) {
      setStoreError("가게명을 입력해 주세요.");
      return;
    }

    setStoreSaving(true);
    setStoreError("");

    try {
      const response = await fetch("/api/store", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          store_name: name,
          tone: storeTone,
          shipping_policy: shippingPolicy,
          refund_policy: refundPolicy,
        }),
      });

      const data = (await response.json()) as StoreApiResponse;

      if (!response.ok) {
        setStoreError(data.error ?? "저장에 실패했습니다.");
        return;
      }

      alert("저장되었습니다.");
    } catch {
      setStoreError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setStoreSaving(false);
    }
  }

  const kpiItems = [
    {
      label: "전체 리뷰",
      value: historyLoading ? "—" : stats.total.toLocaleString("ko-KR"),
      hint: "저장된 리뷰 합계",
      valueClass: "text-zinc-900 dark:text-zinc-50",
      accent: "bg-zinc-100 dark:bg-zinc-800",
    },
    {
      label: "긍정 리뷰",
      value: historyLoading ? "—" : stats.positive.toLocaleString("ko-KR"),
      hint: "positive",
      valueClass: "text-emerald-600 dark:text-emerald-400",
      accent: "bg-emerald-50 dark:bg-emerald-950/50",
    },
    {
      label: "부정 리뷰",
      value: historyLoading ? "—" : stats.negative.toLocaleString("ko-KR"),
      hint: "negative",
      valueClass: "text-red-600 dark:text-red-400",
      accent: "bg-red-50 dark:bg-red-950/50",
    },
    {
      label: "긍정률",
      value: historyLoading ? "—" : `${stats.positiveRate}%`,
      hint: "긍정 / 전체",
      valueClass: "text-indigo-600 dark:text-indigo-400",
      accent: "bg-indigo-50 dark:bg-indigo-950/50",
    },
  ] as const;

  const categoryItems = [
    { label: "우리 가게 정보", targetId: "store-info" },
    { label: "문의 답변", targetId: "cs-reply" },
    { label: "자동 리뷰 답변", targetId: "review-reply" },
    { label: "리뷰 히스토리", targetId: "review-history" },
    { label: "최근 CS 문의", targetId: "cs-history" },
    { label: "AI 운영 분석", targetId: "ai-insights" },
  ] as const;

  function scrollToSection(targetId: string) {
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section className="sticky top-0 z-20 -mx-4 border-b border-zinc-200/70 bg-zinc-50/90 px-4 py-3 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/90 sm:top-2 sm:mx-0 sm:rounded-2xl sm:border sm:shadow-sm">
          <div className="mb-3">
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              카테고리 / 빠른 이동
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              필요한 작업으로 바로 이동합니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {categoryItems.map((item) => (
              <button
                key={item.targetId}
                type="button"
                onClick={() => scrollToSection(item.targetId)}
                className="min-h-12 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              리뷰 통계
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              reviews 테이블 기준 실시간 KPI
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpiItems.map((item) => (
              <article key={item.label} className={kpiCardClass}>
                <div
                  className={`mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg ${item.accent}`}
                >
                  <span className="h-2 w-2 rounded-full bg-current opacity-40" />
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {item.label}
                </p>
                <p
                  className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${item.valueClass}`}
                >
                  {item.value}
                </p>
                <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                  {item.hint}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="ai-insights"
          className={`${cardClass} scroll-mt-32 border-indigo-200/60 dark:border-indigo-900/50`}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400">
                <InsightsIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  AI 운영 분석
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  최근 리뷰 20건을 바탕으로 생성된 운영 인사이트입니다.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadInsights()}
              disabled={insightsLoading}
              className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950"
            >
              {insightsLoading ? "분석 중..." : "다시 분석"}
            </button>
          </div>

          {insightsLoading ? (
            <div
              className="space-y-3"
              aria-busy="true"
              aria-label="인사이트 로딩"
            >
              <div className="h-4 w-3/4 animate-pulse rounded-md bg-indigo-100 dark:bg-indigo-950/60" />
              <div className="h-4 w-full animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-4 w-5/6 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-4 w-2/3 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
              <p className="pt-2 text-xs text-indigo-600/80 dark:text-indigo-400/80">
                AI가 리뷰를 분석하고 있습니다...
              </p>
            </div>
          ) : insightsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {insightsError}
            </div>
          ) : (
            <div className="rounded-xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/50 via-white to-zinc-50 px-5 py-4 dark:border-indigo-900/40 dark:from-indigo-950/20 dark:via-zinc-900 dark:to-zinc-900">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                {insights}
              </pre>
            </div>
          )}
        </section>

        <section id="store-info" className={`${cardClass} scroll-mt-32`}>
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              가게 정보
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              가게명·말투·정책을 입력한 뒤 저장하면 Supabase에 등록됩니다.
            </p>
          </div>

          <form onSubmit={handleStoreSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="store_name" className="text-sm font-medium">
                가게명
              </label>
              <input
                id="store_name"
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="예) 행복한 빵집"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="store_tone" className="text-sm font-medium">
                말투
              </label>
              <input
                id="store_tone"
                type="text"
                value={storeTone}
                onChange={(e) => setStoreTone(e.target.value)}
                placeholder="예) 친근하고 짧게"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="shipping_policy" className="text-sm font-medium">
                배송정책
              </label>
              <textarea
                id="shipping_policy"
                value={shippingPolicy}
                onChange={(e) => setShippingPolicy(e.target.value)}
                placeholder="배송 안내, 기간, 지역 등"
                className={textareaClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="refund_policy" className="text-sm font-medium">
                환불정책
              </label>
              <textarea
                id="refund_policy"
                value={refundPolicy}
                onChange={(e) => setRefundPolicy(e.target.value)}
                placeholder="환불·교환 조건 등"
                className={textareaClass}
              />
            </div>

            <button
              type="submit"
              disabled={storeSaving}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {storeSaving ? "저장 중..." : "저장"}
            </button>
          </form>

          {storeError ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {storeError}
            </div>
          ) : null}
        </section>

        <section
          id="cs-reply"
          className={`${cardClass} scroll-mt-32 border-sky-200/70 dark:border-sky-900/50`}
        >
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                Customer Support
              </p>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                CS 문의 답변 생성
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                고객 문의와 원하는 답변 톤을 입력하면 가게 정책을 반영한 CS 답변을 생성합니다.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900">
              /api/cs-reply
            </span>
          </div>

          <form
            onSubmit={handleCsReplySubmit}
            className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]"
          >
            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="customer_message" className="text-sm font-medium">
                  고객 문의 입력
                </label>
                <textarea
                  id="customer_message"
                  value={customerMessage}
                  onChange={(event) => setCustomerMessage(event.target.value)}
                  placeholder="예) 주문한 상품이 아직 도착하지 않았어요. 배송 현황을 확인해 주세요."
                  className="min-h-36 w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="cs_tone" className="text-sm font-medium">
                  답변 톤 입력
                </label>
                <input
                  id="cs_tone"
                  type="text"
                  value={csTone}
                  onChange={(event) => setCsTone(event.target.value)}
                  placeholder="예) 정중하고 빠르게 안심시키는 톤"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={csLoading}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-sky-700 px-5 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
              >
                {csLoading ? "생성 중..." : "CS 답변 생성"}
              </button>

              {csError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  {csError}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">생성된 CS 답변</h3>
                {csLoading ? (
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    작성 중
                  </span>
                ) : null}
              </div>
              <div
                className="min-h-56 whitespace-pre-wrap rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm leading-6 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                aria-live="polite"
              >
                {csLoading
                  ? "고객 문의에 맞는 답변을 생성하고 있습니다..."
                  : csReply || "생성된 CS 답변이 여기에 표시됩니다."}
              </div>
            </div>
          </form>
        </section>

        <section id="cs-history" className={`${cardClass} scroll-mt-32`}>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                최근 CS 문의
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                저장된 고객 문의와 AI 답변을 최신순으로 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadCsMessages()}
              disabled={csMessagesLoading}
              className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              새로고침
            </button>
          </div>

          {csMessagesError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {csMessagesError}
            </div>
          ) : null}

          {csMessagesLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              CS 문의를 불러오는 중...
            </p>
          ) : csMessages.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              아직 저장된 CS 문의가 없습니다.
            </p>
          ) : (
            <ul className="space-y-4">
              {csMessages.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 shadow-sm dark:border-sky-900/50 dark:bg-sky-950/25"
                >
                  <div className="mb-3 flex justify-end">
                    <time
                      dateTime={item.created_at}
                      className="text-xs text-zinc-500 dark:text-zinc-400"
                    >
                      {formatDate(item.created_at)}
                    </time>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-1 font-medium text-sky-700 dark:text-sky-300">
                        문의
                      </p>
                      <p className="whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.customer_message}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-1 font-medium text-emerald-700 dark:text-emerald-300">
                        답변
                      </p>
                      <p className="whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.reply}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="review-reply" className={`${cardClass} scroll-mt-32`}>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              AI 리뷰 답글 생성기
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              리뷰와 원하는 말투를 입력하면 한국어 답글을 생성합니다.
            </p>
          </div>

          <form onSubmit={handleReviewSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="review" className="text-sm font-medium">
                리뷰 입력
              </label>
              <textarea
                id="review"
                value={review}
                onChange={(event) => setReview(event.target.value)}
                placeholder="예) 음식이 맛있고 사장님이 친절했어요."
                className="min-h-32 w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="tone" className="text-sm font-medium">
                톤 입력
              </label>
              <input
                id="tone"
                type="text"
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                placeholder="예) 정중하고 따뜻한 톤"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isLoading ? "생성 중..." : "AI 답글 생성"}
            </button>
          </form>

          {error ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <div className="mt-6">
            <h2 className="mb-2 text-sm font-medium">AI 답글 출력</h2>
            <div className="min-h-28 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              {isLoading
                ? "답글을 생성하고 있습니다..."
                : reply || "생성된 답글이 여기에 표시됩니다."}
            </div>
          </div>
        </section>

        <section id="review-history" className={`${cardClass} scroll-mt-32`}>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                리뷰 히스토리
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                저장된 리뷰와 AI 답글을 최신순으로 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={historyLoading}
              className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              새로고침
            </button>
          </div>

          {historyError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {historyError}
            </div>
          ) : null}

          {!historyLoading && stats.negative >= 3 ? (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5 shadow-sm dark:border-amber-900/50 dark:from-amber-950/40 dark:to-orange-950/30"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-sm font-bold text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                !
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  최근 부정 리뷰가 증가하고 있습니다.
                </p>
                <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/80">
                  부정 리뷰 {stats.negative}건 · 빠른 대응이 필요한 항목을
                  확인하세요.
                </p>
              </div>
            </div>
          ) : null}

          {historyLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              히스토리를 불러오는 중...
            </p>
          ) : history.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              아직 저장된 리뷰가 없습니다.
            </p>
          ) : (
            <ul className="space-y-4">
              {history.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-xl border p-4 ${sentimentCardClass(item.sentiment)}`}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${sentimentBadgeClass(item.sentiment)}`}
                      >
                        {sentimentLabel(item.sentiment)}
                      </span>
                      {item.sentiment === "negative" ? (
                        <span className={urgentBadgeClass}>
                          긴급 대응 필요
                        </span>
                      ) : null}
                    </div>
                    <time
                      dateTime={item.created_at}
                      className="text-xs text-zinc-600 dark:text-zinc-400"
                    >
                      {formatDate(item.created_at)}
                    </time>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">
                        리뷰
                      </p>
                      <p className="leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.review}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">
                        답글
                      </p>
                      <p className="leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.reply}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
