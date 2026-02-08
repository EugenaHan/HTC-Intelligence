/**
 * 添加宏观经济测试数据
 * 用于测试前端"Economy"筛选和报告生成功能
 */
require('dotenv').config({ path: '.env.local' });
const { connectToDatabase, saveNews } = require('./db');

const economyTestData = [
  {
    title: 'China\'s GDP grows 5.2% in 2024, beating expectations',
    summary: 'China\'s gross domestic product expanded by 5.2% in 2024, surpassing the government\'s 5% target. The fourth quarter saw 5.6% growth, driven by strong exports and policy stimulus.',
    url: 'https://example.com/gdp-2024',
    source: 'National Bureau of Statistics',
    date: new Date().toISOString(),
    categories: ['Macro Economy'],
    sentiment: 'Positive'
  },
  {
    title: 'RMB exchange rate stabilizes at 7.24 per USD',
    summary: 'The Chinese yuan has stabilized around 7.24 per US dollar after months of volatility. Analysts expect the currency to remain steady in Q1 2026 as the PBOC maintains prudent monetary policy.',
    url: 'https://example.com/rmb-rate',
    source: 'People\'s Bank of China',
    date: new Date(Date.now() - 86400000).toISOString(),
    categories: ['Macro Economy'],
    sentiment: 'Neutral'
  },
  {
    title: 'China CPI rises 0.3% in December, inflation remains mild',
    summary: 'China\'s consumer price index increased by 0.3% year-on-year in December 2025, remaining well below the central bank\'s 3% target. Food prices fell while service costs increased modestly.',
    url: 'https://example.com/cpi-dec',
    source: 'National Bureau of Statistics',
    date: new Date(Date.now() - 172800000).toISOString(),
    categories: ['Macro Economy'],
    sentiment: 'Neutral'
  },
  {
    title: 'PBOC cuts reserve requirement ratio by 0.5 percentage points',
    summary: 'The People\'s Bank of China announced a 50 basis point cut to the reserve requirement ratio, releasing approximately 1 trillion yuan in long-term liquidity to support economic growth.',
    url: 'https://example.com/pboc-rrr',
    source: 'People\'s Bank of China',
    date: new Date(Date.now() - 259200000).toISOString(),
    categories: ['Macro Economy'],
    sentiment: 'Positive'
  },
  {
    title: 'Chinese consumer spending rebounds in Q4 2025',
    summary: 'Retail sales in China grew 7.4% year-on-year in the fourth quarter of 2025, the fastest pace in two years. The recovery was led by tourism, dining, and luxury goods spending.',
    url: 'https://example.com/retail-sales',
    source: 'National Bureau of Statistics',
    date: new Date(Date.now() - 345600000).toISOString(),
    categories: ['Macro Economy'],
    sentiment: 'Positive'
  }
];

async function start() {
  console.log('🔄 Connecting to database...');
  await connectToDatabase();

  console.log('📊 Adding economy test data...\n');
  
  let count = 0;
  for (const item of economyTestData) {
    try {
      const result = await saveNews(item);
      if (result.inserted) {
        count++;
        console.log(`✅ Added: ${item.title}`);
      } else {
        console.log(`⚠️  Skipped (already exists): ${item.title}`);
      }
    } catch (e) {
      console.error(`❌ Failed to add: ${item.title} - ${e.message}`);
    }
  }

  console.log(`\n🎉 Done! Added ${count} economy news items.`);
  console.log('💡 Now you can test the "Economy" filter on the frontend!');
  process.exit(0);
}

start().catch(err => {
  console.error('💥 Error:', err);
  process.exit(1);
});
