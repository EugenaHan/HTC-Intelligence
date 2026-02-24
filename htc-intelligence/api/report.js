const axios = require('axios');

const SHORT_HAUL_KEYWORDS = [
  'short haul', 'southeast asia', 'singapore', 'malaysia', 'thailand', 'japan', 'korea', 'vietnam',
  'indonesia', 'philippines', 'hong kong', 'taiwan', 'macao', '东南亚', '日韩', '新加坡', '马来西亚', '日本', '韩国'
];

const LONG_HAUL_KEYWORDS = [
  'long haul', 'canada', 'uk', 'britain', 'europe', 'australia', 'new zealand', 'fiji', 'egypt',
  'uae', 'abu dhabi', 'dubai', 'nordic', 'finland', '澳大利亚', '新西兰', '加拿大', '英国', '欧洲', '中东'
];

const US_FLIGHT_KEYWORDS = [
  'china-us', 'china us', 'sino-us', '中美', 'u.s.', 'usa', 'united states', 'flight', 'route', 'capacity',
  '航班', '航线', '运力'
];

const US_RELATION_KEYWORDS = [
  'relations', 'diplomatic', 'geopolitical', 'bilateral', '中美关系', '双边', '外交', '政策'
];

const US_VISA_KEYWORDS = [
  'u.s. visa', 'us visa', 'american visa', '签证', 'visa', 'b1', 'b2', '面签', '拒签'
];

const CONSUMER_TREND_KEYWORDS = [
  'demand', 'spending', 'booking', 'ota', 'young', 'gen z', 'premium', 'holiday', 'spring festival',
  '消费', '预订', '年轻', '趋势', '客流'
];

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncate(value, maxLen) {
  return normalizeText(value).slice(0, maxLen);
}

function itemText(item) {
  return [
    ...(Array.isArray(item.categories) ? item.categories : []),
    item.title,
    item.summary,
    item.insightEn
  ].join(' ').toLowerCase();
}

function containsAnyKeyword(text, keywords) {
  return keywords.some((k) => text.includes(k));
}

function pickByKeywords(items, keywords) {
  return items
    .map((item, idx) => ({ item, idx, text: itemText(item) }))
    .filter((x) => containsAnyKeyword(x.text, keywords));
}

function renderBullets(list, limit) {
  if (list.length === 0) return '- No material updates in selected news.';
  return list.slice(0, limit).map(({ item, idx }) => {
    const summary = item.summary ? ` ${item.summary}` : '';
    return `- ${item.title}.${summary} [N${idx + 1}]`;
  }).join('\n');
}

function buildFallbackReport(items) {
  const shortHaul = pickByKeywords(items, SHORT_HAUL_KEYWORDS);
  const longHaul = pickByKeywords(items, LONG_HAUL_KEYWORDS);
  const consumer = pickByKeywords(items, CONSUMER_TREND_KEYWORDS);
  const usFlights = pickByKeywords(items, US_FLIGHT_KEYWORDS).filter((x) => x.text.includes('us') || x.text.includes('u.s.') || x.text.includes('中美'));
  const usRelations = pickByKeywords(items, US_RELATION_KEYWORDS);
  const usVisa = pickByKeywords(items, US_VISA_KEYWORDS).filter((x) => x.text.includes('us') || x.text.includes('u.s.') || x.text.includes('美国') || x.text.includes('american'));

  const topEvidence = items.slice(0, 3).map((_, idx) => `[N${idx + 1}]`).join(', ') || '[N1]';

  return `# Competitive Environment
## Short Haul
${renderBullets(shortHaul, 4)}
- Strategic implication for Hawaii: Short-haul rivals are improving air access and conversion channels for Chinese outbound travelers, which can divert demand from Hawaii in shoulder periods ${topEvidence}.

## Long Haul
${renderBullets(longHaul, 4)}
- Strategic implication for Hawaii: Long-haul competitors are restoring routes and destination marketing pipelines, raising competitive pressure on Hawaii’s share-of-voice and package conversion ${topEvidence}.

# Consumer Trends
${renderBullets(consumer, 4)}
- Implication for Hawaii: Position products around high-intent Chinese segments (premium + experiential) and emphasize conversion-oriented content with clear itinerary value ${topEvidence}.

# US Access Monitor
${renderBullets(usFlights, 3)}
${renderBullets(usRelations, 2)}
${renderBullets(usVisa, 2)}

# Recommended Actions (Next 30-90 Days)
- Objective: Protect Hawaii consideration in outbound planning windows. Why now: Competing destinations are expanding access and distribution. Supporting evidence ${topEvidence}.
- Objective: Build China-facing content tied to concrete booking triggers (routes, holiday windows, premium experiences). Why now: Consumer intent is increasingly experience-led and conversion-sensitive. Supporting evidence ${topEvidence}.
- Objective: Track US-access barriers weekly (flight restoration, visa friction, bilateral sentiment) and align messaging rapidly. Why now: Access volatility directly impacts Hawaii demand capture. Supporting evidence ${topEvidence}.`;
}

function extractProviderError(error) {
  const message =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown error';
  const code = error?.code || error?.response?.status || 'UNKNOWN';
  return { code, message: String(message) };
}

function isRetryableProviderError(error) {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  const status = Number(error?.response?.status || 0);
  if (status >= 500 && status < 600) return true;
  if (['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ERR_CANCELED'].includes(code)) return true;
  return /timeout|aborted|socket hang up|network/i.test(msg);
}

