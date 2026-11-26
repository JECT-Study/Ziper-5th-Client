import accessory from '../../assets/product-save/accessory.png';
import beauty from '../../assets/product-save/beauty.png';
import pants from '../../assets/product-save/pants.png';
import skirt from '../../assets/product-save/skirt.png';
import tops from '../../assets/product-save/tops.png';
import type { FallbackIcon } from '@ziper/api/product-fields';

export const fallbackImages: Record<FallbackIcon, string> = {
  TOP: tops,
  PANTS: pants,
  SKIRT: skirt,
  ACCESSORY: accessory,
  BEAUTY: beauty,
};
