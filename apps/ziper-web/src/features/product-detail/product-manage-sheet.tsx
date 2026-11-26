import { BottomSheet, Button, Footer } from '../../components';
import * as styles from './product-detail.css';

export type ProductAction = 'edit' | 'purchase';

export function ProductManageSheet({
  open,
  canPurchase,
  onSelect,
  onClose,
}: {
  open: boolean;
  canPurchase: boolean;
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
      </div>
    </BottomSheet>
  );
}
