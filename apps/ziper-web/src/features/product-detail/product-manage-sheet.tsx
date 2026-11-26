import { BottomSheet, Button, Footer } from '../../components';
import * as styles from './product-detail.css';

export type ProductAction = 'edit' | 'purchase' | 'delete';

export function ProductManageSheet({
  open,
  canPurchase,
  canDelete = false,
  onSelect,
  onClose,
}: {
  open: boolean;
  canPurchase: boolean;
  /** 휴지통으로 보내는 "삭제" 항목. 보드 상세의 상품 카드 ... 에서 켠다. */
  canDelete?: boolean;
  onSelect: (action: ProductAction) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      title="상품 관리"
      onClose={onClose}
      showClose={false}
      footer={
        <Footer>
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </Footer>
      }
    >
      <div className={styles.menuActions}>
        {canPurchase && (
          <button type="button" className={styles.menuAction} onClick={() => onSelect('purchase')}>
            구매 완료
          </button>
        )}
        <button type="button" className={styles.menuAction} onClick={() => onSelect('edit')}>
          상품 수정
        </button>
        {canDelete && (
          <button
            type="button"
            className={`${styles.menuAction} ${styles.menuActionDanger}`}
            onClick={() => onSelect('delete')}
          >
            삭제
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
