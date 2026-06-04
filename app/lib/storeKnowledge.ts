import type { SupabaseClient } from "@supabase/supabase-js";

import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";

export type StoreKnowledgeCategory =
  | "pricing"
  | "shipping"
  | "refund_exchange"
  | "stock"
  | "reservation"
  | "packaging"
  | "allergy_ingredient"
  | "product"
  | "general";

export type StoreKnowledgeItem = {
  id?: string;
  user_id: string;
  store_id?: string | null;
  category: StoreKnowledgeCategory | string;
  question: string;
  answer: string;
  source_type: string;
  source_id?: string | null;
  source_text?: string | null;
  confidence: string;
  created_at?: string;
  updated_at?: string;
};

type StoreKnowledgeSaveInput = {
  supabase: SupabaseClient;
  userId: string;
  storeId: number | string;
  category: StoreKnowledgeCategory | string;
  question: string;
  answer: string;
  sourceId?: string | null;
  sourceText?: string | null;
};

type StoreKnowledgeLoadInput = {
  supabase: SupabaseClient;
  userId: string;
  limit?: number;
};

export const storeKnowledgeSql = `
create table if not exists store_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  store_id text,
  category text not null default 'general',
  question text not null,
  answer text not null,
  source_type text not null default 'missing_info',
  source_id text,
  source_text text,
  confidence text not null default 'owner_confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_knowledge_items_user_id_updated_at_idx
  on store_knowledge_items (user_id, updated_at desc);

create index if not exists store_knowledge_items_user_id_category_idx
  on store_knowledge_items (user_id, category);
`;

function isMissingStoreKnowledgeTableError(error: { message: string } | null) {
  return Boolean(error && /store_knowledge_items|schema cache|does not exist/i.test(error.message));
}

function warnMissingStoreKnowledgeTable() {
  console.warn(`store_knowledge_items table is missing. Run: ${storeKnowledgeSql}`);
}

export function mapMissingInfoTopicToKnowledgeCategory(
  topic?: string | null,
): StoreKnowledgeCategory {
  switch (topic) {
    case "pricing":
      return "pricing";
    case "shipping_fee":
    case "shipping_schedule":
      return "shipping";
    case "refund_exchange":
      return "refund_exchange";
    case "stock":
      return "stock";
    case "reservation":
      return "reservation";
    case "gift_wrapping":
      return "packaging";
    case "allergy":
    case "material":
      return "allergy_ingredient";
    case "product_composition":
    case "size_adjustment":
    case "care_instruction":
      return "product";
    default:
      return "general";
  }
}

export async function saveStoreKnowledgeItem({
  supabase,
  userId,
  storeId,
  category,
  question,
  answer,
  sourceId,
  sourceText,
}: StoreKnowledgeSaveInput) {
  const trimmedQuestion = question.trim();
  const trimmedAnswer = answer.trim();

  if (!trimmedQuestion || !trimmedAnswer) {
    return { saved: false, skipped: true };
  }

  const now = new Date().toISOString();
  const existing = await supabase
    .from("store_knowledge_items")
    .select("id")
    .eq("user_id", userId)
    .eq("category", category)
    .eq("question", trimmedQuestion)
    .maybeSingle();

  if (isMissingStoreKnowledgeTableError(existing.error)) {
    warnMissingStoreKnowledgeTable();
    return { saved: false, missingTable: true };
  }

  if (existing.error) {
    console.warn("Failed to check existing store knowledge item.", existing.error);
    return { saved: false, error: existing.error.message };
  }

  if (existing.data?.id) {
    const { error } = await supabase
      .from("store_knowledge_items")
      .update({
        answer: trimmedAnswer,
        source_type: "missing_info",
        source_id: sourceId ? String(sourceId) : null,
        source_text: sourceText?.trim() || null,
        confidence: "owner_confirmed",
        updated_at: now,
      })
      .eq("id", existing.data.id)
      .eq("user_id", userId);

    if (isMissingStoreKnowledgeTableError(error)) {
      warnMissingStoreKnowledgeTable();
      return { saved: false, missingTable: true };
    }

    if (error) {
      console.warn("Failed to update store knowledge item.", error);
      return { saved: false, error: error.message };
    }

    return { saved: true, updated: true };
  }

  const { error } = await supabase.from("store_knowledge_items").insert({
    user_id: userId,
    store_id: String(storeId),
    category,
    question: trimmedQuestion,
    answer: trimmedAnswer,
    source_type: "missing_info",
    source_id: sourceId ? String(sourceId) : null,
    source_text: sourceText?.trim() || null,
    confidence: "owner_confirmed",
    created_at: now,
    updated_at: now,
  });

  if (isMissingStoreKnowledgeTableError(error)) {
    warnMissingStoreKnowledgeTable();
    return { saved: false, missingTable: true };
  }

  if (error) {
    console.warn("Failed to insert store knowledge item.", error);
    return { saved: false, error: error.message };
  }

  return { saved: true, inserted: true };
}

export async function loadStoreKnowledgeItems({
  supabase,
  userId,
  limit = 50,
}: StoreKnowledgeLoadInput) {
  const { data, error } = await supabase
    .from("store_knowledge_items")
    .select(
      "id, user_id, store_id, category, question, answer, source_type, source_id, source_text, confidence, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (isMissingStoreKnowledgeTableError(error)) {
    warnMissingStoreKnowledgeTable();
    return [];
  }

  if (error) {
    console.warn("Failed to load store knowledge items.", error);
    return [];
  }

  return (data ?? []) as StoreKnowledgeItem[];
}

export function formatStoreKnowledgeForPrompt(items: StoreKnowledgeItem[]) {
  if (items.length === 0) return "";

  return [
    "[사장님이 확인해준 가게 지식]",
    ...items.map((item) => {
      const category = item.category || "general";

      return `- (${category}) ${item.question}: ${item.answer}`;
    }),
  ].join("\n");
}

export function mergeStoreKnowledgeIntoStore<T extends CsReplyPromptStore>(
  store: T,
  knowledgeItems: StoreKnowledgeItem[],
): T {
  const knowledgeText = formatStoreKnowledgeForPrompt(knowledgeItems);

  if (!knowledgeText) return store;

  return {
    ...store,
    extra_faq: [store.extra_faq?.trim(), knowledgeText]
      .filter(Boolean)
      .join("\n\n"),
  };
}
