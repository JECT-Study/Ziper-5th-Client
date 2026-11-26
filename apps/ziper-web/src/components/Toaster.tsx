import { Toaster as SonnerToaster, toast } from 'sonner';
import { Toast } from './Toast';
import * as styles from './Toast.css';

const DURATION_MS = 2500;
const OFFSET = {
  bottom: 'calc(env(safe-area-inset-bottom) + var(--ziper-toast-offset, 94px))',
  left: 16,
  right: 16,
};

/** 화면 아래에서 올라오는 토스트를 띄운다. 쌓기·애니메이션·사라지기는 Sonner 가 맡고, 모양은 Toast 를 쓴다. */
export function showToast(
  message: string,
  {
    compact,
    after,
    toasterId,
  }: {
    compact?: boolean;
    after?: { id: string | number; message: string };
    toasterId?: string;
  } = {},
) {
  const previous = after && toast.getToasts().at(-1)?.id === after.id ? after : undefined;
  const className = compact ? styles.compact : undefined;
  const id = toast.custom(
    () => (
      <div className={styles.slot}>
        {previous && <Toast className={className}>{previous.message}</Toast>}
        <Toast className={className}>{message}</Toast>
      </div>
    ),
    { id: previous?.id, duration: DURATION_MS, ...(toasterId && { toasterId }) },
  );
  return { id, message };
}

/** 기본 토스터는 앱 루트에 둔다. 모달 안의 알림은 별도 id로 보낸다. */
export function Toaster({ id }: { id?: string }) {
  return (
    <SonnerToaster
      id={id}
      position="bottom-center"
      // Figma: 하단 탭(69px) 위로 25px 띄운다. 하단 탭이 없는 화면에서는 아래 버튼 위에 걸친다.
      offset={OFFSET}
      mobileOffset={OFFSET}
      visibleToasts={1}
      // 600px 보다 넓은 화면에서는 Sonner 가 토스트 칸을 내용 크기로 줄여 왼쪽에 붙인다. 칸을 꽉 채워 가운데에 둔다.
      toastOptions={{ className: styles.item }}
    />
  );
}
