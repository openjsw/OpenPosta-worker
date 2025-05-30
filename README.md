# OpenPosta-worker

**OpenPosta** is a lightweight webmail backend system powered by [Cloudflare Email Workers](https://developers.cloudflare.com/email-routing/email-workers/) and [D1 Database](https://developers.cloudflare.com/d1/).
It provides a simple, serverless mail service for managing inboxes, sending messages, and handling admin/user permissions. Outbound email is supported via [Resend](https://resend.com/).

👉 中文说明：[README-ZH.md](./README-ZH.md)

---

## ✨ Features

* Serverless architecture using Cloudflare Workers
* D1 database to store user accounts, emails, and permissions
* Inbox and outbox management, email details, and sending
* Admin backend with login/logout/account management
* Supports external email delivery via Resend API
* Full REST API with CORS and cookie-based authentication

---

## 📁 Structure

```
├── worker.js             # Main Cloudflare Worker logic
├── src/
│   └── postal-mime.js   # Used for parsing raw email (via PostalMime)
└── README.md             # English documentation (this file)
```

---

## 🚀 Deployment Steps

### 1. D1 Schema Initialization

Create tables by executing `schema.sql`:

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

### 2. Bind the Database

In Cloudflare dashboard > Workers > Bindings > D1, bind your DB instance with the variable name `DB`.

### 3. Add Environment Variable

Set the environment variable below to enable external mail sending:

* `RESEND_API_KEY` – your Resend API key

Without it, users can still receive and send emails internally.

---

## ⚙️ API Overview

### Admin Endpoints (Cookie-based Auth)

* `POST   /manage/login`       — Admin login
* `POST   /manage/logout`      — Admin logout
* `GET    /manage/check`       — Auth status check
* `GET    /manage/list`        — List email accounts
* `POST   /manage/add`         — Add new account
* `POST   /manage/delete`      — Remove account
* `POST   /manage/update`      — Update permissions

### User Endpoints

* `POST   /user/login`         — User login
* `POST   /user/logout`        — Logout
* `GET    /user/check`         — Check login status
* `GET    /user/inbox`         — View inbox (self only)
* `GET    /user/mail?id=`      — Read message detail
* `GET    /user/sent`          — Sent emails
* `GET    /user/sentmail?id=`  — Sent mail detail
* `POST   /user/send`          — Send email (internal/external)

### Public Read-Only APIs

* `GET    /api/list`           — Latest emails
* `GET    /api/detail?id=`     — Email detail by ID

---

## 🔐 Authentication & Security

* Cookie-based session auth for admin and users
* Role separation between admin/user
* Strict CORS headers recommended: set `Access-Control-Allow-Origin` to your frontend domain
* External sending limited to authorized users with valid API keys

---

## 📌 Notes & Extensions

* Easily extensible to support attachments, HTML templates, auditing, etc.
* Resend API can be replaced with Mailgun, SendGrid, or custom SMTP provider
* A frontend UI is available [here](https://github.com/toewpq/jianMail) for inbox/outbox access

---

© 2025 OpenJSW™/OpenPosta. Licensed under the MIT License.
