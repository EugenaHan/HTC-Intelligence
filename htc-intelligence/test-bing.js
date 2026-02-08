#!/usr/bin/env node
/**
 * Bing RSS 参数测试脚本
 * 测试不同的参数组合，找出有效配置
 */
const axios = require('axios');
const cheerio = require('cheerio');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 测试参数组合
const testCases = [
  {
    name: 'Test 1: 原始参数 (cc=US & setLang=en-US)',
    url: 'https://www.bing.com/news/search?q=China+outbound+tourism&format=rss&cc=US&setLang=en-US'
  },
  {
    name: 'Test 2: 添加 mkt 参数',
    url: 'https://www.bing.com/news/search?q=China+tourism&format=rss&mkt=en-US'
  },
  {
    name: 'Test 3: 简化查询 - 单个关键词',
    url: 'https://www.bing.com/news/search?q=tourism&format=rss'
  },
  {
    name: 'Test 4: 使用 nr 参数 (限制数量)',
    url: 'https://www.bing.com/news/search?q=China+travel&format=rss&nr=20'
  },
  {
    name: 'Test 5: 完全简化 - 无额外参数',
    url: 'https://www.bing.com/news/search?q=travel&format=rss'
  },
  {
    name: 'Test 6: 添加 setlang 参数 (小写)',
    url: 'https://www.bing.com/news/search?q=China+tourism&format=rss&setlang=en'
  },
  {
    name: 'Test 7: 组合参数 (mkt + cc)',
    url: 'https://www.bing.com/news/search?q=tourism&format=rss&mkt=en-US&cc=US'
  },
  {
    name: 'Test 8: 使用 site: 搜索',
    url: 'https://www.bing.com/news/search?q=site:cntravel.com&format=rss'
  }
];

async function testURL(testCase) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${testCase.name}`);
  console.log(`URL: ${testCase.url}`);
  console.log('-'.repeat(60));

  try {
    const res = await axios.get(testCase.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      },
      timeout: 15000
    });

    const $ = cheerio.load(res.data, { xmlMode: true });
    const items = $('item');

    console.log(`✅ 成功！找到 ${items.length} 个项目`);

    if (items.length > 0) {
      console.log('\n前 3 个项目:');
      items.slice(0, 3).each((i, el) => {
        const title = $(el).find('title').text().trim();
        const pubDate = $(el).find('pubDate').text();
        console.log(`  ${i + 1}. ${title}`);
        console.log(`     发布: ${pubDate || '无日期'}`);
      });
    }

    return { success: true, count: items.length };
  } catch (e) {
    console.error(`❌ 失败: ${e.message}`);
    if (e.response) {
      console.error(`   状态码: ${e.response.status}`);
    }
    return { success: false, count: 0 };
  }
}

async function runTests() {
  console.log('🧪 Bing RSS 参数测试开始...');
  console.log(`测试 ${testCases.length} 种配置\n`);

  const results = [];

  for (const testCase of testCases) {
    const result = await testURL(testCase);
    results.push({
      name: testCase.name,
      ...result
    });
  }

  // 汇总报告
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(60));

  results.forEach((r, i) => {
    const status = r.success ? (r.count > 0 ? '✅ 成功' : '⚠️  空结果') : '❌ 失败';
    const count = r.count > 0 ? `(${r.count} 篇)` : '';
    console.log(`${i + 1}. ${status} ${count} - ${r.name}`);
  });

  // 找出最佳配置
  const successful = results.filter(r => r.success && r.count > 0);
  if (successful.length > 0) {
    console.log('\n🎉 推荐配置:');
    successful.sort((a, b) => b.count - a.count);
    console.log(`   ${successful[0].name} - ${successful[0].count} 篇文章`);
  } else {
    console.log('\n⚠️  所有配置都未返回文章，可能 Bing RSS 需要其他方法');
  }

  process.exit(0);
}

runTests().catch(err => {
  console.error('\n💥 测试失败:', err.message);
  process.exit(1);
});
