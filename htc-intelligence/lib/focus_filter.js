const FOCUS_PRIMARY_CATEGORIES = [
  'Outbound Trend',
  'Consumption Trend',
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
  'outbound travel',
  'booking',
  'bookings',
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
  '客运量',
  '客座率',
  '客流',
  '同比',
  'year-on-year',
  'yoy',
  '复苏',
  '恢复'
];

const COMPETITOR_ACTION_SIGNALS = [
  'roadshow',
  'marketing campaign',
  'campaign',
  'promotion',
  'partnership',
  'memorandum of understanding',
  'mou',
  'cooperation',
  'cooperation letter',
  'content marketing',
  'creator',
  'influencer',
  'douyin',
  'wechat pay',
  'payment experience',
  'route launch',
  'inaugural flight',
  'frequency increase',
  'capacity increase',
  'new route',
  'resumption',
  'ads visa',
  'ads channel',
  '路演',
  '营销',
  '推广',
  '合作',
  '合作备忘录',
  '首航',
  '开通',
  '增班',
  '复航',
  '抖音',
  '微信支付'
];

const CONSUMER_TREND_SIGNALS = [
  'gen z',
  'millennial',
  'young travelers',
  'traveler behavior',
  'travel sentiment',
  'per capita spending',
  'spending',
  'premium',
  'luxury',
  'duty free',
  'self-indulgent',
  'emotional value',
  '消费升级',
  '人均消费',
  '旅游消费',
  '消费活力',
  '年轻人',
  'z世代',
  '90后',
  '00后'
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
  'changi',
  'malaysia',
  'tawau',
  'semporna',
  'sabah',
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
  'western canada',
  'europe',
  'uk',
  'britain',
  'british',
  'france',
  'germany',
  'italy',
  'spain',
  'finland',
  'helsinki',
  'nordic',
  'australia',
  'sydney',
  'brisbane',
  'melbourne',
  'adelaide',
  'new zealand',
  'middle east',
  'uae',
  'abu dhabi',
  'abudhabi',
  'dubai',
  'qatar',
  'turkey',
  'turkiye',
  'egypt',
  'cairo',
  'argentina',
  'saudi arabia',
  'riyadh',
  'fiji',
  'maldives',
  'tahiti',
  '夏威夷',
  '美国',
  '加拿大',
  '欧洲',
  '英国',
  '芬兰',
  '北欧',
  '法国',
  '德国',
  '意大利',
  '西班牙',
  '澳大利亚',
  '悉尼',
  '布里斯班',
  '墨尔本',
  '阿德莱德',
  '新西兰',
  '中东',
  '阿联酋',
  '阿布扎比',
  '迪拜',
  '卡塔尔',
  '土耳其',
  '埃及',
  '阿根廷',
  '沙特',
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
  const hasCompetitionAction = containsAny(text, COMPETITOR_ACTION_SIGNALS);
  const hasConsumerTrend = containsAny(text, CONSUMER_TREND_SIGNALS);
  const hasShortHaulDestination = containsAny(text, SHORT_HAUL_DESTINATIONS);
  const hasLongHaulDestination = containsAny(text, LONG_HAUL_DESTINATIONS);
  const hasFlightSignal = containsAny(text, FLIGHT_SIGNALS);
  const hasUSVisaSignal = containsAny(text, US_VISA_SIGNALS);
  const hasChinaUSRelationSignal = containsAny(text, CHINA_US_RELATION_SIGNALS);
  const hasMobilityContext = hasTravelContext || hasCompetitionAction || hasFlightSignal || hasUSVisaSignal;

  if (hasChina && hasTravelContext && (hasOutbound || hasConsumerTrend || hasCompetitionAction)) {
    tags.add('Outbound Trend');
  }

  if (hasChina && hasConsumerTrend && (hasTravelContext || hasOutbound)) {
    tags.add('Consumption Trend');
  }

  if (hasChina && hasMobilityContext && hasShortHaulDestination) {
    tags.add('Short Haul');
  }

  if (hasChina && hasMobilityContext && hasLongHaulDestination) {
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

  if (
    legacyCategories.includes('consumption trend') ||
    legacyCategories.includes('中国消费趋势') ||
    legacyCategories.includes('消费趋势')
  ) {
    categories.add('Consumption Trend');
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
