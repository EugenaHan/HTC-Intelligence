const axios = require('axios');

module.exports = async function handler(req, res) {
  try {
    // 1. 安全检查
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return res.status(400).json({ success: false, error: 'No items selected' });

    const truncate = (value, maxLen) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
    const maxItems = Math.min(Number(process.env.REPORT_MAX_ITEMS || 15), 30);
    const providerTimeoutMs = Math.max(3000, Number(process.env.REPORT_PROVIDER_TIMEOUT_MS || 8000));

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

    // 4. 精心设计的 Prompt (强制 AI 按照三段式填空)
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

    const response = await axios.post(`${DEEPSEEK_BASE}/v1/chat/completions`, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: "You are a senior travel strategist. Output in Markdown format." },
        { role: 'user', content: prompt }
      ],
      max_tokens: 900,
      temperature: 0.4
    }, {
      headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
      timeout: providerTimeoutMs
    });

    const report = response.data.choices[0].message.content;
    res.status(200).json({ success: true, report });
  } catch (error) {
    console.error("Report Generation Error:", error);
    const providerMessage =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      'Unknown error';
    const isProviderTimeout =
      error?.code === 'ECONNABORTED' ||
      error?.response?.status === 504 ||
      /timeout/i.test(String(providerMessage));
    if (isProviderTimeout) {
      return res.status(504).json({
        success: false,
        error: 'Report provider timed out. Please retry with fewer selected items.'
      });
    }
    res.status(500).json({ success: false, error: `Failed to generate report: ${providerMessage}` });
  }
};
