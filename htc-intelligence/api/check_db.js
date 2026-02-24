require('dotenv').config({ path: '.env.local' });
const { connectToDatabase } = require('./db');

async function check() {
  const db = await connectToDatabase();
  const news = await db.collection('news').find({ categories: 'Macro Economy' }).toArray();
  
  console.log('\n📊 Economy News URLs:\n');
  news.forEach((item, i) => {
    console.log(`${i+1}. ${item.title_cn}`);
    console.log(`   URL: ${item.url}`);
    console.log(item.url.includes('example.com') ? '   ❌ 仍然是假链接' : '   ✅ 已更新为真实链接');
    console.log();
  });
  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
