import {
  codePointLength,
  hasUnsupportedTagCharacters,
  invalidTagCharactersMessage,
  isValidTag,
  normalizeProductMemo,
  normalizeProductTitle,
  normalizeTag,
  parseWholeWon,
  priceRangeMessage,
  productLimits,
  titleLengthMessage,
} from '@ziper/api/product-fields';
import * as v from 'valibot';

export const memoLengthMessage = '한 줄 메모는 100자까지 저장할 수 있어요.';
export const tagsMessage = '6자 이하의 해시태그를 1개 이상 선택해 주세요.';
export const boardsMessage = '현재 보드를 1개 이상 선택해 주세요.';

/** 저장·수정 폼이 함께 쓰는 서버 필드 규칙. 빈 값은 안내 없이 제출만 막는다(메시지 ''). */
export const productFields = {
  productTitle: v.pipe(
    v.string(),
    v.transform(normalizeProductTitle),
    v.nonEmpty(''),
    v.check((title) => codePointLength(title) <= productLimits.titleLength, titleLengthMessage),
  ),
  price: v.pipe(
    v.string(),
    v.transform((value) => parseWholeWon(value.trim().replace(/원$/u, ''))),
    v.number(priceRangeMessage),
  ),
  memo: v.pipe(
    v.string(),
    v.transform(normalizeProductMemo),
    v.check((memo) => codePointLength(memo) <= productLimits.memoLength, memoLengthMessage),
  ),
  tags: v.pipe(
    v.array(v.string()),
    v.minLength(1, tagsMessage),
    v.check((tags) => tags.every(isValidTag), tagsMessage),
  ),
  boardIds: v.pipe(v.array(v.number()), v.minLength(1, boardsMessage)),
};

export const requiredImage = <T>() => v.custom<NonNullable<T>>((value) => value != null, '');

/** 새 해시태그 입력. 이미 있는 태그는 takenTags 로 막는다. */
export const newTagSchema = (takenTags: readonly string[]) =>
  v.pipe(
    v.string(),
    v.check((tag) => !hasUnsupportedTagCharacters(tag), invalidTagCharactersMessage),
    v.check(isValidTag, ''),
    v.transform(normalizeTag),
    v.check((tag) => !takenTags.includes(tag), ''),
  );
