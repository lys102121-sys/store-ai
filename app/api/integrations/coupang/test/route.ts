import { requireAuthenticatedUser } from "@/app/lib/auth";
import {
  COUPANG_OPEN_API_HOST,
  createCoupangAuthorization,
} from "@/app/lib/coupangOpenApi";

export const runtime = "nodejs";

const COUPANG_CONNECTION_ERROR =
  "Coupang connection test failed. Check vendorId, accessKey, and secretKey.";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createInquiryQuery(vendorId: string) {
  const inquiryEndAt = new Date();
  const inquiryStartAt = new Date(inquiryEndAt);
  inquiryStartAt.setUTCDate(inquiryStartAt.getUTCDate() - 1);

  // 쿠팡 문서 확인 후 query parameter 조정 필요
  return new URLSearchParams({
    inquiryStartAt: formatDate(inquiryStartAt),
    inquiryEndAt: formatDate(inquiryEndAt),
    vendorId,
    answeredType: "ALL",
    pageSize: "10",
    pageNum: "1",
  }).toString();
}

function truncateForLog(value: string) {
  return value.length > 500 ? `${value.slice(0, 500)}...` : value;
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { data: credential, error: credentialError } = await auth.supabase
    .from("platform_credentials")
    .select("vendor_id, access_key, secret_key")
    .eq("user_id", auth.userId)
    .eq("platform", "coupang")
    .maybeSingle();

  if (credentialError) {
    return Response.json(
      { error: "Failed to read Coupang credentials.", detail: credentialError.message },
      { status: 500 },
    );
  }

  const vendorId = credential?.vendor_id?.trim();
  const accessKey = credential?.access_key?.trim();
  const secretKey = credential?.secret_key?.trim();

  if (!vendorId || !accessKey || !secretKey) {
    return Response.json(
      { error: "Coupang credentials are incomplete." },
      { status: 400 },
    );
  }

  const method = "GET";
  const path = `/v2/providers/openapi/apis/api/v5/vendors/${encodeURIComponent(vendorId)}/onlineInquiries`;
  const query = createInquiryQuery(vendorId);
  let authorization: string;

  try {
    authorization = createCoupangAuthorization({
      method,
      path,
      query,
      accessKey,
      secretKey,
    });
  } catch (error) {
    const failedAt = new Date().toISOString();
    await auth.supabase
      .from("platform_credentials")
      .update({
        status: "error",
        last_tested_at: failedAt,
        updated_at: failedAt,
      })
      .eq("user_id", auth.userId)
      .eq("platform", "coupang");

    return Response.json(
      {
        error: "Failed to create Coupang HMAC signature.",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 500 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const testedAt = new Date().toISOString();

  try {
    const response = await fetch(`${COUPANG_OPEN_API_HOST}${path}?${query}`, {
      method,
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "X-Requested-By": vendorId,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseBody = truncateForLog(await response.text());
      console.error("Coupang connection test failed.", {
        status: response.status,
        responseBody,
      });

      await auth.supabase
        .from("platform_credentials")
        .update({
          status: "error",
          last_tested_at: testedAt,
          updated_at: testedAt,
        })
        .eq("user_id", auth.userId)
        .eq("platform", "coupang");

      return Response.json(
        { error: COUPANG_CONNECTION_ERROR, detail: `HTTP ${response.status}` },
        { status: 502 },
      );
    }

    const { error: updateError } = await auth.supabase
      .from("platform_credentials")
      .update({
        status: "connected",
        last_tested_at: testedAt,
        updated_at: testedAt,
      })
      .eq("user_id", auth.userId)
      .eq("platform", "coupang");

    if (updateError) {
      return Response.json(
        { error: "Failed to update Coupang connection status.", detail: updateError.message },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      status: "connected",
      last_tested_at: testedAt,
    });
  } catch (error) {
    console.error("Coupang connection test request failed.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    await auth.supabase
      .from("platform_credentials")
      .update({
        status: "error",
        last_tested_at: testedAt,
        updated_at: testedAt,
      })
      .eq("user_id", auth.userId)
      .eq("platform", "coupang");

    return Response.json(
      { error: COUPANG_CONNECTION_ERROR },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
