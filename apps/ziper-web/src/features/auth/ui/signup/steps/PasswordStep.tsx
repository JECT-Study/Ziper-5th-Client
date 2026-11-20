import { Button, TextField } from '../../../../../components';
import type { Agreements } from '../../../model/terms';
import { StepScreen } from '../../common/StepScreen';
import { fields } from '../../common/StepScreen.css';
import { Terms } from '../../common/Terms';

export function PasswordStep({
  password,
  passwordInvalid,
  passwordConfirm,
  passwordsMatch,
  agreed,
  canSubmit,
  submitting,
  onPasswordChange,
  onPasswordConfirmChange,
  onAgreedChange,
  onBack,
  onSubmit,
}: {
  password: string;
  passwordInvalid: boolean;
  passwordConfirm: string;
  passwordsMatch: boolean;
  agreed: Agreements;
  canSubmit: boolean;
  submitting: boolean;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onAgreedChange: (next: Agreements) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const confirmMismatch = passwordConfirm.length > 0 && !passwordsMatch;

  return (
    <StepScreen
      headerTitle="회원 가입"
      onBack={onBack}
      title="비밀번호를 입력해주세요"
      actions={
        <Button disabled={!canSubmit} loading={submitting} onClick={onSubmit}>
          다음
        </Button>
      }
    >
      <div className={fields}>
        <TextField
          label="비밀번호"
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호를 입력해주세요"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          helperText="영문, 숫자, 특수문자 조합 8자리 이상으로 입력해주세요"
          error={passwordInvalid}
          autoFocus
        />
        <TextField
          label="비밀번호 확인"
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호를 한 번 더 입력해주세요"
          value={passwordConfirm}
          onChange={(e) => onPasswordConfirmChange(e.target.value)}
          success={passwordsMatch}
          helperText={passwordsMatch ? '비밀번호가 일치합니다' : undefined}
          error={confirmMismatch ? '비밀번호가 일치하지 않습니다' : undefined}
        />
      </div>

      <Terms agreed={agreed} onChange={onAgreedChange} />
    </StepScreen>
  );
}
