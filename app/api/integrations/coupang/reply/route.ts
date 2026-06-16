import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAuthenticatedUser } from "@/app/lib/auth";
import { getBillingPlanStatus } from "@/app/lib/billingPlan";
import {
  COUPANG_OPEN_API_HOST,
  createCoupangAuthorization,
  createCoupangOnlineInquiryReplyBody,
  createCoupangOnlineInquiryReplyPath,
} from "@/app/lib/coupangOpenApi";

export const runtime = "nodejs";

const COUPANG_REPLY_ERROR =
  "쿠팡 답변 등록에 실패했습니다. 쿠팡 연동 설정을 확인해 주세요.";

type RequestBody = {
  csMessageId?: unknown;
};

function truncateForLog(value: string) {
  return value.length > 500 ? `${value.slice(0, 500)}...` : value;
}

async function updateCsMessagePlatformState({
  supabase,
  userId,
  csMessageId,
  status,
  platformStatus,
}: {
  supabase: SupabaseClient;
  userId: string;
  csMessageId: string;
  status?: "completed";
  platformStatus: "posted" | "failed";
}) {
  const payload: { status?: "completed"; platform_status: "posted" | "failed" } =
    {
      platform_status: platformStatus,
    };

  if (status) {
    payload.status = status;
  }

  const { error } = await supabase
    .from("cs_messages")
    .update(payload)
    .eq("id", csMessageId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update Coupang CS message state.", {
      csMessageId,
      message: error.message,
    });
    return false;
  }

  return true;
}

function buildCoupangReplyFailureResponse(status = 502) {
  return Response.json(
    {
      success: false,
      message: COUPANG_REPLY_ERROR,
    },
    { status },
  );
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json(
      { success: false, message: "올바른 요청 내용을 입력해 주세요." },
      { status: 400 },
    );
  }

  const csMessageId =
    typeof body.csMessageId === "string" ? body.csMessageId.trim() : "";

  if (!csMessageId) {
    return Response.json(
      { success: false, message: "CS 문의 id가 필요합니다." },
      { status: 400 },
    );
  }

  const { data: csMessage, error: csMessageError } = await auth.supabase
    .from("cs_messages")
    .select("id, reply, source_platform, external_id")
    .eq("id", csMessageId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (csMessageError) {
    console.error("Failed to load Coupang CS message.", {
      csMessageId,
      message: csMessageError.message,
    });
    return buildCoupangReplyFailureResponse(500);
  }

  if (!csMessage) {
    return Response.json(
      { success: false, message: "해당 문의를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (csMessage.source_platform !== "coupang") {
    return Response.json(
      { success: false, message: "쿠팡 문의만 등록할 수 있습니다." },
      { status: 400 },
    );
  }

  const reply =
    typeof csMessage.reply === "string" ? csMessage.reply.trim() : "";
  const externalId =
    typeof csMessage.external_id === "string"
      ? csMessage.external_id.trim()
      : "";

  if (!reply || !externalId) {
    return Response.json(
      { success: false, message: "답변 초안과 쿠팡 문의 id가 필요합니다." },
      { status: 400 },
    );
  }

  if (externalId.startsWith("mock-coupang")) {
    const updated = await updateCsMessagePlatformState({
      supabase: auth.supabase,
      userId: auth.userId,
      csMessageId,
      status: "completed",
      platformStatus: "posted",
    });

    if (!updated) {
      return buildCoupangReplyFailureResponse(500);
    }

    return Response.json({
      success: true,
      mock: true,
      message: "샘플 문의가 플랫폼 등록 완료 상태로 처리되었습니다.",
    });
  }

  const plan = await getBillingPlanStatus({
    supabase: auth.supabase,
    userId: auth.userId,
  });

  if (!plan.isPaid) {
    await updateCsMessagePlatformState({
      supabase: auth.supabase,
      userId: auth.userId,
      csMessageId,
      platformStatus: "failed",
    });

    return Response.json(
      {
        success: false,
        message:
          "실제 쿠팡 답변 등록은 유료 플랜에서 사용할 수 있습니다. 도입 상담 후 연결해 주세요.",
        paid_plan_required: true,
      },
      { status: 402 },
    );
  }

  const { data: credential, error: credentialError } = await auth.supabase
    .from("platform_credentials")
    .select("vendor_id, access_key, secret_key, wing_id")
    .eq("user_id", auth.userId)
    .eq("platform", "coupang")
    .maybeSingle();

  if (credentialError) {
    console.error("Failed to load Coupang credentials for reply.", {
      message: credentialError.message,
    });
    await updateCsMessagePlatformState({
      supabase: auth.supabase,
      userId: auth.userId,
      csMessageId,
      platformStatus: "failed",
    });
    return buildCoupangReplyFailureResponse(500);
  }

  const vendorId = credential?.vendor_id?.trim();
  const accessKey = credential?.access_key?.trim();
  const secretKey = credential?.secret_key?.trim();
  const wingId = credential?.wing_id?.trim();

  if (!vendorId || !accessKey || !secretKey || !wingId) {
    await updateCsMessagePlatformState({
      supabase: auth.supabase,
      userId: auth.userId,
      csMessageId,
      platformStatus: "failed",
    });
    return buildCoupangReplyFailureResponse(400);
  }

  const method = "POST";
  const path = createCoupangOnlineInquiryReplyPath(vendorId, externalId);
  const query = "";
  let authorization: string;
  let requestBody: ReturnType<typeof createCoupangOnlineInquiryReplyBody>;

  try {
    authorization = createCoupangAuthorization({
      method,
      path,
      query,
      accessKey,
      secretKey,
    });
    requestBody = createCoupangOnlineInquiryReplyBody({
      inquiryId: externalId,
      reply,
      wingId,
    });
  } catch (error) {
    console.error("Failed to prepare Coupang inquiry reply.", {
      csMessageId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    await updateCsMessagePlatformState({
      supabase: auth.supabase,
      userId: auth.userId,
      csMessageId,
      platformStatus: "failed",
    });
    return buildCoupangReplyFailureResponse(500);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${COUPANG_OPEN_API_HOST}${path}`, {
      method,
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "X-Requested-By": vendorId,
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error("Coupang inquiry reply request failed.", {
        csMessageId,
        status: response.status,
        responseBody: truncateForLog(await response.text()),
      });
      await updateCsMessagePlatformState({
        supabase: auth.supabase,
        userId: auth.userId,
        csMessageId,
        platformStatus: "failed",
      });
      return buildCoupangReplyFailureResponse();
    }

    const updated = await updateCsMessagePlatformState({
      supabase: auth.supabase,
      userId: auth.userId,
      csMessageId,
      status: "completed",
      platformStatus: "posted",
    });

    if (!updated) {
      return buildCoupangReplyFailureResponse(500);
    }

    return Response.json({
      success: true,
      message: "쿠팡에 답변을 등록했습니다.",
    });
  } catch (error) {
    console.error("Coupang inquiry reply request failed.", {
      csMessageId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    await updateCsMessagePlatformState({
      supabase: auth.supabase,
      userId: auth.userId,
      csMessageId,
      platformStatus: "failed",
    });
    return buildCoupangReplyFailureResponse();
  } finally {
    clearTimeout(timeout);
  }
}
