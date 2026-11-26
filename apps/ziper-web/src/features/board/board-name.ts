import { codePointLength, productLimits } from '@ziper/api/product-fields';
import * as v from 'valibot';

export const BOARD_NAME_MAX = productLimits.boardNameLength;
export const INVALID_BOARD_NAME_MESSAGE = '사용할 수 있는 문자로 10자 이하의 이름을 입력해 주세요.';
export const DUPLICATE_BOARD_NAME_MESSAGE = '이미 사용 중인 보드 이름이에요';

export type BoardNameCheck = 'empty' | 'invalid' | 'duplicate' | 'ok';

export function normalizeBoardName(value: string) {
  // Matches Java isWhitespace/isSpaceChar plus FORMAT for edge trimming.
  // eslint-disable-next-line no-control-regex
  return value.replace(/^[\p{Z}\p{Cf}\t-\r\u001c-\u001f]+|[\p{Z}\p{Cf}\t-\r\u001c-\u001f]+$/gu, '');
}

/**
 * 앞뒤 공백을 뺀 1~10자, 다른 보드와 겹치지 않는 이름. 중복 확인 API 가 없어 받아 둔 이름으로 먼저 막고,
 * 최종 판단은 만들기 요청(409)이 한다. 빈 이름은 안내 없이 제출만 막는다(메시지 '').
 */
export const boardNameSchema = (takenNames: readonly string[]) =>
  v.pipe(
    v.string(),
    v.transform(normalizeBoardName),
    v.nonEmpty(''),
    v.check(
      (name) => codePointLength(name) <= BOARD_NAME_MAX && !/[\p{Cc}\p{Cs}]/u.test(name),
      INVALID_BOARD_NAME_MESSAGE,
    ),
    v.check((name) => !takenNames.includes(name), DUPLICATE_BOARD_NAME_MESSAGE),
  );

export function checkBoardName(value: string, takenNames: readonly string[]): BoardNameCheck {
  const result = v.safeParse(boardNameSchema(takenNames), value);
  if (result.success) return 'ok';
  const message = result.issues[0].message;
  return message === DUPLICATE_BOARD_NAME_MESSAGE ? 'duplicate' : message ? 'invalid' : 'empty';
}
