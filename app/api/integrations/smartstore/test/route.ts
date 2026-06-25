import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAuthenticatedUser } from "@/app/lib/auth";
import {
  fetchSmartstoreProductInquiries,
  requestSmartstoreAccessToken,
} from "@/app/lib/smartstoreOpenApi";

export const runtime = "nodejs";

const SMARTSTORE_CONNECTION_ERROR =
  "Smartstore connection test failed. Check clientId, clientSecret, and accountId.";

async function updateSmartstoreConnectionStatus({
  supabase,
  userId,
  status,
  testedAt,
}: {
  supabase: SupabaseClient;
  userId: string;
  status: "connected" | "error";
  testedAt: string;
}) {
  await supabase
    .from("platform_credentials")
    .update({
      status,
      last_tested_at: testedAt,
      updated_at: testedAt,
    })
    .eq("user_id", userId)
    .eq("platform", "smartstore");
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { data: credential, error: credentialError } = await auth.supabase
    .from("platform_credentials")
    .select("vendor_id, access_key, secret_key, wing_id")
    .eq("user_id", auth.userId)
    .eq("platform", "smartstore")
    .maybeSingle();

  if (credentialError) {
    return Response.json(
      {
        error: "Failed to read Smartstore credentials.",
        detail: credentialError.message,
      },
      { status: 500 },
    );
  }

  const vendorId = credential?.vendor_id?.trim();
  const accessKey = credential?.access_key?.trim();
  const secretKey = credential?.secret_key?.trim();
  const wingId = credential?.wing_id?.trim();

  if (!vendorId || !accessKey || !secretKey) {
    return Response.json(
      { error: "Smartstore credentials are incomplete." },
      { status: 400 },
    );
  }

  const testedAt = new Date().toISOString();

  try {
    const accessToken = await requestSmartstoreAccessToken({
      clientId: accessKey,
      clientSecret: secretKey,
      accountId: wingId || vendorId,
    });

    // Naver Commerce API product inquiry list currently uses /v1/contents/qnas.
    // Re-check official docs before production rollout if query parameters change.
    await fetchSmartstoreProductInquiries({
      accessToken,
      page: 1,
      size: 1,
    });

    await updateSmartstoreConnectionStatus({
      supabase: auth.supabase,
      userId: auth.userId,
      status: "connected",
      testedAt,
    });

    return Response.json({
      success: true,
      status: "connected",
      last_tested_at: testedAt,
    });
  } catch (error) {
    console.error("Smartstore connection test failed.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    await updateSmartstoreConnectionStatus({
      supabase: auth.supabase,
      userId: auth.userId,
      status: "error",
      testedAt,
    });

    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("bcrypt package")
          ? "Smartstore OAuth signature dependency is not installed."
          : SMARTSTORE_CONNECTION_ERROR,
        detail: message.includes("bcrypt package") ? message : undefined,
      },
      { status: message.includes("bcrypt package") ? 500 : 502 },
    );
  }
}
