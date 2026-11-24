import { useEffect, useState } from 'react';
import { isNicknameAvailable } from '../../../api/authApi';
import { isValidNickname } from '../../../model/rules';

type NicknameState = 'idle' | 'checking' | 'available' | 'taken' | 'failed';

const DEBOUNCE_MS = 300;

/** 닉네임 규칙을 확인하고, 입력이 멈추면 서버에 중복 여부를 묻는다. */
export function useNicknameCheck(value: string) {
  const [state, setState] = useState<NicknameState>('idle');
  const valid = isValidNickname(value);

  useEffect(() => {
    if (!valid) return setState('idle');
    setState('checking');
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const available = await isNicknameAvailable(value);
        if (!cancelled) setState(available ? 'available' : 'taken');
      } catch {
        if (!cancelled) setState('failed');
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, valid]);

  const error =
    value.length > 0 && !valid
      ? '한글, 영문, 숫자 2~10자로 입력해주세요'
      : state === 'taken'
        ? '이미 사용 중인 닉네임입니다'
        : state === 'failed'
          ? '중복 확인에 실패했어요. 잠시 후 다시 시도해주세요'
          : undefined;

  return { available: state === 'available', checking: state === 'checking', error };
}
