// Local HTTP fixture for the existing detail/board API plus the provisional JEC-79 contract.
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const seedBoards = () => [
  { boardId: 1, name: '기본 보드' },
  { boardId: 2, name: '가을 코디' },
];
let boards = seedBoards();
const createdAt = '2026-11-22T00:00:00Z';
const autoToken = 'jec23-local-fixture';
const refreshCookie = 'jec23_refresh';
let requireLogin = false;
let session = null;
const sessionCookie = (token) =>
  `${refreshCookie}=${token ?? ''}; Path=/api/v1/auth; HttpOnly; SameSite=Lax${token ? '' : '; Max-Age=0'}`;
const retiredImageUrl = 'https://retired.example.invalid/product.png';
const rediscoveryInterval = 14 * 24 * 60 * 60 * 1_000;
const product = (cardId, productTitle, price, boardIds, status = 'PLANNED') => ({
  cardId,
  productTitle,
  price,
  boardLinks: new Map(boardIds.map((id) => [id, 0])),
  status,
  createdAt,
  updatedOrder: 0,
  nextRediscoveryAt: new Date(Date.now() - 1_000).toISOString(),
  productUrl: `https://example.com/products/${cardId}`,
  shop: '테스트몰',
  memo: '첫 저장 메모',
  imageUrl: null,
  imageFileId: null,
  imageFileUrl: null,
  imageStatus: 'NONE',
  fallbackIcon: 'TOP',
  link: { status: 'AVAILABLE' },
  tags: [{ tagId: 3, title: '가을', isDefault: true }],
});
const seed = () => [
  product(7, '오버핏 울 블렌드 니트 가디건', 39000, [1, 2]),
  product(8, '린넨 블라우스', 29000, [1, 2]),
  product(9, '플리츠 스커트', 19000, [1]),
  product(10, '구매한 셔츠', 45000, [2], 'PURCHASED'),
  product(11, '구매한 바지', 50000, [2], 'PURCHASED'),
];
let cards = seed();
let nextUpdatedOrder = 1;
let dropMutationReplies = false;
let failMutationStatusRead = false;
let failedStatusCardId = null;
let summaryFailure = null;
let dropEditBeforeCommit = false;
let staleEditReply = false;
let failEditStatusRead = false;
let failDetailId = null;
let failEditBoards = false;
let failBoardsOnce = false;
let failPurchasedOnce;
let removedBeforePurchase = false;
let purchasedBeforePurchase = false;
let expiredSession = false;
let expireSessionOnEdit = false;
let expireSessionOnPurchase = false;
let sessionErrorOnPurchasedPage = null;
let failReissueOnce = null;
let deleteBoardOnEdit = false;
let boardChoicesRefreshStatus = null;
let removeCardOnEdit = false;
let boardCreateReply = null;
let delayOriginalReply = false;
let originalVisitStatus = null;
const purchased = () => cards.filter((card) => card.status === 'PURCHASED');
const inBoard = (boardId) =>
  cards.filter((card) => card.status === 'PLANNED' && card.boardLinks.has(boardId));
function recordVisit(card) {
  card.nextRediscoveryAt = new Date(Date.now() + rediscoveryInterval).toISOString();
  card.updatedOrder = nextUpdatedOrder++;
}

function removeSecondaryBoard() {
  boards = boards.filter(({ boardId }) => boardId !== 2);
  cards = cards.filter((card) => {
    card.boardLinks.delete(2);
    return card.boardLinks.size > 0 || card.status === 'PURCHASED';
  });
}
const dto = ({ boardLinks, updatedOrder: _updatedOrder, ...card }) => ({
  ...card,
  boards: boards.filter((board) => boardLinks.has(board.boardId)),
});
const summary = (items) => ({
  productCount: items.length,
  previewImages: items
    .slice(0, 3)
    .map(({ cardId, imageUrl, fallbackIcon }) => ({ cardId, imageUrl, fallbackIcon })),
});

function sorted(items, sort, boardId) {
  // Board queries sort by the mapping's creation order; JEC-79 date sorts use updated_at.
  const orderOf = (card) =>
    boardId === undefined ? card.updatedOrder : card.boardLinks.get(boardId);
  return items.toSorted((a, b) => {
    const recentFirst = orderOf(b) - orderOf(a) || b.cardId - a.cardId;
    if (sort === 'PRICE_ASC' || sort === 'PRICE_DESC') {
      const tie = boardId === undefined ? b.cardId - a.cardId : recentFirst;
      if (a.price === null || b.price === null) {
        return Number(a.price === null) - Number(b.price === null) || tie;
      }
      const price = sort === 'PRICE_ASC' ? a.price - b.price : b.price - a.price;
      return price || tie;
    }
    return sort === 'OLDEST' ? -recentFirst : recentFirst;
  });
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return JSON.parse(body);
}

