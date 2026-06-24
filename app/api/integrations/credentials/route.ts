import { requireAuthenticatedUser } from "@/app/lib/auth";

type CredentialsRequestBody = {
  platform?: unknown;
  vendor_id?: unknown;
  access_key?: unknown;
  secret_key?: unknown;
  wing_id?: unknown;
};

function normalizeText(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  return typeof value === "string" ? value.trim() : null;
}

function normalizeCredentialPlatform(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "coupang";
  }

  if (value === "coupang" || value === "smartstore") {
    return value;
  }

  return null;
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.supabase
    .from("platform_credentials")
    .select(
      "id, user_id, platform, vendor_id, access_key, secret_key, wing_id, status, last_tested_at, created_at, updated_at",
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json(
      { error: "Failed to fetch platform credentials.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({
    credentials: (data ?? []).map(({ secret_key, ...credential }) => ({
      ...credential,
      has_secret_key: Boolean(secret_key),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  let body: CredentialsRequestBody;
  try {
    body = (await request.json()) as CredentialsRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const vendorId = normalizeText(body.vendor_id);
  const accessKey = normalizeText(body.access_key);
  const secretKey = normalizeText(body.secret_key);
  const wingId = normalizeText(body.wing_id);
  const platform = normalizeCredentialPlatform(body.platform);

  if (
    platform === null ||
    vendorId === null ||
    accessKey === null ||
    secretKey === null ||
    wingId === null
  ) {
    return Response.json(
      { error: "Credential values must be strings." },
      { status: 400 },
    );
  }

  const { data: existingCredential, error: existingCredentialError } =
    await auth.supabase
      .from("platform_credentials")
      .select("secret_key, status")
      .eq("user_id", auth.userId)
      .eq("platform", platform)
      .maybeSingle();

  if (existingCredentialError) {
    return Response.json(
      {
        error: "Failed to read existing platform credentials.",
        detail: existingCredentialError.message,
      },
      { status: 500 },
    );
  }

  const savedSecretKey = secretKey || existingCredential?.secret_key || null;
  const { data, error } = await auth.supabase
    .from("platform_credentials")
    .upsert(
      {
        user_id: auth.userId,
        platform,
        vendor_id: vendorId || null,
        access_key: accessKey || null,
        secret_key: savedSecretKey,
        wing_id: wingId || null,
        status: existingCredential?.status ?? "not_connected",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" },
    )
    .select(
      "id, user_id, platform, vendor_id, access_key, wing_id, status, last_tested_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return Response.json(
      { error: "Failed to save platform credentials.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({
    credential: {
      ...data,
      has_secret_key: Boolean(savedSecretKey),
    },
  });
}
