import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  BottomNavigation,
  BottomSheet,
  Button,
  Checkbox,
  ChipFilter,
  Divider,
  Footer,
  HeaderIconButton,
  HeaderMain,
  HeaderSub,
  Icon,
  Modal,
  SegmentedControl,
  SocialLoginButton,
  TextField,
  Toast,
  type BottomTab,
  type IconName,
} from '../components';
import * as styles from '../styles/design-system.css';

// 디자인 시스템 컴포넌트를 한눈에 확인하는 개발용 페이지. Figma "Design_필수산출물_디자인시스템"과 비교할 때 쓴다.
export const Route = createFileRoute('/design-system')({
  component: DesignSystemPage,
});

const ICON_NAMES: IconName[] = [
  'house-fill',
  'house-line',
  'grid-fill',
  'grid-line',
  'hand-point-up-fill',
  'hand-point-up-line',
  'person-fill',
  'person-line',
  'bell-line',
  'chevron-left-line',
  'chevron-right-line',
  'chevron-up-line',
  'chevron-down-line',
  'chevron-right-small-line',
  'xmark-line',
  'xmark-circle-fill',
  'plus-fill',
  'plus-small-fill',
  'plus-small-line',
  'dot3-horizontal-line',
  'arrow-up-right-fill',
  'pencil-fill',
  'eye-fill',
  'eye-slash-fill',
  'signup-loading',
];

function DesignSystemPage() {
  const [text, setText] = useState('Text Typing');
  const [box, setBox] = useState('');
  const [checked, setChecked] = useState(true);
  const [chip, setChip] = useState('b');
  const [segment, setSegment] = useState<'a' | 'b'>('a');
  const [tab, setTab] = useState<BottomTab>('home');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className={styles.page}>
      <Section title="Header">
        <HeaderMain right={<HeaderIconButton icon="house-fill" label="홈" />} />
        <HeaderSub
          title="상품 저장"
          onBack={() => {}}
          right={<HeaderIconButton icon="chevron-right-line" label="다음" />}
        />
      </Section>

      <Section title="Button">
        {(['primary', 'secondary'] as const).map((variant) => (
          <div key={variant} className={styles.stack}>
            {(['large', 'medium', 'small'] as const).map((size) => (
              <div key={size} className={styles.row}>
                <Button variant={variant} size={size} leftIcon="plus-small-line">
                  레이블
                </Button>
                <Button variant={variant} size={size} disabled leftIcon="plus-small-line">
                  레이블
                </Button>
                <Button variant={variant} size={size} loading>
                  레이블
                </Button>
              </div>
            ))}
          </div>
        ))}
      </Section>

      <Section title="Social login">
        <SocialLoginButton provider="naver" />
        <SocialLoginButton provider="kakao" />
        <SocialLoginButton provider="apple" />
      </Section>

      <Section title="TextField · underline">
        <TextField
          label="Label"
          placeholder="Placeholder"
          helperText="Helper message"
          maxLength={8}
          showCounter
          value=""
          onChange={() => {}}
        />
        <TextField
          label="Label"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onClear={() => setText('')}
          helperText="Helper message"
          maxLength={20}
          showCounter
        />
        <TextField
          label="Label"
          value="Text Complete"
          readOnly
          success
          helperText="Helper message"
        />
        <TextField
          label="Label"
          value="Text Complete"
          readOnly
          error="Helper message"
          onClear={() => {}}
        />
        <TextField label="Label" placeholder="Disable" disabled />
        <TextField
          label="Label"
          placeholder="Placeholder"
          helperText="Helper message"
          trailing={<span className={styles.timer}>00:54</span>}
        />
        <TextField
          label="Label"
          type="password"
          defaultValue="Placeholder"
          helperText="Helper message"
        />
      </Section>

      <Section title="TextField · box">
        <TextField
          variant="box"
          label="Label"
          placeholder="example@ject6team.net"
          value={box}
          onChange={(e) => setBox(e.target.value)}
          onClear={() => setBox('')}
          helperText="Helper message"
          maxLength={30}
          showCounter
        />
        <TextField
          variant="box"
          label="Label"
          value="example@ject6team.net"
          readOnly
          error="Helper message"
        />
        <TextField variant="box" label="Label" placeholder="example@ject6team.net" disabled />
      </Section>

      <Section title="Checkbox · Chip · Segmented">
        <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)}>
          [필수] 이용약관 동의
        </Checkbox>
        <Checkbox checked={!checked} onChange={(e) => setChecked(!e.target.checked)}>
          [선택] 마케팅 수신 동의
        </Checkbox>
        <div className={styles.row}>
          {['a', 'b'].map((id) => (
            <ChipFilter key={id} selected={chip === id} onClick={() => setChip(id)}>
              레이블
            </ChipFilter>
          ))}
        </div>
        <SegmentedControl
          items={[
            { value: 'a', label: 'Label' },
            { value: 'b', label: 'Label' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </Section>

      <Section title="Divider · Toast">
        <Divider />
        <Divider tone="strong" />
        <Divider size="md" />
        <Divider size="md" tone="strong" />
        <Toast>인증번호가 발송되었어요</Toast>
      </Section>

      <Section title="Footer · Modal · BottomSheet">
        <Footer>
          <Button>레이블</Button>
        </Footer>
        <Footer layout="split">
          <Button variant="secondary">레이블</Button>
          <Button>레이블</Button>
        </Footer>
        <Footer layout="stack">
          <Button>레이블</Button>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            바텀시트 열기
          </Button>
        </Footer>
        <Button size="small" onClick={() => setModalOpen(true)}>
          모달 열기
        </Button>
      </Section>

      <Section title="Icon">
        <div className={styles.icons}>
          {ICON_NAMES.map((name) => (
            <span key={name} title={name}>
              <Icon name={name} />
            </span>
          ))}
        </div>
      </Section>

      <Section title="BottomNavigation">
        <BottomNavigation active={tab} onSelect={setTab} onAdd={() => {}} />
      </Section>

      <Modal
        open={modalOpen}
        title="모달타이틀"
        description="서브내용 문구가 들어갑니다"
        actions={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button onClick={() => setModalOpen(false)}>확인</Button>
          </>
        }
      />
      <BottomSheet
        open={sheetOpen}
        title="Title"
        onClose={() => setSheetOpen(false)}
        footer={
          <Footer layout="stack">
            <Button>레이블</Button>
            <Button variant="secondary" onClick={() => setSheetOpen(false)}>
              닫기
            </Button>
          </Footer>
        }
      >
        <div className={styles.sheetBody} />
      </BottomSheet>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.stack}>{children}</div>
    </section>
  );
}
