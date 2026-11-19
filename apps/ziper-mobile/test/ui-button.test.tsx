import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '@ziper/ui/native';
import { expect, it, vi } from 'vitest';

it('keeps the label accessible and consumes presses only when enabled', async () => {
  const onPress = vi.fn();
  const props = { label: '삭제', destructive: true, onPress };
  const view = await render(<Button {...props} disabled />);
  const button = () => screen.getByRole('button', { name: '삭제' });

  expect(button().props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.press(button());
  expect(onPress).not.toHaveBeenCalled();

  await view.rerender(<Button {...props} />);
  expect(button().props.accessibilityState).toMatchObject({ disabled: false });
  await fireEvent.press(button());
  expect(onPress).toHaveBeenCalledOnce();
});
