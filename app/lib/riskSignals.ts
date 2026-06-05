export const healthSafetyPattern =
  /알레르기|알러지|두드러기|발진|붉어|복통|배가\s*아프|식중독|상한\s*것\s*같|상한|이상\s*반응|호흡|병원|아프다|아파|먹고\s*탈|탈났|피부\s*반응|피부|가려|위생/;

export const disputePattern = /법적|신고|소송|분쟁|고소|소비자원|보상/;

export const strongComplaintPattern =
  /최악|화나|불쾌|실망|강력|항의|클레임/;

export const refundExchangePattern = /환불|반품|교환|취소/;

export function hasHealthSafetySignal(text: string) {
  return healthSafetyPattern.test(text);
}

export function hasDisputeSignal(text: string) {
  return disputePattern.test(text);
}

export function hasStrongComplaintSignal(text: string) {
  return strongComplaintPattern.test(text);
}

export function hasRefundExchangeSignal(text: string) {
  return refundExchangePattern.test(text);
}
