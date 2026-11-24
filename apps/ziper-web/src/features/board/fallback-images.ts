import accessory from '../../assets/product-save/accessory.png';
import beauty from '../../assets/product-save/beauty.png';
import pants from '../../assets/product-save/pants.png';
import skirt from '../../assets/product-save/skirt.png';
import tops from '../../assets/product-save/tops.png';
import type { FallbackIcon } from './api';

/** 이미지가 없는 상품을 대신하는 카테고리 그림 */
export const fallbackImages: Record<FallbackIcon, string> = {
  TOP: tops,
  PANTS: pants,
  SKIRT: skirt,
  ACCESSORY: accessory,
  BEAUTY: beauty,
};
