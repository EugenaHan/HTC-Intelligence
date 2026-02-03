const axios = require('axios');
const cheerio = require('cheerio');

// DeepSeek API（与 api/index.js 一致：OPENAI_API_KEY + API_BASE_URL）
const DEEPSEEK_BASE = (process.env.API_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const DEEPSEEK_KEY = process.env.OPENAI_API_KEY;
const INSIGHT_DELAY_MS = 500; // delay between AI insight calls to avoid rate limits
// fullText 为主要输入，确保 DeepSeek 基于完整文章脉络生成夏威夷战略洞察
const INSIGHT_PROMPT = `You are a Senior Strategic Consultant for the Hawaii Tourism Board (HTB). Analyze this news article. Full text (excerpt): {fullText}. Title: {title}. Summary: {summary}. Based on your expertise in cross-disciplinary market intelligence (History, Art, Tech), provide a professional insight (under 60 words in Chinese) specifically for the Hawaii market. Focus on competitive threats, opportunities for HTB, or strategic recommendations.`;

const FULL_TEXT_FETCH_MAX = 1500;   // 正文前 1500 字，用于关键词/分类及 AI 洞察
const INSIGHT_FULL_TEXT_CHARS = 1500; // fullText 作为主要输入传给 DeepSeek（完整脉络）
const DETAIL_DELAY_MIN_MS = 500;   // 详情页随机延时下限，防封禁
const DETAIL_DELAY_MAX_MS = 1500;  // 详情页随机延时上限

// Optional: decode non-UTF8 response (e.g. GBK for some Chinese sites)
let iconvLite;
try { iconvLite = require('iconv-lite'); } catch (_) { iconvLite = null; }

// News sources configuration (articleBody: 正文选择器，配合二级爬取逻辑)
const NEWS_SOURCES = [
  {
    name: 'Travel And Tour World',
    baseUrl: 'https://www.travelandtourworld.com',
    searchUrl: 'https://www.travelandtourworld.com/news/',
    selectors: {
      articles: 'article.post',
      title: 'h2.entry-title a',
      link: 'h2.entry-title a',
      summary: '.entry-content p',
      date: '.entry-date',
      articleBody: '.entry-content' // 核心正文区域
    }
  },
  {
    name: 'Dragon Trail',
    baseUrl: 'https://www.dragontrail.com',
    searchUrl: 'https://www.dragontrail.com/resources/blog',
    selectors: {
      articles: '.blog-post',
      title: 'h2 a',
      link: 'h2 a',
      summary: '.excerpt',
      date: '.date',
      articleBody: '.post-content'
    }
  },
  {
    name: 'China Daily',
    baseUrl: 'https://www.chinadaily.com.cn',
    searchUrl: 'https://www.chinadaily.com.cn/travel',
    selectors: {
      articles: '.main_art',
      title: 'h4 a',
      link: 'h4 a',
      summary: 'p',
      date: '.date',
      articleBody: '#Content' // China Daily 标准正文 ID
    }
  },
  {
    name: 'China Travel News (环球旅讯)',
    baseUrl: 'https://www.chinatravelnews.com',
    searchUrl: 'https://www.chinatravelnews.com/list/2',
    selectors: {
      articles: '.item',
      title: 'h3 a',
      link: 'h3 a',
      summary: '.desc',
      date: '.time',
      articleBody: '.article-content'
    }
  },
  {
    name: 'Global Times',
    baseUrl: 'https://www.globaltimes.cn',
    searchUrl: 'https://www.globaltimes.cn/business/tourism',
    selectors: {
      articles: '.article_item',
      title: '.article_title a',
      link: '.article_title a',
      summary: '.article_desc',
      date: '.article_time',
      articleBody: '.article_content'
    }
  },
  {
    name: 'Skift',
    baseUrl: 'https://skift.com',
    searchUrl: 'https://skift.com/news/',
    selectors: {
      articles: 'article',
      title: '.entry-title a',
      link: '.entry-title a',
      summary: '.entry-content',
      date: 'time',
      articleBody: '.entry-content'
    }
  },
  {
    name: '旅业传媒 (Travel Daily CN)',
    baseUrl: 'https://www.traveldaily.cn',
    searchUrl: 'https://www.traveldaily.cn/article',
    selectors: {
      articles: '.article-item',
      title: '.title a',
      link: '.title a',
      summary: '.desc',
      date: '.date',
      articleBody: '.article-content'
    }
  },
  {
    name: '执惠',
    baseUrl: 'https://www.tripvivid.com',
    searchUrl: 'https://www.tripvivid.com/news',
    selectors: {
      articles: '.news-item',
      title: 'h3 a',
      link: 'h3 a',
      summary: 'p',
      date: '.time',
      articleBody: '.content-detail'
    }
  },
  {
    name: '闻旅',
    baseUrl: 'https://www.wenlvnews.com',
    searchUrl: 'https://www.wenlvnews.com/list',
    selectors: {
      articles: '.list-item',
      title: 'a',
      link: 'a',
      summary: '.summary',
      date: '.date',
      articleBody: '.article-body'
    }
  }
];

// Keywords for searching (English + 中文，支持中文媒体)
const KEYWORDS = [
  'China outbound travel',
  'Chinese tourists',
  'China tourism',
  'Chinese travelers',
  'China market',
  'Chinese visitors',
  'China travel trend',
  'Chinese tourist spending',
  'US visa',
  'China-US direct flights',
  'US tourism',
  'Hawaii tourism',
  'visa-free',
  'visa on arrival',
  'direct flight',
  'route resumption',
  'capacity increase',
  'roadshow',
  'fam trip',
  'celebrity endorsement',
  'high-net-worth',
  'customized travel',
  'niche market',
  '中美直航',
  '美国签证',
  '中国出境游趋势',
  '出境游趋势',
  '免签政策',
  '落地签',
  '路演',
  '高净值',
  '直飞',
  '复航',
  '增班',
  '考察团',
  '明星代言',
  '定制游',
  '利基市场'
];

// Helper: case-insensitive includes
function containsAny(text, phrases) {
  const lower = text.toLowerCase();
  return phrases.some(p => lower.includes(p.toLowerCase()));
}

// 目的地细分：Short Haul（日韩东南亚） / Long Haul（澳新、欧美、中东）
const SHORT_HAUL_TERMS = [
  'japan', 'korea', 'seoul', 'tokyo', 'osaka', 'thailand', 'malaysia', 'singapore',
  'vietnam', 'indonesia', 'bali', 'philippines', 'cambodia', 'myanmar', 'laos',
  '日本', '韩国', '东南亚', '泰国', '马来西亚', '新加坡', '越南', '印尼', '巴厘岛', '菲律宾'
];
const LONG_HAUL_TERMS = [
  'australia', 'new zealand', 'europe', 'france', 'germany', 'uk', 'italy', 'spain',
  'dubai', 'uae', 'qatar', 'turkey', 'usa', 'america', 'canada', 'hawaii',
  '澳新', '澳洲', '新西兰', '欧美', '中东', '迪拜', '美国', '加拿大', '夏威夷'
];

// Categories mapping
function categorizeNews(title, summary) {
  const text = title + ' ' + summary;
  const lower = text.toLowerCase();
  const categories = [];

  // 目的地严格划分：Short Haul（日韩东南亚）优先，否则 Long Haul（澳新、欧美、中东）
  const isShortHaul = SHORT_HAUL_TERMS.some(t => lower.includes(t));
  const isLongHaul = LONG_HAUL_TERMS.some(t => lower.includes(t));
  if (isShortHaul && !isLongHaul) categories.push('Short Haul');
  else if (isLongHaul) categories.push('Long Haul');

  // 中美专题
  if (containsAny(text, ['Visa', 'Direct flight', 'China-US', 'Civil Aviation Administration'])) {
    categories.push('中美专题');
  }

  // 夏威夷竞对分析
  if (containsAny(text, ['Maldives', 'Fiji', 'Tahiti', 'Bali'])) {
    categories.push('Competitive Insight');
  }

  // 签证政策（免签、落地签）
  if (containsAny(text, ['visa-free', 'visa on arrival', '免签', '落地签', '免签政策']) || lower.includes('visa policy')) {
    categories.push('Visa Policy');
  }

  // 航线动态（直飞、复航、增班）
  if (containsAny(text, ['direct flight', 'nonstop', 'resumption', 'capacity increase', '直飞', '复航', '增班', '新航线'])) {
    categories.push('Flight Routes');
  }
  if (lower.includes('flight') || lower.includes('airline') || lower.includes('route')) {
    if (!categories.includes('Flight Routes')) categories.push('Flight Routes');
  }

  // 营销活动（路演、考察团、明星代言人）
  if (containsAny(text, ['roadshow', 'fam trip', 'celebrity endorsement', '路演', '考察团', '明星代言', '推介会'])) {
    categories.push('Marketing');
  }

  // 消费趋势（高净值、定制游、利基市场 + 原有）
  if (containsAny(text, ['Spending', 'Luxury', 'Gen Z', 'Silver-haired', 'high-net-worth', 'customized travel', 'niche market', '高净值', '定制游', '利基市场'])) {
    categories.push('Consumer Trend');
  }

  // Market data / Market trend
  if (lower.includes('growth') || lower.includes('increase') || lower.includes('visitor') ||
      lower.includes('arrival') || lower.includes('tourist number') || lower.includes('booking')) {
    categories.push('Market Data');
  }
  if (lower.includes('trend') || lower.includes('outlook') || lower.includes('forecast') ||
      lower.includes('survey') || lower.includes('report')) {
    categories.push('Market Trend');
  }

  return categories.length > 0 ? categories : ['Market Trend'];
}

// Sentiment analysis
function analyzeSentiment(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  
  const positiveKeywords = ['growth', 'increase', 'surge', 'rise', 'boom', 'recover', 'expand', 'boost'];
  const negativeKeywords = ['decline', 'drop', 'fall', 'decrease', 'plunge', 'slump', 'crash'];
  
  let positiveCount = positiveKeywords.filter(kw => text.includes(kw)).length;
  let negativeCount = negativeKeywords.filter(kw => text.includes(kw)).length;
  
  if (positiveCount > negativeCount) return '利好';
  if (negativeCount > positiveCount) return '威胁';
  return '中立';
}

// Fallback insight（API 失败时）：基于分类的简短中文摘要
function fallbackInsightFromCategories(categories, sentiment, title, summary) {
  const raw = title + ' ' + summary;
  const text = raw.toLowerCase();
  const isChinaUSAviation = text.includes('中美直航') || raw.includes('签证便利化');

  if (isChinaUSAviation) {
    return "聚焦夏威夷接待能力复苏与竞对分流压力：中美直航/签证便利化若推进，需评估本地运力与酒店恢复节奏，同时关注东南亚及长线目的地对客源的分流，提前布局产品与营销应对。";
  }
  if (categories.includes('中美专题')) {
    return "中美关系与政策议题与夏威夷入境市场相关。建议结合签证与直航进展，评估夏威夷接待能力复苏节奏及竞对分流压力。";
  }
  if (categories.includes('Competitive Insight')) {
    return "竞对目的地（如马尔代夫、斐济、大溪地、巴厘岛）动态值得关注。需对比夏威夷差异化优势与接待能力，应对分流压力。";
  }
  if (categories.includes('Visa Policy')) {
    return "竞对免签/落地签政策持续扩大，夏威夷面临美签门槛的竞争压力。HTA 应加强签证便利化倡导，并突出「一次美签、多目的地」与品质长线体验，对冲短途免签目的地分流。";
  }
  if (categories.includes('Flight Routes')) {
    return "各目的地直飞、复航、增班加速，夏威夷需优先推动中美直航恢复与增班。同时对比竞对航线密度与时刻，评估运力缺口与营销投放节奏。";
  }
  if (categories.includes('Marketing')) {
    return "同业路演、考察团与明星代言增多，夏威夷可参考其触达方式，加强 B2B 路演与 KOL/明星合作，在签证与航线约束下提升心智份额。";
  }
  if (categories.includes('Consumer Trend')) {
    return "高净值、定制游与利基市场增长影响客源结构。夏威夷可强化高端与定制产品线，与短途大众市场形成差异化，缓解竞对分流压力。";
  }
  if (categories.includes('Short Haul')) {
    return "日韩东南亚免签与短航程形成强分流。夏威夷需强调长线独特性与品质体验，并对比签证与航线便利度，明确差异化卖点。";
  }
  if (categories.includes('Long Haul')) {
    return "澳新、欧美、中东长线目的地加强航线与营销。HTA 需与航司合作恢复中国—夏威夷直航，并对比竞对运力与接待能力，突出复苏节奏与差异化。";
  }
  return "持续监测市场动态，结合签证、航线、目的地与消费趋势，调整夏威夷产品与营销策略。";
}

// Async AI insight：fullText（正文前 1500 字）为主要输入，供 DeepSeek 基于完整脉络生成夏威夷战略洞察。返回 { insight, viaDeepSeek }。
async function generateInsightAsync(title, summary, categories, sentiment, fullTextExcerpt) {
  if (!DEEPSEEK_KEY) {
    return { insight: fallbackInsightFromCategories(categories, sentiment, title, summary), viaDeepSeek: false };
  }
  const fullText = (fullTextExcerpt && typeof fullTextExcerpt === 'string') ? fullTextExcerpt.trim().substring(0, INSIGHT_FULL_TEXT_CHARS) : '';
  const prompt = INSIGHT_PROMPT
    .replace('{fullText}', fullText || '(none)')
    .replace('{title}', title)
    .replace('{summary}', summary || '');
  try {
    const url = `${DEEPSEEK_BASE}/v1/chat/completions`;
    const res = await axios.post(
      url,
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        temperature: 0.4
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    const content = res.data?.choices?.[0]?.message?.content;
    if (content && typeof content === 'string') {
      const trimmed = content.trim();
      const insight = trimmed.length > 60 ? trimmed.slice(0, 57) + '...' : trimmed;
      return { insight, viaDeepSeek: true };
    }
  } catch (err) {
    console.warn('DeepSeek insight API failed, using category fallback:', err.message || err);
  }
  return { insight: fallbackInsightFromCategories(categories, sentiment, title, summary), viaDeepSeek: false };
}

// Fetch full article body from detail page; handle encoding for Chinese sources. Returns first FULL_TEXT_FETCH_MAX chars.
async function fetchFullText(link, bodySelector, encoding) {
  try {
    const opts = {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000,
      maxRedirects: 3
    };
    if (encoding && encoding.toLowerCase() !== 'utf-8' && iconvLite) {
      opts.responseType = 'arraybuffer'; // raw bytes for iconv-lite decode
    }
    const res = await axios.get(link, opts);
    let html = res.data;
    if (encoding && encoding.toLowerCase() !== 'utf-8' && iconvLite) {
      const buf = Buffer.isBuffer(res.data) ? res.data : Buffer.from(res.data);
      html = iconvLite.decode(buf, encoding);
    } else if (typeof html !== 'string') {
      html = String(html);
    }
    const $ = cheerio.load(html);
    const selectors = (bodySelector || '.content, .article-content, .entry-content').split(',').map(s => s.trim());
    let text = '';
    for (const sel of selectors) {
      text = $(sel).text().trim();
      if (text.length > 0) break;
    }
    return (text || '').replace(/\s+/g, ' ').substring(0, FULL_TEXT_FETCH_MAX);
  } catch (e) {
    return '';
  }
}

// 二级深度抓取：列表候选 → 访问详情页取正文 1500 字 → 关键词通过后再参与洞察与存库
async function crawlSource(source) {
  try {
    console.log(`Crawling ${source.name}...`);
    const response = await axios.get(source.searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    const listCandidates = [];

    $(source.selectors.articles).each((i, elem) => {
      const titleElem = $(elem).find(source.selectors.title);
      const title = titleElem.text().trim();
      const link = titleElem.attr('href');
      const summary = $(elem).find(source.selectors.summary).text().trim();
      const dateText = $(elem).find(source.selectors.date).text().trim();
      if (title && link) {
        const fullLink = link.startsWith('http') ? link : source.baseUrl + link;
        listCandidates.push({
          title,
          link: fullLink,
          summary: summary.substring(0, 300) + (summary.length > 300 ? '...' : ''),
          dateText
        });
      }
    });

    const bodySelector = source.selectors.articleBody || '.content, .entry-content';
    const encoding = source.encoding || null;
    const candidates = [];

    for (let i = 0; i < listCandidates.length; i++) {
      // 详情页随机延时 500ms–1500ms，防止被目标站封禁
      if (i > 0) {
        const delay = DETAIL_DELAY_MIN_MS + Math.floor(Math.random() * (DETAIL_DELAY_MAX_MS - DETAIL_DELAY_MIN_MS + 1));
        await new Promise(r => setTimeout(r, delay));
      }
      const item = listCandidates[i];
      // 使用 axios 访问详情页，按 articleBody 抓取正文前 1500 字
      const fullText = await fetchFullText(item.link, bodySelector, encoding);
      const combinedText = (item.title + ' ' + item.summary + ' ' + fullText).toLowerCase();
      const isRelevant = KEYWORDS.some(kw => combinedText.includes(kw.toLowerCase()));
      if (!isRelevant) continue;

      // 符合关键词后再参与分类与洞察，不直接存库
      const categories = categorizeNews(item.title, item.summary + ' ' + fullText);
      const sentiment = analyzeSentiment(item.title, item.summary + ' ' + fullText);
      let date = new Date().toISOString().split('T')[0];
      if (item.dateText) {
        const parsedDate = new Date(item.dateText);
        if (!isNaN(parsedDate)) date = parsedDate.toISOString().split('T')[0];
      }
      candidates.push({
        title: item.title,
        link: item.link,
        summary: item.summary,
        source: source.name,
        date,
        categories,
        sentiment,
        month: date.substring(0, 7).replace('-', '年') + '月',
        fullTextForInsight: fullText.substring(0, INSIGHT_FULL_TEXT_CHARS) // fullText 作为主要输入传给 AI
      });
    }

    const articles = [];
    for (let i = 0; i < candidates.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, INSIGHT_DELAY_MS));
      const c = candidates[i];
      const { insight, viaDeepSeek } = await generateInsightAsync(
        c.title,
        c.summary,
        c.categories,
        c.sentiment,
        c.fullTextForInsight
      );
      if (viaDeepSeek) {
        console.log(`Insight generated for [${c.title}] via DeepSeek`);
      }
      articles.push({
        title: c.title,
        url: c.link,
        summary: c.summary,
        source: c.source,
        date: c.date,
        categories: c.categories,
        sentiment: c.sentiment,
        insight,
        month: c.month
      });
    }

    console.log(`Found ${articles.length} articles from ${source.name}`);
    return articles;
    
  } catch (error) {
    console.error(`Error crawling ${source.name}:`, error.message);
    return [];
  }
}

// Main crawler function
async function crawlAllNews() {
  console.log('Starting news crawler...');
  console.log('Timestamp:', new Date().toISOString());
  
  const allNews = [];
  
  for (const source of NEWS_SOURCES) {
    const news = await crawlSource(source);
    allNews.push(...news);
    
    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Remove duplicates based on title
  const uniqueNews = [];
  const seenTitles = new Set();
  
  for (const news of allNews) {
    if (!seenTitles.has(news.title)) {
      seenTitles.add(news.title);
      uniqueNews.push(news);
    }
  }
  
  console.log(`\nTotal unique articles: ${uniqueNews.length}`);
  
  // Save to database via API
  if (uniqueNews.length > 0) {
    const API_URL = process.env.API_URL || 'http://localhost:3000/api';
    
    for (const news of uniqueNews) {
      try {
        await axios.post(`${API_URL}/news`, news, {
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(`Saved: ${news.title.substring(0, 50)}...`);
      } catch (error) {
        console.error(`Error saving news:`, error.message);
      }
    }
  }
  
  console.log('Crawler finished!');
  return uniqueNews;
}

// Run if called directly
if (require.main === module) {
  crawlAllNews().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Crawler failed:', error);
    process.exit(1);
  });
}

module.exports = { crawlAllNews };
