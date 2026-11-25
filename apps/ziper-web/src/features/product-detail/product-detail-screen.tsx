import {
  ProductDetailError,
  type ProductDetail,
  type ProductDetailApi,
} from '@ziper/api/product-detail';
import { unknownOutcome } from '@ziper/api/outcome';
import { useEffect, useRef, useState } from 'react';
import { BridgeError } from '@ziper/bridge/contract';
import { BottomSheet, Button, HeaderSub, Toast } from '../../components';
import { Dialog } from '../../components/Dialog';
import ellipsis from '../../assets/product-detail/ellipsis.svg';
import pencil from '../../assets/product-detail/pencil.svg';
import checkCheck from '../../assets/product-detail/check-check.svg';
import { ProductImage } from './product-image';
import { ProductEditForm } from './product-edit-form';
import { PurchasedProducts } from './purchased-products';
import { useBackLayer } from '../../shared/use-back-layer';
import { useLoad } from '../../shared/use-load';
import * as styles from './product-detail.css';

const won = new Intl.NumberFormat('ko-KR');
const loadErrors = {
  'auth-required': '로그인한 뒤 상품을 확인해 주세요.',
  forbidden: '이 상품을 볼 수 있는 권한이 없어요.',
  'not-found': '상품을 찾을 수 없어요. 삭제되었거나 더 이상 제공되지 않는 상품이에요.',
  failed: '상품 정보를 불러오지 못했어요.',
};

