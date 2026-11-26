import { fallbackIcons } from '@ziper/api/product-fields';
import { choice, list, nullable, object, text, url } from './response';

/** Fields common to board cards, purchased cards and product detail. */
export function decodeProductCardFields(card: Record<string, unknown>) {
  return {
    shop: nullable(text, card.shop),
    productTitle: text(card.productTitle),
    imageUrl: nullable(url, card.imageUrl),
    imageFileUrl: nullable(url, card.imageFileUrl),
    fallbackIcon: nullable((icon) => choice(icon, fallbackIcons), card.fallbackIcon),
    linkStatus: choice(object(card.link).status, ['AVAILABLE', 'SOLD_OUT', 'REMOVED', 'UNKNOWN']),
    tags: list(card.tags).map((tag) => text(object(tag).title)),
  };
}
