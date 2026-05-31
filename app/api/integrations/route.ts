import { requireAuthenticatedUser } from "@/app/lib/auth";

const supportedPlatforms = new Set([
  "baemin",
  "yogiyo",
  "coupangeats",
  "smartstore",
  "coupang",
]);

type IntegrationRequestBody = {
  platform?: unknown;
  store_url?: unknown;
  memo?: unknown;
};

function normalizeOptionalText(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  return typeof value === "string" ? value.trim() : null;
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.supabase
    .from("platform_integration_requests")
    .select("id, user_id, platform, status, store_url, memo, created_at, updated_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json(
      { error: "Failed to fetch integration requests.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ integrations: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  let body: IntegrationRequestBody;
  try {
    body = (await request.json()) as IntegrationRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const platform = typeof body.platform === "string" ? body.platform.trim() : "";
  const storeUrl = normalizeOptionalText(body.store_url);
  const memo = normalizeOptionalText(body.memo);

  if (!supportedPlatforms.has(platform)) {
    return Response.json({ error: "Unsupported platform." }, { status: 400 });
  }

  if (storeUrl === null || memo === null) {
    return Response.json(
      { error: "store_url and memo must be strings." },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("platform_integration_requests")
    .upsert(
      {
        user_id: auth.userId,
        platform,
        status: "requested",
        store_url: storeUrl || null,
        memo: memo || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" },
    )
    .select("id, user_id, platform, status, store_url, memo, created_at, updated_at")
    .single();

  if (error) {
    return Response.json(
      { error: "Failed to save integration request.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ integration: data }, { status: 201 });
}
