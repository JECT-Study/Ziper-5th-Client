import type { Outcome } from './outcome';
import type { FallbackIcon } from './product-fields';

/** Client-facing types; the web adapter maps the deployed HTTP contract to this shape. */
export type ProductStatus = 'PLANNED' | 'PURCHASED';
export type ProductLinkStatus = 'AVAILABLE' | 'SOLD_OUT' | 'REMOVED' | 'UNKNOWN';
export type ProductBoard = { id: string; name: string };

export type ProductDetail = {
  cardId: string;
  productUrl: string;
  shop: string;
  productTitle: string;
  price: number | null;
  memo: string;
  imageUrl: string | null;
  imageFileId: string | null;
  imageFileUrl: string | null;
  fallbackIcon: FallbackIcon | null;
  status: ProductStatus;
  linkStatus: ProductLinkStatus;
  tags: readonly string[];
  boards: readonly ProductBoard[];
};

export type ProductUpdate = Pick<
  ProductDetail,
  'productTitle' | 'shop' | 'memo' | 'imageUrl' | 'imageFileId' | 'fallbackIcon' | 'tags'
> & { price: number; boardIds: readonly string[] };

export class ProductDetailError extends Error {
  constructor(
    public readonly code: 'auth-required' | 'forbidden' | 'not-found' | 'failed',
    public readonly detail?: string,
  ) {
    super(detail ?? code);
    this.name = 'ProductDetailError';
  }
}

export type ProductMutation<T> = Outcome<T, ProductDetailError['code']>;

/** Reads throw ProductDetailError or a transport error; mutations resolve to an Outcome. */
export interface ProductDetailApi {
  get(cardId: string, signal: AbortSignal): Promise<ProductDetail>;
  listBoards(signal: AbortSignal): Promise<readonly ProductBoard[]>;
  update(cardId: string, input: ProductUpdate): Promise<ProductMutation<ProductDetail>>;
  openOriginal(cardId: string): Promise<void>;
  // The deployed API does not offer purchases yet. Only the dev preview supplies these.
  purchases?: ProductPurchases;
}

export interface ProductPurchases {
  complete(
    cardId: string,
  ): Promise<ProductMutation<{ cardId: string; status: 'PURCHASED'; affectedBoardCount: number }>>;
  list(signal: AbortSignal): Promise<readonly ProductDetail[]>;
}
