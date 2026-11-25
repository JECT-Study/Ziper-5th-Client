import type { FallbackIcon } from './product-detail';

export type BoardSummary = { id: string; name: string; productCount: number };

export type ProductPreview = {
  name: string;
  price: number | null;
  imageURL: string | null;
};

export type ProductLookup =
  | { status: 'ready'; url: string; shop: string; product?: ProductPreview }
  | { status: 'duplicate' | 'unsupported' | 'auth-required' };

export type CardImage =
  | { kind: 'linked-product'; url: string }
  | { kind: 'template'; id: FallbackIcon }
  | { kind: 'upload'; file: File };

export type ProductSaveInput = {
  url: string;
  sharedUrl: string | null;
  shop: string;
  name: string;
  price: number;
  image: CardImage;
  tags: readonly string[];
  memo: string;
  boardIds: readonly string[];
  metadataSource: 'CLIENT' | 'MANUAL';
};

export type ProductSaveResult = { cardId: string } | 'duplicate' | 'auth-required' | 'failed';

export interface ProductSaveApi {
  lookup(url: string, signal: AbortSignal): Promise<ProductLookup>;
  listBoards(signal: AbortSignal): Promise<readonly BoardSummary[]>;
  createBoard(name: string): Promise<BoardSummary>;
  // 'failed' means no product was registered. Reject if registration may have committed.
  save(input: ProductSaveInput): Promise<ProductSaveResult>;
}
