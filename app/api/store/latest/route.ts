import { requireAuthenticatedUser } from "@/app/lib/auth";

const storeSelectColumns =
  "user_id, store_name, business_type, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_reply_examples, owner_cs_examples, auto_complete_low_risk_cs, auto_complete_positive_reviews, ai_work_mode, ai_work_start_time, ai_work_end_time, created_at, updated_at";
const legacyStoreSelectColumns =
  "user_id, store_name, business_type, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_reply_examples, owner_cs_examples, auto_complete_low_risk_cs, auto_complete_positive_reviews, created_at, updated_at";
const aiWorkModeSql =
  "alter table stores add column if not exists ai_work_mode text default 'safe_auto'; alter table stores add column if not exists ai_work_start_time text default '09:00'; alter table stores add column if not exists ai_work_end_time text default '22:00';";

function isMissingAiWorkModeColumnError(error: { message?: string } | null) {
  return Boolean(
    error &&
      /(ai_work_mode|ai_work_start_time|ai_work_end_time)/i.test(
        error.message ?? "",
      ),
  );
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  let { data, error } = await auth.supabase
    .from("stores")
    .select(storeSelectColumns)
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (isMissingAiWorkModeColumnError(error)) {
    console.warn(`stores AI work mode columns are missing. Run: ${aiWorkModeSql}`);
    const fallback = await auth.supabase
      .from("stores")
      .select(legacyStoreSelectColumns)
      .eq("user_id", auth.userId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    data = fallback.data
      ? {
          ...fallback.data,
          ai_work_mode: "safe_auto",
          ai_work_start_time: "09:00",
          ai_work_end_time: "22:00",
        }
      : null;
    error = fallback.error;
  }

  if (error) {
    return Response.json(
      { error: "Failed to fetch store.", detail: error.message },
      { status: 500 },
    );
  }

  if (!data) {
    return Response.json({ error: "No store found." }, { status: 404 });
  }

  return Response.json({ store: data });
}
