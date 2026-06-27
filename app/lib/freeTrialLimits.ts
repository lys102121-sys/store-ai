export const UNPAID_AI_REPLY_LIMIT = 0;
export const UNPAID_BATCH_REVIEW_LIMIT = 0;
export const PAID_PLAN_REQUIRED_MESSAGE =
  "AI 답변 생성과 실제 플랫폼 연동은 유료 도입 후 사용할 수 있습니다. 도입 상담을 요청해 주세요.";

// Backward-compatible aliases for existing billing helpers.
export const FREE_TRIAL_AI_REPLY_LIMIT = UNPAID_AI_REPLY_LIMIT;
export const FREE_TRIAL_BATCH_REVIEW_LIMIT = UNPAID_BATCH_REVIEW_LIMIT;
export const FREE_TRIAL_LIMIT_REACHED_MESSAGE = PAID_PLAN_REQUIRED_MESSAGE;
