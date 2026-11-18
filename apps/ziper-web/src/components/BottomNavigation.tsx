import addButton from '../assets/components/nav-add-button.svg';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import * as styles from './BottomNavigation.css';

export type BottomTab = 'home' | 'board' | 'rediscover' | 'my';

const TABS: { id: BottomTab; label: string; icon: IconName }[] = [
  { id: 'home', label: '홈', icon: 'house-fill' },
  { id: 'board', label: '보드', icon: 'grid-fill' },
  { id: 'rediscover', label: '재발견', icon: 'hand-point-up-fill' },
  { id: 'my', label: '마이', icon: 'person-fill' },
];

type BottomNavigationProps = {
  active: BottomTab;
  onSelect: (tab: BottomTab) => void;
  /** 가운데 + 버튼(상품 추가) */
  onAdd: () => void;
  disabledTabs?: readonly BottomTab[];
  addDisabled?: boolean;
  className?: string;
};

export function BottomNavigation({
  active,
  onSelect,
  onAdd,
  disabledTabs,
  addDisabled,
  className,
}: BottomNavigationProps) {
  const renderTab = (tab: (typeof TABS)[number]) => (
    <button
      key={tab.id}
      type="button"
      className={cx(styles.tab, tab.id === active && styles.active)}
      aria-current={tab.id === active ? 'page' : undefined}
      disabled={disabledTabs?.includes(tab.id)}
      onClick={() => onSelect(tab.id)}
    >
      <Icon name={tab.icon} />
      <span className={styles.label}>{tab.label}</span>
    </button>
  );

  return (
    <nav className={cx(styles.root, className)}>
      <div className={styles.group}>{TABS.slice(0, 2).map(renderTab)}</div>
      <div className={styles.group}>{TABS.slice(2).map(renderTab)}</div>
      <button
        type="button"
        className={styles.add}
        onClick={onAdd}
        disabled={addDisabled}
        aria-label="상품 추가"
      >
        <img src={addButton} alt="" width={50} height={50} />
      </button>
    </nav>
  );
}
