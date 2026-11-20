import { Button, Modal, TextField } from '../../../../../components';
import { StepScreen } from '../../common/StepScreen';

export function CodeStep({
  email,
  code,
  complete,
  error,
  verifying,
  onChange,
  onBack,
  onVerify,
  onResend,
  onRetryEmail,
  onOtherMethod,
}: {
  email: string;
  code: string;
  complete: boolean;
  /** locked: 서버가 5회 넘게 틀린 인증을 잠갔다. */
  error: 'mismatch' | 'locked' | null;
  verifying: boolean;
  onChange: (value: string) => void;
  onBack: () => void;
  onVerify: () => void;
  onResend: () => void;
  onRetryEmail: () => void;
  onOtherMethod: () => void;
}) {
  return (
    <StepScreen
      headerTitle="회원 가입"
      onBack={onBack}
      eyebrow="아래 주소로 인증코드가 발송되었습니다"
      title={email}
      actionsLayout="stack"
      actions={
        <>
          <Button disabled={!complete} loading={verifying} onClick={onVerify}>
            인증하기
          </Button>
          <Button variant="secondary" onClick={onResend}>
            인증번호 재전송
          </Button>
        </>
      }
    >
      <TextField
        label="인증번호"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="인증번호 6자리를 입력해주세요"
        value={code}
        onChange={(e) => onChange(e.target.value)}
        onClear={() => onChange('')}
        error={error === 'mismatch' ? '인증번호가 일치하지 않습니다' : undefined}
        autoFocus
      />
      <Modal
        open={error === 'locked'}
        title="인증을 완료하지 못했어요"
        // 닫으면(Escape) 다시 인증하기와 같이 이메일 단계로 돌아간다.
        onClose={onRetryEmail}
        actionsLayout="stack"
        actions={
          <>
            <Button onClick={onOtherMethod}>다른 방법으로 시도하기</Button>
            <Button variant="secondary" onClick={onRetryEmail}>
              다시 인증하기
            </Button>
          </>
        }
      />
    </StepScreen>
  );
}
