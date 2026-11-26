import { Button, TextField } from '../../components';
import * as styles from './product-save.css';

export function InlineEntry({
  label,
  value,
  maxLength,
  counter,
  onChange,
  onConfirm,
  onCancel,
  action,
  disabled,
  loading,
  helperText,
  error,
  placeholder,
  variant,
}: {
  label: string;
  value: string;
  maxLength?: number;
  counter?: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  action: string;
  disabled: boolean;
  loading?: boolean;
  helperText?: string;
  error?: string;
  placeholder?: string;
  variant?: 'primary' | 'secondary';
}) {
  const confirm = () => {
    if (!disabled && !loading) onConfirm();
  };

  return (
    <div
      className={styles.inline}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.nativeEvent.isComposing && !loading) {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <TextField
        className={styles.grow}
        variant="box"
        aria-label={label}
        autoFocus
        value={value}
        maxLength={maxLength}
        showCounter={maxLength !== undefined}
        counter={counter}
        helperText={helperText}
        error={error}
        placeholder={placeholder}
        disabled={loading}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
          event.preventDefault();
          confirm();
        }}
        onClear={() => onChange('')}
      />
      <Button
        size="small"
        variant={variant}
        loading={loading}
        disabled={disabled}
        onClick={confirm}
      >
        {action}
      </Button>
      <Button size="small" variant="secondary" disabled={loading} onClick={onCancel}>
        취소
      </Button>
    </div>
  );
}