export function ProductDetailScreen({
  cardId,
  api,
  onBack,
  manage,
  openExternal,
  platformReady = true,
}: {
  cardId: string;
  api: ProductDetailApi;
  onBack?: () => void | Promise<unknown>;
  manage?: (canPurchase: boolean) => Promise<'edit' | 'purchase' | null>;
  openExternal: (url: string) => Promise<void>;
  platformReady?: boolean;
}) {
  const [view, setView] = useState<'detail' | 'edit' | 'purchased'>('detail');
  const [pending, setPending] = useState<'menu' | 'purchase' | 'original' | 'edit' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [toast, setToast] = useState('');
  const [affectedBoardCount, setAffectedBoardCount] = useState<number | null>(null);
  const busy = useRef(false);
  const alive = useRef(false);
  const [loaded, retry, updateProduct] = useLoad(
    (signal) => api.get(cardId, signal),
    [api, cardId],
    {
      onReady() {
        setUncertain(false);
        busy.current = false;
        setPending(null);
        setError('');
      },
    },
  );
  const product: ProductDetail | null = loaded.status === 'ready' ? loaded.value : null;
  const loadError =
    loaded.status !== 'error'
      ? ''
      : loaded.error instanceof ProductDetailError
        ? loadErrors[loaded.error.code]
        : loadErrors.failed;
  const purchases = api.purchases;
  const canPurchase = Boolean(purchases) && product?.status === 'PLANNED';
  const removed = product?.linkStatus === 'REMOVED';

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function begin(action: 'menu' | 'purchase' | 'original') {
    busy.current = true;
    setPending(action);
    setError('');
  }

  function finish() {
    busy.current = false;
    if (alive.current) setPending(null);
  }

  async function openMenu() {
    if (!product || busy.current || !platformReady || uncertain) return;
    if (!manage) {
      setMenuOpen(true);
      return;
    }
    begin('menu');
    try {
      const action = await manage(canPurchase);
      if (!alive.current) return;
      if (action === 'edit') setView('edit');
      if (action === 'purchase' && canPurchase) setConfirm(true);
    } catch {
      if (alive.current) setError('상품 관리 메뉴를 열지 못했어요. 다시 시도해 주세요.');
    } finally {
      finish();
    }
  }

  async function purchase() {
    if (!product || !purchases || !canPurchase || busy.current || uncertain) return;
    begin('purchase');
    try {
      const result = await purchases.complete(product.cardId).catch(() => unknownOutcome);
      if (!alive.current) return;
      setConfirm(false);
      if (result.status === 'done') {
        const { status, affectedBoardCount } = result.value;
        updateProduct((current) => ({ ...current, status }));
        setAffectedBoardCount(affectedBoardCount);
        setView('purchased');
        return;
      }
      const reason = result.status === 'rejected' ? result.reason : null;
      // Without a confirmed failure, or for a product that changed underneath, reload first.
      setUncertain(!reason || reason === 'not-found' || reason === 'forbidden');
      setError(
        !reason
          ? '구매 처리 결과를 확인할 수 없어요. 다시 처리하지 말고 현재 상태를 확인해 주세요.'
          : reason === 'failed'
            ? '구매 완료로 변경하지 못했어요. 다시 시도해 주세요.'
            : loadErrors[reason],
      );
    } finally {
      finish();
    }
  }

  async function original() {
    if (!product || removed || busy.current || !platformReady) return;
    begin('original');
    let opened = false;
    try {
      // Call the opener in the click stack, before contacting the API.
      await openExternal(product.productUrl);
      opened = true;
      if (alive.current) await api.openOriginal(product.cardId);
    } catch (reason) {
      if (!alive.current) return;
      setError(
        opened
          ? '쇼핑몰은 열었지만 방문 기록을 반영하지 못했어요.'
          : reason instanceof BridgeError && reason.code === 'RESULT_UNKNOWN'
            ? '쇼핑몰 열기 결과를 확인할 수 없어요. 이미 열린 창이 있는지 확인해 주세요.'
            : '원본 쇼핑몰을 열지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      finish();
    }
  }
  function reload() {
    setView('detail');
    setConfirm(false);
    setUncertain(false);
    setError('');
    retry();
  }

  function closeLayer() {
    if (confirm) setConfirm(false);
    // A normal cancel must not record another detail view.
    else if (view === 'edit' && uncertain) reload();
    else setView('detail');
  }

  const title =
    view === 'edit' ? '상품 수정' : view === 'purchased' ? '구매 완료 목록' : '상품 상세';
  const hasLayer = view !== 'detail' || confirm;
  const back = hasLayer ? closeLayer : onBack;
  useBackLayer(hasLayer, () => {
    if (!pending) closeLayer();
  });
  return (
    <main className={styles.page}>
      <HeaderSub
        title={title}
        className={styles.header}
        onBack={
          back
            ? () => {
                if (pending) return;
                Promise.resolve()
                  .then(back)
                  .catch(() => setError('이전 화면으로 돌아가지 못했어요.'));
              }
            : undefined
        }
        right={
          product && view === 'detail' ? (
            <button
              className={styles.iconButton}
              type="button"
              aria-label="상품 관리"
              disabled={Boolean(pending) || uncertain || !platformReady}
              onClick={() => void openMenu()}
            >
              <img src={ellipsis} alt="" />
            </button>
          ) : undefined
        }
      />
      <div className={styles.body}>
        {loadError ? (
          <>
            <p className={styles.error} role="alert">
              {loadError}
            </p>
            <Button onClick={reload}>다시 확인</Button>
          </>
        ) : !product ? (
          <p role="status">상품 정보를 불러오는 중이에요.</p>
        ) : view === 'edit' ? (
          <ProductEditForm
            key={product.cardId}
            product={product}
            api={api}
            onSaved={(updated) => {
              setPending(null);
              updateProduct(() => updated);
              setView('detail');
              setToast('상품 정보를 수정했어요.');
            }}
            onBusyChange={(value) => setPending(value ? 'edit' : null)}
            onReconcile={() => setUncertain(true)}
            onCancel={closeLayer}
          />
        ) : view === 'purchased' && purchases ? (
          <PurchasedProducts api={purchases} affectedBoardCount={affectedBoardCount} />
        ) : (
          <>
            <ProductImage product={product} />
            <div className={styles.info}>
              <p className={styles.caption}>{product.shop || '쇼핑몰 정보 없음'}</p>
              <h2 className={styles.name}>{product.productTitle}</h2>
              <div className={styles.priceRow}>
                <strong className={styles.price}>
                  {product.price === null ? '가격 정보 없음' : won.format(product.price) + '원'}
                </strong>
                <span className={styles.caption}>저장 시점 가격 · KRW</span>
              </div>
            </div>
            <div className={styles.memo}>
              <span className={styles.caption}>저장 이유</span>
              <p>{product.memo || '저장한 메모가 없어요.'}</p>
            </div>
            {product.tags.length > 0 && (
              <ul className={styles.chips} aria-label="상품 태그">
                {product.tags.map((tag) => (
                  <li className={styles.chip} key={tag}>
                    #{tag}
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.boards}>
              <p className={styles.caption}>담긴 보드 · {product.boards.length}개</p>
              <ul className={styles.chips}>
                {product.boards.map((board) => (
                  <li className={styles.boardChip} key={board.id}>
                    {board.name}
                  </li>
                ))}
              </ul>
            </div>
            {product.status === 'PURCHASED' && (
              <p className={styles.successTitle} role="status">
                ✓ 구매 완료한 상품이에요
              </p>
            )}
            {product.linkStatus === 'SOLD_OUT' && (
              <p className={styles.caption}>품절된 상품이에요.</p>
            )}
            <Button
              className={styles.action}
              disabled={removed || Boolean(pending) || !platformReady}
              loading={pending === 'original'}
              onClick={() => void original()}
            >
              {removed ? '원본 상품 접근불가' : '↗ 원본 쇼핑몰 가기'}
            </Button>
            {removed && <p className={styles.caption}>원본 상품의 판매가 종료되었어요.</p>}
            {purchases && product.status === 'PURCHASED' && (
              <Button
                className={styles.secondary}
                onClick={() => {
                  setAffectedBoardCount(null);
                  setView('purchased');
                }}
              >
                구매 완료 목록 보기
              </Button>
            )}
          </>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {uncertain && view === 'detail' && (
          <Button className={styles.secondary} onClick={reload}>
            현재 상태 확인
          </Button>
        )}
      </div>
      <BottomSheet
        className={styles.menu}
        open={menuOpen}
        title="상품 관리"
        onClose={() => setMenuOpen(false)}
        footer={
          <div className={styles.menuFooter}>
            <Button className={styles.secondary} onClick={() => setMenuOpen(false)}>
              닫기
            </Button>
          </div>
        }
      >
        <div className={styles.menuActions}>
          <button
            type="button"
            className={styles.menuAction}
            onClick={() => {
              setMenuOpen(false);
              setView('edit');
            }}
          >
            <img src={pencil} alt="" />
            상품 수정
          </button>
          {canPurchase && (
            <button
              type="button"
              className={styles.menuAction}
              onClick={() => {
                setMenuOpen(false);
                setConfirm(true);
              }}
            >
              <img src={checkCheck} alt="" />
              구매 완료
            </button>
          )}
        </div>
      </BottomSheet>
      {confirm && (
        <Dialog
          className={styles.modal}
          titleId="purchase-title"
          onClose={() => {
            if (pending !== 'purchase') setConfirm(false);
          }}
          alert
        >
          <h2 id="purchase-title" className={styles.modalTitle}>
            {'구매 완료 목록 보드로\n이동하시겠습니까?'}
          </h2>
          <div className={styles.buttonRow}>
            <Button
              className={styles.secondary}
              disabled={pending === 'purchase'}
              onClick={() => setConfirm(false)}
            >
              취소
            </Button>
            <Button
              className={styles.action}
              loading={pending === 'purchase'}
              onClick={() => void purchase()}
            >
              이동하기
            </Button>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className={styles.toast}>
          <Toast>{toast}</Toast>
        </div>
      )}
    </main>
  );
}
