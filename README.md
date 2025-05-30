# jianMail 简邮 —— Cloudflare 邮局后端

**jianMail 简邮** 是一个基于 [Cloudflare Email Workers](https://developers.cloudflare.com/email-routing/email-workers/) + D1 数据库实现的**轻量级 Web 邮局服务**。  
支持自定义收/发件箱管理，管理员后台，账号权限分级，并通过 [Resend](https://resend.com/) API 实现外部发件能力。

## ✨ 功能特性

- Cloudflare Worker 原生无服务器架构
- D1 数据库存储账号、邮件、权限等
- 支持自定义邮箱账号注册/删除/权限修改
- 邮件收件箱、发件箱、写信、查阅详情
- 管理员后台权限控制（登录、登出、列表、账号管理）
- 支持外发邮件（可发往外部邮箱，需配置 Resend Key）
- 全 API 接口，跨域支持（含 Cookie 鉴权）

---

## 📁 项目结构

```


├──  worker.js              # Cloudflare Worker 主逻辑
├── src/
│   └── postal-mime.js #[postal-mime 功能文件](https://github.com/postalsys/postal-mime?tab=License-1-ov-file#readme)
│   └── ...
└── README.md              # 后端说明文档（本文件）

````

---

## 🚀 快速部署

### 1. 数据库准备

初始化 D1 数据库，执行 `schema.sql`：

```sql
-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password TEXT,
  created_at TEXT
);

-- 邮箱账号表
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password TEXT,
  can_send INTEGER DEFAULT 1,
  can_receive INTEGER DEFAULT 1,
  created_at TEXT
);

-- 邮件主表
CREATE TABLE IF NOT EXISTS mails (
  id TEXT PRIMARY KEY,
  mail_from TEXT,
  mail_to TEXT,
  subject TEXT,
  body TEXT,
  body_html TEXT,
  attachments TEXT,
  raw_email TEXT,
  created_at TEXT,
  updated_at TEXT
);
````

### 2. 绑定 D1 数据库

* 在 Cloudflare 控制台 > Workers > Bindings > D1，绑定你的数据库为变量名 `DB`。

### 3. 配置环境变量

**RESEND_API_KEY**：你的 Resend 邮件服务 API Key。
  用于支持用户写信外发邮件（可选，若不配置仅可收件/内网发件）。


## ⚙️ 主要 API 列表

### 管理后台接口（需管理员登录 Cookie）

* `POST   /manage/login`       — 管理员登录
* `POST   /manage/logout`      — 管理员登出
* `GET    /manage/check`       — 检查登录状态
* `GET    /manage/list`        — 邮箱账号列表
* `POST   /manage/add`         — 新增邮箱账号
* `POST   /manage/delete`      — 删除邮箱账号
* `POST   /manage/update`      — 修改邮箱权限

### 用户端接口

* `POST   /user/login`         — 用户邮箱登录
* `POST   /user/logout`        — 用户登出
* `GET    /user/check`         — 检查用户登录
* `GET    /user/inbox`         — 收件箱（限本人）
* `GET    /user/mail?id=`      — 收件详情（限本人）
* `GET    /user/sent`          — 发件箱（限本人）
* `GET    /user/sentmail?id=`  — 发件详情
* `POST   /user/send`          — 发送邮件（支持外发，需有权限）

### 开放查询接口（仅供演示/测试）

* `GET    /api/list`           — 最新邮件列表
* `GET    /api/detail?id=`     — 邮件详情

---

## 🔐 鉴权与安全

* 管理员与用户均用 Cookie 会话认证，安全隔离，防止权限混用。
* 仅管理员可操作邮箱账号增删改，普通用户不可越权访问。
* 支持 CORS 跨域配置，需将 `Access-Control-Allow-Origin` 指定为前端实际域名。

---

## 📌 备注 & 扩展

* 邮件收发逻辑可根据需要扩展：支持更多附件格式、自定义通知、日志审计等。
* 邮件外发依赖 Resend API，若需更换为 Mailgun、SendGrid、MailChannels 等可修改 `/user/send` 接口实现。
* 后续可配合前端 [`index.html`](https://github.com/toewpq/jianMail)（见项目 demo 目录）体验完整收发流程。


