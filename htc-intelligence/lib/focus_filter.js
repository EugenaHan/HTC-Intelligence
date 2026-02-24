const FOCUS_PRIMARY_CATEGORIES = [
  'Outbound Trend',
  'Short Haul',
  'Long Haul',
  'China-US Flights',
  'China-US Relations',
  'US Visa'
];

const CHINA_SIGNALS = [
  'china',
  'chinese',
  '中国',
  '中国游客',
  '中国公民',
  '内地游客',
  '大陆游客',
  '赴华',
  '出境游'
];

const US_SIGNALS = [
  'united states',
  'u.s.',
  'u.s',
  'usa',
  'america',
  'american',
  '美国',
  '中美',
  'us-china',
  'china-us',
  '美签',
  '赴美'
];

const TRAVEL_CONTEXT_SIGNALS = [
  'travel',
  'tourism',
  'tourist',
  'destination',
  'visitor',
  'holiday',
  'trip',
  'outbound',
  '航班',
  '航线',
  '直飞',
  '复航',
  '增班',
  '旅行',
  '旅游',
  '游客',
  '目的地',
  '签证',
  '入境',
  '出境'
];

const OUTBOUND_SIGNALS = [
  'outbound',
  'booking',
  'demand',
  'departure',
  'travel demand',
  'travel recovery',
  'forecast',
  'report',
  'survey',
  'visitor arrivals',
  '出境游',
  '出境旅游',
  '出入境',
  '旅游订单',
  '游客量',
  '客流',
  '复苏',
  '恢复'
];

const FLIGHT_SIGNALS = [
  'flight',
  'airline',
  'aviation',
  'route',
  'nonstop',
  'direct flight',
  'capacity',
  '航班',
  '航空',
  '航司',
  '航线',
  '直飞',
  '复航',
  '增班'
];

const US_VISA_SIGNALS = [
  'visa',
  'b1/b2',
  'interview waiver',
  'entry policy',
  'consular',
  'embassy',
  '签证',
  '美签',
  '美国签证',
  '赴美签证',
  '面签',
  '拒签',
  '免签',
  '入境政策'
];

const CHINA_US_RELATION_SIGNALS = [
  'china-us',
  'u.s.-china',
  'bilateral',
  'relationship',
  'relations',
  'diplomatic',
  'consulate',
  'consular',
  'embassy',
  'dialogue',
  'meeting',
  'agreement',
  'geopolitical',
  '中美',
  '中美关系',
  '双边',
  '外交',
  '领事',
  '使馆',
  '会晤',
  '会谈',
  '磋商'
];

const SHORT_HAUL_DESTINATIONS = [
  'thailand',
  'vietnam',
  'singapore',
  'malaysia',
  'japan',
  'korea',
  'south korea',
  'hong kong',
  'macau',
  'taiwan',
  'bali',
  'indonesia',
  'philippines',
  '泰国',
  '越南',
  '新加坡',
  '马来西亚',
  '日本',
  '韩国',
  '香港',
  '澳门',
  '台湾',
  '巴厘岛',
  '印尼',
  '菲律宾'
];

const LONG_HAUL_DESTINATIONS = [
  'hawaii',
  'united states',
  'u.s.',
  'usa',
  'america',
  'canada',
  'europe',
  'uk',
  'france',
  'germany',
  'italy',
  'spain',
  'australia',
  'new zealand',
  'middle east',
  'uae',
  'dubai',
  'qatar',
  'turkey',
  'turkiye',
  'fiji',
  'maldives',
  'tahiti',
  '夏威夷',
  '美国',
  '加拿大',
  '欧洲',
  '英国',
  '法国',
  '德国',
  '意大利',
  '西班牙',
  '澳大利亚',
  '新西兰',
  '中东',
  '阿联酋',
  '迪拜',
  '卡塔尔',
  '土耳其',
  '斐济',
  '马尔代夫',
  '大溪地'
];

