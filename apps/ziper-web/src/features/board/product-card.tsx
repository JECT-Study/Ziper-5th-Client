import { useState } from 'react';
import { Icon } from '../../components';
import { cx } from '../../components/cx';
import type { BoardProduct } from './api';
import { fallbackImages } from './fallback-images';
import * as styles from './board-detail.css';

const won = new Intl.NumberFormat('ko-KR');

type ProductCardProps = {
  product: BoardProduct;
  onOpen: () => void;
  onMore: () => void;
  onOpenOriginal: () => void;
};

/** 보드 상세의 상품 카드 (Figma "ZIPER / Product card") */
export function ProductCard({ product, onOpen, onMore, onOpenOriginal }: ProductCardProps) {
  const [failed, setFailed] = useState(false);
  const photo = product.imageFileUrl ?? product.imageUrl;
  const fallback = product.fallbackIcon ? fallbackImages[product.fallbackIcon] : null;

  return (
    <article className={styles.card}>
      <div className={styles.imageSection}>
        <div className={styles.imageArea}>
          <button type="button" className={styles.imageButton} onClick={onOpen}>
            {photo && !failed ? (
              <img
                className={styles.photo}
                src={photo}
                alt={product.productTitle}
                onError={() => setFailed(true)}
              />
            ) : fallback ? (
              <img className={styles.fallback} src={fallback} alt={product.productTitle} />
            ) : (
              <span className={styles.noImage}>{product.productTitle}</span>
            )}
          </button>
          <button
            type="button"
            className={styles.more}
            onClick={onMore}
            aria-label={`${product.productTitle} 상품 관리`}
          >
            <Icon name="dot3-horizontal-line" />
          </button>
        </div>
        <button type="button" className={styles.originalLink} onClick={onOpenOriginal}>
          원본 쇼핑몰로 이동
          <Icon name="arrow-up-right-fill" size={12} />
        </button>
      </div>
      <button type="button" className={styles.info} onClick={onOpen}>
        {product.shop && <span className={styles.shop}>{product.shop}</span>}
        <span className={styles.title}>{product.productTitle}</span>
        <span className={styles.price}>{won.format(product.price)}원</span>
      </button>
      {product.tags.length > 0 && (
        <ul className={styles.tags} aria-label="태그">
          {product.tags.map((tag) => (
            <li key={tag.tagId} className={styles.tag}>
              {tag.title}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden>
      <div className={cx(styles.skeleton, styles.skeletonImage)} />
      <div className={cx(styles.skeleton, styles.skeletonLine, styles.skeletonShort)} />
      <div className={cx(styles.skeleton, styles.skeletonLine)} />
      <div className={cx(styles.skeleton, styles.skeletonLine, styles.skeletonMedium)} />
    </div>
  );
}
