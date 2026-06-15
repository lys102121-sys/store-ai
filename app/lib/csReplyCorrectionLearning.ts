import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyCsCase } from "@/app/lib/csCaseIntake";

export type CsReplyCorrection = {
  id?: string;
  user_id: string;
  source_type: "cs_message";
  source_id: string;
  customer_message: string;
  ai_reply: string;
  owner_reply: string;
  sanitized_customer_message: string;
  sanitized_ai_reply: string;
  sanitized_owner_reply: string;
  case_type: string;
  source_platform: string;
  status: "active" | "archived";
  created_at?: string;
  updated_at?: string;
};

export const csReplyCorrectionsSql = `
create table if not exists cs_reply_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_type text not null default 'cs_message',
  source_id text not null,
  customer_message text not null,
  ai_reply text not null,
  owner_reply text not null,
  sanitized_customer_message text not null,
  sanitized_ai_reply text not null,
  sanitized_owner_reply text not null,
  case_type text not null,
  source_platform text not null default 'manual',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, source_type, source_id)
);

create index if not exists cs_reply_corrections_user_case_idx
  on cs_reply_corrections (user_id, case_type, updated_at desc);

alter table cs_reply_corrections enable row level security;

drop policy if exists "Users can manage own CS reply corrections"
  on cs_reply_corrections;

create policy "Users can manage own CS reply corrections"
  on cs_reply_corrections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
`;

function normalizeForComparison(value: string) {
  return value.toLowerCase().replace(/[\s.,!?()[\]{}'"`~:;·…]+/g, "");
}

export function hasMeaningfulCsReplyCorrection(
  aiReply: string,
  ownerReply: string,
) {
  const before = normalizeForComparison(aiReply);
  const after = normalizeForComparison(ownerReply);

  if (!before || !after || before === after) return false;

  const shorterLength = Math.min(before.length, after.length);
  const longerLength = Math.max(before.length, after.length);
  const lengthGap = Math.abs(before.length - after.length);

  if (lengthGap >= 12 || lengthGap / Math.max(longerLength, 1) >= 0.18) {
    return true;
  }

  let differentCharacters = 0;

  for (let index = 0; index < shorterLength; index += 1) {
    if (before[index] !== after[index]) differentCharacters += 1;
  }

  return differentCharacters / Math.max(shorterLength, 1) >= 0.2;
}

export function sanitizeCsCorrectionText(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, "[링크]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[이메일]")
    .replace(/01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/g, "[연락처]")
    .replace(
      /(?:주문|예약|접수|송장|운송장)\s*(?:번호|ID|아이디)?\s*[:#은는]?\s*[A-Za-z0-9-]{4,}/gi,
      "[식별정보]",
    )
    .replace(/\d[\d,]*(?:\.\d+)?\s*(?:만원|천원|원)/g, "[금액]")
    .replace(/\b\d{6,}\b/g, "[식별정보]")
    .replace(/\s+/g, " ")
    .trim();
}

function isMissingCorrectionTableError(error: { message?: string } | null) {
  return Boolean(
    error &&
      /cs_reply_corrections|schema cache|does not exist/i.test(
        error.message ?? "",
      ),
  );
}

function warnMissingCorrectionTable() {
  console.warn(
    `cs_reply_corrections table is missing. Run this SQL in Supabase SQL editor: ${csReplyCorrectionsSql}`,
  );
}

export async function recordCsReplyCorrection({
  supabase,
  userId,
  sourceId,
  customerMessage,
  aiReply,
  ownerReply,
  sourcePlatform,
}: {
  supabase: SupabaseClient;
  userId: string;
  sourceId: string | number;
  customerMessage: string;
  aiReply: string;
  ownerReply: string;
  sourcePlatform?: string | null;
}) {
  if (!hasMeaningfulCsReplyCorrection(aiReply, ownerReply)) {
    return { saved: false, skipped: true };
  }

  const now = new Date().toISOString();
  const sourceIdValue = String(sourceId);
  const existing = await supabase
    .from("cs_reply_corrections")
    .select("id")
    .eq("user_id", userId)
    .eq("source_type", "cs_message")
    .eq("source_id", sourceIdValue)
    .maybeSingle();

  if (isMissingCorrectionTableError(existing.error)) {
    warnMissingCorrectionTable();
    return { saved: false, missingTable: true };
  }

  if (existing.error) {
    console.error("Failed to load existing CS reply correction.", existing.error);
    return { saved: false, error: existing.error.message };
  }

  const payload = {
    user_id: userId,
    source_type: "cs_message",
    source_id: sourceIdValue,
    customer_message: customerMessage.trim(),
    ai_reply: aiReply.trim(),
    owner_reply: ownerReply.trim(),
    sanitized_customer_message: sanitizeCsCorrectionText(customerMessage),
    sanitized_ai_reply: sanitizeCsCorrectionText(aiReply),
    sanitized_owner_reply: sanitizeCsCorrectionText(ownerReply),
    case_type: classifyCsCase(customerMessage).type,
    source_platform: sourcePlatform?.trim() || "manual",
    status: "active",
    updated_at: now,
  };
  const mutation = existing.data?.id
    ? await supabase
        .from("cs_reply_corrections")
        .update({
          owner_reply: payload.owner_reply,
          sanitized_owner_reply: payload.sanitized_owner_reply,
          case_type: payload.case_type,
          source_platform: payload.source_platform,
          status: "active",
          updated_at: now,
        })
        .eq("id", existing.data.id)
        .eq("user_id", userId)
    : await supabase.from("cs_reply_corrections").insert(payload);
  const { error } = mutation;

  if (!error) return { saved: true };

  if (isMissingCorrectionTableError(error)) {
    warnMissingCorrectionTable();
    return { saved: false, missingTable: true };
  }

  console.error("Failed to save CS reply correction.", error);
  return { saved: false, error: error.message };
}

export async function loadCsReplyCorrections({
  supabase,
  userId,
  limit = 60,
}: {
  supabase: SupabaseClient;
  userId: string;
  limit?: number;
}) {
  const { data, error } = await supabase
    .from("cs_reply_corrections")
    .select(
      "id, user_id, source_type, source_id, customer_message, ai_reply, owner_reply, sanitized_customer_message, sanitized_ai_reply, sanitized_owner_reply, case_type, source_platform, status, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!error) return (data ?? []) as CsReplyCorrection[];

  if (isMissingCorrectionTableError(error)) {
    warnMissingCorrectionTable();
    return [];
  }

  console.error("Failed to load CS reply corrections.", error);
  return [];
}

const genericTokens = new Set([
  "고객",
  "문의",
  "답변",
  "확인",
  "안내",
  "주세요",
  "합니다",
  "있어요",
  "되나요",
  "상품",
  "제품",
]);

function getTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^0-9a-z가-힣]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !genericTokens.has(token)),
  );
}