function normalizeText(value = '') {
  return String(value).toLowerCase();
}

function containsAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

function hasChinaSignal(text) {
  return containsAny(text, CHINA_SIGNALS) || /\bchina\b|\bchinese\b/i.test(text);
}

function hasUSSignal(text) {
  return containsAny(text, US_SIGNALS) || /\bu\.?s\.?a?\b/i.test(text) || text.includes('中美');
}

function toLowerCategories(categories) {
  if (!Array.isArray(categories)) return [];
  return categories.map(item => normalizeText(item));
}

function collectFocusTagsFromText(text) {
  const tags = new Set();

  const hasChina = hasChinaSignal(text);
  const hasUS = hasUSSignal(text);
  const hasTravelContext = containsAny(text, TRAVEL_CONTEXT_SIGNALS);
  const hasOutbound = containsAny(text, OUTBOUND_SIGNALS);
  const hasShortHaulDestination = containsAny(text, SHORT_HAUL_DESTINATIONS);
  const hasLongHaulDestination = containsAny(text, LONG_HAUL_DESTINATIONS);
  const hasFlightSignal = containsAny(text, FLIGHT_SIGNALS);
  const hasUSVisaSignal = containsAny(text, US_VISA_SIGNALS);
  const hasChinaUSRelationSignal = containsAny(text, CHINA_US_RELATION_SIGNALS);

  if (hasChina && hasTravelContext && hasOutbound) {
    tags.add('Outbound Trend');
  }

  if (hasChina && hasTravelContext && hasShortHaulDestination) {
    tags.add('Short Haul');
  }

  if (hasChina && hasTravelContext && hasLongHaulDestination) {
    tags.add('Long Haul');
  }

  if (hasChina && hasUS && hasFlightSignal) {
    tags.add('China-US Flights');
  }

  if (hasChina && hasUS && hasUSVisaSignal) {
    tags.add('US Visa');
  }

  if (hasChina && hasUS && hasChinaUSRelationSignal && (hasTravelContext || hasFlightSignal || hasUSVisaSignal)) {
    tags.add('China-US Relations');
  }

  return Array.from(tags);
}

function deriveFocusCategories(newsItem = {}) {
  const text = normalizeText(`${newsItem.title || ''} ${newsItem.summary || ''}`);
  const categories = new Set(collectFocusTagsFromText(text));
  const legacyCategories = toLowerCategories(newsItem.categories);

  if (
    legacyCategories.includes('outbound trend') ||
    legacyCategories.includes('中国出境游趋势') ||
    legacyCategories.includes('出境游趋势')
  ) {
    categories.add('Outbound Trend');
  }

  if (legacyCategories.includes('short haul')) {
    categories.add('Short Haul');
  }

  if (legacyCategories.includes('long haul')) {
    categories.add('Long Haul');
  }

  if (
    (legacyCategories.includes('flight routes') || legacyCategories.includes('aviation')) &&
    categories.has('Long Haul') &&
    hasChinaSignal(text) &&
    hasUSSignal(text)
  ) {
    categories.add('China-US Flights');
  }

  if (
    (legacyCategories.includes('visa policy') || legacyCategories.includes('policy')) &&
    hasChinaSignal(text) &&
    hasUSSignal(text)
  ) {
    categories.add('US Visa');
  }

  return Array.from(categories);
}

function mergeFocusCategories(newsItem = {}) {
  const categories = new Set(Array.isArray(newsItem.categories) ? newsItem.categories : []);
  deriveFocusCategories(newsItem).forEach(category => categories.add(category));
  return Array.from(categories);
}

function isFocusNews(newsItem = {}) {
  const focusCategories = deriveFocusCategories(newsItem);
  return focusCategories.some(category => FOCUS_PRIMARY_CATEGORIES.includes(category));
}

module.exports = {
  FOCUS_PRIMARY_CATEGORIES,
  deriveFocusCategories,
  mergeFocusCategories,
  isFocusNews
};
