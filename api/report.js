// api/report.js
// 专门用于生成 "HTC Monthly Report" 风格的深度报告
const axios = require('axios');

module.exports = async function handler(req, res) {
  // 1. 安全检查
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items selected' });

  // 2. 整理素材 (把新闻分类喂给 AI)
  // 我们把 source 也带上，增加可信度
  const context = items.map((n, i) => 
    `ITEM ${i+1}:
    - Source: ${n.source}
    - Date: ${n.date.split('T')[0]}
    - Category: ${n.categories.join(', ')}
    - Title: ${n.title}
    - Summary: ${n.summary}
    - Insight: ${n.insight_en}`
  ).join('\n\n');

  // 3. 配置 DeepSeek
  const DEEPSEEK_KEY = process.env.OPENAI_API_KEY;
  const DEEPSEEK_BASE = (process.env.API_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');

  // 4. 核心 Prompt：复刻 Monthly Report 风格
  const prompt = `
Role: Senior Market Analyst for Hawaii Tourism China (HTC).
Task: Write a "Monthly Market Intelligence Report" based on the provided news items.
Target Audience: HTC Executives and HTA Head Office.
Language: English (Formal, Narrative, Data-driven).

**STYLE GUIDE (CRITICAL):**
- Do NOT just list the news titles.
- Write **detailed narrative paragraphs** synthesizing multiple news items together.
- Include **specific data** (percentages, passenger numbers, dates) whenever available in the input.
- Use a professional, objective tone similar to a government or consultancy report.

**REPORT STRUCTURE:**

# Market Intelligence Monthly Report
*Period: ${new Date().toLocaleDateString('en-US', {month:'long', year:'numeric'})}*

## 1. Outbound Travel Market
(Instructions: Synthesize news related to China's macro tourism trends, total outbound numbers, visa policies, passport rankings, and general consumer sentiment. If no specific macro news is selected, summarize the general market sentiment based on the available items.)

## 2. Competitive Environment

### SHORT HAUL (Asia Pacific)
(Instructions: Focus on competitors like Japan, Korea, Thailand, Malaysia, Singapore. Discuss:
- **Visa Policies:** Any new visa-free arrangements?
- **Airlines:** Specific route resumptions (e.g., Sichuan Airlines, Juneyao Airlines), flight frequencies.
- **Arrival Data:** Any stats from JNTO or other tourism boards.
- **Marketing:** What are they doing to attract Chinese tourists?)

### LONG HAUL (US, Europe, Middle East)
(Instructions: Focus on Hawaii's direct competitors. Discuss:
- **Capacity:** Flight recovery rates to US/Europe.
- **Barriers:** Visa wait times, costs.
- **New Players:** Destinations like Saudi Arabia or Turkey if mentioned.)

## 3. Strategic Implications for Hawaii
(Instructions: Based on the above, provide 3 bullet points on what Hawaii should do. E.g., "Given the aggressive recovery of Short Haul capacity...")

---
**Input Data to Analyze:**
${context}
`;

  try {
    const response = await axios.post(`${DEEPSEEK_BASE}/v1/chat/completions`, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: "You are a professional tourism analyst. Output in clean Markdown." },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000, // 增加 token 限制，允许写更长的报告
      temperature: 0.5 // 稍微降低温度，保证数据的准确性
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