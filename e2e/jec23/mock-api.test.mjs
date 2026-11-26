import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

async function startFixture(t) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('./mock-api.mjs', import.meta.url))],
    {
      env: { ...process.env, JEC23_FIXTURE_PORT: '0' },
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  const closed = once(child, 'close');
  const output = createInterface({ input: child.stdout });
  t.after(async () => {
    child.kill();
    await closed;
    output.close();
  });
  const base = await Promise.race([
    once(output, 'line').then(
      ([line]) => line?.match(/^JEC-23 fixture: (http:\/\/127\.0\.0\.1:\d+)$/)?.[1],
    ),
    closed.then(([code]) => {
      throw new Error(`Fixture exited before startup: ${code}`);
    }),
  ]);
  assert.ok(base, 'Fixture is listening on loopback');
  return base;
}

async function fixture(t) {
  const base = await startFixture(t);
  return async (path, status = 200, method = 'GET', body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { Authorization: 'Bearer jec23-local-fixture', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(3_000),
    });
    assert.equal(response.status, status, `${method} ${path}`);
    return response.json();
  };
}

const detail = (id) => `/api/v1/products/${id}`;
const board = (id) => `/api/v1/boards/${id}/products`;
const ids = ({ items }) => items.map(({ cardId }) => cardId);

async function emailFixture(t, reset = 'auth=email') {
  const base = await startFixture(t);
  const call = (path, method = 'GET', headers = {}, body) =>
    fetch(`${base}${path}`, { method, headers, body, signal: AbortSignal.timeout(3_000) });
  const auth = '/api/v1/auth';
  const cookieMode = { 'X-Refresh-Token-Mode': 'cookie' };
  const login = (password, headers = cookieMode) =>
    call(
      `${auth}/email/login`,
      'POST',
      { ...headers, 'Content-Type': 'application/json' },
      JSON.stringify({ email: 'jec23@example.test', password }),
    );
  const reissue = (Cookie) =>
    call(`${auth}/reissue`, 'POST', { ...cookieMode, ...(Cookie && { Cookie }) });
  const getProduct = (accessToken) =>
    call(detail(7), 'GET', { Authorization: `Bearer ${accessToken}` });
  const credentials = async (response) => {
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /; HttpOnly;/);
    assert.match(cookie, /; Path=\/api\/v1\/auth;/);
    return { cookie: cookie.split(';')[0], token: (await response.json()).accessToken };
  };

  assert.equal((await call(`/_reset?${reset}`, 'POST')).status, 200);
  return { call, login, reissue, getProduct, credentials, auth, cookieMode };
}

test('mock email login gates product APIs, rotates refresh cookies and supports logout', async (t) => {
  const { call, login, reissue, getProduct, credentials, auth, cookieMode } = await emailFixture(t);
  assert.equal((await reissue()).status, 401);
  assert.equal((await getProduct('jec23-local-fixture')).status, 401);
  assert.equal((await call(`${detail(7)}/purchase`, 'POST')).status, 401);
  assert.equal((await login('wrong')).status, 401);
  assert.equal((await login('Jec23Fixture!', {})).status, 401);
  const first = await credentials(await login('Jec23Fixture!'));
  const product = await getProduct(first.token);
  assert.equal(product.status, 200);
  assert.equal((await product.json()).status, 'PLANNED');
  const second = await credentials(await reissue(first.cookie));
  assert.notEqual(second.cookie, first.cookie);
  assert.equal((await reissue(first.cookie)).status, 401);
  assert.equal((await getProduct(first.token)).status, 401);
  const signedIn = { Authorization: `Bearer ${second.token}` };
  const purchased = await call(`${detail(7)}/purchase`, 'POST', signedIn);
  assert.equal(purchased.status, 200);
  assert.deepEqual(await purchased.json(), {
    cardId: 7,
    status: 'PURCHASED',
    affectedBoardCount: 2,
  });
  const list = await call('/api/v1/products/purchased?sort=RECENT', 'GET', signedIn);
  assert.equal(list.status, 200);
  assert.equal(ids(await list.json())[0], 7);
  const logout = await call(`${auth}/logout`, 'POST', { ...cookieMode, Cookie: second.cookie });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await reissue(second.cookie)).status, 401);
  assert.equal((await getProduct(second.token)).status, 401);
});

