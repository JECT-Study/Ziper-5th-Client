import {
  ProductDetailError,
  type ProductDetail,
  type ProductDetailApi,
} from '@ziper/api/product-detail';
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
  api?: ProductDetailApi;
  onBack?: () => void | Promise<unknown>;
  manage?: (purchased: boolean) => Promise<'edit' | 'purchase' | null>;
  openExternal: (url: string) => Promise<void>;
  platformReady?: boolean;
}) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [attempt, retry] = useState(0);
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

  useEffect(() => {
    alive.current = true;
    const request = new AbortController();
    setProduct(null);
    setLoadError('');
    if (api) {
      void api
        .get(cardId, request.signal)
        .then((value) => {
          if (!request.signal.aborted) {
            setProduct(value);
            setUncertain(false);
            busy.current = false;
            setPending(null);
            setError('');
          }
        })
        .catch((reason) => {
          if (!request.signal.aborted)
            setLoadError(
              reason instanceof ProductDetailError ? loadErrors[reason.code] : loadErrors.failed,
            );
        });
    }
    return () => {
      alive.current = false;
      request.abort();
    };
  }, [api, cardId, attempt]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function openMenu() {
    if (!product || busy.current || !platformReady || uncertain) return;
    if (!manage) {
      setMenuOpen(true);
      return;
    }
    busy.current = true;
    setPending('menu');
    setError('');
    try {
      const action = await manage(product.status === 'PURCHASED');
      if (!alive.current) return;
      if (action === 'edit') setView('edit');
      if (action === 'purchase' && product.status === 'PLANNED') setConfirm(true);
    } catch {
      if (alive.current) setError('상품 관리 메뉴를 열지 못했어요. 다시 시도해 주세요.');
    } finally {
      busy.current = false;
      if (alive.current) setPending(null);
    }
  }

  async function purchase() {
    if (!product || !api || busy.current || uncertain || product.status === 'PURCHASED') return;
    busy.current = true;
    setPending('purchase');
    setError('');
    try {
      const result = await api.purchase(product.cardId);
      if (!alive.current) return;
      setProduct({ ...product, status: result.status });
      setAffectedBoardCount(result.affectedBoardCount);
      setConfirm(false);
      setView('purchased');
    } catch (reason) {
      if (!alive.current) return;
      setConfirm(false);
      const known = reason instanceof ProductDetailError;
      setUncertain(!known || reason.code === 'not-found' || reason.code === 'forbidden');
      setError(
        known
          ? reason.code === 'failed'
            ? '구매 완료로 변경하지 못했어요. 다시 시도해 주세요.'
            : loadErrors[reason.code]
          : '구매 처리 결과를 확인할 수 없어요. 다시 처리하지 말고 현재 상태를 확인해 주세요.',
      );
    } finally {
      busy.current = false;
      if (alive.current) setPending(null);
    }
  }

  async function original() {
    if (!product || !api || !product.isLinkValid || busy.current || !platformReady) return;
    busy.current = true;
    setPending('original');
    setError('');
    try {
      // Open from the click, before awaiting the event API, to avoid browser popup blocking.
      await openExternal(product.productUrl);
      if (!alive.current) return;
      try {
        await api.openOriginal(product.cardId);
      } catch {
        if (alive.current) setError('쇼핑몰은 열었지만 방문 기록을 반영하지 못했어요.');
      }
    } catch (reason) {
      if (alive.current)
        setError(
          reason instanceof BridgeError && reason.code === 'RESULT_UNKNOWN'
            ? '쇼핑몰 열기 결과를 확인할 수 없어요. 이미 열린 창이 있는지 확인해 주세요.'
            : '원본 쇼핑몰을 열지 못했어요. 다시 시도해 주세요.',
        );
    } finally {
      busy.current = false;
      if (alive.current) setPending(null);
    }
  }
  function reload() {
    setView('detail');
    setConfirm(false);
    setUncertain(false);
    setError('');
    retry((n) => n + 1);
  }

  const title =
    view === 'edit' ? '상품 수정' : view === 'purchased' ? '구매 완료 목록' : '상품 상세';
  const back = view === 'edit' ? reload : view === 'purchased' ? () => setView('detail') : onBack;
  // 확인 창·수정·결과 화면에서 Back 을 누르면 상세를 떠나지 않고 한 단계만 닫는다.
  useBackLayer(view !== 'detail' || confirm, () => {
    if (pending) return;
    if (confirm) setConfirm(false);
    else if (view === 'edit') reload();
    else setView('detail');
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
        {!api ? (
          <p className={styles.feedback} role="status">
            상품 상세 서비스는 아직 연결되지 않았어요.
          </p>
        ) : loadError ? (
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
              setProduct(updated);
              setView('detail');
              setToast('상품 정보를 수정했어요.');
            }}
            onBusyChange={(value) => setPending(value ? 'edit' : null)}
            onCancel={reload}
          />
        ) : view === 'purchased' ? (
          <PurchasedProducts api={api} affectedBoardCount={affectedBoardCount} />
        ) : (
          <>
            <ProductImage key={product.imageUrl + ':' + product.fallbackIcon} product={product} />
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
            <Button
              className={styles.action}
              disabled={!product.isLinkValid || Boolean(pending) || !platformReady}
              loading={pending === 'original'}
              onClick={() => void original()}
            >
              {product.isLinkValid ? '↗ 원본 쇼핑몰 가기' : '원본 상품 접근불가'}
            </Button>
            {!product.isLinkValid && (
              <p className={styles.caption}>
                원본 상품 링크가 삭제되거나 차단되었어요.
                <br />이 상품은 재발견에서 제외돼요.
              </p>
            )}
            {product.status === 'PURCHASED' && (
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
        {uncertain && (
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
          {product?.status === 'PLANNED' && (
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
