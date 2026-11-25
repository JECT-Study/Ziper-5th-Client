// Ably: product ID, sharing-card groups and the rendered detail price/title.
// Part of the injected scanner: plain JS sharing the scope set up in ./index.ts.
export const ablySource = String.raw`
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
`;
