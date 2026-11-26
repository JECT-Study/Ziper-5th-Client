import {
  ProductDetailError,
  type ProductDetail,
  type ProductDetailApi,
} from '@ziper/api/product-detail';
import { unknownOutcome } from '@ziper/api/outcome';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { BridgeError } from '@ziper/bridge/contract';
import { Button, Footer, HeaderSub, Icon, Modal, showToast } from '../../components';
import { ProductManageSheet, type ProductAction } from './product-manage-sheet';
import { ProductImage } from './product-image';
import { ProductEditForm, type EditRecovery } from './product-edit-form';
import { useBackLayer } from '../../shared/use-back-layer';
import { useLoad } from '../../shared/use-load';
import * as styles from './product-detail.css';

const won = new Intl.NumberFormat('ko-KR');
const loadErrors = {
  'auth-required': '로그인한 뒤 상품을 확인해 주세요.',
  forbidden: '이 상품을 볼 수 있는 권한이 없어요.',
  'not-found': '상품을 찾을 수 없어요. 삭제되었거나 더 이상 제공되지 않는 상품이에요.',
  'board-not-found': '보드를 찾을 수 없어요.',
  'image-unusable': '이미지를 사용할 수 없어요.',
  failed: '상품 정보를 불러오지 못했어요.',
};

