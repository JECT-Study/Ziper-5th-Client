import { useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';
import { Icon, Spinner } from './Icon';
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
  counter?: string;
  /** 값이 있을 때 지우기(x) 버튼을 보여준다. */
  onClear?: () => void;
  /** 입력칸 오른쪽에 넣을 요소. 예: 인증 타이머 */
  trailing?: ReactNode;
  /** 입력값을 서버에서 확인하는 중. 입력칸 오른쪽에 작은 스피너를 보여준다. 예: 닉네임 중복 확인 */
  loading?: boolean;
};

export function TextField({
  variant = 'underline',
  label,
  helperText,
  error,
  success,
  showCounter,
  counter: customCounter,
  onClear,
  trailing,
  loading,
  type = 'text',
  className,
  id,
  'aria-describedby': describedBy,
  ...input
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperId = `${inputId}-helper`;
  const [revealed, setRevealed] = useState(false);
  const element = useRef<HTMLInputElement>(null);

  const value = String(input.value ?? '');
  const isPassword = type === 'password';
  const message = typeof error === 'string' ? error : helperText;
  const hasError = Boolean(error);
  const tone = hasError ? 'error' : success ? 'success' : 'default';
  const counter =
    customCounter ??
    (showCounter && input.maxLength !== undefined ? `${value.length}/${input.maxLength}` : null);

  const description = [describedBy, message || counter ? helperId : undefined]
    .filter(Boolean)
    .join(' ');
  const fieldName = input['aria-label'] ?? label;
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
          ref={element}
          type={isPassword && revealed ? 'text' : type}
          className={styles.input[variant]}
          aria-invalid={hasError || undefined}
          aria-describedby={description || undefined}
          aria-busy={loading || undefined}
        />
        {loading && <Spinner size={16} className={styles.spinner} />}
        {/* Figma 순서: 비밀번호 보기 → 지우기 */}
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
        {onClear && value && !input.disabled && !input.readOnly && (
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              onClear();
              element.current?.focus();
            }}
            aria-label={fieldName ? `${fieldName} 지우기` : '입력 지우기'}
          >
            <Icon name="xmark-circle-fill" />
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
