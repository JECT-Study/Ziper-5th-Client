import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import * as styles from './TextField.css';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  /** underline: 가입·로그인 화면의 밑줄형(textField) · box: 테두리형(singleLineTextField) */
  variant?: 'underline' | 'box';
  label?: string;
  helperText?: string;
  /** true 거나 문자열이면 오류 상태. 문자열이면 helperText 대신 보여준다. */
  error?: boolean | string;
  /** 입력이 확인된 상태. 도움말이 초록색으로 바뀐다. */
  success?: boolean;
  /** maxLength 와 함께 쓰면 "글자 수/최대" 를 보여준다. */
  showCounter?: boolean;
  /** 값이 있을 때 지우기(x) 버튼을 보여준다. */
  onClear?: () => void;
  /** 입력칸 오른쪽에 넣을 요소. 예: 인증 타이머 */
  trailing?: ReactNode;
};

export function TextField({
  variant = 'underline',
  label,
  helperText,
  error,
  success,
  showCounter,
  onClear,
  trailing,
  type = 'text',
  className,
  id,
  ...input
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperId = `${inputId}-helper`;
  const [revealed, setRevealed] = useState(false);

  const value = String(input.value ?? '');
  const isPassword = type === 'password';
  const message = typeof error === 'string' ? error : helperText;
  const hasError = Boolean(error);
  const tone = hasError ? 'error' : success ? 'success' : 'default';
  const counter =
    showCounter && input.maxLength !== undefined ? `${value.length}/${input.maxLength}` : null;

  return (
    <div className={cx(styles.root[variant], className)}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <div
        className={cx(styles.field[variant], hasError && styles.fieldError[variant])}
        data-disabled={input.disabled || undefined}
      >
        <input
          {...input}
          id={inputId}
          type={isPassword && revealed ? 'text' : type}
          className={styles.input[variant]}
          aria-invalid={hasError || undefined}
          aria-describedby={message || counter ? helperId : undefined}
        />
        {onClear && value && !input.disabled && (
          <button
            type="button"
            className={styles.action}
            onClick={onClear}
            aria-label="입력 지우기"
          >
            <Icon name="xmark-circle-fill" />
          </button>
        )}
        {isPassword && (
          <button
            type="button"
            className={styles.action}
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? '비밀번호 숨기기' : '비밀번호 보기'}
          >
            <Icon name={revealed ? 'eye-fill' : 'eye-slash-fill'} />
          </button>
        )}
        {trailing}
      </div>
      {(message || counter) && (
        <div id={helperId} className={cx(styles.helper[variant], styles.helperTone[tone])}>
          <span>{message}</span>
          {counter && (
            <span className={styles.counter[tone === 'error' ? 'error' : 'default']}>
              {counter}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
