import { useCheckNicknameAvailability } from '@ziper/api';
import { useEffect, useState } from 'react';
import * as v from 'valibot';
import { nicknameSchema } from '../../../model/rules';

const DEBOUNCE_MS = 300;

/** 닉네임 규칙을 확인하고, 입력이 멈추면 서버에 중복 여부를 묻는다. */
export function useNicknameCheck(value: string) {
  const rule = v.safeParse(nicknameSchema, value);
  const valid = rule.success;
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  const current = valid && settled === value;
  const check = useCheckNicknameAvailability(
    { nickname: settled },
    { query: { enabled: current } },
  );
  const available = current && check.data?.data.available;
  const taken = current && check.data?.data.available === false;
  const failed = current && check.isError;

  const error =
    value.length > 0 && !rule.success
      ? rule.issues[0].message
      : taken
        ? '이미 사용 중인 닉네임입니다'
        : failed
          ? '중복 확인에 실패했어요. 잠시 후 다시 시도해주세요'
          : undefined;

  return {
    available: Boolean(available),
    checking: valid && (!current || check.isFetching),
    error,
  };
}
