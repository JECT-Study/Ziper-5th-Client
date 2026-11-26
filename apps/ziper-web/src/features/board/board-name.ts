import { codePointLength, productLimits } from '@ziper/api/product-fields';

export const BOARD_NAME_MAX = productLimits.boardNameLength;
export const INVALID_BOARD_NAME_MESSAGE = '사용할 수 있는 문자로 10자 이하의 이름을 입력해 주세요.';

export type BoardNameCheck = 'empty' | 'invalid' | 'duplicate' | 'ok';

export function normalizeBoardName(value: string) {
  // Matches Java isWhitespace/isSpaceChar plus FORMAT for edge trimming.
  // eslint-disable-next-line no-control-regex
  return value.replace(/^[\p{Z}\p{Cf}\t-\r\u001c-\u001f]+|[\p{Z}\p{Cf}\t-\r\u001c-\u001f]+$/gu, '');
}

/**
 * 백엔드 규칙: 앞뒤 공백을 뺀 이름이 1~10자이고 다른 보드와 겹치지 않아야 한다.
 * 중복 확인 API 가 없어서, 화면에 받아 둔 보드 이름으로 먼저 확인한다. 최종 판단은 만들기 요청(409)이다.
 */
export function checkBoardName(value: string, takenNames: readonly string[]): BoardNameCheck {
  const name = normalizeBoardName(value);
  if (!name) return 'empty';
  if (codePointLength(name) > BOARD_NAME_MAX || /[\p{Cc}\p{Cs}]/u.test(name)) return 'invalid';
  return takenNames.includes(name) ? 'duplicate' : 'ok';
}
