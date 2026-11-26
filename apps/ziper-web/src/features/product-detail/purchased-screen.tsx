import { openOriginalUrl } from '@ziper/api';
import { BridgeError } from '@ziper/bridge/contract';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePlatform } from '../../bridge/provider';
import { BottomNavigation, HeaderIconButton, HeaderSub, showToast } from '../../components';
import { useTabNavigation } from '../../shared/use-tab-navigation';
import { productRejection } from './product-errors';
import type { PurchasedProduct } from './purchases';
import { error as errorStyle, purchasedPage, purchasedScroll } from './product-detail.css';
import type { ProductSort } from './product-sort';
import { PurchasedListError, PurchasedProducts } from './purchased-products';

type AccessError = 'auth-required' | 'forbidden';

export function PurchasedScreen({
  sort,
  onSortChange,
  entryError = false,
  onRetryEntry,
  openProduct,
  goBack,
}: {
  sort: ProductSort;
  onSortChange: (sort: ProductSort) => void;
  entryError?: boolean;
  onRetryEntry: () => void;
  openProduct: (product: PurchasedProduct) => Promise<unknown>;
  goBack: () => Promise<unknown>;
}) {
  const { platform, status } = usePlatform();
  const selectTab = useTabNavigation();
  const opening = useRef<AbortController | null>(null);
  const navigating = useRef(false);
  const [backFailed, setBackFailed] = useState(false);
  const [visitRevision, setVisitRevision] = useState(0);
  const [missingCards, setMissingCards] = useState<ReadonlySet<number>>(() => new Set());
  const [accessError, setAccessError] = useState<AccessError | null>(null);
  const accessNotice = useRef<HTMLDivElement>(null);
  const focusAccessNotice = useRef(false);
  useEffect(() => () => opening.current?.abort(), []);
  const restrictAccess = useCallback((code: AccessError, moveFocus = false) => {
    opening.current?.abort();
    focusAccessNotice.current = moveFocus;
    setAccessError(code);
    if (code === 'auth-required') showToast('로그인이 만료되어 구매 완료 목록을 볼 수 없어요.');
  }, []);
  useLayoutEffect(() => {
    if (!accessError || !focusAccessNotice.current) return;
    focusAccessNotice.current = false;
    const notice = accessNotice.current;
    if (notice && notice.ownerDocument.activeElement === notice.ownerDocument.body) notice.focus();
  }, [accessError]);
  const ready = !accessError && !entryError && (status === 'native' || status === 'web');

  async function openOriginal(product: PurchasedProduct) {
    if (!ready || navigating.current || opening.current || product.link.status === 'REMOVED')
      return;
    const operation = new AbortController();
    opening.current = operation;
    let opened = false;
    let mayHaveRecorded = false;
    try {
      await platform.external.open(product.productUrl);
      opened = true;
      if (operation.signal.aborted) return;
      mayHaveRecorded = true;
      await openOriginalUrl(product.cardId, { signal: operation.signal });
    } catch (error) {
      if (operation.signal.aborted) return;
      const code = opened ? productRejection(error)?.code : undefined;
      if (code) {
        mayHaveRecorded = false;
        if (code === 'auth-required') {
          restrictAccess(code);
          return;
        }
        if (code === 'not-found') {
          setMissingCards((ids) => new Set([...ids, product.cardId]));
          showToast('쇼핑몰은 열었지만 저장한 상품을 찾을 수 없어요.');
          return;
        }
        if (code === 'forbidden') {
          showToast('쇼핑몰은 열었지만 방문 기록을 남길 권한이 없어요.');
          return;
        }
      }
      showToast(
        opened
          ? '쇼핑몰은 열었지만 방문 기록 반영 여부를 확인하지 못했어요.'
          : error instanceof BridgeError && error.code === 'RESULT_UNKNOWN'
            ? '쇼핑몰 열기 결과를 확인할 수 없어요. 이미 열린 창이 있는지 확인해 주세요.'
            : '원본 쇼핑몰을 열지 못했어요.',
      );
    } finally {
      // A visit can change updated_at even if the response is lost.
      if (mayHaveRecorded && !operation.signal.aborted) {
        setVisitRevision((revision) => revision + 1);
      }
      opening.current = null;
    }
  }

  async function open(product: PurchasedProduct) {
    if (accessError || navigating.current) return;
    navigating.current = true;
    try {
      await openProduct(product);
    } finally {
      navigating.current = false;
    }
  }

  async function back() {
    if (navigating.current) return;
    navigating.current = true;
    setBackFailed(false);
    try {
      await goBack();
    } catch {
      setBackFailed(true);
    } finally {
      navigating.current = false;
    }
  }

  function add() {
    if (navigating.current) return;
    void platform.navigation
      .push('/register-product')
      .catch(() => showToast('상품 추가 화면을 열지 못했어요.'));
  }

  return (
    <main className={purchasedPage}>
      <div>
        <HeaderSub
          title="구매 완료 목록"
          onBack={() => void back()}
          right={ready && <HeaderIconButton icon="plus-fill" label="상품 추가" onClick={add} />}
        />
        {backFailed && (
          <div className={errorStyle} role="alert">
            이전 화면으로 돌아가지 못했어요. 다시 시도해 주세요.
          </div>
        )}
      </div>
      <div className={purchasedScroll} data-scroll-restoration-id="purchased-products">
        {accessError === 'auth-required' ? null : accessError ? (
          <PurchasedListError ref={accessNotice} forbidden />
        ) : entryError ? (
          <PurchasedListError retry={onRetryEntry} />
        ) : (
          <PurchasedProducts
            missingCards={missingCards}
            visitRevision={visitRevision}
            onAccessDenied={restrictAccess}
            sort={sort}
            onSortChange={(next) => {
              if (!navigating.current && next !== sort) onSortChange(next);
            }}
            onOpen={(product) =>
              void open(product).catch(() => showToast('상품 상세를 열지 못했어요.'))
            }
            onOpenOriginal={(product) => void openOriginal(product)}
          />
        )}
      </div>
      <BottomNavigation
        active="board"
        onSelect={(tab) => {
          if (!navigating.current) selectTab(tab);
        }}
        onAdd={ready ? add : undefined}
      />
    </main>
  );
}
