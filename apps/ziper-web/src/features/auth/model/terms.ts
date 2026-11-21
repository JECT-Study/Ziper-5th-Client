// 가입 약관 목록과 규칙. 이메일 가입과 소셜 신규 가입이 같이 쓴다.
export const TERMS = [
  { id: 'service', label: '[필수] 서비스 이용약관', required: true },
  { id: 'privacy', label: '[필수] 개인정보 수집 및 이용 동의', required: true },
  { id: 'marketing', label: '[선택] 마케팅 정보 수신 동의', required: false },
] as const;

export type Agreements = Record<(typeof TERMS)[number]['id'], boolean>;

export const requiredAgreed = (agreed: Agreements) =>
  TERMS.every((term) => !term.required || agreed[term.id]);
