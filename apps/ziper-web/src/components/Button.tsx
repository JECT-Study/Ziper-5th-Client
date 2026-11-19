import { Button as UiButton, type ButtonProps as UiButtonProps } from '@ziper/ui/web';
import { Icon, Spinner, type IconName } from './Icon';

type ButtonProps = Omit<UiButtonProps, 'leftIcon' | 'rightIcon' | 'loadingIcon'> & {
  leftIcon?: IconName;
  rightIcon?: IconName;
};

const ICON_SIZE = { large: 24, medium: 16, small: 12 } as const;
const SPINNER_SIZE = { large: 24, medium: 24, small: 16 } as const;

export function Button({ size = 'large', loading, leftIcon, rightIcon, ...props }: ButtonProps) {
  return (
    <UiButton
      {...props}
      size={size}
      loading={loading}
      leftIcon={leftIcon && <Icon name={leftIcon} size={ICON_SIZE[size]} />}
      rightIcon={rightIcon && <Icon name={rightIcon} size={ICON_SIZE[size]} />}
      loadingIcon={loading && <Spinner size={SPINNER_SIZE[size]} />}
    />
  );
}