function pageOf(items, cursor) {
  const offset = Number(cursor ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) return null;
  // Deliberately small pages make cursor behavior observable on either list.
  return {
    items: items.slice(offset, offset + 2).map(dto),
    nextCursor: offset + 2 < items.length ? String(offset + 2) : null,
  };
}

createServer(async (req, res) => {
  const { method } = req;
  const { pathname, searchParams } = new URL(req.url, 'http://127.0.0.1');
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
    console.log(method, req.url, status);
  };
  const issueSession = () => {
    session = { access: randomUUID(), refresh: randomUUID() };
    res.setHeader('Set-Cookie', sessionCookie(session.refresh));
    return json(200, { accessToken: session.access });
  };
  const committed = (body, statusCardId = null) => {
    if (!dropMutationReplies) return json(200, body);
    if (failMutationStatusRead) failedStatusCardId = statusCardId;
    console.log(method, pathname, 'committed; response dropped');
    res.destroy();
  };
  try {
    if (method === 'GET' && pathname === '/api/_jec23/ready') {
      return json(200, { fixture: 'jec23' });
    }
    if (method === 'POST' && pathname === '/_reset') {
      requireLogin = searchParams.get('auth') === 'email';
      session = null;
      boards = seedBoards();
      deleteBoardOnEdit = searchParams.get('deleteBoardOnEdit') === '1';
      boardChoicesRefreshStatus =
        searchParams.get('boardChoicesRefreshStatus') ??
        (searchParams.get('expireOnBoardChoicesRefresh') === '1' ? '401' : null);
      removeCardOnEdit = searchParams.get('removeCardOnEdit') === '1';
      boardCreateReply =
        searchParams.get('boardCreateReply') ??
        (searchParams.get('duplicateBoardOnCreate') === '1' ? 'duplicate' : null);
      cards = seed().filter(
        (card) => searchParams.get('emptyPurchased') !== '1' || card.status !== 'PURCHASED',
      );
      if (searchParams.get('shopLinkStates') === '1') {
        for (const card of cards) {
          if (card.cardId === 8 || card.cardId === 10) card.link.status = 'SOLD_OUT';
          if (card.cardId === 9 || card.cardId === 11) card.link.status = 'REMOVED';
        }
      }
      if (searchParams.get('unicodeProductText') === '1') {
        const card = cards.find(({ cardId }) => cardId === 8);
        card.productTitle = '\u00a0린넨 블라우스\u202f';
        card.memo = '\u2007첫 저장 메모\u00a0';
      }
      if (searchParams.get('invalidEditImageUrl') === '1') {
        cards.find(({ cardId }) => cardId === 8).imageUrl = retiredImageUrl;
      }
      if (searchParams.get('unsignedEditImage') === '1') {
        // The detail API can return a stored file ID without a signed URL.
        const card = cards.find(({ cardId }) => cardId === 8);
        card.imageFileId = 81;
        card.imageStatus = 'READY';
      }
      if (searchParams.get('mirrorWhileEditing') === '1') {
        const card = cards.find(({ cardId }) => cardId === 8);
        card.imageUrl = 'https://image.example.invalid/original-photo.png';
        card.imageStatus = 'PENDING';
      }
      delayOriginalReply = searchParams.get('delayOriginalReply') === '1';
      originalVisitStatus = searchParams.get('originalVisitStatus');
      if (delayOriginalReply) {
        const removed = cards.find((card) => card.cardId === 8);
        removed.link.status = 'REMOVED';
      }
      nextUpdatedOrder = 1;
      dropMutationReplies = searchParams.get('dropMutationReplies') === '1';
      failMutationStatusRead = searchParams.get('failMutationStatusRead') === '1';
      failedStatusCardId = null;
      summaryFailure = null;
      dropEditBeforeCommit = searchParams.get('dropEditBeforeCommit') === '1';
      staleEditReply = searchParams.get('staleEditReply') === '1';
      failEditStatusRead = searchParams.get('failEditStatusRead') === '1';
      failDetailId = null;
      failEditBoards = searchParams.get('failEditBoards') === '1';
      failBoardsOnce = false;
      failPurchasedOnce = searchParams.get('failPurchasedOnce');
      removedBeforePurchase = searchParams.get('removedBeforePurchase') === '1';
      purchasedBeforePurchase = searchParams.get('purchasedBeforePurchase') === '1';
      expiredSession = searchParams.get('expiredSession') === '1';
      expireSessionOnEdit = searchParams.get('expireSessionOnEdit') === '1';
      expireSessionOnPurchase = searchParams.get('expireSessionOnPurchase') === '1';
      const reissue = searchParams.get('purchasedPageReissue');
      sessionErrorOnPurchasedPage = ['401', '403', '503'].includes(reissue) ? reissue : null;
      const entryReissue = searchParams.get('failReissueOnce');
      failReissueOnce = entryReissue === '1' ? '503' : entryReissue === '403' ? '403' : null;
      if (sessionErrorOnPurchasedPage) {
        cards.push(product(12, '구매한 가방', 59000, [2], 'PURCHASED'));
      }
      return json(200, { ok: true });
    }
    if (requireLogin && method === 'POST' && pathname.startsWith('/api/v1/auth/')) {
      const cookieMode = req.headers['x-refresh-token-mode'] === 'cookie';
      const hasRefreshCookie = () =>
        !!session &&
        req.headers.cookie?.split(/;\s*/).includes(`${refreshCookie}=${session.refresh}`);
      const unauthorized = () => json(401, { code: 'UNAUTHORIZED' });
      if (pathname === '/api/v1/auth/email/login') {
        const { email, password } = (await readJson(req)) ?? {};
        if (!cookieMode || email !== 'jec23@example.test' || password !== 'Jec23Fixture!') {
          return unauthorized();
        }
        expiredSession = false;
        return issueSession();
      }
      if (pathname === '/api/v1/auth/logout') {
        if (cookieMode) {
          if (hasRefreshCookie()) session = null;
          res.setHeader('Set-Cookie', sessionCookie(null));
        }
        res.writeHead(204, { 'Cache-Control': 'no-store' }).end();
        console.log(method, pathname, 204);
        return;
      }
      if (pathname === '/api/v1/auth/reissue' && (!cookieMode || !hasRefreshCookie())) {
        return unauthorized();
      }
    }
    if (!expiredSession && method === 'POST' && pathname === '/api/v1/auth/reissue') {
      if (failReissueOnce) {
        const status = Number(failReissueOnce);
        failReissueOnce = null;
        return json(status, { code: status === 403 ? 'FORBIDDEN' : 'TEMPORARY_FAILURE' });
      }
      return requireLogin ? issueSession() : json(200, { accessToken: autoToken });
    }
    const accessToken = requireLogin ? session?.access : autoToken;
    if (expiredSession || !accessToken || req.headers.authorization !== `Bearer ${accessToken}`)
      return json(401, { code: 'UNAUTHORIZED' });
    // Fixture introspection, not a contract for the future rediscovery API.
    if (method === 'GET' && pathname === '/_state') {
      const at = searchParams.get('at') ?? new Date().toISOString();
      const timestamp = Date.parse(at);
      if (!Number.isFinite(timestamp)) return json(400, { code: 'INVALID_TIME' });
      return json(200, {
        eligibleCardIds: cards
          .filter(
            (card) =>
              card.status === 'PLANNED' &&
              !['REMOVED', 'SOLD_OUT'].includes(card.link.status) &&
              Date.parse(card.nextRediscoveryAt) <= timestamp,
          )
          .map(({ cardId }) => cardId),
      });
    }
    if (method === 'POST' && pathname === '/api/v1/boards') {
      const { name: rawName } = await readJson(req);
      const name = typeof rawName === 'string' ? rawName.trim() : '';
      if (!name || [...name].length > 10) return json(400, { code: 'INVALID_BOARD_NAME' });
      if (boards.some((board) => board.name === name))
        return json(409, { code: 'DUPLICATE_BOARD_NAME' });
      const boardId = Math.max(...boards.map((board) => board.boardId)) + 1;
      const board = { boardId, name };
      boards = [board, ...boards];
      const reply = boardCreateReply;
      boardCreateReply = null;
      if (reply === 'duplicate') {
        // A board with the submitted name was created elsewhere after loading choices.
        return json(409, { code: 'DUPLICATE_BOARD_NAME' });
      }
      if (reply === 'wrong-board') {
        // The requested board was created, but the response refers to a different board.
        return json(201, {
          boardId: 2,
          name: '가을 코디',
          productCount: 2,
          createdAt,
          modifiable: true,
        });
      }
      return json(201, { ...board, productCount: 0, createdAt, modifiable: true });
    }
    if (method === 'GET' && pathname === '/api/v1/boards') {
      if (failBoardsOnce) {
        failBoardsOnce = false;
        return json(503, { code: 'TEMPORARY_FAILURE' });
      }
      const purchasedSummary = summary(sorted(purchased(), 'RECENT'));
      const failure = summaryFailure;
      summaryFailure = null;
      if (failure === '401') {
        expiredSession = true;
        return json(401, { code: 'UNAUTHORIZED' });
      }
      if (failure === '403') return json(403, { code: 'FORBIDDEN' });
      if (failure === 'malformed') purchasedSummary.previewImages = null;
      return json(200, {
        boards: boards.map((board) => ({
          ...board,
          ...summary(sorted(inBoard(board.boardId), 'RECENT', board.boardId)),
          createdAt,
          modifiable: board.boardId !== 1,
        })),
        purchasedSummary,
      });
    }
    if (method === 'GET' && pathname === '/api/v1/products/purchased') {
      const cursor = searchParams.get('cursor');
      if (cursor && sessionErrorOnPurchasedPage) {
        expiredSession = sessionErrorOnPurchasedPage === '401';
        failReissueOnce = expiredSession ? null : sessionErrorOnPurchasedPage;
        sessionErrorOnPurchasedPage = null;
        return json(401, { code: 'UNAUTHORIZED' });
      }
      if (failPurchasedOnce === (cursor ? 'next' : 'first')) {
        failPurchasedOnce = null;
        return json(503, { code: 'TEMPORARY_FAILURE' });
      }
      // JEC-79 allows a missing list price, while the deployed detail DTO requires one.
      const items = purchased().map((card) =>
        card.cardId === 11 ? { ...card, price: null } : card,
      );
      const page = pageOf(sorted(items, searchParams.get('sort')), cursor);
      return page ? json(200, page) : json(400, { code: 'INVALID_CURSOR' });
    }
    const boardPath = /^\/api\/v1\/boards\/(\d+)\/products$/.exec(pathname);
    if (boardPath) {
      const board = boards.find(({ boardId }) => boardId === Number(boardPath[1]));
      if (!board) return json(404, { code: 'BOARD_NOT_FOUND' });
      const cardsOnBoard = inBoard(board.boardId);
      if (method === 'GET') {
        const cursor = searchParams.get('cursor');
        const page = pageOf(sorted(cardsOnBoard, searchParams.get('sort'), board.boardId), cursor);
        if (!page) return json(400, { code: 'INVALID_REQUEST' });
        return json(200, {
          ...board,
          ...page,
          productCount: cardsOnBoard.length,
          hasNext: page.nextCursor !== null,
        });
      }
      return json(404, { code: 'NOT_FOUND' });
    }
    const productPath = /^\/api\/v1\/products\/(\d+)(?:\/(purchase|open-original))?$/.exec(
      pathname,
    );
    if (
      method === 'GET' &&
      productPath &&
      !productPath[2] &&
      Number(productPath[1]) === failedStatusCardId
    ) {
      failedStatusCardId = null;
      return json(503, { code: 'TEMPORARY_FAILURE' });
    }
    const card = productPath && cards.find(({ cardId }) => cardId === Number(productPath[1]));
    if (!card) return json(404, { code: productPath ? 'PRODUCT_CARD_NOT_FOUND' : 'NOT_FOUND' });
    if (method === 'GET' && !productPath[2]) {
      if (failDetailId === card.cardId) {
        failDetailId = null;
        return json(404, {});
      }
      if (failEditBoards && card.cardId === 8) {
        failEditBoards = false;
        failBoardsOnce = true;
      }
      recordVisit(card);
      return json(200, dto(card));
    }
    if (method === 'PATCH' && !productPath[2]) {
      const body = await readJson(req);
      if (expireSessionOnEdit) {
        expiredSession = true;
        return json(401, { code: 'UNAUTHORIZED' });
      }
      const { productTitle, price, memo, tags, boardIds, imageUrl, imageFileId, fallbackIcon } =
        body;
      if (removeCardOnEdit) {
        removeCardOnEdit = false;
        cards = cards.filter((item) => item !== card);
        return json(404, { code: 'PRODUCT_CARD_NOT_FOUND' });
      }
      if (deleteBoardOnEdit) {
        deleteBoardOnEdit = false;
        // Simulate removing another board after the edit form loaded its choices.
        removeSecondaryBoard();
        if (!cards.includes(card)) return json(404, { code: 'PRODUCT_CARD_NOT_FOUND' });
      }
      if (
        !productTitle ||
        !Number.isSafeInteger(price) ||
        price < 0 ||
        !tags?.length ||
        !Array.isArray(boardIds) ||
        !boardIds.length
      ) {
        return json(400, { code: 'INVALID_REQUEST' });
      }
      if (imageUrl === retiredImageUrl) return json(400, { code: 'INVALID_PRODUCT_IMAGE_URL' });
      if (boardIds.some((id) => !boards.some((board) => board.boardId === id))) {
        summaryFailure = boardChoicesRefreshStatus;
        return json(404, { code: 'BOARD_NOT_FOUND' });
      }
      const finishMirror = () => {
        if (card.imageStatus === 'PENDING' && card.imageUrl) {
          card.imageFileId = 81;
          card.imageStatus = 'READY';
        }
      };
      if (dropEditBeforeCommit) {
        dropEditBeforeCommit = false;
        if (failEditStatusRead) failDetailId = card.cardId;
        finishMirror();
        console.log(method, pathname, 'not committed; response dropped');
        res.destroy();
        return;
      }
      const previous = staleEditReply ? dto(card) : null;
      const updatedOrder = nextUpdatedOrder++;
      Object.assign(card, {
        updatedOrder,
        productTitle,
        price,
        memo,
        boardLinks: new Map(boardIds.map((id) => [id, card.boardLinks.get(id) ?? updatedOrder])),
        imageUrl,
        imageFileId,
        imageStatus:
          imageUrl === card.imageUrl && imageFileId === card.imageFileId
            ? card.imageStatus
            : 'NONE',
        fallbackIcon,
        tags: tags.map((title, index) => ({ title, tagId: index + 1, isDefault: false })),
      });
      finishMirror();
      staleEditReply = false;
      return committed(previous ?? dto(card));
    }
    if (method === 'POST' && productPath[2] === 'purchase') {
      if (expireSessionOnPurchase) {
        expireSessionOnPurchase = false;
        expiredSession = true;
        return json(401, { code: 'UNAUTHORIZED' });
      }
      if (removedBeforePurchase) {
        // Simulates deletion elsewhere, between loading detail and confirming purchase.
        removedBeforePurchase = false;
        cards = cards.filter((item) => item !== card);
        return json(400, { code: 'PRODUCT_CARD_NOT_FOUND' });
      }
      if (purchasedBeforePurchase && card.status === 'PLANNED') {
        // Another client confirmed between detail load and this confirmation.
        purchasedBeforePurchase = false;
        card.status = 'PURCHASED';
        card.updatedOrder = nextUpdatedOrder++;
      }
      if (card.status === 'PURCHASED') return json(409, { code: 'ALREADY_PURCHASED' });
      card.status = 'PURCHASED';
      card.updatedOrder = nextUpdatedOrder++;
      return committed(
        { cardId: card.cardId, status: card.status, affectedBoardCount: card.boardLinks.size },
        card.cardId,
      );
    }
    if (method === 'POST' && productPath[2] === 'open-original') {
      if (originalVisitStatus === '401') {
        expiredSession = true;
        return json(401, { code: 'UNAUTHORIZED' });
      }
      if (originalVisitStatus === 'unclassified-404') return json(404, {});
      if (originalVisitStatus === '404') {
        // The card disappeared after the caller loaded it.
        cards = cards.filter((item) => item !== card);
        return json(404, { code: 'PRODUCT_CARD_NOT_FOUND' });
      }
      recordVisit(card);
      if (delayOriginalReply) await new Promise((resolve) => setTimeout(resolve, 6_000));
      return json(200, { cardId: card.cardId, productUrl: card.productUrl });
    }
    return json(404, { code: 'NOT_FOUND' });
  } catch {
    return json(400, { code: 'INVALID_REQUEST' });
  }
}).listen(Number(process.env.JEC23_FIXTURE_PORT ?? 3011), '127.0.0.1', function () {
  console.log(`JEC-23 fixture: http://127.0.0.1:${this.address().port}`);
});
