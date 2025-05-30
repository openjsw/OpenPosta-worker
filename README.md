# OpenPosta-worker — Cloudflare邮局后端

**OpenPosta** 是一个基于 [Cloudflare Email Workers](https://developers.cloudflare.com/email-routing/email-workers/)、[D1 数据库](https://developers.cloudflare.com/d1/)和 [Resend API](https://resend.com/) 实现的轻量级 Web 邮局服务。
支持自定义邮箱账号管理、微级权限控制、邮件收发、管理员后台。

---

## ✨ 功能特性

* 无服务器 Cloudflare Worker 原生架构
* D1 数据库存储账号/邮件/权限
* 支持邮箱账号注册/删除/权限编辑
* 邮件收件箱、发件箱、写信、详情查询
* 管理员后台登录/退出/账号管理
* 外部邮件发送（Resend API）
* API RESTful 接口，支持跨域 & Cookie 鉴权

---

## 📁 项目结构

```text
.
├──  worker.js              # Cloudflare Worker 后端主逻辑
├──  src/
│   └── postal-mime.js     # 邮件分析库
└──  README.md              # 本文档
```

---

## 🚀 快速部署

### 1. 初始化 D1 数据库

执行 schema.sql:

```sql
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password TEXT,
  can_send INTEGER DEFAULT 1,
  can_receive INTEGER DEFAULT 1,
  created_at TEXT
);

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
```

### 2. 在 Cloudflare Workers 管理界面中

* Bind D1 数据库，名称为 `DB`
* 添加环境变量 `RESEND_API_KEY`

---

## ⚙️ API 接口列表

### 管理员

| Method | Path           | 描述     |
| ------ | -------------- | ------ |
| POST   | /manage/login  | 登录     |
| POST   | /manage/logout | 退出     |
| GET    | /manage/check  | 查询状态   |
| GET    | /manage/list   | 账号列表   |
| POST   | /manage/add    | 新增邮箱账号 |
| POST   | /manage/delete | 删除账号   |
| POST   | /manage/update | 调整许可权限 |

### 用户端

| Method | Path               | 描述   |
| ------ | ------------------ | ---- |
| POST   | /user/login        | 登录   |
| POST   | /user/logout       | 退出   |
| GET    | /user/check        | 查询状态 |
| GET    | /user/inbox        | 收件箱  |
| GET    | /user/mail?id=     | 收件详情 |
| GET    | /user/sent         | 发件箱  |
| GET    | /user/sentmail?id= | 发件详情 |
| POST   | /user/send         | 写信发送 |

### 公共 API

| Method | Path            | 描述     |
| ------ | --------------- | ------ |
| GET    | /api/list       | 最新邮件列表 |
| GET    | /api/detail?id= | 邮件详情   |

---

## 🔐 鉴权与安全

* 用户/管理员各自独立用 Cookie 鉴权
* 仅有管理员可进行账号操作，用户无许可访问
* CORS 支持跨域，需配合前端域名

---

## 📌 扩展提示

* 邮件附件/格式支持可扩展
* Resend 可替换为 Mailgun / SendGrid / MailChannels
* 前端可配合 [jianMail UI](https://github.com/toewpq/jianMail)

---

这是 OpenPosta 的后端实现文档，如需提供中文版 README 或前端部署指南，可再进一步维护。
