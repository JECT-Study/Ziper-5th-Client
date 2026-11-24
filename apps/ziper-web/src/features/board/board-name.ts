export const BOARD_NAME_MAX = 10;

export type BoardNameCheck = 'empty' | 'duplicate' | 'ok';

/**
 * 백엔드 규칙: 앞뒤 공백을 뺀 이름이 1~10자이고 다른 보드와 겹치지 않아야 한다.
 * 중복 확인 API 가 없어서, 화면에 받아 둔 보드 이름으로 먼저 확인한다. 최종 판단은 만들기 요청(409)이다.
 */
export function checkBoardName(value: string, takenNames: readonly string[]): BoardNameCheck {
  const name = value.trim();
  if (!name) return 'empty';
  return takenNames.includes(name) ? 'duplicate' : 'ok';
}
