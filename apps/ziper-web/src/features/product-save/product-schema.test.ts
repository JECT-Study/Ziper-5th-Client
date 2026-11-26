import { priceRangeMessage, titleLengthMessage } from '@ziper/api/product-fields';
import * as v from 'valibot';
import { expect, it } from 'vitest';
import {
  boardsMessage,
  memoLengthMessage,
  newTagSchema,
  productFields,
  requiredImage,
  tagsMessage,
} from './product-schema';

const schema = v.object({ ...productFields, image: requiredImage<string | null>() });
const valid = {
  productTitle: '  울   가디건 ',
  price: '39,000원',
  memo: ' 메모 ',
  tags: ['가을'],
  boardIds: [1],
  image: 'TOP',
};
const message = (input: object) => {
  const result = v.safeParse(schema, { ...valid, ...input });
  return result.success ? null : result.issues[0].message;
};

it('normalizes the fields the server stores', () => {
  expect(v.parse(schema, valid)).toEqual({
    productTitle: '울 가디건',
    price: 39_000,
    memo: '메모',
    tags: ['가을'],
    boardIds: [1],
    image: 'TOP',
  });
});

it.each([
  [{ productTitle: '가'.repeat(201) }, titleLengthMessage],
  [{ productTitle: '   ' }, ''],
  [{ price: '10억1' }, priceRangeMessage],
  [{ price: '1,000,000,001' }, priceRangeMessage],
  [{ memo: '😀'.repeat(101) }, memoLengthMessage],
  [{ tags: [] }, tagsMessage],
  [{ tags: ['일곱글자태그다'] }, tagsMessage],
  [{ boardIds: [] }, boardsMessage],
  [{ image: null }, ''],
])('rejects %o', (input, expected) => {
  expect(message(input)).toBe(expected);
});

it('accepts emoji within the code-point limits', () => {
  expect(message({ memo: '😀'.repeat(100), tags: ['😀😀😀😀😀😀'] })).toBeNull();
});

it('normalizes a new tag and blocks duplicates and invisible characters', () => {
  expect(v.parse(newTagSchema([]), '#  봄 코디')).toBe('봄 코디');
  expect(v.safeParse(newTagSchema(['봄']), '#봄').success).toBe(false);
  expect(v.safeParse(newTagSchema([]), '봄​').issues?.[0].message).toBe(
    '해시태그에 보이지 않는 문자는 사용할 수 없어요.',
  );
});
