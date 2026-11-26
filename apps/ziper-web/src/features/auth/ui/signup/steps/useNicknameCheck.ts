import { useEffect, useState } from 'react';
import { useNicknameAvailabilityQuery } from '../../../api/queries';
import { isValidNickname } from '../../../model/rules';

const DEBOUNCE_MS = 300;

/** 닉네임 규칙을 확인하고, 입력이 멈추면 서버에 중복 여부를 묻는다. */
export function useNicknameCheck(value: string) {
  const valid = isValidNickname(value);
  // 입력이 멈춘 뒤의 값으로만 묻는다. 같은 닉네임은 캐시가 바로 답한다.
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const query = useNicknameAvailabilityQuery(settled, valid && settled === value);
  // 입력 중(아직 멈추지 않음)이거나 서버에 묻는 중이면 확인 중으로 본다.
  const checking = valid && (settled !== value || query.isFetching);
  const taken = !checking && query.data === false;
  const failed = !checking && query.isError;

  const error =
    value.length > 0 && !valid
      ? '한글, 영문, 숫자 2~10자로 입력해주세요'
      : taken
        ? '이미 사용 중인 닉네임입니다'
        : failed
          ? '중복 확인에 실패했어요. 잠시 후 다시 시도해주세요'
          : undefined;

  return { available: valid && !checking && query.data === true, checking, error };
}
