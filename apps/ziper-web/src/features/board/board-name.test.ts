import { expect, it } from 'vitest';
import { checkBoardName, normalizeBoardName } from './board-name';

it('matches the board API’s trim, duplicate and length rules', () => {
  expect(normalizeBoardName('\u001c\u200b 가을 코디\u00a0\ufeff')).toBe('가을 코디');
  expect(checkBoardName('\u200b가을 코디\u00a0', ['가을 코디'])).toBe('duplicate');
  expect(checkBoardName('\u200b　', [])).toBe('empty');
  expect(checkBoardName('🧥'.repeat(10), [])).toBe('ok');
  expect(checkBoardName('🧥'.repeat(11), [])).toBe('invalid');
  expect(checkBoardName('봄\u0000옷', [])).toBe('invalid');
  expect(checkBoardName('봄\ud800옷', [])).toBe('invalid');
  expect(checkBoardName('봄\u200d옷', [])).toBe('ok');
});
