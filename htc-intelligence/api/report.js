// api/report.js
// 专门用于生成 HTC 标准战略报告 (三段式)
const axios = require('axios');

export default async function handler(req, res) {
  // 1. 安全检查
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items selected' });

  // 2. 整理素材 (把新闻分类喂给 AI，辅助它思考)
  const context = items.map((n, i) =>
    `${i+1}. [${n.categories.join(', ')}] TITLE: ${n.title}\n   SUMMARY: ${n.summary}\n   INSIGHT: ${n.insight_en}`
  ).join('\n\n');

  // 3. 配置 DeepSeek
  const DEEPSEEK_KEY = process.env.OPENAI_API_KEY;
  const DEEPSEEK_BASE = (process.env.API_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');

  // 4. 精心设计的 Prompt (强制 AI 按照三段式填空)
  const prompt = `You are a senior strategist at Hawaii Tourism Authority.
Task: Write an Executive Market Intelligence Report based ONLY on the provided news.
Target Audience: HTA (Hawaii Tourism Authority) Executives.
Language: English (Professional, Strategic, Concise).

Structure Requirements (YOU MUST FOLLOW THIS):

# Executive Market Intelligence Report
*Date: ${new Date().toLocaleDateString('en-US', {month:'long', year:'numeric'})}*

## 1. Competitive Environment
### 1.1 Short Haul Competitors (Asia Pacific)
- Synthesize updates from Thailand, Singapore, Japan, Korea, SE Asia, etc.
- Focus on: Visa policies, flight recovery, and marketing campaigns targeting Chinese tourists.
- **Strategic Implication for Hawaii:** (One sentence on how this affects Hawaii).

### 1.2 Long Haul Competitors (Europe, US, Middle East, etc.)
- Synthesize updates from Europe, US Mainland, Australia, Middle East.
- Focus on: Capacity constraints, pricing, and visa hurdles.
- **Strategic Implication for Hawaii:** (One sentence on Hawaii's positioning).

## 2. Consumer Behaviour & Trends
- Synthesize updates on Luxury Spending, Retail (Duty Free), Gen-Z preferences, and Travel Sentiment.
- **Opportunity for Hawaii:** (How can Hawaii capture this spending power?).

---
**Input Data to Analyze:**
${context}
`;

  try {
    const response = await axios.post(`${DEEPSEEK_BASE}/v1/chat/completions`, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: "You are a senior travel strategist. Output in Markdown format." },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.7
    }, {
      headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}` }
    });

    const report = response.data.choices[0].message.content;
    res.status(200).json({ success: true, report });

  } catch (error) {
    console.error("Report Generation Error:", error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
}
