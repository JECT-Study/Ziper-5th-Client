// Musinsa: product ID from the path and the Next.js Detail record fallback.
// Part of the injected scanner: plain JS sharing the scope set up in ./index.ts.
export const musinsaSource = String.raw`
  const musinsaHosts = hosts.musinsa;
  // Musinsa keeps the submitted path spelling but uses the decimal goods number in Detail and CDN paths.
  const musinsaPath = /^\/(?:products|app\/goods)\/0*([1-9]\d*|0)\/?$/;
  const musinsaId = musinsaHosts.includes(host) && musinsaPath.exec(location.pathname)?.[1];
  const musinsaPageTitle = (value) => value.replace(/\s+-\s+(?:사이즈\s*&\s*)?후기\s*\|\s*무신사\s*$/, '');

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
`;
