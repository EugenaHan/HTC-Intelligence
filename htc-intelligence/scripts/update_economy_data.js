/**
 * 更新宏观经济测试数据（删除旧数据，添加完整版）
 */
require('dotenv').config({ path: '.env.local' });
const { connectToDatabase } = require('../lib/db');

const economyTestData = [
  {
    title: 'China\'s GDP grows 5.2% in 2024, beating expectations',
    title_cn: '中国2024年GDP增长5.2%，超出预期',
    summary: 'China\'s gross domestic product expanded by 5.2% in 2024, surpassing the government\'s 5% target. The fourth quarter saw 5.6% growth, driven by strong exports and policy stimulus.',
    summary_cn: '中国2024年国内生产总值增长5.2%，超过政府5%的目标。第四季度增长5.6%，由强劲的出口和政策刺激推动。',
    insight_en: 'Strong GDP growth indicates robust consumer confidence and spending power. Chinese travelers are likely to increase overseas travel budgets in 2025, benefiting long-haul destinations like Hawaii.',
    insight_cn: '强劲的GDP增长表明消费者信心和购买力强劲。中国游客可能在2025年增加海外旅行预算，有利于夏威夷等长线目的地。',
    url: 'https://www.stats.gov.cn/english/PressRelease/202501/t20250117_1944623.html',
    source: 'National Bureau of Statistics',
    date: new Date().toISOString(),
    categories: ['Macro Economy'],
    sentiment: 'Positive'
  },
  {
    title: 'RMB exchange rate stabilizes at 7.24 per USD',
    title_cn: '人民币汇率在7.24兑1美元处企稳',
    summary: 'The Chinese yuan has stabilized around 7.24 per US dollar after months of volatility. Analysts expect the currency to remain steady in Q1 2026 as the PBOC maintains prudent monetary policy.',
    summary_cn: '在数月波动后，人民币兑美元汇率稳定在7.24左右。分析师预计2026年第一季度汇率将保持稳定，因央行保持审慎货币政策。',
    insight_en: 'Stable RMB reduces currency uncertainty for Chinese travelers, making long-haul trips more predictable. Hawaii should emphasize value-for-money luxury experiences to attract middle-class travelers.',
    insight_cn: '人民币稳定减少了中国游客的汇率不确定性，使长途旅行更具可预测性。夏威夷应强调高性价比的奢华体验，以吸引中产阶级游客。',
    url: 'https://www.pbc.gov.cn/en/3688230/3688250/index.html',
    source: 'People\'s Bank of China',
    date: new Date(Date.now() - 86400000).toISOString(),
    categories: ['Macro Economy'],
    sentiment: 'Neutral'
  },
  {
    title: 'China CPI rises 0.3% in December, inflation remains mild',
    title_cn: '中国12月CPI上涨0.3%，通胀保持温和',
    summary: 'China\'s consumer price index increased by 0.3% year-on-year in December 2025, remaining well below the central bank\'s 3% target. Food prices fell while service costs increased modestly.',
    summary_cn: '2025年12月，中国消费者价格指数同比上涨0.3%，远低于央行3%的目标。食品价格下降，服务成本小幅上涨。',
    insight_en: 'Mild inflation preserves consumer purchasing power. Chinese tourists maintain strong spending capacity for premium travel experiences. Hawaii can promote high-end tourism packages without price sensitivity concerns.',
    insight_cn: '温和通胀保持消费者购买力。中国游客对高端旅行体验保持强劲的消费能力。夏威夷可以推广高端旅游套餐，无需担心价格敏感度。',
    url: 'https://www.stats.gov.cn/english/PressRelease/202501/t20250112_1944598.html',
    source: 'National Bureau of Statistics',
    date: new Date(Date.now() - 172800000).toISOString(),
    categories: ['Macro Economy'],
    sentiment: 'Neutral'
  },
  {
    title: 'PBOC cuts reserve requirement ratio by 0.5 percentage points',
    title_cn: '央行降准0.5个百分点',
    summary: 'The People\'s Bank of China announced a 50 basis point cut to the reserve requirement ratio, releasing approximately 1 trillion yuan in long-term liquidity to support economic growth.',
    summary_cn: '中国人民银行宣布降准50个基点，释放约1万亿元长期流动性以支持经济增长。',
    insight_en: 'Monetary easing boosts consumer lending and travel financing. Expect increased spending on leisure travel. Hawaii should partner with Chinese fintech platforms to offer installment payment options for luxury packages.',
    insight_cn: '货币宽松促进消费贷款和旅行融资。预计休闲旅游支出将增加。夏威夷应与中国金融科技平台合作，为奢华套餐提供分期付款选择。',
    url: 'https://www.pbc.gov.cn/en/3688230/3688250/20250115/index.html',
    source: 'People\'s Bank of China',
    date: new Date(Date.now() - 259200000).toISOString(),
    categories: ['Macro Economy'],
    sentiment: 'Positive'
  },
  {
    title: 'Chinese consumer spending rebounds in Q4 2025',
    title_cn: '2025年第四季度中国消费支出反弹',
    summary: 'Retail sales in China grew 7.4% year-on-year in the fourth quarter of 2025, the fastest pace in two years. The recovery was led by tourism, dining, and luxury goods spending.',
    summary_cn: '2025年第四季度，中国零售额同比增长7.4%，为两年来最快增速。复苏由旅游、餐饮和奢侈品消费引领。',
    insight_en: 'Strong rebound in consumer spending signals returning confidence in outbound travel. Chinese tourists are ready for premium international experiences. Hawaii should target high-spending segments with personalized luxury offerings.',
    insight_cn: '消费支出强劲反弹表明对出境游的信心恢复。中国游客已准备好体验高端国际旅行。夏威夷应针对高消费群体推出个性化奢华产品。',
    url: 'https://www.stats.gov.cn/english/PressRelease/202501/t20250110_1944590.html',
    source: 'National Bureau of Statistics',
    date: new Date(Date.now() - 345600000).toISOString(),
    categories: ['Macro Economy'],
    sentiment: 'Positive'
  }
];

