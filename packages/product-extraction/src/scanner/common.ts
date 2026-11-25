// Parsing helpers and structured-data identity checks shared by every shop.
// Part of the injected scanner: plain JS sharing the scope set up in ./index.ts.
export const commonSource = String.raw`
  const parse = (source) => {
    if (!source || source.length > 500000) return null;
    try { return JSON.parse(source); } catch { return null; }
  };
  const property = (value, key) => value && typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
  const pathValue = (value, path) => path.replace(/\[(\d+)\]/g, '.$1').split('.').reduce(property, value);
  const krw = (value) => {
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.0+)?(?:\s*원)?$/.test(value)) return null;
    const price = Number(value.replace(/[,\s원]/g, ''));
    return price <= 1000000000 ? price : null;
  };
  const sameTitle = (a, b) => a.replace(/\s+/g, ' ') === b.replace(/\s+/g, ' ');
  const imageUrl = (value) => {
    if (rule.imageStrategy !== 'SERVER_MIRROR' || typeof value !== 'string' || !value.trim()) return null;
    try {
      value = value.trim().replace(/&amp;/g, '&');
      let url = new URL(value, location.href);
      if (musinsaId && (url.hostname === 'image.msscdn.net' || /^\/(?!\/)/.test(value))) {
        const imageId = /^\/(?:thumbnails\/)?images\/(?:goods|prd)_img\/\d{8}\/(\d+)\//.exec(url.pathname)?.[1];
        if (imageId && imageId !== musinsaId) return null;
        if (imageId && /^\/(?!\/)/.test(value)) url = new URL(value, 'https://image.msscdn.net');
      }
      if (zigzagId && url.hostname === 'cf.product-image.s.zigzag.kr') {
        // Only this observed path family carries a product ID; dated uploads do not.
        const imageId = /^\/original\/c\/(?:\d+\/){3}(\d+)-\d+\./.exec(url.pathname)?.[1];
        if (imageId && imageId !== zigzagId) return null;
      }
      return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
        url.href.length <= 2048 && rule.imageHosts.includes(url.hostname) ? url.href : null;
    } catch { return null; }
  };

  // A fragment or query alone inherits the current item's path, even on a recommendation.
  const hasURLPath = (value) => typeof value === 'string' && /^[^?#\s]/.test(value.trim());
  const productURLId = (value, hosts, path) => {
    if (!hasURLPath(value)) return;
    try {
      const url = new URL(value, location.href);
      if (url.protocol === 'https:' && !url.username && !url.password && !url.port &&
        hosts.includes(url.hostname)) return path.exec(url.pathname)?.[1];
    } catch {}
  };
  const structuredProductId = (product, hosts, path) => {
    const value = property(product, '@id');
    // Graph identifiers such as #product aren't evidence of a specific product URL.
    if (typeof value === 'string' && /^https:\/\//i.test(value)) return productURLId(value, hosts, path);
  };
  const identifiedProduct = (products, hosts, path, id, allowAnonymous) => {
    // The structured product and its offers must refer to the same item.
    const candidates = products.map(product => {
      const sku = product.sku;
      const urls = [product.url, ...[product.offers].flat().map(offer => offer?.url)]
        .filter(value => typeof value === 'string' && value.length);
      const structuredId = structuredProductId(product, hosts, path);
      const paths = urls.filter(hasURLPath);
      const identified = sku != null || !!structuredId || paths.length > 0;
      const matches = identified && paths.every(value => productURLId(value, hosts, path) === id) &&
        (sku == null || String(sku) === id) && (!structuredId || structuredId === id);
      return { product, matches, anonymous: !identified && !urls.length };
    });
    return candidates.find(candidate => candidate.matches)?.product ??
      (allowAnonymous && candidates.length === 1 && candidates[0].anonymous ? candidates[0].product : null);
  };
  const isWon = (currency) => currency == null || /^KRW$/i.test(String(currency).trim());
  const uniqueWon = (values) => {
    const prices = new Set();
    for (const raw of values) {
      if (typeof raw !== 'string' && typeof raw !== 'number') continue;
      const price = krw(String(raw).trim());
      if (price === null) continue;
      prices.add(price);
      if (prices.size > 1) return [];
    }
    return [...prices];
  };
`;
