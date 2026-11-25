import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const [path, url, title, price] = process.argv.slice(2);
assert.ok(
  path && url && title && price,
  'usage: node assert-product-fields.mjs snapshot.json URL TITLE PRICE',
);
const snapshot = JSON.parse(readFileSync(path, 'utf8'));
assert.equal(snapshot.success, true, 'agent-device snapshot failed');

for (const [label, expected] of [
  ['상품 링크', url],
  ['상품명', title],
  ['가격', price],
]) {
  const inputs = snapshot.data.nodes.filter(
    // Android uses the field caption as the hint and the entered text as the label.
    (node) =>
      node.kind === 'text-field' &&
      (snapshot.data.androidSnapshot ? node.placeholder : node.label) === label,
  );
  assert.equal(inputs.length, 1, `expected one ${label} input`);
  assert.equal(inputs[0].value, expected, `${label} value differs`);
}
console.log('상품 링크·전체 상품명·가격 일치');
