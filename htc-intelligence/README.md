# HTC Market Intelligence System

## 系统功能

### 1. 自动化新闻爬取
- **定时任务**: 每天凌晨2点自动爬取最新新闻
- **数据源**: Travel And Tour World, Dragon Trail等
- **智能分类**: 自动识别Short Haul/Long Haul/签证/航线等类别
- **情感分析**: 自动判断利好/威胁/中立

### 2. 用户认证系统
- **登录方式**: 邮箱/密码、Google账号
- **Firebase Authentication**: 安全可靠
- **个人收藏**: 登录后可收藏感兴趣的新闻

### 3. 新闻展示
- **自动筛选**: 默认显示当月及上个月新闻
- **多维度筛选**: 出境游趋势/消费趋势/经济趋势/Short Haul/Long Haul
- **收藏功能**: 收藏新闻，随时查看
- **原文链接**: 点击卡片跳转原文

### 4. 英文报告生成
- **自动汇总**: 按范例格式生成英文报告
- **一键复制**: 复制到剪贴板，直接粘贴到月报
- **实时更新**: 根据筛选条件动态生成

### 5. 24小时在线
- **Vercel托管**: 无需您的电脑开着
- **全球CDN**: 同事在任何地方都能访问
- **自动更新**: 每天自动爬取最新新闻

---

## 技术架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   GitHub Actions │────▶│  News Crawler   │────▶│  MongoDB Atlas  │
│  (Daily 2AM UTC) │     │   (Node.js)     │     │  (Database)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
┌─────────────────┐     ┌─────────────────┐            │
│   Vercel CDN    │◀───│  Vercel API     │◀───────────┘
│  (Frontend)     │     │  (Serverless)   │
└─────────────────┘     └─────────────────┘
        │
        ▼
┌─────────────────┐
│  Firebase Auth  │
│  (User Auth)    │
└─────────────────┘
```

---

## 部署步骤

### 1. 创建MongoDB Atlas数据库
1. 访问 https://www.mongodb.com/cloud/atlas
2. 注册免费账号（512MB免费额度）
3. 创建Cluster
4. 获取连接字符串（MONGODB_URI）

### 2. 创建Firebase项目
1. 访问 https://console.firebase.google.com/
2. 创建新项目
3. 启用Authentication（Email/Password + Google）
4. 获取Firebase配置参数

### 3. 部署到Vercel
1. Fork此仓库到您的GitHub账号
2. 访问 https://vercel.com/
3. 导入GitHub仓库
4. 设置环境变量:
   - `MONGODB_URI`
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
5. 部署

### 4. 配置GitHub Actions
1. 在GitHub仓库设置中添加Secrets:
   - `MONGODB_URI`
   - `API_URL` (Vercel部署后的API地址)
2. GitHub Actions将自动运行爬虫

---

## 环境变量

| 变量名 | 说明 | 获取方式 |
|--------|------|---------|
| `MONGODB_URI` | MongoDB连接字符串 | MongoDB Atlas控制台 |
| `FIREBASE_API_KEY` | Firebase API密钥 | Firebase项目设置 |
| `FIREBASE_AUTH_DOMAIN` | Firebase认证域名 | Firebase项目设置 |
| `FIREBASE_PROJECT_ID` | Firebase项目ID | Firebase项目设置 |

---

## 使用说明

### 访问网站
- 部署后会获得一个Vercel域名（如 `https://htc-intelligence.vercel.app`）
- 分享给同事，无需您的电脑开着

### 查看新闻
- 打开网站自动显示当月及上个月新闻
- 使用筛选器查看特定类别
- 点击新闻卡片跳转原文

### 收藏新闻
1. 点击右上角"Sign In"登录
2. 使用邮箱或Google账号
3. 点击新闻卡片上的❤️收藏
4. 点击"My Favorites"查看收藏

### 生成报告
- 右侧自动显示英文报告
- 点击"Copy Report"复制到剪贴板
- 粘贴到您的月报文档

---

## 免费额度

| 服务 | 免费额度 | 说明 |
|------|---------|------|
| Vercel | 100GB带宽/月 | 足够团队使用 |
| MongoDB Atlas | 512MB存储 | 约存储2年新闻 |
| Firebase Auth | 10,000用户/月 | 足够团队使用 |
| GitHub Actions | 2,000分钟/月 | 足够每日爬虫 |

**总成本: $0/月**

---

## 维护

### 更新爬虫
- 修改 `crawler/news-crawler.js`
- 添加新的新闻源
- 提交到GitHub，自动部署

### 查看日志
- Vercel Dashboard: 查看API日志
- GitHub Actions: 查看爬虫运行日志
- MongoDB Atlas: 查看数据库状态

---

## 联系支持

如有问题，请提交GitHub Issue或联系开发团队。
