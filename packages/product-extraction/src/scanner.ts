import { ablyProductRedirectHost, productExtractionTimeout, shopHosts } from './link';
import { maxExtractedTitleUnits, type Shops } from './schema';

// Standalone JS injected into the extraction WebView. It posts {url, name, price, imageURL}
// snapshots until one is complete. Keep it as source text: Hermes doesn't preserve function source.
const scanProduct = String.raw`(function (shops, ablyRedirectHost, hosts, timeout) {
  if (window !== window.top) return;
  const host = location.hostname === ablyRedirectHost ? 'm.a-bly.com' : location.hostname;
  const rule = shops.find((shop) => shop.hosts.includes(host));
  // The WebView can inject this script more than once per document.
  if (!rule || window.__ziperProductScan === document) return;
  window.__ziperProductScan = document;
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
  const musinsaHosts = hosts.musinsa;
  // Musinsa keeps the submitted path spelling but uses the decimal goods number in Detail and CDN paths.
  const musinsaPath = /^\/(?:products|app\/goods)\/0*([1-9]\d*|0)\/?$/;
  const musinsaId = musinsaHosts.includes(host) && musinsaPath.exec(location.pathname)?.[1];
  const musinsaPageTitle = (value) => value.replace(/\s+-\s+(?:사이즈\s*&\s*)?후기\s*\|\s*무신사\s*$/, '');
  const zigzagHosts = hosts.zigzag;
  const zigzagPath = /^\/(?:app\/)?catalog\/products\/(\d+)(?:\/|$)/;
  const zigzagId = zigzagHosts.includes(host) && zigzagPath.exec(location.pathname)?.[1];
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

  const ablyHosts = hosts.ably;
  const ablyPath = /^\/(?:app\/)?goods\/0*([1-9]\d*|0)\/?$/;
  const ablyId = ablyHosts.includes(host) && /^\/goods\/0*([1-9]\d*|0)(?:\/|$)/.exec(location.pathname)?.[1];
  let ablyUnavailable = false;
  if (ablyId) {
    // This notice from a hidden PDP otherwise blocks Ziper's manual entry screen.
    const alert = window.alert;
    window.alert = function (message) {
      if (typeof message === 'string' && /^판매 중인 상품이 아닙니다\.?$/.test(message.trim())) {
        ablyUnavailable = true;
        return;
      }
      return alert.apply(this, arguments);
    };
  }
  const ablyDetailTitle = () => {
    const share = document.querySelectorAll('[id="goods-detail-send"]');
    if (share.length !== 1) return '';
    // The item title is a sibling of the price block, including the promotion layout.
    const details = (share[0].closest('[id="goods-detail-price-highlight"]') ??
      share[0].parentElement?.parentElement)?.parentElement;
    const titles = [...(details?.children ?? [])]
      .filter(node => node.getAttribute('tabindex') === '0' && node.children.length === 1)
      .map(node => node.firstElementChild)
      .filter(node => !node.children.length && node.getAttribute('data-testid') === node.textContent);
    return titles.length === 1 ? titles[0].textContent.trim() : '';
  };
  const ablyDisplayPrice = (couponName) => {
    // The public price precedes the share button; list price, rewards and personal estimates are outside that group.
    const share = document.querySelectorAll('[id="goods-detail-send"]');
    if (share.length !== 1) return null;
    const group = share[0].parentElement?.firstElementChild;
    if (!group || group === share[0]) return null;
    if (couponName) {
      const labels = share[0].closest('[id="goods-detail-price-area"]')?.querySelectorAll('[data-testid="쿠폰적용가"]');
      if (labels?.length !== 1 ||
        labels[0].textContent.trim() !== '쿠폰적용가' || !sameTitle(ablyDetailTitle(), couponName)) return null;
    }
    const units = group.querySelectorAll('[data-testid="원"]');
    if (units.length !== 1 || units[0].textContent.trim() !== '원') return null;
    const text = units[0].parentElement?.textContent.trim() ?? '';
    return text.endsWith('원') ? krw(text) : null;
  };
  const ablySharingName = (value) => value.trim().replace(/\s+-\s+에이블리$/, '');
  const sameTitle = (a, b) => a.replace(/\s+/g, ' ') === b.replace(/\s+/g, ' ');
  // Each Ably app/web sharing card starts with its own URL.
  const ablyPageGroups = (kind) => {
    const groups = [];
    let group;
    for (const tag of document.head.querySelectorAll('meta[property^="' + kind + ':"]')) {
      const field = tag.getAttribute('property');
      if (field === kind + ':url') {
        group = { matches: false, app: false, tags: [] };
        groups.push(group);
        try {
          const url = new URL(tag.content);
          group.matches = url.protocol === 'https:' && !url.port && !url.username && !url.password &&
            (url.hostname === ablyRedirectHost || rule.hosts.includes(url.hostname)) &&
            ablyPath.exec(url.pathname)?.[1] === ablyId;
          group.app = url.pathname.startsWith('/app/');
        } catch {}
      } else if (group) group.tags.push(tag);
    }
    return groups;
  };

  // Public detail-page state is a fallback when the page omits OG/JSON-LD tags.
  const musinsaPdp = (data) => {
    const id = musinsaId;
    const props = data?.props?.pageProps;
    const queries = props?.dehydratedState?.queries;
    if (!id || data?.page !== '/products/[productId]' || String(data.query?.productId).replace(/^0+(?=\d)/, '') !== id ||
      props?.hasDetail !== true || !Array.isArray(queries)) return;
    const detail = queries.slice(0, 32).find(entry => entry?.queryKey?.[0] === 'Detail' &&
      String(entry.queryKey[1]) === id && String(entry.state?.data?.data?.goodsNo) === id)?.state?.data?.data;
    if (typeof detail?.goodsNm !== 'string' || !detail.goodsNm.trim()) return;
    // The Detail record carries the ID; the separate summary must agree with its name.
    const summary = props.meta?.data;
    const meta = summary?.goodsNm === detail.goodsNm ? summary : null;
    const summaryPrice = meta?.goodsPrice;
    const detailPrice = detail.goodsPrice;
    const won = (amount, prices) => typeof amount === 'number' && prices?.currency === 'KRW'
      ? krw(String(amount)) : null;
    let price;
    if ((props.currencyCode == null || props.currencyCode === 'KRW') &&
      (summaryPrice?.currency == null || summaryPrice.currency === 'KRW')) {
      // Either record can carry the public sale price; a coupon-adjusted final price is not a substitute.
      price = won(summaryPrice?.salePrice, summaryPrice) ?? won(detailPrice?.salePrice, detailPrice);
      if (price === null && summaryPrice?.couponDiscount !== true && detailPrice?.couponDiscount !== true) {
        const prices = summaryPrice ?? detailPrice;
        if (prices?.salePrice == null) price = won(prices?.finalPrice, prices);
      }
    }
    // Some listings render a season or style prefix separately from the structured name.
    let name = detail.goodsNm;
    if (typeof detail.headDesc === 'string' && detail.headDesc.trim()) {
      const headings = document.querySelectorAll('span[class*="GoodsName-"]');
      const heading = headings.length === 1 ? headings[0].textContent.trim() : '';
      if (heading && sameTitle(heading, (detail.headDesc + name).trim())) name = heading;
    }
    const cover = imageUrl(detail.thumbnailImageUrl);
    return {
      name,
      price,
      cover,
      imageURL: cover ?? imageUrl(meta?.thumbnailImageUrl),
    };
  };
  const zigzagPdp = (data, foreignCurrency) => {
    const id = zigzagId;
    if (!id || data?.query?.catalog_product_id !== id) return;
    const queries = data.props?.pageProps?.dehydratedState?.queries;
    if (!Array.isArray(queries)) return;
    for (const entry of queries.slice(0, 32)) {
      const key = entry?.queryKey;
      if (!Array.isArray(key) || key[0] !== 'getPdpBaseInfo' || String(key[1]) !== id) continue;
      const product = entry?.state?.data?.product;
      if (String(product?.id) !== id) continue;
      const prices = product.product_price;
      const display = prices?.display_final_price;
      // The public metadata uses the additional displayed price when the page shows a coupon price.
      const displayed = display?.final_price_additional ?? display?.final_price;
      const currency = displayed?.price_with_currency?.display_currency;
      const amount = typeof displayed?.price === 'number' ? krw(String(displayed.price)) : null;
      const legacy = prices?.final_discount_info?.discount_price;
      const legacyPrice = typeof legacy === 'number' ? krw(String(legacy)) : null;
      // 원~ is the published starting price, not a selected option. Require same-item corroboration.
      const startingPrice = currency === '원~' && !foreignCurrency && amount === legacyPrice;
      const displayedPrice = currency === '원' || startingPrice ? amount : null;
      const blocksLegacyPrice = currency != null && currency !== '원';
      return {
        name: typeof product.name === 'string' ? product.name : '',
        closed: product.sales_status === 'CLOSED',
        displayedPrice,
        blocksLegacyPrice,
        price: displayedPrice ?? (foreignCurrency || blocksLegacyPrice ? null : legacyPrice),
        imageURL: imageUrl(product.product_image_list?.[0]?.url),
      };
    }
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

  let last = '';
  let sent = 0;
  let sharingTitleSeenAt;
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
  const sample = () => {
    if (ablyUnavailable) return true;
    if (!window.ReactNativeWebView?.postMessage || !document.head) return false;
    if (/^(just a moment|attention required|access denied|403 forbidden|보안 확인 중)/i.test(document.title) ||
      document.querySelector('#challenge-form')) return true;
    const entities = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .slice(0, 16).flatMap((element) => parse(element.textContent) ?? [])
      .flatMap((entry) => property(entry, '@graph') ?? entry);
    const products = entities.filter((entry) => [property(entry, '@type')].flat().includes('Product'));
    const pageId = musinsaId || zigzagId;
    const productHosts = musinsaId ? musinsaHosts : zigzagHosts;
    const productPath = musinsaId ? musinsaPath : zigzagPath;
    const ogURL = pageId && document.querySelector('meta[property="og:url"]')?.content.trim();
    const ogMatches = !ogURL || productURLId(ogURL, productHosts, productPath) === pageId;
    const product = pageId
      ? identifiedProduct(products, productHosts, productPath, pageId, ogMatches)
      : ablyId ? identifiedProduct(products, ablyHosts, ablyPath, ablyId, false) : products[0];
    const usePageTags = !pageId || (ogURL ? ogMatches : !products.length || !!product);
    const nextData = parse(document.getElementById('__NEXT_DATA__')?.textContent);
    const ablyGroups = ablyId ? ablyPageGroups('og') : [];
    const twitterGroups = ablyId ? ablyPageGroups('twitter') : [];
    const expectedId = ablyId || zigzagId;
    const retailerIds = expectedId ? [...document.head.querySelectorAll('meta[property="product:retailer_item_id"]')]
      .map(tag => tag.content.trim()).filter(Boolean) : [];
    if (retailerIds.some(id => id !== expectedId)) return false;
    const ablyIdentityGroups = ablyGroups.length ? ablyGroups : twitterGroups;
    const ablyCardConflict = ablyIdentityGroups.length > 0 && !ablyIdentityGroups.some(group => group.matches);
    const ablyStorefrontTitle = ablyId && /^(.*?)\s+-\s+에이블리 스토어$/.exec(document.title.trim())?.[1];
    const ablyBrand = ablyId && retailerIds.length &&
      document.head.querySelector('meta[property="product:brand"]')?.content.trim();
    const withoutAblyBrand = (title) =>
      ablyBrand && title.startsWith(ablyBrand + ' ') ? title.slice(ablyBrand.length + 1) : title;
    const verifiedTwitterFallback = ablyCardConflict && twitterGroups.some(group => group.matches);
    if (ablyCardConflict && !verifiedTwitterFallback && !product) return false;
    const hasForeignMetaCurrency = [...document.querySelectorAll('meta[property="product:price:currency"]')]
      .some(tag => !isWon(tag.content));
    const offers = [property(product, 'offers')].flat();
    const hasForeignCurrency = hasForeignMetaCurrency ||
      offers.some(offer => !isWon(property(offer, 'priceCurrency')));
    const zigzag = zigzagPdp(nextData, hasForeignCurrency);
    // Missing Zigzag pages can retain a complete CLOSED record. Only use it on an actual detail page.
    if (zigzag?.closed) {
      const headings = document.querySelectorAll('h1');
      if (!zigzag.name.trim() || headings.length !== 1 ||
        !sameTitle(headings[0].textContent.trim(), zigzag.name.trim())) return false;
    }
    const values = (selector) => {
      try {
        if (selector.startsWith('ldjson:')) {
          const path = selector.slice(7);
          if (path === 'offers.price') {
            // Ably can publish a different KRW price for the same item with coupon_sno.
            const coupons = ablyId ? new URL(location.href).searchParams.getAll('coupon_sno') : null;
            // An unlabeled amount cannot resolve a page or offer set that also quotes another currency.
            return uniqueWon(offers.filter(offer => {
              if (coupons) {
                if (offer?.url != null && typeof offer.url !== 'string') return false;
                const ref = offer?.url?.trim();
                const scope = ref && !ref.startsWith('#') ? ref : (typeof product?.url === 'string' ? product.url.trim() : '');
                // A missing or fragment-only URL does not identify a coupon offer.
                const selected = scope && !scope.startsWith('#')
                  ? new URL(scope, location.href).searchParams.getAll('coupon_sno') : [];
                if (coupons.length > 1 || selected.length !== coupons.length || selected[0] !== coupons[0]) return false;
              }
              const currency = property(offer, 'priceCurrency');
              return isWon(currency) && (currency != null || !hasForeignCurrency);
            }).map(offer => property(offer, 'price')));
          }
          if (path === 'image[0]') {
            const image = property(product, 'image');
            const candidate = Array.isArray(image) ? image[0] : image;
            return [candidate, property(candidate, 'contentUrl'), property(candidate, 'url')];
          }
          return [pathValue(product, path)];
        }
        if (zigzagId && selector === 'json:__NEXT_DATA__.props.pageProps.product.final_price') {
          if (zigzag?.displayedPrice != null) return [zigzag.displayedPrice];
          const legacy = nextData?.props?.pageProps?.product;
          return !hasForeignCurrency && !zigzag?.blocksLegacyPrice && String(nextData?.query?.catalog_product_id) === zigzagId &&
            String(legacy?.id) === zigzagId ? [legacy.final_price] : [];
        }
        if (!usePageTags) return [];
        // A conflicting card cannot establish the identity of page-wide values.
        if (ablyCardConflict && !/og:(title|image)/.test(selector) &&
          !(verifiedTwitterFallback && retailerIds.length && selector.includes('product:price:amount'))) return [];
        const nextPrefix = 'json:__NEXT_DATA__.';
        if (selector.startsWith(nextPrefix)) {
          if (zigzagId && products.length && !product) return [];
          return [pathValue(nextData, selector.slice(nextPrefix.length))];
        }
        if (selector === 'title') {
          if (musinsaId) return [musinsaPageTitle(document.title)];
          if (!ablyId) return [document.title];
          if (!ablyStorefrontTitle) return [document.title.trim()];
          return ablyStorefrontTitle === '상품 상세' ? [] : [withoutAblyBrand(ablyStorefrontTitle)];
        }
        const [query, attribute] = selector.split('@');
        if (query.includes('product:price:amount')) {
          // There is no reliable pairing between duplicate amount and currency tags.
          if (hasForeignMetaCurrency) return [];
          return uniqueWon([...document.querySelectorAll(query)]
            .map(element => attribute ? element.getAttribute(attribute) : element.textContent));
        }
        const cardField = /og:(title|image)/.exec(query)?.[1];
        const candidates = ablyIdentityGroups.length && cardField
          ? ablyGroups.filter(group => group.matches)
            // The app card names the item; the web card can include the storefront name.
            .sort((a, b) => cardField === 'title' ? Number(b.app) - Number(a.app) : 0)
            .flatMap(group => group.tags.filter(tag => tag.matches(query)).map(tag => {
              const value = attribute ? tag.getAttribute(attribute) : tag.textContent;
              if (cardField !== 'title' || attribute !== 'content' || group.app || !ablyStorefrontTitle) return value;
              const sharedTitle = value?.trim().replace(/\s+-\s+에이블리$/, '');
              // document.title collapses whitespace, unlike the card attribute.
              return sharedTitle?.replace(/\s+/g, ' ') === ablyStorefrontTitle
                ? withoutAblyBrand(value.trim()) : value;
            })).slice(0, 16)
          : [...document.querySelectorAll(query)].slice(0, 16)
            .map(element => attribute ? element.getAttribute(attribute) : element.textContent);
        if (cardField && attribute === 'content') {
          for (const group of twitterGroups) {
            if (!group.matches) continue;
            for (const tag of group.tags) {
              if (tag.getAttribute('property') === 'twitter:' + cardField) candidates.push(tag.content);
            }
          }
        }
        if (cardField === 'title' && attribute === 'content') {
          if (ablyId) return candidates.map(value => value?.replace(/\s+-\s+에이블리\s*$/, ''));
          if (musinsaId) return candidates.map(value => value == null ? value : musinsaPageTitle(value));
        }
        return candidates;
      } catch { return []; }
    };
    const first = (rules, convert) => {
      for (const selector of rules) {
        for (const raw of values(selector)) {
          if (typeof raw !== 'string' && typeof raw !== 'number') continue;
          const parsed = convert(String(raw).trim());
          if (parsed !== null) return parsed;
        }
      }
      return null;
    };
    const title = (text) => text.trim() || null;
    const pdp = musinsaPdp(nextData) ?? zigzag;
    // The sharing card is in <head>, before the detail record with the actual item name.
    const musinsaStructuredName = musinsaId &&
      (String(product?.sku) === musinsaId || structuredProductId(product, musinsaHosts, musinsaPath) === musinsaId) &&
      typeof product.name === 'string' ? product.name : '';
    const detailName = title(pdp?.name ?? '') ?? title(musinsaStructuredName);
    let name = detailName ?? first(rule.fields.title, title) ?? '';
    let waitingForHeading = false;
    if (!detailName && name && zigzagId && ogURL && ogMatches && retailerIds.length) {
      // The verified card can prepend the shop name; the product heading may mount after load.
      const headings = document.querySelectorAll('h1');
      const heading = headings.length === 1 ? headings[0].textContent.trim() : '';
      waitingForHeading = !heading;
      if (heading && name.endsWith(' ' + heading)) name = heading;
    }
    if (waitingForHeading && document.readyState === 'loading') {
      // A streamed head can precede the verified title by several seconds.
      name = '';
    } else if (pageId && !detailName && name && (waitingForHeading || document.readyState === 'loading')) {
      sharingTitleSeenAt ??= Date.now();
      if (Date.now() - sharingTitleSeenAt < 600) name = '';
    }
    const ablyDetailVerified = ablyId && retailerIds.length > 0;
    const hasAblyTitle = (groups, matches) => groups.some(group => group.tags.some(tag => {
      if (tag.getAttribute('property') !== 'og:title') return false;
      const sharedTitle = ablySharingName(tag.content);
      return sharedTitle && matches(sharedTitle, group);
    }));
    let ablyDetailMatchesCard = false;
    // The detail can appear before retailer_item_id is added. Require the card URL and the
    // actual heading inside the detail price section, not a document title or recommendation.
    if (ablyId && !ablyDetailVerified && ablyGroups.length && ablyGroups.every(group => group.matches)) {
      const heading = ablyDetailTitle();
      if (heading && hasAblyTitle(ablyGroups, shared => sameTitle(shared, heading))) {
        ablyDetailMatchesCard = true;
        name = title(heading);
      }
    }
    if (ablyDetailVerified && name && ablyBrand && ablyStorefrontTitle) {
      const withoutBrand = withoutAblyBrand(ablyStorefrontTitle);
      const matchingCards = ablyGroups.filter(group => group.matches);
      const confirmed = hasAblyTitle(matchingCards, (sharedTitle, group) => group.app || sameTitle(sharedTitle, name));
      if (withoutBrand !== ablyStorefrontTitle && sameTitle(withoutBrand, name) &&
        matchingCards.length && !confirmed) {
        const heading = ablyDetailTitle();
        if (sameTitle(heading, ablyStorefrontTitle) || sameTitle(heading, withoutBrand)) name = title(heading);
        else if (document.readyState === 'loading') name = '';
        else {
          sharingTitleSeenAt ??= Date.now();
          if (Date.now() - sharingTitleSeenAt < 600) name = '';
        }
      }
    }
    const useAblyDetail = ablyDetailVerified || ablyDetailMatchesCard;
    // A page-wide amount can belong to the plain offer. The labeled, same-item coupon quote is more specific.
    const coupons = ablyDetailVerified && !ablyCardConflict && !hasForeignCurrency && name
      ? new URL(location.href).searchParams.getAll('coupon_sno') : [];
    const couponPrice = coupons.length === 1 && /^\d+$/.test(coupons[0]) ? ablyDisplayPrice(name) : null;
    // Zero also appears while the detail hydrates; it cannot overrule an existing quote.
    const price = (couponPrice > 0 ? couponPrice : null) ?? first(rule.fields.price, krw) ??
      (typeof pdp?.price === 'number' ? krw(String(pdp.price)) : null) ??
      (useAblyDetail && !hasForeignMetaCurrency ? ablyDisplayPrice() : null);
    // A gallery slide can match the product ID without being its representative photo.
    const ablyCovers = ablyId && document.querySelectorAll('[id="goods-detail-cover-item.0"] img');
    const firstSlide = ablyCovers?.length === 1 ? ablyCovers[0] : null;
    const slideURL = img => imageUrl(img?.currentSrc || img?.getAttribute('src'));
    const firstSlideURL = slideURL(firstSlide);
    const ablyCover = useAblyDetail ? firstSlideURL : null;
    const loadedAblyCover = firstSlide?.complete && firstSlide.naturalWidth > 0 ? ablyCover : null;
    const cover = zigzag?.imageURL ?? pdp?.cover;
    const imageURL = loadedAblyCover ?? first(rule.fields.image, raw => {
      const image = imageUrl(raw);
      // The rule can see a later slide before the first image finishes loading on Android.
      if (ablyId && image && image !== firstSlideURL &&
        [...document.querySelectorAll('[id^="goods-detail-cover-item."] img')].some(img =>
          /^goods-detail-cover-item\.[1-9]\d*$/.test(img.closest('[id^="goods-detail-cover-item."]').id) &&
          slideURL(img) === image)) return null;
      if (!cover || image === cover) return image;
      const asset = image?.split('?')[0];
      if (asset === cover) return image;
      const resized = musinsaId && cover.replace('https://image.msscdn.net/images/', 'https://image.msscdn.net/thumbnails/images/');
      return asset === resized ? image : null;
    }) ?? pdp?.imageURL ?? ablyCover;
    // A missing-product page can reuse the storefront's OG title and CDN image.
    const productType = usePageTags && document.querySelector('meta[property="og:type"]')?.content === 'product';
    if (!product && !pdp && !productType && !verifiedTwitterFallback && price === null) return false;
    // Keep the exact title or leave it for manual entry. A sliced prefix can look complete.
    if (name.length > ${maxExtractedTitleUnits}) name = '';
    const payload = JSON.stringify({ url: location.href, name, price, imageURL });
    if (payload !== last) {
      last = payload;
      sent = 0;
    }
    // The first message can arrive before native sees the final redirected URL.
    if (sent < 3) {
      window.ReactNativeWebView.postMessage(payload);
      sent++;
    }
    return sent >= 3 && Boolean(name && price !== null && (imageURL || rule.imageStrategy === 'CLIENT_UPLOAD'));
  };
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
