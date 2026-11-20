import { useState } from 'react';
import { requiredAgreed, type Agreements } from '../model/terms';

/** 약관 동의 체크 상태. */
export function useAgreements() {
  const [agreed, setAgreed] = useState<Agreements>({
    service: false,
    privacy: false,
    marketing: false,
  });
  return { agreed, setAgreed, requiredAgreed: requiredAgreed(agreed) };
}