async function start() {
  console.log('🔄 Connecting to database...');
  const db = await connectToDatabase();
  
  if (!db) {
    console.log('❌ Database connection failed');
    process.exit(1);
  }

  const collection = db.collection('news');
  
  // 删除现有的经济测试数据
  console.log('\n🗑️  Deleting old economy test data...');
  const deleteResult = await collection.deleteMany({
    source: { $in: ['National Bureau of Statistics', 'People\'s Bank of China'] }
  });
  console.log(`   ✅ Deleted ${deleteResult.deletedCount} old records`);

  // 添加新数据
  console.log('\n📊 Adding updated economy test data...\n');
  
  let count = 0;
  for (const item of economyTestData) {
    try {
      // 直接插入，不使用 saveNews（因为 saveNews 会检查重复）
      await collection.insertOne({
        ...item,
        _id: undefined  // 让 MongoDB 自动生成 _id
      });
      count++;
      console.log(`✅ Added: ${item.title_cn}`);
    } catch (e) {
      console.error(`❌ Failed: ${item.title_cn} - ${e.message}`);
    }
  }

  console.log(`\n🎉 Done! Added ${count} economy news items.`);
  console.log('\n📝 Each item now includes:');
  console.log('   ✅ Chinese title (title_cn)');
  console.log('   ✅ Chinese summary (summary_cn)');
  console.log('   ✅ HTC Strategy Insight - English (insight_en)');
  console.log('   ✅ HTC Strategy Insight - Chinese (insight_cn)');
  console.log('\n🚀 Now you can test the "Economy" filter on the frontend!');
  process.exit(0);
}

start().catch(err => {
  console.error('💥 Error:', err);
  process.exit(1);
});
