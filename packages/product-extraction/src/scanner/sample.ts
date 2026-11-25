import { maxExtractedTitleUnits } from '../schema';

// Reads one snapshot from the current document and posts it to native.
// Part of the injected scanner: plain JS sharing the scope set up in ./index.ts.
export const sampleSource = String.raw`
  let last = '';
  let sent = 0;
  let sharingTitleSeenAt;
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
    if ((waitingForHeading || musinsaId) && !detailName && document.readyState === 'loading') {
      // A streamed head can precede the verified title by several seconds. Musinsa's card
      // title carries the brand, and its Detail record arrives only with the body.
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
`;
