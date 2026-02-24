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

## 1. China Outbound Travel
- Synthesize only China outbound travel demand, booking, and traveler preference shifts.
- Ignore generic global tourism news that is not linked to Chinese travelers.

## 2. Hawaii Competitor Analysis
### 2.1 Short Haul Competitors
- Cover short haul destinations competing for Chinese tourists (for example: Japan, Korea, Thailand, Singapore, Malaysia).
- Focus on policy, flights, and campaign moves that could divert demand from Hawaii.

### 2.2 Long Haul Competitors
- Cover long haul competitors (for example: US mainland, Europe, Australia, Middle East).
- Focus on capacity, access convenience, and value proposition compared with Hawaii.

## 3. China-US Flights
- Summarize China-US aviation recovery, route launches/resumptions, frequency/capacity changes, and bottlenecks.
- Explain direct implication for Hawaii accessibility.

## 4. China-US Relations
- Summarize bilateral developments that materially affect travel sentiment or travel policy.
- Do not include unrelated geopolitical commentary.

## 5. US Visa Environment
- Summarize US visa policy/process updates that affect Chinese leisure travelers (appointment wait times, approval friction, policy changes).
- Give one concise execution recommendation for Hawaii marketing under current visa constraints.

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
