import { useEffect, useRef, useState } from 'react';
import emptyBoard from '../../assets/board/empty-board.png';
import { usePlatform } from '../../bridge/provider';
import {
  BottomNavigation,
  Button,
  ChipFilter,
  HeaderIconButton,
  HeaderSub,
  showToast,
} from '../../components';
import { errorMessage } from '../../shared/api/http';
import { useTabNavigation } from '../../shared/use-tab-navigation';
import { fetchBoardProducts, openOriginal, type BoardProductPage, type BoardSort } from './api';
import { ProductCard, ProductCardSkeleton } from './product-card';
import * as styles from './board-detail.css';

const SORTS: { value: BoardSort; label: string }[] = [
  { value: 'RECENT', label: '최근 등록순' },
  { value: 'OLDEST', label: '오래된 순' },
  { value: 'PRICE_ASC', label: '가격 낮은 순' },
  { value: 'PRICE_DESC', label: '가격 높은 순' },
];

type Products =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; page: BoardProductPage; loadingMore: boolean };

/** 정렬이 바뀌면 처음부터 다시 불러오고, 목록 끝에 닿으면 다음 페이지를 붙인다. */
function useBoardProducts(boardId: number, sort: BoardSort) {
  const [state, setState] = useState<Products>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    fetchBoardProducts(boardId, sort).then(
      (page) => alive && setState({ status: 'ready', page, loadingMore: false }),
      () => alive && setState({ status: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [boardId, sort, attempt]);

  async function loadMore() {
    if (state.status !== 'ready' || state.loadingMore || !state.page.hasNext) return;
    const { page } = state;
    setState({ ...state, loadingMore: true });
    try {
      const next = await fetchBoardProducts(boardId, sort, page.nextCursor);
      setState({
        status: 'ready',
        page: { ...next, items: [...page.items, ...next.items] },
        loadingMore: false,
      });
    } catch {
      // 다음 페이지만 실패하면 지금 목록은 두고, 끝에 다시 닿을 때 또 시도한다.
      setState({ status: 'ready', page, loadingMore: false });
    }
  }

  return { state, reload: () => setAttempt((n) => n + 1), loadMore };
}

type BoardDetailScreenProps = {
  boardId: number;
  /** 방금 만든 보드. "만들었어요" 토스트를 띄운다. */
  created: boolean;
  onCreatedShown: () => void;
};

export function BoardDetailScreen({ boardId, created, onCreatedShown }: BoardDetailScreenProps) {
  const { platform, status } = usePlatform();
  const selectTab = useTabNavigation();
  const [sort, setSort] = useState<BoardSort>('RECENT');
  const { state, reload, loadMore } = useBoardProducts(boardId, sort);
  const page = state.status === 'ready' ? state.page : null;

  // 방금 만든 보드면 이름을 알게 된 뒤 한 번만 알린다.
  const announced = useRef(false);
  useEffect(() => {
    if (!created || !page || announced.current) return;
    announced.current = true;
    showToast(`${page.name} 보드를 만들었어요`);
    onCreatedShown();
  }, [created, page, onCreatedShown]);

  // 목록 끝이 보이면 다음 페이지를 불러온다.
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  useEffect(() => {
    const target = sentinel.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMoreRef.current();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [page?.hasNext]);

  const addProduct =
    status === 'initializing'
      ? undefined
      : () =>
          void platform.navigation.push('/register-product').catch(() => {
            showToast('상품 추가 화면을 열지 못했어요.');
          });

  async function goOriginal(cardId: number) {
    try {
      await platform.external.open(await openOriginal(cardId));
    } catch (error) {
      showToast(errorMessage(error, '원본 쇼핑몰을 열지 못했어요.'));
    }
  }

  return (
    <main className={styles.page}>
      <HeaderSub
        title={page?.name ?? ''}
        onBack={() => void platform.navigation.back()}
        right={<HeaderIconButton icon="plus-fill" label="상품 추가" onClick={addProduct} />}
      />
      <div className={styles.body}>
        <div className={styles.sorts}>
          {SORTS.map((option) => (
            <ChipFilter
              key={option.value}
              selected={sort === option.value}
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </ChipFilter>
          ))}
        </div>

        {state.status === 'loading' && (
          <div className={styles.grid} aria-busy>
            {Array.from({ length: 4 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        )}

        {state.status === 'error' && (
          <div className={styles.status} role="alert">
            보드를 불러오지 못했어요.
            <Button variant="secondary" size="small" onClick={reload}>
              다시 시도
            </Button>
          </div>
        )}

        {page && page.items.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyText}>
              <img src={emptyBoard} alt="" width={122} height={111} />
              <div>
                <p className={styles.emptyTitle}>아직 상품이 없어요</p>
                <p className={styles.emptyDescription}>
                  {'상품을 저장하면 이 보드에 담겨요.\n+ 버튼으로 첫 상품을 추가해 보세요.'}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              leftIcon="plus-small-line"
              className={styles.emptyButton}
              onClick={addProduct}
              disabled={!addProduct}
            >
              상품 추가하기
            </Button>
          </div>
        )}

        {page && page.items.length > 0 && (
          <>
            <div className={styles.grid}>
              {page.items.map((product) => (
                <ProductCard
                  key={product.cardId}
                  product={product}
                  onOpen={() =>
                    void platform.navigation.push(`/products/${product.cardId}`).catch(() => {})
                  }
                  // TODO: 상품 관리 시트(구매 완료·상품 수정·삭제)와 연결한다.
                  onMore={() => {}}
                  onOpenOriginal={() => void goOriginal(product.cardId)}
                />
              ))}
            </div>
            {page.hasNext && <div ref={sentinel} className={styles.sentinel} />}
          </>
        )}
      </div>
      <BottomNavigation active="board" onSelect={selectTab} onAdd={addProduct} />
    </main>
  );
}