export function ProductDetailScreen({
  cardId,
  api,
  onBack,
  openPurchased,
  fromPurchasedList = false,
  openExternal,
  platformReady = true,
}: {
  cardId: string;
  api: ProductDetailApi;
  onBack?: () => void | Promise<unknown>;
  openPurchased?: (replace: boolean) => Promise<unknown>;
  fromPurchasedList?: boolean;
  openExternal: (url: string) => Promise<void>;
  platformReady?: boolean;
}) {
  const [view, setView] = useState<'detail' | 'menu' | 'edit' | 'confirm'>('detail');
  const [pending, setPending] = useState<
    'purchase' | 'original' | 'edit' | 'purchased-list' | null
  >(null);
  const [error, setError] = useState('');
  // Set after an unconfirmed purchase: only a fresh read may enable the menu again.
  const [uncertain, setUncertain] = useState(false);
  const [accessError, setAccessError] = useState<
    Exclude<EditRecovery, 'unknown'> | 'mutation-forbidden' | null
  >(null);
  const editRecovery = useRef<EditRecovery | null>(null);
  const reconcileEdit = useCallback((reason: EditRecovery) => {
    editRecovery.current = reason;
  }, []);
  const [imageRevision, setImageRevision] = useState(0);
  const [editToast, setEditToast] = useState<ReturnType<typeof showToast> | null>(null);
  const notifyDefaultImage = useCallback(() => {
    if (!editToast) return;
    setEditToast(null);
    showToast('대표 이미지를 불러올 수 없어 기본 이미지로 대체했어요.', {
      compact: true,
      after: editToast,
    });
  }, [editToast]);
  const busy = useRef(false);
  const leaving = useRef(false);
  const alive = useRef(false);
  const openingOriginal = useRef<AbortController | null>(null);
  const purchaseAttempted = useRef(false);
  const detailBody = useRef<HTMLDivElement>(null);
  const manageButton = useRef<HTMLButtonElement>(null);
  const actionMessage = useRef<HTMLDivElement>(null);
  const focusAfterConfirmation = useRef(false);
  const [loaded, retry, updateProduct] = useLoad(
    (signal) => api.get(cardId, signal),
    [api, cardId],
    {
      timeoutMs: 10_000,
      onReady(next) {
        setUncertain(false);
        busy.current = false;
        setPending(null);
        setError(
          uncertain && next.status === 'PLANNED'
            ? '아직 구매 예정 상품이에요. 구매 완료로 변경하려면 다시 선택해 주세요.'
            : '',
        );
      },
    },
  );
  useLayoutEffect(() => {
    const body = detailBody.current;
    if (loaded.status === 'loading' || !body || body.ownerDocument.activeElement !== body) return;
    // Focus the refreshed result only if the keyboard user stayed here during the read.
    const result = body.querySelector<HTMLElement>('[data-reload-result]');
    (result ?? body.querySelector('h2'))?.focus();
  }, [loaded.status]);
  useLayoutEffect(() => {
    if (pending || !focusAfterConfirmation.current) return;
    focusAfterConfirmation.current = false;
    const body = detailBody.current;
    if (!body || view !== 'detail') return;
    const { activeElement } = body.ownerDocument;
    if (activeElement !== body.ownerDocument.body && activeElement !== manageButton.current) return;
    // Land on the message, not on a button that a held confirmation key could activate.
    (actionMessage.current ?? body.querySelector<HTMLElement>('[data-reload-result]'))?.focus();
  }, [pending, view]);
  const product = !accessError && loaded.status === 'ready' ? loaded.value : null;
  const loadCode =
    (accessError === 'mutation-forbidden' ? 'forbidden' : accessError) ??
    (loaded.status === 'error'
      ? loaded.error instanceof ProductDetailError
        ? loaded.error.code
        : 'failed'
      : null);
  const authReadFailed = loadCode === 'auth-required' && !accessError;
  useEffect(() => {
    if (authReadFailed) showToast(loadErrors['auth-required']);
  }, [authReadFailed]);
  const purchases = api.purchases;
  const canPurchase = Boolean(purchases) && product?.status === 'PLANNED';
  const removed = product?.linkStatus === 'REMOVED';

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      openingOriginal.current?.abort();
    };
  }, []);

  function begin(action: NonNullable<typeof pending>) {
    if (busy.current || leaving.current) return false;
    busy.current = true;
    setPending(action);
    setError('');
    return true;
  }

  function finish() {
    busy.current = false;
    setPending(null);
  }

  function selectAction(action: ProductAction) {
    if (action === 'edit') setView('edit');
    if (action === 'purchase' && canPurchase) setView('confirm');
  }

  async function purchase(event: MouseEvent<HTMLButtonElement>) {
    if (!product || !purchases || !canPurchase || uncertain || !begin('purchase')) return;
    focusAfterConfirmation.current = event.detail === 0;
    purchaseAttempted.current = true;
    try {
      const result = await purchases.complete(product.cardId).catch(() => unknownOutcome);
      if (!alive.current) return;
      if (result.status === 'done') {
        updateProduct((current) => ({ ...current, status: result.value.status }));
        // Drop the confirmation entry first so Back from the list cannot reopen it.
        const atDetail = await discardLayer();
        if (!alive.current) return;
        setView('detail');
        if (!openPurchased) return;
        if (!atDetail) {
          setError('구매 완료됐어요. 아래 버튼에서 구매 완료 목록을 열어 주세요.');
          return;
        }
        if (await goPurchased(true)) {
          showToast('1개 상품을 구매 완료 목록으로 이동했어요', { compact: true });
        }
        return;
      }
      setView('detail');
      const reason = result.status === 'rejected' ? result.reason : null;
      if (reason === 'auth-required' || reason === 'forbidden') {
        setAccessError(reason === 'forbidden' ? 'mutation-forbidden' : reason);
        if (reason === 'auth-required') showToast('로그인이 만료되어 구매 상태를 바꿀 수 없어요.');
        return;
      }
      // JEC-79 also allows 400 for an already deleted card. Confirm the current state first.
      setUncertain(true);
      setError(
        !reason
          ? '구매 처리 결과를 확인할 수 없어요. 다시 처리하지 말고 현재 상태를 확인해 주세요.'
          : reason === 'failed'
            ? '구매 완료로 변경하지 못했어요. 상품의 현재 상태를 확인해 주세요.'
            : loadErrors[reason],
      );
    } finally {
      finish();
    }
  }

  async function goPurchased(replace: boolean) {
    if (!openPurchased) return false;
    try {
      await openPurchased(replace);
      return true;
    } catch {
      setView('detail');
      setError('구매 완료 목록을 열지 못했어요. 다시 시도해 주세요.');
      return false;
    }
  }

  async function showPurchased() {
    if (!begin('purchased-list')) return;
    try {
      // A confirmed purchase after reconciliation should leave the same history as normal success.
      await goPurchased(purchaseAttempted.current && product?.status === 'PURCHASED');
    } finally {
      finish();
    }
  }

  async function original(card: Pick<ProductDetail, 'cardId' | 'productUrl' | 'linkStatus'>) {
    if (card.linkStatus === 'REMOVED' || !platformReady || !begin('original')) return;
    const operation = new AbortController();
    openingOriginal.current = operation;
    let opened = false;
    try {
      // Call the opener in the click stack, before contacting the API.
      await openExternal(card.productUrl);
      opened = true;
      if (!operation.signal.aborted) await api.openOriginal(card.cardId, operation.signal);
    } catch (reason) {
      if (operation.signal.aborted) return;
      if (opened && reason instanceof ProductDetailError) {
        if (reason.code === 'auth-required' || reason.code === 'not-found') {
          setView('detail');
          setAccessError(reason.code);
          if (reason.code === 'auth-required') {
            showToast('로그인이 만료되어 방문 기록을 남기지 못했어요.');
          } else {
            setError('쇼핑몰은 열었지만 방문 기록은 남기지 못했어요.');
          }
          return;
        }
        if (reason.code === 'forbidden') {
          setError('쇼핑몰은 열었지만 방문 기록을 남길 권한이 없어요.');
          return;
        }
      }
      setError(
        opened
          ? '쇼핑몰은 열었지만 방문 기록 반영 여부를 확인하지 못했어요.'
          : reason instanceof BridgeError && reason.code === 'RESULT_UNKNOWN'
            ? '쇼핑몰 열기 결과를 확인할 수 없어요. 이미 열린 창이 있는지 확인해 주세요.'
            : '원본 쇼핑몰을 열지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      openingOriginal.current = null;
      finish();
    }
  }
  function reload(event?: MouseEvent<HTMLButtonElement>) {
    if (leaving.current) return;
    if (event?.detail === 0) detailBody.current?.focus({ preventScroll: true });
    setEditToast(null);
    setView('detail');
    setAccessError(null);
    setError('');
    retry();
  }

  function closeLayer() {
    if (busy.current) return;
    if (view === 'edit') {
      const recovery = editRecovery.current;
      editRecovery.current = null;
      if (recovery === 'unknown') return reload();
      if (recovery) setAccessError(recovery);
    }
    // A normal cancel or a confirmed read failure needs no additional detail request.
    setView('detail');
  }

  const hasLayer = view !== 'detail';
  const discardLayer = useBackLayer(hasLayer, closeLayer);

  async function goBack() {
    if (hasLayer) return closeLayer();
    // Leaving detail can interrupt a visit, but not an edit or status change.
    if (!onBack || leaving.current || (busy.current && !openingOriginal.current)) return;
    leaving.current = true;
    try {
      await onBack();
    } catch {
      setError('이전 화면으로 돌아가지 못했어요.');
    } finally {
      leaving.current = false;
    }
  }
  const statusCheckFailed = uncertain && loadCode === 'failed';
  const purchasedReturn = (
    <Button
      variant="secondary"
      disabled={Boolean(pending)}
      loading={pending === 'purchased-list'}
      onClick={() => void showPurchased()}
    >
      구매 완료 목록 보기
    </Button>
  );
  const actionError = error && (
    <div ref={actionMessage} className={styles.error} role="alert" tabIndex={-1}>
      {error}
    </div>
  );
  return (
    <main className={styles.page}>
      <HeaderSub
        title="상품 상세"
        onBack={hasLayer || onBack ? () => void goBack() : undefined}
        right={
          product ? (
            <button
              ref={manageButton}
              className={styles.iconButton}
              type="button"
              aria-label="상품 관리"
              disabled={Boolean(pending) || uncertain}
              onClick={() => {
                if (!busy.current && !leaving.current) setView('menu');
              }}
            >
              <Icon name="dot3-horizontal-line" />
            </button>
          ) : undefined
        }
      />
      <div ref={detailBody} tabIndex={-1} className={styles.body}>
        {loadCode === 'auth-required' ? null : loadCode ? (
          <>
            <p className={styles.error} role="alert" tabIndex={-1} data-reload-result>
              {accessError === 'mutation-forbidden'
                ? '이 상품의 상태를 변경할 권한이 없어요.'
                : statusCheckFailed
                  ? '구매 상태를 확인하지 못했어요. 다시 처리하기 전에 현재 상태를 확인해 주세요.'
                  : loadErrors[loadCode]}
              {error && (
                <>
                  <br />
                  {error}
                </>
              )}
            </p>
            {loadCode === 'not-found' && fromPurchasedList && openPurchased ? (
              purchasedReturn
            ) : (
              <Button disabled={Boolean(pending)} onClick={reload}>
                {statusCheckFailed ? '현재 상태 확인' : '다시 확인'}
              </Button>
            )}
          </>
        ) : !product ? (
          <p role="status">
            {uncertain ? '상품의 현재 상태를 확인하는 중이에요.' : '상품 정보를 불러오는 중이에요.'}
          </p>
        ) : (
          <>
            <ProductImage
              product={product}
              revision={imageRevision}
              onDefaultImage={editToast ? notifyDefaultImage : undefined}
            />
            <div className={styles.info}>
              <p className={styles.shop}>{product.shop || '쇼핑몰 정보 없음'}</p>
              <h2 className={styles.name} tabIndex={-1}>
                {product.productTitle}
              </h2>
              <strong className={styles.price}>
                {product.price === null ? '가격 정보 없음' : won.format(product.price) + '원'}
              </strong>
            </div>
            <div className={styles.memo}>
              <span className={styles.caption}>한 줄 메모</span>
              <p>{product.memo || '저장한 메모가 없어요.'}</p>
            </div>
            {product.tags.length > 0 && (
              <ul className={styles.chips} aria-label="상품 태그">
                {product.tags.map((tag) => (
                  <li className={styles.chip} key={tag}>
                    {tag}
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.boards}>
              <p className={styles.caption}>담긴 보드 · {product.boards.length}개</p>
              <ul className={styles.chips}>
                {product.boards.map((board) => (
                  <li className={styles.chip} key={board.id}>
                    {board.name}
                  </li>
                ))}
              </ul>
            </div>
            {product.status === 'PURCHASED' && (
              <p className={styles.successTitle} role="status" tabIndex={-1} data-reload-result>
                ✓ 구매 완료한 상품이에요
              </p>
            )}
            {product.linkStatus === 'SOLD_OUT' && (
              <p className={styles.caption}>품절된 상품이에요.</p>
            )}
            {removed && <p className={styles.caption}>원본 상품의 판매가 종료되었어요.</p>}
          </>
        )}
        {!product && !loadCode && actionError}
      </div>
      {product && (
        <Footer className={styles.footer} layout="stack">
          {actionError}
          {uncertain ? (
            <Button disabled={Boolean(pending)} onClick={reload}>
              현재 상태 확인
            </Button>
          ) : (
            <>
              {openPurchased && product.status === 'PURCHASED' && purchasedReturn}
              <Button
                disabled={removed || Boolean(pending) || !platformReady}
                loading={pending === 'original'}
                onClick={() => void original(product)}
              >
                {removed ? '원본 상품 접근불가' : '원본 쇼핑몰로 이동'}
              </Button>
            </>
          )}
        </Footer>
      )}
      <ProductManageSheet
        open={view === 'menu'}
        canPurchase={canPurchase}
        onSelect={selectAction}
        onClose={closeLayer}
      />
      {product && view === 'edit' && (
        <ProductEditForm
          key={product.cardId}
          product={product}
          api={api}
          onSaved={(updated) => {
            finish();
            editRecovery.current = null;
            updateProduct(() => updated);
            setImageRevision((n) => n + 1);
            setView('detail');
            setEditToast(showToast('상품 정보 수정을 완료했어요', { compact: true }));
          }}
          onBusyChange={(value) => {
            busy.current = value;
            setPending(value ? 'edit' : null);
          }}
          onReconcile={reconcileEdit}
          onChecked={(latest) => {
            editRecovery.current = null;
            updateProduct(() => latest);
          }}
          onCancel={closeLayer}
        />
      )}
      <Modal
        open={view === 'confirm'}
        title="구매 완료 목록으로 이동할까요?"
        onClose={closeLayer}
        actions={
          <>
            <Button variant="secondary" disabled={pending === 'purchase'} onClick={closeLayer}>
              취소
            </Button>
            <Button loading={pending === 'purchase'} onClick={(event) => void purchase(event)}>
              이동하기
            </Button>
          </>
        }
      />
    </main>
  );
}
