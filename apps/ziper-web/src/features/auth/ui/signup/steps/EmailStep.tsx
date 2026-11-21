import { Button, TextField } from '../../../../../components';
import { StepScreen } from '../../common/StepScreen';

export function EmailStep({
  email,
  valid,
  sending,
  onChange,
  onBack,
  onSend,
}: {
  email: string;
  valid: boolean;
  sending: boolean;
  onChange: (value: string) => void;
  onBack: () => void;
  onSend: () => void;
}) {
  return (
    <StepScreen
      headerTitle="회원 가입"
      onBack={onBack}
      title="이메일을 입력해주세요"
      actions={
        <Button disabled={!valid} loading={sending} onClick={onSend}>
          인증 메일 보내기
        </Button>
      }
    >
      <TextField
        label="이메일"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="이메일을 입력해주세요"
        value={email}
        onChange={(e) => onChange(e.target.value)}
        onClear={() => onChange('')}
        error={email.length > 0 && !valid ? '이메일 형식이 올바르지 않습니다' : undefined}
        autoFocus
      />
    </StepScreen>
  );
}