async function callProvider({ baseUrl, apiKey, prompt, maxTokens, timeoutMs }) {
  const response = await axios.post(`${baseUrl}/v1/chat/completions`, {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'You are a senior travel strategist. Output in Markdown format.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: maxTokens,
    temperature: 0.3
  }, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: timeoutMs
  });

  return response?.data?.choices?.[0]?.message?.content;
}

module.exports = async function handler(req, res) {
  try {
    // 1. 安全检查
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return res.status(400).json({ success: false, error: 'No items selected' });

    const maxItems = Math.min(Number(process.env.REPORT_MAX_ITEMS || 15), 30);
    const providerTimeoutMs = Math.max(5000, Number(process.env.REPORT_PROVIDER_TIMEOUT_MS || 15000));

    // 2. 整理素材 (容错处理，避免脏数据导致函数崩溃)
    const normalizedItems = items.slice(0, maxItems).map((n = {}) => {
      const categories = Array.isArray(n.categories) ? n.categories : [];
      return {
        categories,
        title: truncate(n.title || n.title_cn || 'Untitled', 180),
        summary: truncate(n.summary || n.summary_cn || '', 320),
        insightEn: truncate(n.insight_en || n.insight || '', 220)
      };
    });

    const context = normalizedItems.map((n, i) =>
      `[N${i + 1}] [${n.categories.join(', ') || 'Uncategorized'}] TITLE: ${n.title}\nSUMMARY: ${n.summary}\nINSIGHT: ${n.insightEn}`
    ).join('\n\n');

    // 3. 配置 DeepSeek
    const DEEPSEEK_KEY = process.env.OPENAI_API_KEY;
    const DEEPSEEK_BASE = (process.env.API_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
    if (!DEEPSEEK_KEY) {
      return res.status(500).json({ success: false, error: 'OPENAI_API_KEY is not configured' });
    }

    // 4. Prompt
    const prompt = `You are a senior strategist at Hawaii Tourism Authority.
Task: Write a monthly market intelligence brief based ONLY on the provided news.
Target Audience: HTA executives.
Language: English (professional and concise).

Hard Rules:
1. Use ONLY the provided input data.
2. Add evidence tags in every key statement using [N#] format.
3. If a section has no supporting evidence in input, write exactly: "No material updates in selected news."
4. Do not add countries, airlines, policies, or numbers that are not in the input.

Required Structure:

# Competitive Environment
## Short Haul
- Flights and capacity changes (new routes, resumption, frequency increases).
- Access and policy changes (visa/ADS/entry convenience when relevant).
- Destination marketing and distribution moves (roadshows, partnerships, payment ecosystem, creator campaigns).
- Demand signals (arrivals, booking or share shifts).
- Strategic implication for Hawaii (1-2 sentences with [N#]).

## Long Haul
- Flights and capacity changes.
- Access and policy changes.
- Destination marketing and distribution moves.
- Demand signals.
- Strategic implication for Hawaii (1-2 sentences with [N#]).

# Consumer Trends
- Demand and spending momentum among Chinese travelers.
- Demographic and behavior shifts (e.g., younger cohorts, premium preferences, emotional-value travel).
- What this implies for Hawaii product positioning (2-3 actionable insights with [N#]).

# US Access Monitor
- China-US flights.
- China-US relations that affect travel sentiment/policy.
- US visa environment for Chinese leisure travel.
- If no evidence exists, write: "No material updates in selected news."

# Recommended Actions (Next 30-90 Days)
- Provide 3-5 actions for HTA.
- Each action must include: Objective, Why now, and Supporting evidence [N#].

---
Input Data:
${context}
`;

    let report = '';
    try {
      report = await callProvider({
        baseUrl: DEEPSEEK_BASE,
        apiKey: DEEPSEEK_KEY,
        prompt,
        maxTokens: 850,
        timeoutMs: providerTimeoutMs
      });
      if (!report) throw new Error('Empty provider response');
    } catch (firstError) {
      if (!isRetryableProviderError(firstError)) {
        const details = extractProviderError(firstError);
        return res.status(500).json({ success: false, error: `Failed to generate report: ${details.message}` });
      }

      // Retry once with smaller context/tokens.
      try {
        const compactItems = normalizedItems.slice(0, Math.min(10, normalizedItems.length));
        const compactContext = compactItems.map((n, i) =>
          `[N${i + 1}] [${n.categories.join(', ') || 'Uncategorized'}] TITLE: ${n.title}\nSUMMARY: ${n.summary}`
        ).join('\n\n');
        const compactPrompt = `${prompt.split('---')[0]}---\nInput Data:\n${compactContext}`;

        report = await callProvider({
          baseUrl: DEEPSEEK_BASE,
          apiKey: DEEPSEEK_KEY,
          prompt: compactPrompt,
          maxTokens: 650,
          timeoutMs: Math.max(5000, Math.floor(providerTimeoutMs * 0.8))
        });
        if (!report) throw new Error('Empty provider response after retry');
      } catch (secondError) {
        const fallbackReport = buildFallbackReport(normalizedItems);
        const details = extractProviderError(secondError);
        console.error('Report fallback activated:', details);
        return res.status(200).json({
          success: true,
          report: fallbackReport,
          degraded: true,
          notice: `Provider unstable (${details.message}). Returned fallback report.`
        });
      }
    }

    return res.status(200).json({ success: true, report });
  } catch (error) {
    console.error("Report Generation Error:", error);
    const details = extractProviderError(error);
    return res.status(500).json({ success: false, error: `Failed to generate report: ${details.message}` });
  }
};
