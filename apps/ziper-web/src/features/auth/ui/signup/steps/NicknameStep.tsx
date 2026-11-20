import { Button, TextField } from '../../../../../components';
import { NICKNAME_MAX } from '../../../model/rules';
import { StepScreen } from '../../common/StepScreen';
import { useNicknameCheck } from './useNicknameCheck';

export function NicknameStep({
  nickname,
  onChange,
  onBack,
  onNext,
}: {
  nickname: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  // 중복 확인은 이 입력칸에만 딸린 검사라 폼 상태와 따로 둔다.
  const { available, error } = useNicknameCheck(nickname);

  return (
    <StepScreen
      headerTitle="회원 가입"
      onBack={onBack}
      title="닉네임을 입력해주세요"
      description="프로필에 표시되는 이름으로, 언제든 변경할 수 있어요"
      actions={
        <Button disabled={!available} onClick={onNext}>
          다음
        </Button>
      }
    >
      <TextField
        label="닉네임"
        placeholder="닉네임을 입력해주세요"
        value={nickname}
        onChange={(e) => onChange(e.target.value)}
        onClear={() => onChange('')}
        maxLength={NICKNAME_MAX}
        showCounter
        error={error}
        success={available}
        helperText={available ? '사용 가능한 닉네임입니다' : undefined}
        autoFocus
      />
    </StepScreen>
  );
}
