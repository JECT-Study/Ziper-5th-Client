/** Client-facing boundary, not a declaration of the server wire format. */
export type BoardSummary = { id: string; name: string; productCount: number };

export type ProductPreview = {
  shop: string;
  name: string;
  price: number | null;
  imageURL: string | null;
};

export type ProductLookup =
  | { status: 'found'; product: ProductPreview }
  | { status: 'manual' | 'unsupported' | 'auth-required' };

export type CardImage =
  | { kind: 'linked-product' }
  | { kind: 'template'; id: string }
  | { kind: 'upload'; file: File };

export type ProductSaveInput = {
  url: string;
  name: string;
  price: number | null;
  image: CardImage | null;
  tags: readonly string[];
  memo: string;
  boardIds: readonly string[];
};

export type ProductSaveResult = 'saved' | 'duplicate' | 'auth-required' | 'failed';

export interface ProductSaveApi {
  lookup(url: string, signal: AbortSignal): Promise<ProductLookup>;
  listBoards(signal: AbortSignal): Promise<readonly BoardSummary[]>;
  createBoard(name: string): Promise<BoardSummary>;
  // 'failed' means nothing was saved. Reject if the result is uncertain; the caller must not retry blindly.
  save(input: ProductSaveInput): Promise<ProductSaveResult>;
}
