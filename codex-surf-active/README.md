# codex_surf

`codex_surf` 是一个基于 `Next.js 15 + Supabase + Cloudflare` 的激活码系统，包含：

- 一个公开激活页：输入账号和激活码完成绑定
- 一个管理员后台：查看已激活账号、激活时间、对应激活码
- 一个批量生码能力：支持数量、前缀、批次号、备注

## 技术栈

- Next.js 15
- React 19
- TypeScript
- Supabase
- Cloudflare / OpenNext

## 本地开发

```bash
npm install
npm run dev
```

## 需要的环境变量

至少配置以下变量：

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
JWT_SECRET=replace-with-a-long-random-string
NEWAPI_BASE_URL=https://your-newapi-domain.com
```

推荐额外配置：

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CODEX_SURF_ADMIN_USERNAME=admin
CODEX_SURF_ADMIN_PASSWORD=change-me
NEWAPI_ADMIN_USERNAME=your-newapi-admin-username
NEWAPI_ADMIN_PASSWORD=your-newapi-admin-password
```

也可以使用服务端令牌方式代替 `NEWAPI_ADMIN_USERNAME / NEWAPI_ADMIN_PASSWORD`：

```env
NEWAPI_ADMIN_ACCESS_TOKEN=your-newapi-admin-access-token
NEWAPI_ADMIN_USER_ID=your-newapi-admin-user-id
```

说明：

- `NEWAPI_BASE_URL` 必须填写你正在运行的 `new-api` 主站地址，例如 `https://api.example.com`
- 不要填写 GitHub 仓库地址，也不要填写当前 `codex_surf` 前端站点地址
- 后台登录、套餐读取、激活后自动开通订阅都会请求这个 `new-api` 地址
- Cloudflare Workers / Pages 部署时，需要在项目的 `Settings` -> `Variables and Secrets` 中配置这些环境变量，然后重新部署

如果没有配置 `CODEX_SURF_ADMIN_USERNAME / CODEX_SURF_ADMIN_PASSWORD`，系统会尝试兼容：

- `codex_admins` 表，字段：`username` / `password`
- 旧版 `auth` 表，字段：`账号` / `密码`

## 数据表

请在 Supabase 中创建激活码表，SQL 见：

- `supabase-schema.sql`

默认表名是 `codex_activation_codes`，也可以通过环境变量 `CODEX_SURF_TABLE` 覆盖。

## 部署

```bash
npm run deploy
```

## 主要接口

- `POST /api/activate`：公开激活接口
- `POST /api/admin/login`：管理员登录
- `GET /api/admin/check`：校验后台登录态
- `GET /api/admin/codes`：后台码库和汇总
- `POST /api/admin/generate-codes`：批量生成激活码
