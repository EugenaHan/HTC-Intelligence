# HTC Market Intelligence - Vercel 部署指南

## 快速部署步骤

### 第一步：创建 MongoDB Atlas 数据库

1. 访问 https://www.mongodb.com/cloud/atlas
2. 点击 **Start Free** 注册账号
3. 创建 Cluster：
   - 选择 **M0 (Free Tier)**
   - 区域选择 **AWS / Tokyo (ap-northeast-1)**
   - 集群名称：`htc-cluster`
4. 创建数据库用户：
   - 用户名：`htc-user`
   - 密码：生成强密码并保存
5. 设置网络访问：
   - 点击 **Network Access** → **Add IP Address**
   - 选择 **Allow Access from Anywhere** (0.0.0.0/0)
6. 获取连接字符串：
   - 点击 **Databases** → **Connect** → **Drivers**
   - 选择 **Node.js**
   - 复制连接字符串，替换 `<password>` 为实际密码
   
   格式如下：
   ```
   mongodb+srv://htc-user:YOUR_PASSWORD@htc-cluster.xxxxx.mongodb.net/htc-intelligence?retryWrites=true&w=majority
   ```

### 第二步：准备 DeepSeek API Key（可选）

1. 访问 https://platform.deepseek.com/
2. 创建或获取 API Key
3. 记录为 `OPENAI_API_KEY`（本项目沿用该环境变量名）

### 第三步：Fork GitHub 仓库

1. 访问 https://github.com/new
2. 创建新仓库：
   - Repository name：`htc-intelligence`
   - 选择 **Public** 或 **Private**
3. 上传代码到仓库

或者使用命令行：
```bash
cd htc-intelligence
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/htc-intelligence.git
git push -u origin main
```

### 第四步：部署到 Vercel

#### 方式 A：使用 Vercel CLI 部署

```bash
# 安装 Vercel CLI（二选一）
npm i -g vercel          # 全局安装（若权限不足可试：sudo npm i -g vercel）
# 或使用项目内 npx，无需全局安装：
npm install              # 在 htc-intelligence 目录下已包含 vercel 依赖

# 登录（会打开浏览器）
vercel login

# 进入项目目录并部署到生产环境
cd htc-intelligence      # 或你的实际路径，如：/mnt/okcomputer/output/htc-intelligence
vercel --prod            # 全局安装时
# 若未全局安装，使用：
npx vercel --prod
```

#### 方式 B：通过 Vercel 网页

1. 访问 https://vercel.com/
2. 使用 GitHub 账号登录
3. 点击 **Add New Project**
4. 导入 `htc-intelligence` 仓库
5. 配置项目：
   - Framework Preset：**Other**
   - Root Directory：**htc-intelligence**
   - Build Command：留空
   - Output Directory：留空
6. 点击 **Environment Variables**，添加以下变量：

| 变量名 | 值 |
|--------|-----|
| `MONGODB_URI` | 你的MongoDB连接字符串 |
| `OPENAI_API_KEY` | OpenAI API Key（用于「Market Intelligence Executive Summary」报告生成） |

7. 点击 **Deploy**
8. 等待部署完成（约2-3分钟）
9. 获得网站地址：`https://htc-intelligence-xxx.vercel.app`

### 第五步：配置 GitHub Actions（自动爬虫）

1. 在 GitHub 仓库页面，点击 **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**，添加：
   - Name：`MONGODB_URI`
   - Value：你的MongoDB连接字符串
3. 再次添加：
   - Name：`API_URL`
   - Value：`https://你的vercel域名/api`

GitHub Actions 将每天自动运行爬虫，更新新闻数据。

---

## 验证部署

### 1. 测试新闻接口
访问：`https://你的域名/api/news`

应该返回新闻列表。

### 2. 测试前端
访问：`https://你的域名/`

应该显示新闻卡片和报告面板。

### 3. 测试报告接口
在前端勾选若干新闻后点击「Generate Report」，应能返回英文战略摘要。

---

## 故障排查

### 问题1：API 返回 404
- 检查 Vercel 路由配置
- 确保 `vercel.json` 正确上传

### 问题2：数据库连接失败
- 检查 `MONGODB_URI` 环境变量
- 确认 MongoDB Atlas IP 白名单包含 0.0.0.0/0

### 问题3：报告生成失败
- 检查 `OPENAI_API_KEY` 是否配置
- 检查 `API_BASE_URL` 是否正确（默认可不配）

---

## 更新网站

修改代码后，推送到 GitHub，Vercel 会自动重新部署：

```bash
git add .
git commit -m "Update feature"
git push
```

---

## 费用说明

| 服务 | 免费额度 | 是否足够 |
|------|---------|---------|
| Vercel | 100GB/月 | ✅ 足够 |
| MongoDB Atlas | 512MB | ✅ 足够 |
| GitHub Actions | 2,000分钟/月 | ✅ 足够 |

**总费用：$0/月**

---

## 需要帮助？

如有问题，请检查：
1. Vercel 部署日志（Dashboard → Deployments）
2. 浏览器控制台错误信息
3. API 响应状态
