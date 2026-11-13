import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import * as styles from './SegmentedControl.css';

type Item<T extends string> = { value: T; label: string; icon?: IconName };

type SegmentedControlProps<T extends string> = {
  items: Item<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cx(styles.root, className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={item.value === value}
          className={cx(styles.item, item.value === value && styles.selected)}
          onClick={() => onChange(item.value)}
        >
          {item.icon && <Icon name={item.icon} size={14} />}
          {item.label}
        </button>
      ))}
    </div>
  );
}
