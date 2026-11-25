import { ablyProductRedirectHost, productExtractionTimeout, shopHosts } from '../link';
import type { Shops } from '../schema';
import { ablySource } from './ably';
import { commonSource } from './common';
import { musinsaSource } from './musinsa';
import { sampleSource } from './sample';
import { zigzagSource } from './zigzag';

// Standalone JS injected into the extraction WebView. It posts {url, name, price, imageURL}
// snapshots until one is complete. Keep it as source text: Hermes doesn't preserve function source.
// The parts share one function scope; `sample` reads the shop sections' bindings when it runs.
const scanProduct = String.raw`(function (shops, ablyRedirectHost, hosts, timeout) {
  if (window !== window.top) return;
  const host = location.hostname === ablyRedirectHost ? 'm.a-bly.com' : location.hostname;
  const rule = shops.find((shop) => shop.hosts.includes(host));
  // The WebView can inject this script more than once per document.
  if (!rule || window.__ziperProductScan === document) return;
  window.__ziperProductScan = document;
${commonSource}
${musinsaSource}
${zigzagSource}
${ablySource}
${sampleSource}
  if (sample()) return;
  const interval = setInterval(() => { if (sample()) clearInterval(interval); }, 300);
  setTimeout(() => clearInterval(interval), timeout);
})`;

export function productScanScript(shops: Shops, timeout = productExtractionTimeout) {
  const args = [shops, ablyProductRedirectHost, shopHosts, timeout].map((arg) =>
    JSON.stringify(arg),
  );
  return `${scanProduct}(${args.join(', ')}); true;`;
}