test('a purchase that expires an email session stays uncommitted until an explicit retry', async (t) => {
  const { call, login, reissue, getProduct, credentials } = await emailFixture(
    t,
    'auth=email&expireSessionOnPurchase=1',
  );
  const purchaseWith = (token) =>
    call(`${detail(7)}/purchase`, 'POST', { Authorization: `Bearer ${token}` });
  const expired = await credentials(await login('Jec23Fixture!'));
  assert.equal((await purchaseWith(expired.token)).status, 401);
  assert.equal((await reissue(expired.cookie)).status, 401);
  const fresh = await credentials(await login('Jec23Fixture!'));
  assert.equal((await reissue(expired.cookie)).status, 401);
  const product = await getProduct(fresh.token);
  assert.equal(product.status, 200);
  assert.equal((await product.json()).status, 'PLANNED');
  const purchase = await purchaseWith(fresh.token);
  assert.equal(purchase.status, 200);
  assert.deepEqual(await purchase.json(), {
    cardId: 7,
    status: 'PURCHASED',
    affectedBoardCount: 2,
  });
});

// This exercises fixture behavior over HTTP, never the deployed storage or queue.
test(
  'JEC-79: purchase keeps membership, excludes rediscovery, and lists each card once',
  { timeout: 10_000 },
  async (t) => {
    const request = await fixture(t);
    assert.ok((await request('/_state')).eligibleCardIds.includes(7));
    assert.deepEqual(await request(`${detail(7)}/purchase`, 200, 'POST'), {
      cardId: 7,
      status: 'PURCHASED',
      affectedBoardCount: 2,
    });
    assert.deepEqual(await request(`${detail(7)}/purchase`, 409, 'POST'), {
      code: 'ALREADY_PURCHASED',
    });
    for (const boardId of [1, 2]) assert.ok(!ids(await request(board(boardId))).includes(7));
    const summary = await request('/api/v1/boards');
    assert.deepEqual(
      summary.boards.map(({ productCount }) => productCount),
      [2, 1],
    );
    assert.equal(summary.purchasedSummary.productCount, 3);
    assert.deepEqual(
      (await request(detail(7))).boards.map(({ boardId }) => boardId),
      [1, 2],
    );

    const future = encodeURIComponent(new Date(Date.now() + 15 * 86_400_000).toISOString());
    const state = await request(`/_state?at=${future}`);
    assert.deepEqual(state.eligibleCardIds, [8, 9]);

    const sorts = {
      RECENT: [7, 11, 10],
      OLDEST: [10, 11, 7],
      PRICE_ASC: [7, 10, 11],
      PRICE_DESC: [10, 7, 11],
    };
    for (const [sort, expected] of Object.entries(sorts)) {
      const path = `/api/v1/products/purchased?size=20&sort=${sort}`;
      const first = await request(path);
      assert.ok(first.nextCursor);
      const next = await request(`${path}&cursor=${encodeURIComponent(first.nextCursor)}`);
      assert.equal(next.nextCursor, null);
      assert.deepEqual([...ids(first), ...ids(next)], expected);
    }
  },
);

