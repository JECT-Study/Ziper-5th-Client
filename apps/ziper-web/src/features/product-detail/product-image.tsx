import type { ProductDetail } from '@ziper/api/product-detail';
import { useState } from 'react';
import top from '../../assets/product-detail/top.svg';
import purchasedTop from '../../assets/product-detail/purchased-top.svg';
import unavailableTop from '../../assets/product-detail/unavailable-top.svg';
import pants from '../../assets/product-save/pants.png';
import skirt from '../../assets/product-save/skirt.png';
import accessory from '../../assets/product-save/accessory.png';
import beauty from '../../assets/product-save/beauty.png';
import * as styles from './product-detail.css';

const templates = { TOP: top, PANTS: pants, SKIRT: skirt, ACCESSORY: accessory, BEAUTY: beauty };
export function ProductImage({
  product,
  purchased = false,
}: {
  product: ProductDetail;
  purchased?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const unavailable = !product.isLinkValid;
  const template = product.fallbackIcon ? templates[product.fallbackIcon] : null;
  return (
    <figure className={styles.imageGroup}>
      <div
        className={[
          styles.image,
          purchased ? styles.resultImage : '',
          unavailable ? styles.unavailable : '',
        ].join(' ')}
      >
        {unavailable ? (
          <>
            <img className={styles.unavailableIcon} src={unavailableTop} alt="" />
            <span className={styles.unavailableLabel}>원본 상품에 접근할 수 없어요</span>
          </>
        ) : product.imageUrl && !failed ? (
          <img
            className={styles.photo}
            src={product.imageUrl}
            alt={product.productTitle}
            onError={() => setFailed(true)}
          />
        ) : template ? (
          <img
            className={product.fallbackIcon === 'TOP' ? undefined : styles.template}
            src={purchased && product.fallbackIcon === 'TOP' ? purchasedTop : template}
            alt={product.productTitle}
          />
        ) : (
          <span className={styles.caption}>등록된 이미지가 없어요</span>
        )}
      </div>
      {!purchased && (
        <figcaption className={styles.caption}>
          {unavailable
            ? '접근불가 · 저장한 정보는 보관돼요'
            : product.imageUrl && !failed
              ? '저장한 상품 이미지'
              : '도안 · 카드 이미지'}
        </figcaption>
      )}
    </figure>
  );
}
