import type { Outcome } from './outcome';
import type { FallbackIcon } from './product-fields';

/** Client-facing types; the web adapter maps the deployed HTTP contract to this shape. */
export type ProductStatus = 'PLANNED' | 'PURCHASED';
export type ProductLinkStatus = 'AVAILABLE' | 'SOLD_OUT' | 'REMOVED' | 'UNKNOWN';
export type ProductBoard = { id: string; name: string; productCount?: number };

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
  imageStatus: 'NONE' | 'PENDING' | 'READY' | 'FAILED';
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
    public readonly code:
      | 'auth-required'
      | 'forbidden'
      | 'not-found'
      | 'board-not-found'
      | 'image-unusable'
      | 'failed',
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
  createBoard(name: string): Promise<ProductBoard>;
  update(cardId: string, input: ProductUpdate): Promise<ProductMutation<ProductDetail>>;
  openOriginal(cardId: string, signal?: AbortSignal): Promise<void>;
  // The deployed API does not offer purchases yet. The dev fixture and previews supply these.
  purchases?: ProductPurchases;
}

export type PurchaseSort = 'RECENT' | 'OLDEST' | 'PRICE_ASC' | 'PRICE_DESC';

export type PurchasedProduct = Pick<
  ProductDetail,
  | 'cardId'
  | 'productTitle'
  | 'shop'
  | 'price'
  | 'imageFileUrl'
  | 'imageUrl'
  | 'fallbackIcon'
  | 'tags'
  | 'productUrl'
  | 'linkStatus'
>;

// Client-facing page shape; the wire DTO still needs to be confirmed in JEC-79.
export type PurchasedPage = {
  items: readonly PurchasedProduct[];
  nextCursor: string | null;
};

export interface ProductPurchases {
  complete(
    cardId: string,
  ): Promise<ProductMutation<{ cardId: string; status: 'PURCHASED'; affectedBoardCount: number }>>;
  list(sort: PurchaseSort, signal: AbortSignal, cursor?: string): Promise<PurchasedPage>;
}
