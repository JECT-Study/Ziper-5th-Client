import { useEffect, useState } from 'react';
import type { ProductDetail, ProductDetailApi } from '@ziper/api/product-detail';
import { Button } from '../../components';
import checkCircle from '../../assets/product-detail/check-circle.svg';
import { ProductImage } from './product-image';
import * as styles from './product-detail.css';

const won = new Intl.NumberFormat('ko-KR');
export function PurchasedProducts({
  api,
  affectedBoardCount,
}: {
  api: ProductDetailApi;
  affectedBoardCount: number | null;
}) {
  const [products, setProducts] = useState<readonly ProductDetail[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    void api
      .listPurchased(request.signal)
      .then((value) => {
        if (!request.signal.aborted) setProducts(value);
      })
      .catch(() => {
        if (!request.signal.aborted) setError(true);
      });
    return () => request.abort();
  }, [api, attempt]);

  return (
    <div className={styles.results}>
      {affectedBoardCount !== null && (
        <div className={styles.success} role="status">
          <p className={styles.successTitle}>✓ 구매 완료 목록으로 이동했어요</p>
          <p>
            {affectedBoardCount}개 보드에서 제외하고
            <br />
            구매 완료 목록에 하나로 모았어요.
          </p>
        </div>
      )}
      {error ? (
        <>
          <p role="alert" className={styles.error}>
            구매 완료 목록을 불러오지 못했어요. 완료된 구매 처리는 유지돼요.
          </p>
          <Button
            onClick={() => {
              setError(false);
              retry((n) => n + 1);
            }}
          >
            목록 다시 불러오기
          </Button>
        </>
      ) : products ? (
        <>
          <div className={styles.summary}>
            <p>{products.length}개 · 구매 완료</p>
            <span className={styles.caption}>최근 등록 순</span>
          </div>
          {products.length === 0 && <p role="status">구매 완료한 상품이 없어요.</p>}
          {products.map((product) => (
            <article className={styles.resultCard} key={product.cardId}>
              <ProductImage key={product.imageUrl} product={product} purchased />
              <span className={styles.chips}>
                <span className={styles.boardChip}>구매 완료</span>
                <span className={styles.boardChip}>PURCHASED</span>
              </span>
              <span className={styles.caption}>{product.shop}</span>
              <strong className={styles.resultName}>{product.productTitle}</strong>
              <strong className={styles.resultName}>
                {product.price === null ? '가격 정보 없음' : won.format(product.price) + '원'}
              </strong>
              <span className={styles.caption}>{product.memo}</span>
            </article>
          ))}
          <p className={styles.resultNote}>
            <img src={checkCircle} alt="" />
            구매 완료 상품은 재발견에서 제외돼요.
          </p>
        </>
      ) : (
        <p role="status">구매 완료 목록을 불러오는 중이에요.</p>
      )}
    </div>
  );
}