test('PATCH updates the source and target boards and keeps the card', async (t) => {
  const request = await fixture(t);
  const patch = (boardIds) =>
    request(detail(7), 200, 'PATCH', {
      productTitle: '수정한 가디건',
      price: 29_000,
      tags: ['가을'],
      memo: '수정한 메모',
      boardIds,
      imageUrl: null,
      imageFileId: null,
      fallbackIcon: 'TOP',
    });
  // Revisiting or editing an existing mapping doesn't make it newly added.
  await request(detail(7));
  await patch([1, 2]);
  assert.deepEqual(ids(await request(board(2))), [8, 7]);

  const moved = await patch([2]);
  assert.deepEqual(
    moved.boards.map(({ boardId }) => boardId),
    [2],
  );
  assert.deepEqual(ids(await request(board(1))), [9, 8]);
  assert.deepEqual(ids(await request(board(2))), [8, 7]);
  const summaries = () =>
    request('/api/v1/boards').then(({ boards }) =>
      boards.map(({ productCount, previewImages }) => [
        productCount,
        previewImages.map(({ cardId }) => cardId),
      ]),
    );
  assert.deepEqual(await summaries(), [
    [2, [9, 8]],
    [2, [8, 7]],
  ]);

  await patch([1, 2]);
  assert.deepEqual(ids(await request(board(1))), [7, 9]);
  assert.deepEqual(ids(await request(board(1) + '?sort=OLDEST')), [8, 9]);
  const pricePath = board(1) + '?sort=PRICE_ASC';
  const first = await request(pricePath);
  const next = await request(`${pricePath}&cursor=${encodeURIComponent(first.nextCursor)}`);
  assert.deepEqual([...ids(first), ...ids(next)], [9, 7, 8]);
  assert.deepEqual(await summaries(), [
    [3, [7, 9, 8]],
    [2, [8, 7]],
  ]);
});

test(
  'detail and original visits postpone rediscovery without making purchases',
  { timeout: 10_000 },
  async (t) => {
    const request = await fixture(t);
    await request(detail(7));
    await request(`${detail(8)}/open-original`, 200, 'POST');
    assert.deepEqual((await request('/_state')).eligibleCardIds, [9]);
    const atDays = (days) =>
      encodeURIComponent(new Date(Date.now() + days * 86_400_000).toISOString());
    assert.deepEqual((await request(`/_state?at=${atDays(13)}`)).eligibleCardIds, [9]);
    const after = atDays(15);
    assert.deepEqual((await request(`/_state?at=${after}`)).eligibleCardIds, [7, 8, 9]);
    const summary = await request('/api/v1/boards');
    assert.equal(summary.purchasedSummary.productCount, 2);
    assert.equal(summary.boards[0].productCount, 3);
    assert.equal(summary.boards[1].productCount, 2);
  },
);

test('distinguishes an unclassified visit 404 from a deleted product', async (t) => {
  const request = await fixture(t);
  const visit = `${detail(8)}/open-original`;
  await request('/_reset?originalVisitStatus=unclassified-404', 200, 'POST');
  assert.deepEqual(await request(visit, 404, 'POST'), {});
  assert.ok(ids(await request(board(2))).includes(8));
  assert.ok((await request('/_state')).eligibleCardIds.includes(8));

  await request('/_reset?originalVisitStatus=404', 200, 'POST');
  assert.deepEqual(await request(visit, 404, 'POST'), { code: 'PRODUCT_CARD_NOT_FOUND' });
  assert.ok(!ids(await request(board(2))).includes(8));
  assert.deepEqual(await request(detail(8), 404), { code: 'PRODUCT_CARD_NOT_FOUND' });
});

test('detail and original visits change date ordering but not price ordering', async (t) => {
  const request = await fixture(t);
  const list = async (sort) => ids(await request(`/api/v1/products/purchased?sort=${sort}`));
  assert.deepEqual(await list('OLDEST'), [10, 11]);
  await request(detail(10));
  assert.deepEqual(await list('RECENT'), [10, 11]);
  assert.deepEqual(await list('OLDEST'), [11, 10]);
  await request(`${detail(11)}/open-original`, 200, 'POST');
  assert.deepEqual(await list('RECENT'), [11, 10]);
  assert.deepEqual(await list('OLDEST'), [10, 11]);
  for (const sort of ['PRICE_ASC', 'PRICE_DESC']) assert.deepEqual(await list(sort), [10, 11]);
});
