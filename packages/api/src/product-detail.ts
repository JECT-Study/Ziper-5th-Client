/** Client-facing reference boundary. No product HTTP contract is implemented on develop yet. */
export type ProductStatus = 'PLANNED' | 'PURCHASED';
export type FallbackIcon = 'TOP' | 'PANTS' | 'SKIRT' | 'ACCESSORY' | 'BEAUTY';
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
  fallbackIcon: FallbackIcon | null;
  status: ProductStatus;
  isLinkValid: boolean;
  tags: readonly string[];
  boards: readonly ProductBoard[];
};

export type ProductUpdate = Pick<
  ProductDetail,
  'productTitle' | 'shop' | 'price' | 'memo' | 'imageUrl' | 'imageFileId' | 'fallbackIcon' | 'tags'
> & { boardIds: readonly string[] };

export class ProductDetailError extends Error {
  constructor(public readonly code: 'auth-required' | 'forbidden' | 'not-found' | 'failed') {
    super(code);
    this.name = 'ProductDetailError';
  }
}

export interface ProductDetailApi {
  get(cardId: string, signal: AbortSignal): Promise<ProductDetail>;
  listBoards(signal: AbortSignal): Promise<readonly ProductBoard[]>;
  update(cardId: string, input: ProductUpdate): Promise<ProductDetail>;
  purchase(
    cardId: string,
  ): Promise<{ cardId: string; status: 'PURCHASED'; affectedBoardCount: number }>;
  listPurchased(signal: AbortSignal): Promise<readonly ProductDetail[]>;
  openOriginal(cardId: string): Promise<void>;
}
// Mutation 'failed' guarantees no change. Other exceptions have an unknown outcome;
// callers must reconcile before allowing another submission.
