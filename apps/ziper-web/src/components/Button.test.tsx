// @vitest-environment happy-dom
import { Button as UiButton } from '@ziper/ui/web';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Button } from './Button';

it('preserves HTML submit and named icon behavior while blocking clicks during loading', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    const clicked = vi.fn();
    const submitted = vi.fn((event: React.SubmitEvent<HTMLFormElement>) => event.preventDefault());
    await act(async () =>
      root.render(
        <form onSubmit={submitted}>
          <Button type="submit" leftIcon="plus-small-line" loading onClick={clicked}>
            저장
          </Button>
        </form>,
      ),
    );
    const button = host.querySelector('button')!;
    expect(button.type).toBe('submit');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toBe('저장');
    expect(
      button.querySelector('[data-loading-replaced="true"] [aria-hidden="true"]'),
    ).not.toBeNull();
    expect(button.querySelector('[role="status"]')?.closest('[aria-hidden="true"]')).not.toBeNull();
    button.click();
    expect(clicked).not.toHaveBeenCalled();
    expect(submitted).not.toHaveBeenCalled();

    await act(async () =>
      root.render(
        <form onSubmit={submitted}>
          <Button type="submit" onClick={clicked}>
            저장
          </Button>
        </form>,
      ),
    );
    button.click();
    expect(clicked).toHaveBeenCalledOnce();
    expect(submitted).toHaveBeenCalledOnce();

    await act(async () => root.render(<UiButton loading>삭제</UiButton>));
    const plain = host.querySelector('button')!;
    expect(plain.type).toBe('button');
    expect(plain.disabled).toBe(true);
    expect(plain.querySelector('[data-loading-replaced]')).toBeNull();
    expect(plain.textContent).toBe('삭제');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