function correctionRelevanceScore(
  customerMessage: string,
  correction: CsReplyCorrection,
) {
  const currentCaseType = classifyCsCase(customerMessage).type;
  const messageTokens = getTokens(customerMessage);
  const correctionTokens = getTokens(correction.sanitized_customer_message);
  const tokenOverlap = [...messageTokens].filter((token) =>
    correctionTokens.has(token),
  ).length;
  const sameCaseBonus =
    correction.case_type === currentCaseType
      ? currentCaseType === "information_request"
        ? 2
        : 6
      : 0;

  return sameCaseBonus + tokenOverlap * 3;
}

export function selectRelevantCsReplyCorrections(
  customerMessage: string,
  corrections: CsReplyCorrection[],
  limit = 2,
) {
  return corrections
    .map((correction) => ({
      correction,
      score: correctionRelevanceScore(customerMessage, correction),
    }))
    .filter(({ score }) => score >= 5)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ correction }) => correction);
}

export function buildCsReplyCorrectionPrompt(
  customerMessage: string,
  corrections: CsReplyCorrection[],
) {
  const relevantCorrections = selectRelevantCsReplyCorrections(
    customerMessage,
    corrections,
  );

  if (relevantCorrections.length === 0) return "";

  return [
    "[사장님이 수정한 유사 답변 학습]",
    "아래 사례는 사실·정책 근거가 아니라 사장님이 선호하는 설명 순서, 확인 방식, 문장 길이와 말투를 참고하기 위한 자료입니다.",
    "사례의 금액, 일정, 가능 여부, 상품 정보, 고객 정보는 현재 문의에 절대 재사용하지 마세요. 현재 가게 정보에 명시된 사실만 답변 근거로 사용하세요.",
    ...relevantCorrections.map(
      (correction, index) =>
        `${index + 1}. 과거 문의: ${correction.sanitized_customer_message}\nAI 초안: ${correction.sanitized_ai_reply}\n사장님 수정: ${correction.sanitized_owner_reply}`,
    ),
  ].join("\n");
}
