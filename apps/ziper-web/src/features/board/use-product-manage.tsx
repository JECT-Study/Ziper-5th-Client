import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { Button, Modal, showToast } from '../../components';
import { errorMessage } from '../../shared/api/http';
import { useBackLayer } from '../../shared/use-back-layer';
import { waitForHistory } from '../../shared/wait-for-route-exit';
import { purchasesEnabled } from '../product-detail/product-detail-api';
import { ProductManageSheet, type ProductAction } from '../product-detail/product-manage-sheet';
import type { BoardProduct } from './api';
import { useMoveProductToTrash } from './queries';

/**
 * 보드 상세 상품 카드의 ... 흐름: 상품 관리 시트(상품 상세와 같은 시트) → 삭제 확인 → 휴지통으로 보내기.
 * 구매 완료·상품 수정은 상품 상세 화면이 맡고 있어서 그 화면으로 보낸다.
 */
export function useProductManage() {
  const navigate = useNavigate();
  const { history } = useRouter();
  const [target, setTarget] = useState<{ product: BoardProduct; step: 'menu' | 'delete' } | null>(
    null,
  );
  const moveToTrash = useMoveProductToTrash();
  const deleting = moveToTrash.isPending;
  const close = () => setTarget(null);

  // 시트 → 삭제 확인을 history 한 칸으로 묶어, Android 뒤로 가기가 열린 것부터 닫게 한다.
  useBackLayer(target !== null, () => {
    if (!deleting) close();
  });

  function select(action: ProductAction) {
    if (!target) return;
    const { product } = target;
    if (action === 'delete') return setTarget({ product, step: 'delete' });
    // 시트가 쌓아 둔 history 칸을 먼저 걷은 뒤 넘어간다. 그대로 넘어가면 그 칸이 남아서,
    // 상품에서 돌아온 뒤 보드에서 뒤로 가기를 두 번 눌러야 나가진다.
    const layer = history.location.state.__TSR_index;
    void waitForHistory(history, close, (location) => location.state.__TSR_index < layer).then(() =>
      // 같은 WebView 안에서 열어, 뒤로 오면 바뀐 내용이 보드에 다시 반영된다.
      navigate({
        to: '/products/$cardId',
        params: { cardId: String(product.cardId) },
        search: { preview: undefined },
      }).catch(() => showToast('상품 상세를 열지 못했어요.')),
    );
  }

  function remove() {
    if (!target || deleting) return;
    moveToTrash.mutate(target.product.cardId, {
      onSuccess: () => {
        close();
        showToast('휴지통으로 옮겼어요');
      },
      onError: (error) =>
        showToast(errorMessage(error, '상품을 삭제하지 못했어요. 다시 시도해 주세요.')),
    });
  }

  const element = (
    <>
      <ProductManageSheet
        open={target?.step === 'menu'}
        // 구매 완료 API(JEC-79)가 배포되기 전에는 상품 상세처럼 숨긴다.
        canPurchase={purchasesEnabled}
        canDelete
        onSelect={select}
        onClose={close}
      />
      <Modal
        open={target?.step === 'delete'}
        title="상품을 삭제할까요?"
        description={'담긴 모든 보드에서 빠지고\n휴지통에 30일 동안 보관돼요.'}
        onClose={() => !deleting && close()}
        actions={
          <>
            <Button variant="secondary" onClick={close} disabled={deleting}>
              취소
            </Button>
            <Button onClick={remove} loading={deleting}>
              삭제하기
            </Button>
          </>
        }
      />
    </>
  );

  return { open: (product: BoardProduct) => setTarget({ product, step: 'menu' }), element };
}
