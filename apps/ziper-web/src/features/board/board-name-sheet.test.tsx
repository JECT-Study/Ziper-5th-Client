// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { button, click, render, type } from '../../test/dom';
import { BoardNameSheet } from './board-name-sheet';

type Submit = Parameters<typeof BoardNameSheet>[0]['onSubmit'];

beforeEach(() => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
});

const show = (onSubmit: Submit = vi.fn(async () => 'done' as const), initialName?: string) =>
  render(
    <BoardNameSheet
      open
      title="새 보드 만들기"
      submitLabel="보드 만들기"
      initialName={initialName}
      takenNames={['기본 보드']}
      onClose={() => {}}
      onSubmit={onSubmit}
    />,
  );
const submit = () => button('보드 만들기');

it('blocks an empty name without an error message', async () => {
  await show();
  expect(submit().disabled).toBe(true);
  expect(document.body.textContent).not.toContain('입력해 주세요.');
});

it.each([
  ['기본 보드', '이미 사용 중인 보드 이름이에요'],
  ['열한글자보드이름입니다', '사용할 수 있는 문자로 10자 이하의 이름을 입력해 주세요.'],
])('rejects %s', async (name, message) => {
  await show();
  await type('보드 이름', name);
  expect(document.body.textContent).toContain(message);
  expect(submit().disabled).toBe(true);
});

it('submits the trimmed name and keeps a server duplicate blocked', async () => {
  const onSubmit = vi.fn<Submit>(async () => 'duplicate');
  await show(onSubmit);
  await type('보드 이름', '  가을 코디 ');
  expect(document.body.textContent).toContain('사용가능한 이름이에요');
  await click('보드 만들기');
  expect(onSubmit).toHaveBeenCalledWith('가을 코디');
  expect(document.body.textContent).toContain('이미 사용 중인 보드 이름이에요');
  expect(submit().disabled).toBe(true);
});

it('does not submit an unchanged name when renaming', async () => {
  await show(undefined, '가을 코디');
  expect(submit().disabled).toBe(true);
});
