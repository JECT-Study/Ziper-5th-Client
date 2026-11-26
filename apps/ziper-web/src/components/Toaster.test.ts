// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { toast } from 'sonner';
import { afterEach, expect, it } from 'vitest';
import { showToast } from './Toaster';

afterEach(() => toast.dismiss());

function content(id: string | number) {
  const active = toast.getToasts().find((notice) => notice.id === id);
  return renderToStaticMarkup(active && 'jsx' in active ? active.jsx : null);
}

it('targets an in-dialog toaster without sending the notice to the page toaster', () => {
  const { id } = showToast('로그인이 만료됐어요.', { toasterId: 'edit-sheet' });
  expect(toast.getToasts().find((notice) => notice.id === id)).toMatchObject({
    toasterId: 'edit-sheet',
  });
});

it('updates the visible success toast with its image warning in the same slot', () => {
  const after = showToast('수정 완료', { compact: true });
  const warning = showToast('기본 이미지 사용', { compact: true, after });
  expect(warning.id).toBe(after.id);
  expect(content(warning.id)).toMatch(/수정 완료.*기본 이미지 사용/);
});

it.each(['expired', 'superseded'])('does not restore a %s success toast', (state) => {
  const after = showToast('수정 완료', { compact: true });
  if (state === 'expired') toast.dismiss(after.id);
  else showToast('다른 안내');
  const warning = showToast('기본 이미지 사용', { compact: true, after });
  expect(warning.id).not.toBe(after.id);
  expect(content(warning.id)).toContain('기본 이미지 사용');
  expect(content(warning.id)).not.toContain('수정 완료');
});
