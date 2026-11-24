// 보드 백엔드 API. 화면·상태는 모르고 요청과 응답만 다룬다.
import { request } from '../../shared/api/http';

export type FallbackIcon = 'TOP' | 'PANTS' | 'SKIRT' | 'ACCESSORY' | 'BEAUTY';

export type BoardPreviewImage = {
  cardId: number;
  /** 서명 URL 또는 원본 이미지. 둘 다 없으면 null */
  imageUrl: string | null;
  fallbackIcon: FallbackIcon | null;
};

export type Board = {
  boardId: number;
  name: string;
  /** 기본 보드는 false. 이름 수정·삭제가 막혀 있다. */
  modifiable: boolean;
  productCount: number;
  /** 최근 추가된 상품 썸네일, 최대 3장 */
  previewImages: BoardPreviewImage[];
  createdAt: string;
};

export type PurchasedSummary = {
  productCount: number;
  previewImages: BoardPreviewImage[];
};

export type BoardList = { boards: Board[]; purchasedSummary: PurchasedSummary };

/** 최신 생성순 */
export function fetchBoards() {
  return request<BoardList>('/api/v1/boards', { auth: true });
}

export function createBoard(name: string) {
  return request<Omit<Board, 'previewImages'>>('/api/v1/boards', {
    method: 'POST',
    body: { name },
    auth: true,
  });
}

export type BoardSort = 'RECENT' | 'OLDEST' | 'PRICE_ASC' | 'PRICE_DESC';

export type BoardProduct = {
  cardId: number;
  shop: string | null;
  productTitle: string;
  price: number;
  memo: string | null;
  /** 원본 쇼핑몰 이미지 */
  imageUrl: string | null;
  /** 자체 저장소 썸네일. 있으면 이걸 먼저 쓴다. */
  imageFileUrl: string | null;
  fallbackIcon: FallbackIcon | null;
  tags: { tagId: number; title: string; isDefault: boolean }[];
  addedAt: string;
};

export type BoardProductPage = {
  boardId: number;
  name: string;
  modifiable: boolean;
  productCount: number;
  items: BoardProduct[];
  /** 마지막 페이지면 null */
  nextCursor: string | null;
  hasNext: boolean;
};

export function fetchBoardProducts(boardId: number, sort: BoardSort, cursor?: string | null) {
  const params = new URLSearchParams({ sort, size: '20' });
  if (cursor) params.set('cursor', cursor);
  return request<BoardProductPage>(`/api/v1/boards/${boardId}/products?${params}`, { auth: true });
}

/** 원본 쇼핑몰로 간다고 기록하고(재발견 주기 초기화), 열 주소를 받는다. 보드 목록 응답에는 주소가 없다. */
export async function openOriginal(cardId: number) {
  const { productUrl } = await request<{ productUrl: string }>(
    `/api/v1/products/${cardId}/open-original`,
    { method: 'POST', auth: true },
  );
  return productUrl;
}

export function renameBoard(boardId: number, name: string) {
  return request<{ boardId: number; name: string }>(`/api/v1/boards/${boardId}`, {
    method: 'PATCH',
    body: { name },
    auth: true,
  });
}

/** 보드를 지운다. 다른 보드에 없는 상품만 휴지통(30일)으로 간다. */
export function deleteBoard(boardId: number) {
  return request(`/api/v1/boards/${boardId}`, { method: 'DELETE', auth: true });
}
