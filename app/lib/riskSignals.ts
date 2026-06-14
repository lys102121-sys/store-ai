export const healthSafetyPattern =
  /알레르기|알러지|두드러기|발진|붉어|복통|배가\s*아프|식중독|상한\s*것\s*같|상한|이상\s*반응|호흡|병원|아프다|아파|먹고\s*탈|탈났|피부\s*반응|피부|가려|위생|다쳤|다침|상처(?:가|를|났|입)|베였|베임|화상|부상/;

export const productSafetyPattern =
  /배터리[^\n]*(?:부풀|팽창)|연기(?:가|이)?\s*(?:났|나왔|발생|피어)|불꽃[^\n]*(?:튀|났|발생)|스파크[^\n]*(?:튀|났|발생)|(?:타는\s*냄새|탄\s*냄새|과열|지나치게\s*뜨거|너무\s*뜨거|감전|누전|폭발|화재)/;

export const disputePattern = /법적|신고|소송|분쟁|고소|소비자원|보상/;

export const strongComplaintPattern =
  /최악|화나|불쾌|실망|강력|항의|클레임/;

export const refundExchangePattern = /환불|반품|교환|취소/;

export function hasHealthSafetySignal(text: string) {
  return healthSafetyPattern.test(text) || productSafetyPattern.test(text);
}

export function hasProductSafetySignal(text: string) {
  return productSafetyPattern.test(text);
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
