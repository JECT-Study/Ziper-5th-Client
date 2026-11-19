// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Button } from './Button';

it('keeps the loading spinner out of the button label and blocks form submission until ready', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const submit = vi.fn((event: React.SubmitEvent<HTMLFormElement>) => event.preventDefault());

  const render = (loading: boolean) =>
    act(async () => {
      root.render(
        <form onSubmit={submit}>
          <Button type="submit" loading={loading}>
            저장
          </Button>
        </form>,
      );
    });

  try {
    await render(true);
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('저장');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('[role="status"]')?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(button.disabled).toBe(true);
    button.click();
    expect(submit).not.toHaveBeenCalled();

    await render(false);
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
    button.click();
    expect(submit).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
