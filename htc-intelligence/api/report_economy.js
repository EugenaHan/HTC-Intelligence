// api/report_economy.js
// 专门生成宏观经济简报
const axios = require('axios');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items selected' });
  }

  const context = items.map(n =>
    `DATA POINT: ${n.title} (Date: ${n.date.split('T')[0]})\nSummary: ${n.summary}\nImplication: ${n.insight_en}`
  ).join('\n\n');

  const DEEPSEEK_KEY = process.env.OPENAI_API_KEY;
  const DEEPSEEK_BASE = (process.env.API_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');

  const prompt = `
Role: Chief Economist for Hawaii Tourism China.
Task: Write the "Economy" section for the Monthly Report.
Input Data:
${context}

**Format Requirements:**
## 1. Economy

### 1.1 Key Economic Indicators
- **RMB Exchange Rate:** (Analyze recent trends vs USD).
- **GDP & CPI:** (Summarize latest stats from NBS/PBOC).
- **Financial Markets:** (Briefly mention stock market sentiment if available).

### 1.2 Impact on Consumer Spending
- Analyze how the above data affects the disposable income of Chinese travelers.
- **Outlook:** Is the travel budget expanding or shrinking?

**Output in clean Markdown format.**
`;

  try {
    const response = await axios.post(`${DEEPSEEK_BASE}/v1/chat/completions`, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: "You are a professional economist. Output in clean Markdown." },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.5
    }, {
      headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}` }
    });

    const report = response.data.choices[0].message.content;
    res.status(200).json({ success: true, report });

  } catch (error) {
    console.error("Economy Report Generation Error:", error);
    res.status(500).json({ error: 'Failed to generate economy report' });
  }
};
