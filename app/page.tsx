"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { getSupabase } from "@/app/lib/supabase";

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

type MissingInfoItem = {
  id: string;
  question: string;
  reason: string;
  source_message: string;
  source_messages?: string[] | null;
  inquiry_count?: number | null;
  status: string;
  topic?: string | null;
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

type MissingInfosListResponse = {
  missingInfos?: MissingInfoItem[];
  error?: string;
  detail?: string;
};

type ResolveMissingInfoResponse = {
  success?: boolean;
  error?: string;
  detail?: string;
};

type DeleteApiResponse = {
  success?: boolean;
  error?: string;
  detail?: string;
};

type DashboardTab = "start" | "store" | "answer" | "manage";

type StoreSettings = {
  user_id: string | null;
  store_name: string | null;
  business_type: string | null;
  tone: string | null;
  shipping_policy: string | null;
  refund_policy: string | null;
  product_name: string | null;
  product_description: string | null;
  product_details: string | null;
  product_caution: string | null;
  extra_faq: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type StoreApiResponse = {
  store?: StoreSettings;
  error?: string;
  detail?: string;
};

type StoreDraft = {
  storeName: string;
  businessType: string;
  storeTone: string;
  shippingPolicy: string;
  refundPolicy: string;
  productName: string;
  productDescription: string;
  productDetails: string;
  productCaution: string;
  extraFaq: string;
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

function EmptyStateCard({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
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
        className="mt-4 inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        {actionLabel}
      </button>
    </div>
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
  const response = await fetch("/api/insights", {
    headers: await getAuthenticatedRequestHeaders(),
  });
  const data = (await response.json()) as InsightsApiResponse;

  if (!response.ok || !data.insights) {
    throw new Error(data.error ?? "?몄궗?댄듃瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??");
  }

  return data.insights;
}

async function fetchReviewHistory() {
  const response = await fetch("/api/reviews", {
    headers: await getAuthenticatedRequestHeaders(),
  });
  const data = (await response.json()) as ReviewsListResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "?덉뒪?좊━瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??");
  }

  return data.reviews ?? [];
}

async function fetchCsMessageHistory() {
  const response = await fetch("/api/cs-messages", {
    headers: await getAuthenticatedRequestHeaders(),
  });
  const data = (await response.json()) as CsMessagesListResponse;

  if (!response.ok) {
    throw new Error(
      data.error ?? "CS ?덉뒪?좊━瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??",
    );
  }

  return data.csMessages ?? [];
}

async function fetchMissingInfoList() {
  const response = await fetch("/api/missing-infos", {
    headers: await getAuthenticatedRequestHeaders(),
  });
  const data = (await response.json()) as MissingInfosListResponse;

  if (!response.ok) {
    throw new Error(
      data.error ?? "확인이 필요한 정보를 불러오지 못했습니다.",
    );
  }

  return data.missingInfos ?? [];
}

async function getAuthenticatedRequestHeaders(
  headers: HeadersInit = {},
): Promise<HeadersInit> {
  const { data, error } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;

  if (error || !token) {
    throw new Error("로그인이 필요합니다");
  }

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}

async function fetchLatestStore() {
  const response = await fetch("/api/store/latest", {
    headers: await getAuthenticatedRequestHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  const data = (await response.json()) as StoreApiResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "가게 정보를 확인하지 못했습니다.");
  }

  return data.store ?? null;
}

const STORE_DRAFT_STORAGE_KEY_PREFIX = "store-info-draft";

function getStoreDraftStorageKey(userId: string) {
  return `${STORE_DRAFT_STORAGE_KEY_PREFIX}:${userId}`;
}

function isStoreDraft(value: unknown): value is StoreDraft {
  if (!value || typeof value !== "object") return false;

  const draft = value as Partial<Record<keyof StoreDraft, unknown>>;

  return (
    typeof draft.storeName === "string" &&
    (draft.businessType === undefined ||
      typeof draft.businessType === "string") &&
    typeof draft.storeTone === "string" &&
    typeof draft.shippingPolicy === "string" &&
    typeof draft.refundPolicy === "string" &&
    typeof draft.productName === "string" &&
    typeof draft.productDescription === "string" &&
    typeof draft.productDetails === "string" &&
    typeof draft.productCaution === "string" &&
    typeof draft.extraFaq === "string"
  );
}

function readStoreDraft(userId: string): StoreDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const rawDraft = window.localStorage.getItem(
      getStoreDraftStorageKey(userId),
    );

    if (!rawDraft) return null;

    const parsedDraft: unknown = JSON.parse(rawDraft);

    return isStoreDraft(parsedDraft) ? parsedDraft : null;
  } catch {
    return null;
  }
}

function saveStoreDraft(userId: string, draft: StoreDraft) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getStoreDraftStorageKey(userId),
    JSON.stringify(draft),
  );
}

function removeStoreDraft(userId: string) {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(getStoreDraftStorageKey(userId));
}

function hasStoreDraftContent(draft: StoreDraft) {
  return Object.values(draft).some((value) => value.trim().length > 0);
}

const kpiCardClass =
  "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm transition dark:border-zinc-800 dark:bg-zinc-900";

const cardClass =
  "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8";

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950";

const textareaClass =
  "min-h-28 w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950";

const businessTypeInputGuides = {
  "배달 음식점": [
    "대표 메뉴명",
    "맵기/양/구성",
    "원산지 또는 알레르기 성분",
    "배달 가능 지역",
    "포장/재가열 방법",
  ],
  "디저트/카페": [
    "대표 상품명",
    "보관 방법",
    "알레르기 성분",
    "픽업/예약 가능 여부",
    "선물 포장 가능 여부",
  ],
  "공방/핸드메이드": [
    "대표 상품명",
    "재질/소재",
    "제작 기간",
    "사이즈 조절 가능 여부",
    "보관/변색 주의사항",
    "선물 포장 가능 여부",
  ],
  "의류/잡화": [
    "대표 상품명",
    "사이즈 정보",
    "소재/세탁 방법",
    "교환/반품 기준",
    "재고/입고 일정",
  ],
  "생활용품": [
    "대표 상품명",
    "구성품",
    "사용 방법",
    "A/S 또는 교환 기준",
    "주의사항",
  ],
  "기타 스마트스토어": [
    "대표 상품명",
    "상품 구성",
    "배송/교환/환불 기준",
    "자주 묻는 질문",
    "주의사항",
  ],
} as const;

type InterpretedBusinessType = keyof typeof businessTypeInputGuides;

function includesAnyKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function interpretBusinessType(value: string): InterpretedBusinessType {
  const trimmedValue = value.trim();

  if (trimmedValue in businessTypeInputGuides) {
    return trimmedValue as InterpretedBusinessType;
  }

  const normalizedValue = trimmedValue.replace(/\s+/g, "").toLowerCase();

  if (
    includesAnyKeyword(normalizedValue, [
      "카페",
      "디저트",
      "베이커리",
      "케이크",
      "쿠키",
      "마카롱",
      "빵집",
      "커피",
      "음료",
      "수제청",
      "티",
      "브런치",
    ])
  ) {
    return "디저트/카페";
  }

  if (
    includesAnyKeyword(normalizedValue, [
      "음식점",
      "식당",
      "배달",
      "치킨",
      "피자",
      "족발",
      "보쌈",
      "분식",
      "한식",
      "중식",
      "일식",
      "도시락",
      "샐러드",
      "밀키트",
    ])
  ) {
    return "배달 음식점";
  }

  if (
    includesAnyKeyword(normalizedValue, [
      "공방",
      "핸드메이드",
      "수제",
      "반지",
      "악세사리",
      "주얼리",
      "캔들",
      "비누",
      "도자기",
      "가죽",
      "꽃",
      "플라워",
    ])
  ) {
    return "공방/핸드메이드";
  }

  if (
    includesAnyKeyword(normalizedValue, [
      "의류",
      "옷",
      "패션",
      "잡화",
      "가방",
      "신발",
      "모자",
      "양말",
      "액세서리",
      "키링",
    ])
  ) {
    return "의류/잡화";
  }

  if (
    includesAnyKeyword(normalizedValue, [
      "생활용품",
      "주방용품",
      "욕실용품",
      "인테리어",
      "문구",
      "반려동물용품",
      "애견용품",
      "청소용품",
    ])
  ) {
    return "생활용품";
  }

  return "기타 스마트스토어";
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("start");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authError, setAuthError] = useState("");

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
  const [businessType, setBusinessType] = useState("");
  const [storeTone, setStoreTone] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productDetails, setProductDetails] = useState("");
  const [productCaution, setProductCaution] = useState("");
  const [extraFaq, setExtraFaq] = useState("");
  const [shippingCutoffTime, setShippingCutoffTime] = useState("");
  const [sameDayShipping, setSameDayShipping] = useState("가능");
  const [courierName, setCourierName] = useState("");
  const [remoteAreaFee, setRemoteAreaFee] = useState("");
  const [changeOfMindRefund, setChangeOfMindRefund] = useState("불가능");
  const [defectContactDeadline, setDefectContactDeadline] = useState("");
  const [returnShippingFee, setReturnShippingFee] = useState("");
  const [cafeCancelBeforeProduction, setCafeCancelBeforeProduction] =
    useState("가능");
  const [cafeCancelAfterProduction, setCafeCancelAfterProduction] =
    useState("불가능");
  const [cafeRefundAfterPickup, setCafeRefundAfterPickup] =
    useState("확인 필요");
  const [cafeProductIssueStandard, setCafeProductIssueStandard] = useState("");
  const [cafeReservationCancelDeadline, setCafeReservationCancelDeadline] =
    useState("");
  const [foodCancelBeforeCooking, setFoodCancelBeforeCooking] =
    useState("가능");
  const [foodCancelAfterCooking, setFoodCancelAfterCooking] =
    useState("불가능");
  const [foodRefundAfterDelivery, setFoodRefundAfterDelivery] = useState("");
  const [foodMissingWrongStandard, setFoodMissingWrongStandard] = useState("");
  const [foodConditionIssueStandard, setFoodConditionIssueStandard] =
    useState("");
  const [storeError, setStoreError] = useState("");
  const [storeSaving, setStoreSaving] = useState(false);
  const [hasStore, setHasStore] = useState(false);
  const [storeStatusLoading, setStoreStatusLoading] = useState(true);
  const [storeDraftReady, setStoreDraftReady] = useState(false);

  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [deletingReviewId, setDeletingReviewId] = useState<number | null>(null);

  const [csMessages, setCsMessages] = useState<CsMessageHistoryItem[]>([]);
  const [csMessagesLoading, setCsMessagesLoading] = useState(true);
  const [csMessagesError, setCsMessagesError] = useState("");
  const [deletingCsMessageId, setDeletingCsMessageId] = useState<
    number | null
  >(null);

  const [missingInfos, setMissingInfos] = useState<MissingInfoItem[]>([]);
  const [missingInfosLoading, setMissingInfosLoading] = useState(true);
  const [missingInfosError, setMissingInfosError] = useState("");
  const [missingInfoAnswers, setMissingInfoAnswers] = useState<
    Record<string, string>
  >({});
  const [missingInfoTargetFields, setMissingInfoTargetFields] = useState<
    Record<string, string>
  >({});
  const [missingInfoResolvingId, setMissingInfoResolvingId] = useState<
    string | null
  >(null);
  const [missingInfoResolveMessage, setMissingInfoResolveMessage] =
    useState("");

  const [insights, setInsights] = useState("");
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState("");

  const storeDraft = useMemo<StoreDraft>(
    () => ({
      storeName,
      businessType,
      storeTone,
      shippingPolicy,
      refundPolicy,
      productName,
      productDescription,
      productDetails,
      productCaution,
      extraFaq,
    }),
    [
      storeName,
      businessType,
      storeTone,
      shippingPolicy,
      refundPolicy,
      productName,
      productDescription,
      productDetails,
      productCaution,
      extraFaq,
    ],
  );

  const applyStoreToForm = useCallback((store: StoreSettings | null) => {
    setHasStore(Boolean(store));

    if (store) {
      setStoreName(store.store_name ?? "");
      setBusinessType(store.business_type ?? "");
      setStoreTone(store.tone ?? "");
      setShippingPolicy(store.shipping_policy ?? "");
      setRefundPolicy(store.refund_policy ?? "");
      setProductName(store.product_name ?? "");
      setProductDescription(store.product_description ?? "");
      setProductDetails(store.product_details ?? "");
      setProductCaution(store.product_caution ?? "");
      setExtraFaq(store.extra_faq ?? "");
      return;
    }

    setStoreName("");
    setBusinessType("");
    setStoreTone("");
    setShippingPolicy("");
    setRefundPolicy("");
    setProductName("");
    setProductDescription("");
    setProductDetails("");
    setProductCaution("");
    setExtraFaq("");
  }, []);

  useEffect(() => {
    let isActive = true;
    let unsubscribe: (() => void) | undefined;

    void Promise.resolve()
      .then(() => {
        const supabaseClient = getSupabase();
        const {
          data: { subscription },
        } = supabaseClient.auth.onAuthStateChange((_event, session) => {
          if (!isActive) return;
          setAuthUser(session?.user ?? null);
          setAuthError("");
          setAuthLoading(false);
        });

        unsubscribe = () => subscription.unsubscribe();

        return supabaseClient.auth.getSession();
      })
      .then(({ data, error }) => {
        if (!isActive) return;

        if (error) {
          setAuthError(error.message);
        }

        setAuthUser(data.session?.user ?? null);
      })
      .catch((error) => {
        if (!isActive) return;
        setAuthError(
          error instanceof Error
            ? error.message
            : "로그인 상태를 확인하지 못했습니다.",
        );
        setAuthUser(null);
      })
      .finally(() => {
        if (!isActive) return;
        setAuthLoading(false);
      });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, []);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError("");

    try {
      const response = await fetch("/api/insights", {
        headers: await getAuthenticatedRequestHeaders(),
      });
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
      const response = await fetch("/api/reviews", {
        headers: await getAuthenticatedRequestHeaders(),
      });
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
      const response = await fetch("/api/cs-messages", {
        headers: await getAuthenticatedRequestHeaders(),
      });
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

  const loadMissingInfos = useCallback(async () => {
    setMissingInfosLoading(true);
    setMissingInfosError("");

    try {
      const infos = await fetchMissingInfoList();
      setMissingInfos(infos);
    } catch (error) {
      setMissingInfosError(
        error instanceof Error
          ? error.message
          : "확인이 필요한 정보를 불러오지 못했습니다.",
      );
      setMissingInfos([]);
    } finally {
      setMissingInfosLoading(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    if (authLoading) {
      return () => {
        isActive = false;
      };
    }

    if (!authUser) {
      void Promise.resolve().then(() => {
        if (!isActive) return;

        setHistory([]);
        setHistoryError("");
        setHistoryLoading(false);
        setHasStore(false);
        setStoreStatusLoading(false);
        setStoreDraftReady(false);
        setStoreName("");
        setBusinessType("");
        setStoreTone("");
        setShippingPolicy("");
        setRefundPolicy("");
        setProductName("");
        setProductDescription("");
        setProductDetails("");
        setProductCaution("");
        setExtraFaq("");
        setCsMessages([]);
        setCsMessagesError("");
        setCsMessagesLoading(false);
        setDeletingCsMessageId(null);
        setMissingInfos([]);
        setMissingInfosError("");
        setMissingInfosLoading(false);
        setMissingInfoAnswers({});
        setMissingInfoTargetFields({});
        setMissingInfoResolvingId(null);
        setMissingInfoResolveMessage("");
        setInsights("");
        setInsightsError("");
        setInsightsLoading(false);
        setDeletingReviewId(null);
      });

      return () => {
        isActive = false;
      };
    }

    void Promise.resolve().then(() => {
      if (!isActive) return;
      setStoreStatusLoading(true);
      setMissingInfosLoading(true);
      setStoreDraftReady(false);

      const draft = readStoreDraft(authUser.id);

      if (draft) {
        setStoreName(draft.storeName);
        setBusinessType(draft.businessType ?? "");
        setStoreTone(draft.storeTone);
        setShippingPolicy(draft.shippingPolicy);
        setRefundPolicy(draft.refundPolicy);
        setProductName(draft.productName);
        setProductDescription(draft.productDescription);
        setProductDetails(draft.productDetails);
        setProductCaution(draft.productCaution);
        setExtraFaq(draft.extraFaq);
      }

      setStoreDraftReady(true);
    });

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

    void fetchLatestStore()
      .then((store) => {
        if (!isActive) return;
        setHasStore(Boolean(store));

        const draft = readStoreDraft(authUser.id);

        if (store && !draft) {
          applyStoreToForm(store);
        } else if (!store && !draft) {
          applyStoreToForm(null);
        } else {
          setHasStore(Boolean(store));
        }
      })
      .catch((error) => {
        if (!isActive) return;
        setHasStore(false);
        setStoreError(
          error instanceof Error
            ? error.message
            : "가게 정보를 확인하지 못했습니다.",
        );
      })
      .finally(() => {
        if (!isActive) return;
        setStoreStatusLoading(false);
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

    void fetchMissingInfoList()
      .then((infos) => {
        if (!isActive) return;
        setMissingInfos(infos);
      })
      .catch((error) => {
        if (!isActive) return;
        setMissingInfosError(
          error instanceof Error
            ? error.message
            : "확인이 필요한 정보를 불러오지 못했습니다.",
        );
        setMissingInfos([]);
      })
      .finally(() => {
        if (!isActive) return;
        setMissingInfosLoading(false);
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
  }, [applyStoreToForm, authLoading, authUser]);

  useEffect(() => {
    if (!authUser || !storeDraftReady) return;

    if (hasStoreDraftContent(storeDraft)) {
      saveStoreDraft(authUser.id, storeDraft);
      return;
    }

    removeStoreDraft(authUser.id);
  }, [authUser, storeDraft, storeDraftReady]);

  const stats = useMemo(() => computeReviewStats(history), [history]);
  const needsStoreInfo = Boolean(authUser && !storeStatusLoading && !hasStore);
  const aiGenerationBlocked = Boolean(
    authUser && (storeStatusLoading || !hasStore),
  );

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedReview = review.trim();
    const trimmedTone = tone.trim();

    if (!trimmedReview || !trimmedTone) {
      setError("리뷰와 톤을 모두 입력해 주세요.");
      setReply("");
      return;
    }

    if (!authUser) {
      setError("로그인이 필요합니다");
      setReply("");
      return;
    }

    if (!hasStore) {
      setError("가게 정보를 먼저 등록해야 AI가 정확히 답변할 수 있습니다.");
      setReply("");
      return;
    }

    setIsLoading(true);
    setError("");
    setReply("");

    try {
      const response = await fetch("/api/review-reply", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
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

    if (!authUser) {
      setCsError("로그인이 필요합니다");
      setCsReply("");
      return;
    }

    if (!hasStore) {
      setCsError("가게 정보를 먼저 등록해야 AI가 정확히 답변할 수 있습니다.");
      setCsReply("");
      return;
    }

    setCsLoading(true);
    setCsError("");
    setCsReply("");

    try {
      const response = await fetch("/api/cs-reply", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
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
      void loadMissingInfos();
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

    if (!authUser) {
      setStoreError("로그인이 필요합니다");
      return;
    }

    setStoreSaving(true);
    setStoreError("");

    try {
      const response = await fetch("/api/store", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          store_name: name,
          business_type: businessType,
          tone: storeTone,
          shipping_policy: shippingPolicy,
          refund_policy: refundPolicy,
          product_name: productName,
          product_description: productDescription,
          product_details: productDetails,
          product_caution: productCaution,
          extra_faq: extraFaq,
        }),
      });

      const data = (await response.json()) as StoreApiResponse;

      if (!response.ok) {
        setStoreError(data.error ?? "저장에 실패했습니다.");
        return;
      }

      setHasStore(true);
      removeStoreDraft(authUser.id);
      alert("저장되었습니다.");
    } catch {
      setStoreError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setStoreSaving(false);
    }
  }

  async function handleResolveMissingInfo(missingInfoId: string) {
    const answer = (missingInfoAnswers[missingInfoId] ?? "").trim();
    const targetField = missingInfoTargetFields[missingInfoId] ?? "extra_faq";

    if (!answer) {
      setMissingInfosError("반영할 답변을 입력해 주세요.");
      setMissingInfoResolveMessage("");
      return;
    }

    setMissingInfoResolvingId(missingInfoId);
    setMissingInfosError("");
    setMissingInfoResolveMessage("");

    try {
      const response = await fetch("/api/missing-infos/resolve", {
        method: "POST",
        headers: await getAuthenticatedRequestHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          missingInfoId,
          answer,
          targetField,
        }),
      });

      const data = (await response.json()) as ResolveMissingInfoResponse;

      if (!response.ok || !data.success) {
        setMissingInfosError(
          data.error ?? "가게 정보에 반영하지 못했습니다.",
        );
        return;
      }

      setMissingInfos((currentInfos) =>
        currentInfos.filter((item) => item.id !== missingInfoId),
      );
      setMissingInfoAnswers((currentAnswers) => {
        const nextAnswers = { ...currentAnswers };
        delete nextAnswers[missingInfoId];
        return nextAnswers;
      });
      setMissingInfoTargetFields((currentFields) => {
        const nextFields = { ...currentFields };
        delete nextFields[missingInfoId];
        return nextFields;
      });

      const latestStore = await fetchLatestStore();
      applyStoreToForm(latestStore);

      if (authUser) {
        removeStoreDraft(authUser.id);
      }

      setMissingInfoResolveMessage("가게 정보에 반영되었습니다");
      void loadMissingInfos();
    } catch {
      setMissingInfosError(
        "네트워크 오류로 가게 정보에 반영하지 못했습니다.",
      );
    } finally {
      setMissingInfoResolvingId(null);
    }
  }

  async function handleDeleteReview(reviewId: number) {
    if (!window.confirm("이 항목을 삭제할까요?")) return;

    setDeletingReviewId(reviewId);
    setHistoryError("");

    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as DeleteApiResponse;

      if (!response.ok) {
        setHistoryError(data.error ?? "리뷰 항목을 삭제하지 못했습니다.");
        return;
      }

      await Promise.all([loadHistory(), loadInsights()]);
    } catch {
      setHistoryError("네트워크 오류로 리뷰 항목을 삭제하지 못했습니다.");
    } finally {
      setDeletingReviewId(null);
    }
  }

  async function handleDeleteCsMessage(csMessageId: number) {
    if (!window.confirm("이 항목을 삭제할까요?")) return;

    setDeletingCsMessageId(csMessageId);
    setCsMessagesError("");

    try {
      const response = await fetch(`/api/cs-messages/${csMessageId}`, {
        method: "DELETE",
        headers: await getAuthenticatedRequestHeaders(),
      });
      const data = (await response.json()) as DeleteApiResponse;

      if (!response.ok) {
        setCsMessagesError(data.error ?? "CS 문의 항목을 삭제하지 못했습니다.");
        return;
      }

      await loadCsMessages();
    } catch {
      setCsMessagesError("네트워크 오류로 CS 문의 항목을 삭제하지 못했습니다.");
    } finally {
      setDeletingCsMessageId(null);
    }
  }

  const pendingMissingInfoCount = missingInfos.filter(
    (item) => item.status === "pending",
  ).length;

  const operationSummaryItems = [
    {
      label: "전체 리뷰 수",
      value: historyLoading ? "—" : stats.total.toLocaleString("ko-KR"),
      description: "지금까지 생성/관리한 리뷰 답글",
      className:
        "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50",
      valueClassName: "text-zinc-950 dark:text-zinc-50",
    },
    {
      label: "부정 리뷰 수",
      value: historyLoading ? "—" : stats.negative.toLocaleString("ko-KR"),
      description: "우선 확인이 필요한 리뷰",
      className:
        stats.negative > 0
          ? "border-red-200 bg-red-50/80 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
          : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50",
      valueClassName:
        stats.negative > 0
          ? "text-red-700 dark:text-red-300"
          : "text-zinc-950 dark:text-zinc-50",
    },
    {
      label: "최근 CS 문의 수",
      value: csMessagesLoading
        ? "—"
        : csMessages.length.toLocaleString("ko-KR"),
      description: "저장된 고객 문의 답변",
      className:
        "border-sky-200 bg-sky-50/70 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/25 dark:text-sky-100",
      valueClassName: "text-sky-700 dark:text-sky-300",
    },
    {
      label: "확인 필요한 정보",
      value: missingInfosLoading
        ? "—"
        : pendingMissingInfoCount.toLocaleString("ko-KR"),
      description: "AI가 답변을 위해 추가로 요청한 정보",
      className:
        pendingMissingInfoCount > 0
          ? "border-amber-300 bg-amber-50 text-amber-950 shadow-sm ring-1 ring-amber-200/80 dark:border-amber-700 dark:bg-amber-950/35 dark:text-amber-100 dark:ring-amber-900/70"
          : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50",
      valueClassName:
        pendingMissingInfoCount > 0
          ? "text-amber-700 dark:text-amber-300"
          : "text-zinc-950 dark:text-zinc-50",
    },
  ] as const;

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
    { label: "문의에 답변하기", targetId: "cs-reply" },
    { label: "리뷰에 답글 달기", targetId: "review-reply" },
    { label: "리뷰 히스토리", targetId: "review-history" },
    { label: "최근 CS 문의", targetId: "cs-history" },
    { label: "확인 필요 정보", targetId: "missing-infos" },
    { label: "AI 운영 분석", targetId: "ai-insights" },
  ] as const;

  const tonePresets = [
    "친절하고 정중하게",
    "따뜻하고 다정하게",
    "짧고 깔끔하게",
    "센스 있고 밝게",
    "고급스럽고 차분하게",
  ] as const;

  const businessTypeOptions = [
    "배달 음식점",
    "디저트/카페",
    "공방/핸드메이드",
    "의류/잡화",
    "생활용품",
    "기타 스마트스토어",
  ] as const;

  const interpretedBusinessType = interpretBusinessType(businessType);
  const businessTypeGuideItems =
    businessTypeInputGuides[interpretedBusinessType];
  const isCafePolicyHelper = interpretedBusinessType === "디저트/카페";
  const isFoodPolicyHelper = interpretedBusinessType === "배달 음식점";

  const policyOptionButtonClass =
    "rounded-lg border px-3 py-2 text-xs font-medium transition";

  const dashboardTabs = [
    { id: "start", label: "시작하기" },
    { id: "store", label: "가게 설정" },
    { id: "answer", label: "답변 작성" },
    { id: "manage", label: "운영 관리" },
  ] as const satisfies ReadonlyArray<{ id: DashboardTab; label: string }>;

  function scrollToSection(targetId: string) {
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function goToTabSection(tab: DashboardTab, targetId: string) {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => scrollToSection(targetId));
    });
  }

  async function handleKakaoLogin() {
    setAuthActionLoading(true);
    setAuthError("");

    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        setAuthError(error.message);
      }
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "카카오 로그인을 시작하지 못했습니다.",
      );
    } finally {
      setAuthActionLoading(false);
    }
  }

  async function handleLogout() {
    setAuthActionLoading(true);
    setAuthError("");

    try {
      const { error } = await getSupabase().auth.signOut();

      if (error) {
        setAuthError(error.message);
        return;
      }

      setAuthUser(null);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "로그아웃하지 못했습니다.",
      );
    } finally {
      setAuthActionLoading(false);
    }
  }

  function handleBuildShippingPolicy() {
    const cutoff = shippingCutoffTime.trim() || "출고 마감 시간";
    const courier = courierName.trim() || "택배사";
    const remoteFee = remoteAreaFee.trim() || "추가 배송비";

    if (isCafePolicyHelper) {
      const pickupGuide = courierName.trim() || "픽업/예약 안내";
      const reservationGuide = remoteAreaFee.trim() || "예약 가능 일정";

      setShippingPolicy(
        `${cutoff} 기준으로 픽업 또는 예약 준비 시간이 달라질 수 있습니다. ${pickupGuide}를 확인해 주시고, ${reservationGuide}은 주문 전 문의해 주세요.`,
      );
      return;
    }

    if (isFoodPolicyHelper) {
      const deliveryArea = remoteAreaFee.trim() || "배달 가능 지역";
      const deliveryGuide = courierName.trim() || "조리/배달 상황";

      setShippingPolicy(
        `${cutoff} 기준으로 주문 접수와 조리 시간이 달라질 수 있습니다. ${deliveryArea}과 ${deliveryGuide}에 따라 배달 시간이 달라질 수 있습니다.`,
      );
      return;
    }

    const shippingSentence =
      sameDayShipping === "가능"
        ? `${cutoff} 이전 주문은 당일 출고되며, ${courier}을 통해 발송됩니다.`
        : `${cutoff} 이전 주문도 당일 출고가 어려울 수 있으며, ${courier}을 통해 순차 발송됩니다.`;

    setShippingPolicy(
      `${shippingSentence} 제주/도서산간 지역은 추가 배송비 ${remoteFee}이 발생합니다.`,
    );
  }

  function handleBuildRefundPolicy() {
    if (isCafePolicyHelper) {
      const beforeProduction =
        cafeCancelBeforeProduction === "가능"
          ? "제조 시작 전에는 취소가 가능합니다."
          : "제조 시작 전에도 취소가 어려울 수 있습니다.";
      const afterProduction =
        cafeCancelAfterProduction === "가능"
          ? "제조가 시작된 이후에도 취소 가능 여부를 확인해 드립니다."
          : "제조가 시작된 이후에는 취소가 어려울 수 있습니다.";
      const afterPickup =
        cafeRefundAfterPickup === "가능"
          ? "픽업/수령 후에도 제품 상태를 확인한 뒤 환불 가능 여부를 안내드립니다."
          : cafeRefundAfterPickup === "불가능"
            ? "픽업/수령 후에는 환불이 어려울 수 있습니다."
            : "픽업/수령 후 환불은 제품 상태를 확인한 뒤 안내드립니다.";
      const issueStandard =
        cafeProductIssueStandard.trim() ||
        "제품에 문제가 있는 경우 수령 후 가능한 빠르게 문의해 주시면 확인 후 안내드리겠습니다.";
      const reservationDeadline = cafeReservationCancelDeadline.trim();

      setRefundPolicy(
        [
          beforeProduction,
          afterProduction,
          afterPickup,
          issueStandard,
          reservationDeadline
            ? `예약 주문 취소는 ${reservationDeadline}까지 문의해 주세요.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      return;
    }

    if (isFoodPolicyHelper) {
      const beforeCooking =
        foodCancelBeforeCooking === "가능"
          ? "조리 시작 전에는 취소가 가능합니다."
          : "조리 시작 전에도 취소가 어려울 수 있습니다.";
      const afterCooking =
        foodCancelAfterCooking === "가능"
          ? "조리가 시작된 이후에도 취소 가능 여부를 확인해 드립니다."
          : "조리가 시작된 이후에는 취소가 어려울 수 있습니다.";
      const afterDelivery =
        foodRefundAfterDelivery.trim() ||
        "배달 완료 후 환불은 주문 상태와 사유를 확인한 뒤 안내드리겠습니다.";
      const missingWrong =
        foodMissingWrongStandard.trim() ||
        "음식 누락이나 오배송이 있는 경우 주문 정보를 확인한 뒤 안내드리겠습니다.";
      const conditionIssue =
        foodConditionIssueStandard.trim() ||
        "음식 상태 문제가 있는 경우 사진과 주문 정보를 함께 알려주시면 확인 후 안내드리겠습니다.";

      setRefundPolicy(
        `${beforeCooking} ${afterCooking} ${afterDelivery} ${missingWrong} ${conditionIssue}`,
      );
      return;
    }

    const deadline = defectContactDeadline.trim() || "문의 기한";
    const returnFee = returnShippingFee.trim() || "반품 배송비";
    const changeOfMindSentence =
      changeOfMindRefund === "가능"
        ? "단순 변심으로 인한 환불은 가능합니다."
        : "단순 변심으로 인한 환불은 불가합니다.";

    setRefundPolicy(
      `${changeOfMindSentence} 상품 하자가 있는 경우 ${deadline} 문의해 주세요. 반품 배송비는 ${returnFee}입니다.`,
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/25 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Supabase Auth
            </p>
            {authUser ? (
              <div className="mt-2">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  로그인됨
                </h2>
                <p className="mt-1 break-all text-sm text-zinc-600 dark:text-zinc-300">
                  {authUser.email ?? authUser.id}
                </p>
              </div>
            ) : (
              <div className="mt-2">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  로그인
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  로그인하면 내 가게 데이터로 분리됩니다
                </p>
              </div>
            )}
            {authError ? (
              <p className="mt-3 text-sm text-red-700 dark:text-red-300">
                {authError}
              </p>
            ) : null}
          </div>

          <div className="mt-4 sm:mt-0">
            {authUser ? (
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={authLoading || authActionLoading}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {authActionLoading ? "처리 중..." : "로그아웃"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleKakaoLogin()}
                disabled={authLoading || authActionLoading}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-yellow-400 px-5 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authActionLoading ? "연결 중..." : "카카오로 로그인"}
              </button>
            )}
          </div>
        </section>

        <nav
          aria-label="대시보드 탭"
          className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {dashboardTabs.map((tab) => {
              const isSelected = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    isSelected
                      ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  }`}
                  aria-pressed={isSelected}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        <section
          className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${
            activeTab === "start" ? "order-[10]" : "hidden"
          }`}
        >
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="mb-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900">
                AI 운영 도우미
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
                소상공인을 위한 AI 리뷰·문의 응대 도우미
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 sm:text-base">
                가게 정보와 운영 정책을 등록하면, AI가 리뷰 답글과 고객
                문의 답변을 우리 가게 말투에 맞춰 작성해드립니다. 부족한
                정보는 AI가 사장님에게 질문하고, 답변을 학습해 다음 응대에
                반영합니다.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => goToTabSection("store", "store-info")}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  가게 정보 등록하기
                </button>
                <button
                  type="button"
                  onClick={() => goToTabSection("answer", "cs-reply")}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  문의 답변 써보기
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              {[
                {
                  step: "1단계",
                  title: "가게 정보 등록",
                  description:
                    "업종, 말투, 배송·환불 정책, 상품 정보를 입력합니다.",
                },
                {
                  step: "2단계",
                  title: "리뷰·문의 답변 생성",
                  description:
                    "고객 리뷰와 문의를 입력하면 AI가 우리 가게에 맞는 답변을 작성합니다.",
                },
                {
                  step: "3단계",
                  title: "부족한 정보 학습",
                  description:
                    "AI가 모르는 질문을 발견하면 사장님에게 확인하고, 답변을 지식에 반영합니다.",
                },
              ].map((item) => (
                <article
                  key={item.step}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-2.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                      {item.step}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {activeTab === "start" && authUser && !storeStatusLoading && !hasStore ? (
          <section className="order-[20] rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/25">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Onboarding
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  먼저 우리 가게 정보를 등록해주세요
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  AI 답변이 가게 정책과 말투를 반영할 수 있도록 기본 정보를 먼저 저장해주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => goToTabSection("store", "store-info")}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-medium text-white transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                가게 정보 등록하기
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {["가게명 입력", "말투 입력", "배송정책 입력", "환불정책 입력"].map(
                (step, index) => (
                  <div
                    key={step}
                    className="rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm shadow-sm dark:border-emerald-900/60 dark:bg-zinc-900"
                  >
                    <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                      {index + 1}
                    </span>
                    <p className="font-medium text-zinc-800 dark:text-zinc-100">
                      {step}
                    </p>
                  </div>
                ),
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "start" && authUser ? (
          <section className="order-[30] rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Daily Summary
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  오늘의 운영 요약
                </h2>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                AI가 부족한 정보를 발견하면 이곳에서 바로 확인할 수 있어요.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {operationSummaryItems.map((item) => (
                <article
                  key={item.label}
                  className={`rounded-xl border p-4 transition ${item.className}`}
                >
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {item.label}
                  </p>
                  <p
                    className={`mt-2 text-3xl font-semibold tracking-tight ${item.valueClassName}`}
                  >
                    {item.value}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
            {pendingMissingInfoCount > 0 ? (
              <button
                type="button"
                onClick={() => goToTabSection("manage", "missing-infos")}
                className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white transition hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
              >
                확인 필요한 정보 보기
              </button>
            ) : null}
          </section>
        ) : null}

        <section className="hidden">
          <div className="mb-3">
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              카테고리 / 빠른 이동
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              필요한 작업으로 바로 이동합니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
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

        <section className={activeTab === "manage" ? "order-[44]" : "hidden"}>
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
          className={`${cardClass} scroll-mt-32 border-indigo-200/60 dark:border-indigo-900/50 ${
            activeTab === "manage" ? "order-[45]" : "hidden"
          }`}
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

        <section
          id="store-info"
          className={`${cardClass} scroll-mt-32 ${
            activeTab === "store" ? "order-[20]" : "hidden"
          }`}
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              가게 정보
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              가게명·말투·정책을 입력한 뒤 저장하면 Supabase에 등록됩니다.
            </p>
          </div>

          {hasStore ? (
            <p className="-mt-4 mb-6 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              현재 등록된 가게 정보를 수정할 수 있습니다
            </p>
          ) : null}

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
              <label htmlFor="business_type" className="text-sm font-medium">
                업종
              </label>
              <select
                id="business_type"
                value={businessType}
                onChange={(event) => setBusinessType(event.target.value)}
                className={inputClass}
              >
                <option value="">업종을 선택해 주세요</option>
                {businessTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={businessType}
                onChange={(event) => setBusinessType(event.target.value)}
                placeholder="직접 입력도 가능합니다. 예: 반려동물 용품"
                className={inputClass}
                aria-label="업종 직접 입력"
              />

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                    이 업종은 이런 정보를 입력하면 좋아요
                  </p>
                  <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                    아래 정보를 채워두면 AI가 고객 문의에 더 정확하게 답변할 수 있어요.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {businessTypeGuideItems.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-100"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
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
              <div className="flex flex-wrap gap-2 pt-1">
                {tonePresets.map((preset) => {
                  const isSelected = storeTone === preset;

                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStoreTone(preset)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-600 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-500"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40"
                      }`}
                      aria-pressed={isSelected}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  대표 상품 정보
                </h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  상품 관련 문의에 더 정확히 답할 수 있도록 대표 상품 정보를 입력해 주세요.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="product_name"
                    className="text-sm font-medium"
                  >
                    대표 상품명
                  </label>
                  <input
                    id="product_name"
                    type="text"
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    placeholder="예: 수제 견과 강정 세트"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="product_description"
                    className="text-sm font-medium"
                  >
                    상품 설명
                  </label>
                  <textarea
                    id="product_description"
                    value={productDescription}
                    onChange={(event) =>
                      setProductDescription(event.target.value)
                    }
                    placeholder="대표 상품의 특징, 맛, 용도 등을 적어주세요."
                    className={textareaClass}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="product_details"
                    className="text-sm font-medium"
                  >
                    구성/용량/재질/사이즈 등
                  </label>
                  <textarea
                    id="product_details"
                    value={productDetails}
                    onChange={(event) => setProductDetails(event.target.value)}
                    placeholder="예: 8개입, 240g, 국내산 견과류 사용"
                    className={textareaClass}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="product_caution"
                    className="text-sm font-medium"
                  >
                    보관방법/주의사항/알레르기/사용법 등
                  </label>
                  <textarea
                    id="product_caution"
                    value={productCaution}
                    onChange={(event) => setProductCaution(event.target.value)}
                    placeholder="예: 직사광선을 피해 서늘한 곳에 보관, 견과류 알레르기 주의"
                    className={textareaClass}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="extra_faq"
                    className="text-sm font-medium"
                  >
                    기타 FAQ/포장·옵션
                  </label>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    선물 포장, 옵션, 자주 묻는 질문처럼 별도로 기억해야 할 내용을 입력하세요.
                  </p>
                  <textarea
                    id="extra_faq"
                    value={extraFaq}
                    onChange={(event) => setExtraFaq(event.target.value)}
                    placeholder="예: 선물 포장 가능합니다. 각인 옵션은 주문 요청사항에 남겨주세요."
                    className={textareaClass}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="shipping_policy" className="text-sm font-medium">
                배송정책
              </label>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      배송정책 작성 도우미
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      자주 묻는 배송 정보를 문장으로 정리합니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBuildShippingPolicy}
                    className="mt-2 inline-flex h-9 w-fit items-center justify-center rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 sm:mt-0"
                  >
                    배송정책 문장 만들기
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="shipping_cutoff"
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                    >
                      {isCafePolicyHelper
                        ? "예약/픽업 기준 시간"
                        : isFoodPolicyHelper
                          ? "주문 접수 기준 시간"
                          : "출고 마감 시간"}
                    </label>
                    <input
                      id="shipping_cutoff"
                      type="text"
                      value={shippingCutoffTime}
                      onChange={(event) =>
                        setShippingCutoffTime(event.target.value)
                      }
                      placeholder={
                        isCafePolicyHelper
                          ? "예: 픽업 하루 전 오후 6시"
                          : isFoodPolicyHelper
                            ? "예: 오후 8시"
                            : "예: 오후 2시"
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {isCafePolicyHelper
                        ? "당일 픽업/예약 가능 여부"
                        : isFoodPolicyHelper
                          ? "당일 주문 가능 여부"
                          : "당일 출고 여부"}
                    </p>
                    <div className="flex gap-2">
                      {["가능", "불가능"].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSameDayShipping(option)}
                          className={`${policyOptionButtonClass} ${
                            sameDayShipping === option
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                          }`}
                          aria-pressed={sameDayShipping === option}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="courier_name"
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                    >
                      {isCafePolicyHelper
                        ? "픽업/예약 안내"
                        : isFoodPolicyHelper
                          ? "조리/배달 안내"
                          : "택배사"}
                    </label>
                    <input
                      id="courier_name"
                      type="text"
                      value={courierName}
                      onChange={(event) => setCourierName(event.target.value)}
                      placeholder={
                        isCafePolicyHelper
                          ? "예: 매장 픽업 가능"
                          : isFoodPolicyHelper
                            ? "예: 주문량에 따라 배달 시간 변동"
                            : "예: CJ대한통운"
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="remote_area_fee"
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                    >
                      {isCafePolicyHelper
                        ? "예약 가능 일정"
                        : isFoodPolicyHelper
                          ? "배달 가능 지역"
                          : "제주/도서산간 추가 배송비"}
                    </label>
                    <input
                      id="remote_area_fee"
                      type="text"
                      value={remoteAreaFee}
                      onChange={(event) => setRemoteAreaFee(event.target.value)}
                      placeholder={
                        isCafePolicyHelper
                          ? "예: 최소 2일 전 예약"
                          : isFoodPolicyHelper
                            ? "예: 매장 반경 3km"
                            : "예: 3,000원"
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
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
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      환불정책 작성 도우미
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      환불 가능 여부와 문의 기준을 문장으로 정리합니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBuildRefundPolicy}
                    className="mt-2 inline-flex h-9 w-fit items-center justify-center rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 sm:mt-0"
                  >
                    환불정책 문장 만들기
                  </button>
                </div>

                {isCafePolicyHelper ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        제조 시작 전 취소 가능 여부
                      </p>
                      <div className="flex gap-2">
                        {["가능", "불가능"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setCafeCancelBeforeProduction(option)
                            }
                            className={`${policyOptionButtonClass} ${
                              cafeCancelBeforeProduction === option
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            }`}
                            aria-pressed={
                              cafeCancelBeforeProduction === option
                            }
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        제조 시작 후 취소 가능 여부
                      </p>
                      <div className="flex gap-2">
                        {["가능", "불가능"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setCafeCancelAfterProduction(option)
                            }
                            className={`${policyOptionButtonClass} ${
                              cafeCancelAfterProduction === option
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            }`}
                            aria-pressed={
                              cafeCancelAfterProduction === option
                            }
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        픽업/수령 후 환불 가능 여부
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {["가능", "불가능", "확인 필요"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setCafeRefundAfterPickup(option)}
                            className={`${policyOptionButtonClass} ${
                              cafeRefundAfterPickup === option
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            }`}
                            aria-pressed={cafeRefundAfterPickup === option}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="cafe_reservation_cancel_deadline"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        예약 주문 취소 마감 시간
                      </label>
                      <input
                        id="cafe_reservation_cancel_deadline"
                        type="text"
                        value={cafeReservationCancelDeadline}
                        onChange={(event) =>
                          setCafeReservationCancelDeadline(event.target.value)
                        }
                        placeholder="예: 픽업 하루 전 오후 6시까지"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label
                        htmlFor="cafe_product_issue_standard"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        제품 이상 시 처리 기준
                      </label>
                      <input
                        id="cafe_product_issue_standard"
                        type="text"
                        value={cafeProductIssueStandard}
                        onChange={(event) =>
                          setCafeProductIssueStandard(event.target.value)
                        }
                        placeholder="예: 제품에 문제가 있는 경우 수령 후 가능한 빠르게 문의"
                        className={inputClass}
                      />
                    </div>
                  </div>
                ) : isFoodPolicyHelper ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        조리 시작 전 취소 가능 여부
                      </p>
                      <div className="flex gap-2">
                        {["가능", "불가능"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setFoodCancelBeforeCooking(option)}
                            className={`${policyOptionButtonClass} ${
                              foodCancelBeforeCooking === option
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            }`}
                            aria-pressed={foodCancelBeforeCooking === option}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        조리 시작 후 취소 가능 여부
                      </p>
                      <div className="flex gap-2">
                        {["가능", "불가능"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setFoodCancelAfterCooking(option)}
                            className={`${policyOptionButtonClass} ${
                              foodCancelAfterCooking === option
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            }`}
                            aria-pressed={foodCancelAfterCooking === option}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="food_refund_after_delivery"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        배달 완료 후 환불 기준
                      </label>
                      <input
                        id="food_refund_after_delivery"
                        type="text"
                        value={foodRefundAfterDelivery}
                        onChange={(event) =>
                          setFoodRefundAfterDelivery(event.target.value)
                        }
                        placeholder="예: 주문 상태와 사유 확인 후 안내"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="food_missing_wrong_standard"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        음식 누락/오배송 처리 기준
                      </label>
                      <input
                        id="food_missing_wrong_standard"
                        type="text"
                        value={foodMissingWrongStandard}
                        onChange={(event) =>
                          setFoodMissingWrongStandard(event.target.value)
                        }
                        placeholder="예: 누락 메뉴와 주문 정보 확인 후 안내"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label
                        htmlFor="food_condition_issue_standard"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        음식 상태 문제 처리 기준
                      </label>
                      <input
                        id="food_condition_issue_standard"
                        type="text"
                        value={foodConditionIssueStandard}
                        onChange={(event) =>
                          setFoodConditionIssueStandard(event.target.value)
                        }
                        placeholder="예: 사진과 주문 정보를 확인한 뒤 안내"
                        className={inputClass}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        단순 변심 환불 가능 여부
                      </p>
                      <div className="flex gap-2">
                        {["가능", "불가능"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setChangeOfMindRefund(option)}
                            className={`${policyOptionButtonClass} ${
                              changeOfMindRefund === option
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            }`}
                            aria-pressed={changeOfMindRefund === option}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="defect_deadline"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        상품 하자 문의 기한
                      </label>
                      <input
                        id="defect_deadline"
                        type="text"
                        value={defectContactDeadline}
                        onChange={(event) =>
                          setDefectContactDeadline(event.target.value)
                        }
                        placeholder="예: 수령 후 24시간 이내"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="return_shipping_fee"
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        반품 배송비
                      </label>
                      <input
                        id="return_shipping_fee"
                        type="text"
                        value={returnShippingFee}
                        onChange={(event) =>
                          setReturnShippingFee(event.target.value)
                        }
                        placeholder="예: 고객 부담 3,000원"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </div>
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

        {activeTab === "answer" && needsStoreInfo ? (
          <section className="order-[29] rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/25">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                먼저 가게 설정을 완료하면 AI 답변을 더 정확하게 만들 수 있어요
              </p>
              <button
                type="button"
                onClick={() => goToTabSection("store", "store-info")}
                className="inline-flex h-9 w-fit items-center justify-center rounded-lg bg-emerald-700 px-3 text-xs font-medium text-white transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                가게 설정하기
              </button>
            </div>
          </section>
        ) : null}

        <section
          id="cs-reply"
          className={`${cardClass} scroll-mt-32 border-sky-200/70 dark:border-sky-900/50 ${
            activeTab === "answer" ? "order-[30]" : "hidden"
          }`}
        >
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900">
                정책 기반 CS
              </p>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                문의에 답변하기
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                배송, 환불, 교환, 상품 관련 고객 문의에 답변합니다. 등록된 배송정책과 환불정책을 기준으로 답변하며, 모르는 내용은 추측하지 않습니다.
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
                  placeholder="예: 제주도 배송비 얼마예요? / 환불 가능한가요? / 오늘 출고되나요?"
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
                disabled={csLoading || aiGenerationBlocked}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-sky-700 px-5 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
              >
                {csLoading ? "생성 중..." : "문의 답변 작성하기"}
              </button>

              {needsStoreInfo ? (
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  먼저 우리 가게 정보를 등록해주세요
                </p>
              ) : null}

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

        <section
          id="cs-history"
          className={`${cardClass} scroll-mt-32 ${
            activeTab === "manage" ? "order-[42]" : "hidden"
          }`}
        >
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
            <EmptyStateCard
              title="아직 고객 문의 기록이 없습니다"
              description="자주 들어오는 문의를 입력하고 AI 답변을 생성해보세요."
              actionLabel="문의 답변 작성하기"
              onAction={() => goToTabSection("answer", "cs-reply")}
            />
          ) : (
            <ul className="space-y-4">
              {csMessages.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 shadow-sm dark:border-sky-900/50 dark:bg-sky-950/25"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => void handleDeleteCsMessage(item.id)}
                      disabled={deletingCsMessageId === item.id}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      {deletingCsMessageId === item.id ? "삭제 중..." : "삭제"}
                    </button>
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

        <section
          id="missing-infos"
          className={`${cardClass} scroll-mt-32 ${
            activeTab === "manage" ? "order-[41]" : "hidden"
          }`}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                AI가 추가로 확인이 필요한 정보
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                등록된 가게, 상품, 정책 정보만으로 답하기 어려웠던 문의를 모아둡니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadMissingInfos()}
              disabled={missingInfosLoading}
              className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              새로고침
            </button>
          </div>

          {missingInfosError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {missingInfosError}
            </div>
          ) : null}

          {missingInfoResolveMessage ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              {missingInfoResolveMessage}
            </div>
          ) : null}

          {missingInfosLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              확인이 필요한 정보를 불러오는 중...
            </p>
          ) : missingInfos.length === 0 ? (
            <EmptyStateCard
              title="현재 확인이 필요한 정보가 없습니다"
              description="AI가 답변하기 어려운 질문을 발견하면 이곳에 표시됩니다."
              actionLabel="가게 정보 보강하기"
              onAction={() => goToTabSection("store", "store-info")}
            />
          ) : (
            <ul className="space-y-4">
              {missingInfos.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/25"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:ring-amber-800">
                      {item.status}
                    </span>
                    {(item.inquiry_count ?? 1) >= 2 ? (
                      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800 ring-1 ring-orange-200 dark:bg-orange-900/50 dark:text-orange-200 dark:ring-orange-800">
                        관련 문의 총 {item.inquiry_count}건
                      </span>
                    ) : null}
                    <time
                      dateTime={item.created_at}
                      className="text-xs text-zinc-500 dark:text-zinc-400"
                    >
                      {formatDate(item.created_at)}
                    </time>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-900/50 dark:bg-zinc-900">
                      <p className="mb-1 font-medium text-amber-800 dark:text-amber-200">
                        사장님에게 필요한 질문
                      </p>
                      <p className="whitespace-pre-wrap leading-6 text-zinc-800 dark:text-zinc-200">
                        {item.question}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-1 font-medium text-sky-700 dark:text-sky-300">
                        원래 고객 문의
                      </p>
                      <p className="whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.source_message}
                      </p>
                    </div>
                    {item.source_messages && item.source_messages.length > 0 ? (
                      <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                        <p className="mb-2 font-medium text-zinc-700 dark:text-zinc-200">
                          유사 문의 예시
                        </p>
                        <ul className="space-y-1.5 text-zinc-700 dark:text-zinc-300">
                          {item.source_messages.slice(0, 3).map((message) => (
                            <li key={message} className="flex gap-2">
                              <span aria-hidden> - </span>
                              <span className="whitespace-pre-wrap leading-6">
                                {message}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-1 font-medium text-zinc-700 dark:text-zinc-200">
                        필요한 이유
                      </p>
                      <p className="whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">
                        {item.reason}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <label
                        htmlFor={`missing_info_answer_${item.id}`}
                        className="mb-2 block font-medium text-zinc-700 dark:text-zinc-200"
                      >
                        답변 입력
                      </label>
                      <textarea
                        id={`missing_info_answer_${item.id}`}
                        value={missingInfoAnswers[item.id] ?? ""}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setMissingInfoAnswers((currentAnswers) => ({
                            ...currentAnswers,
                            [item.id]: nextValue,
                          }));
                        }}
                        placeholder="예: 선물 포장 가능합니다. 추가 비용은 1,000원입니다."
                        className="min-h-24 w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <label
                        htmlFor={`missing_info_target_${item.id}`}
                        className="mb-2 mt-3 block font-medium text-zinc-700 dark:text-zinc-200"
                      >
                        저장 위치
                      </label>
                      <select
                        id={`missing_info_target_${item.id}`}
                        value={missingInfoTargetFields[item.id] ?? "extra_faq"}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setMissingInfoTargetFields((currentFields) => ({
                            ...currentFields,
                            [item.id]: nextValue,
                          }));
                        }}
                        className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        <option value="extra_faq">기타 FAQ/포장·옵션</option>
                        <option value="product_details">상품 정보</option>
                        <option value="product_caution">
                          주의사항/사용법
                        </option>
                        <option value="shipping_policy">배송 정책</option>
                        <option value="refund_policy">환불 정책</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleResolveMissingInfo(item.id)}
                        disabled={missingInfoResolvingId === item.id}
                        className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-amber-700 px-4 text-sm font-medium text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
                      >
                        {missingInfoResolvingId === item.id
                          ? "반영 중..."
                          : "가게 정보에 반영"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          id="review-reply"
          className={`${cardClass} scroll-mt-32 ${
            activeTab === "answer" ? "order-[31]" : "hidden"
          }`}
        >
          <div className="mb-6">
            <p className="mb-2 inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
              리뷰 답글
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              리뷰에 답글 달기
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              고객이 남긴 리뷰에 감사 답글을 작성합니다. 맛, 서비스, 배송에 대한 리뷰를 입력하면 우리 가게 말투에 맞춰 답글을 만들어드려요.
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
                placeholder="예: 족발이 정말 부드럽고 맛있었어요! 다음에도 주문할게요."
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
              disabled={isLoading || aiGenerationBlocked}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isLoading ? "생성 중..." : "리뷰 답글 작성하기"}
            </button>
            {needsStoreInfo ? (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                먼저 우리 가게 정보를 등록해주세요
              </p>
            ) : null}
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

        <section
          id="review-history"
          className={`${cardClass} scroll-mt-32 ${
            activeTab === "manage" ? "order-[43]" : "hidden"
          }`}
        >
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
            <EmptyStateCard
              title="아직 리뷰 답글 기록이 없습니다"
              description="고객 리뷰를 입력하고 첫 AI 답글을 생성해보세요."
              actionLabel="리뷰 답글 작성하기"
              onAction={() => goToTabSection("answer", "review-reply")}
            />
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
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleDeleteReview(item.id)}
                        disabled={deletingReviewId === item.id}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        {deletingReviewId === item.id ? "삭제 중..." : "삭제"}
                      </button>
                      <time
                        dateTime={item.created_at}
                        className="text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        {formatDate(item.created_at)}
                      </time>
                    </div>
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
