import PostalMime from './src/postal-mime.js';

// ========== 简单唯一ID生成器 ==========
function nanoid(size = 21) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
  let id = '';
  let random = crypto.getRandomValues(new Uint8Array(size));
  for (let i = 0; i < size; i++) {
    id += chars[random[i] % chars.length];
  }
  return id;
}

// ========== CORS 配置 ==========
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", //修改成你的前端地址
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Credentials": "true"
};

// ========== 管理员cookie工具 ==========
function getAdminToken(request) {
  let cookie = request.headers.get('cookie') || '';
  let match = cookie.match(/token=([^;]+)/);
  return match ? match[1] : '';
}
function setAdminCookie(res, token) {
  res.headers.set('Set-Cookie', `token=${token}; HttpOnly; Path=/; SameSite=Lax`);
}
function clearAdminCookie(res) {
  res.headers.set('Set-Cookie', `token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/;`);
}
async function checkAdminSession(env, request) {
  const token = getAdminToken(request);
  if (!token) return false;
  const { results } = await env.DB.prepare('SELECT id FROM admins WHERE id = ?').bind(token).all();
  return !!(results && results.length);
}

// ========== 用户cookie工具 ==========
function getUserToken(request) {
  let cookie = request.headers.get('cookie') || '';
  let match = cookie.match(/user_token=([^;]+)/);
  return match ? match[1] : '';
}
function setUserCookie(res, token) {
  res.headers.set('Set-Cookie', `user_token=${token}; HttpOnly; Path=/; SameSite=Lax`);
}
function clearUserCookie(res) {
  res.headers.set('Set-Cookie', `user_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/;`);
}
async function checkUserSession(env, request) {
  const token = getUserToken(request);
  if (!token) return false;
  const { results } = await env.DB.prepare('SELECT id FROM accounts WHERE id = ?').bind(token).all();
  return !!(results && results.length);
}

// ========== D1未绑定提示 ==========
function d1NotBindResponse() {
  return new Response(
    JSON.stringify({
      error: "D1 数据库未绑定！请在 Cloudflare Worker 设置中绑定 D1 数据库（DB）后再使用本服务。",
      en: "D1 database is not bound! Please bind D1 (DB) in your Cloudflare Worker settings before using this service."
    }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

// ========== Resend API 发信 ==========
async function sendByResend({ from, to, subject, text }, apiKey) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from, to, subject, text
    })
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error('Resend发送失败: ' + detail);
  }
  return await resp.json();
}

export default {
  // ========== 邮件入库（接收收件人邮件事件） ==========
  async email(message, env, ctx) {
    if (!env.DB) return d1NotBindResponse();

    // 判断收件人是否存在
    const mail_to = message.to;
    const { results: toAccount } = await env.DB.prepare('SELECT * FROM accounts WHERE email = ? AND can_receive = 1').bind(mail_to).all();
    if (!toAccount || !toAccount.length) {
      // 邮箱不存在或禁止收信，拒收（退信）
      throw new Error('邮箱不存在或不允许收件');
    }

    try {
      const mail_from = message.from;
      const raw_email = await new Response(message.raw).text();
      const mail = await new PostalMime().parse(raw_email);

      const now = new Date().toISOString();
      const newMail = {
        id: nanoid(),
        mail_from,
        mail_to,
        subject: mail.subject || '',
        body: mail.text || '',
        body_html: mail.html || '',
        attachments: mail.attachments ? JSON.stringify(mail.attachments) : null,
        raw_email,
        created_at: now,
        updated_at: now,
      };

      await env.DB.prepare(`
        INSERT INTO mails 
        (id, mail_from, mail_to, subject, body, body_html, attachments, raw_email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        newMail.id, newMail.mail_from, newMail.mail_to, newMail.subject,
        newMail.body, newMail.body_html, newMail.attachments, newMail.raw_email,
        newMail.created_at, newMail.updated_at
      ).run();
    } catch (e) {
      console.error('邮件解析或存储失败:', e);
    }
  },

  // ========== API/管理后台/用户端 ==========
  async fetch(request, env, ctx) {
    if (!env.DB) return d1NotBindResponse();

    // 跨域预检
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 管理员接口
    if (path === '/manage/login' && request.method === 'POST') {
      const { username, password } = await request.json();
      const { results } = await env.DB.prepare(
        'SELECT * FROM admins WHERE username = ? AND password = ?'
      ).bind(username, password).all();
      if (results && results.length) {
        const token = results[0].id;
        let res = new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        setAdminCookie(res, token);
        return res;
      } else {
        return new Response(JSON.stringify({ error: "用户名或密码错误" }), { status: 401, headers: corsHeaders });
      }
    }
    if (path === '/manage/logout' && request.method === 'POST') {
      let res = new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      clearAdminCookie(res);
      return res;
    }
    if (path === '/manage/check') {
      const loggedIn = await checkAdminSession(env, request);
      return new Response(JSON.stringify({ loggedIn }), { headers: corsHeaders });
    }
    if (path.startsWith('/manage/') && !(await checkAdminSession(env, request))) {
      return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: corsHeaders });
    }
    if (path === '/manage/list') {
      const { results } = await env.DB.prepare(
        'SELECT id, email, can_send, can_receive, created_at FROM accounts ORDER BY created_at DESC'
      ).all();
      return new Response(JSON.stringify({ accounts: results }), { headers: corsHeaders });
    }
    if (path === '/manage/add' && request.method === 'POST') {
      const { email, password, can_send = 1, can_receive = 1 } = await request.json();
      const id = nanoid();
      const created_at = new Date().toISOString();
      try {
        await env.DB.prepare(
          `INSERT INTO accounts (id, email, password, can_send, can_receive, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(id, email, password, can_send ? 1 : 0, can_receive ? 1 : 0, created_at).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ error: '邮箱已存在或数据库错误', detail: e.message }), { status: 400, headers: corsHeaders });
      }
    }
    if (path === '/manage/delete' && request.method === 'POST') {
      const { email } = await request.json();
      await env.DB.prepare(
        `DELETE FROM accounts WHERE email = ?`
      ).bind(email).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }
    if (path === '/manage/update' && request.method === 'POST') {
      const { email, can_send, can_receive } = await request.json();
      const canSendVal = typeof can_send === 'undefined' ? 1 : (can_send ? 1 : 0);
      const canReceiveVal = typeof can_receive === 'undefined' ? 1 : (can_receive ? 1 : 0);
      await env.DB.prepare(
        `UPDATE accounts SET can_send = ?, can_receive = ? WHERE email = ?`
      ).bind(canSendVal, canReceiveVal, email).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 用户接口
    if (path === '/user/login' && request.method === 'POST') {
      const { email, password } = await request.json();
      const { results } = await env.DB.prepare(
        'SELECT * FROM accounts WHERE email = ? AND password = ? AND can_receive = 1'
      ).bind(email, password).all();
      if (results && results.length) {
        const token = results[0].id;
        let res = new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        setUserCookie(res, token);
        return res;
      } else {
        return new Response(JSON.stringify({ error: "邮箱或密码错误" }), { status: 401, headers: corsHeaders });
      }
    }
    if (path === '/user/logout' && request.method === 'POST') {
      let res = new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      clearUserCookie(res);
      return res;
    }
    if (path === '/user/check') {
      const loggedIn = await checkUserSession(env, request);
      return new Response(JSON.stringify({ loggedIn }), { headers: corsHeaders });
    }

    // 用户收件箱
    if (path === '/user/inbox') {
      if (!(await checkUserSession(env, request))) {
        return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: corsHeaders });
      }
      const token = getUserToken(request);
      const { results: accounts } = await env.DB.prepare('SELECT email FROM accounts WHERE id = ?').bind(token).all();
      const email = accounts && accounts.length ? accounts[0].email : null;
      if (!email) return new Response(JSON.stringify({ error: "账号异常" }), { status: 401, headers: corsHeaders });

      const { results } = await env.DB.prepare(
        `SELECT id, mail_from, subject, created_at FROM mails WHERE mail_to = ? ORDER BY created_at DESC LIMIT 20`
      ).bind(email).all();
      return new Response(JSON.stringify({ mails: results }), { headers: corsHeaders });
    }

    // 用户邮件详情
    if (path === '/user/mail' && request.method === 'GET') {
      if (!(await checkUserSession(env, request))) {
        return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: corsHeaders });
      }
      const id = url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ error: "缺少参数 id" }), { status: 400, headers: corsHeaders });
      // 权限校验，只能看自己的邮件
      const token = getUserToken(request);
      const { results: accounts } = await env.DB.prepare('SELECT email FROM accounts WHERE id = ?').bind(token).all();
      const email = accounts && accounts.length ? accounts[0].email : null;
      const { results } = await env.DB.prepare(
        `SELECT * FROM mails WHERE id = ? AND mail_to = ?`
      ).bind(id, email).all();
      return new Response(JSON.stringify({ mail: results[0] || null }), { headers: corsHeaders });
    }

    // 用户发件箱
    if (path === '/user/sent') {
      if (!(await checkUserSession(env, request))) {
        return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: corsHeaders });
      }
      const token = getUserToken(request);
      const { results: accounts } = await env.DB.prepare('SELECT email FROM accounts WHERE id = ?').bind(token).all();
      const email = accounts && accounts.length ? accounts[0].email : null;
      if (!email) return new Response(JSON.stringify({ error: "账号异常" }), { status: 401, headers: corsHeaders });

      const { results } = await env.DB.prepare(
        `SELECT id, mail_to, subject, created_at FROM mails WHERE mail_from = ? ORDER BY created_at DESC LIMIT 20`
      ).bind(email).all();
      return new Response(JSON.stringify({ mails: results }), { headers: corsHeaders });
    }

    // 用户发件详情
    if (path === '/user/sentmail' && request.method === 'GET') {
      if (!(await checkUserSession(env, request))) {
        return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: corsHeaders });
      }
      const id = url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ error: "缺少参数 id" }), { status: 400, headers: corsHeaders });
      const token = getUserToken(request);
      const { results: accounts } = await env.DB.prepare('SELECT email FROM accounts WHERE id = ?').bind(token).all();
      const email = accounts && accounts.length ? accounts[0].email : null;
      const { results } = await env.DB.prepare(
        `SELECT * FROM mails WHERE id = ? AND mail_from = ?`
      ).bind(id, email).all();
      return new Response(JSON.stringify({ mail: results[0] || null }), { headers: corsHeaders });
    }

    // 用户写信（发件）- 通过 Resend
    if (path === '/user/send' && request.method === 'POST') {
      if (!(await checkUserSession(env, request))) {
        return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: corsHeaders });
      }
      const { to, subject, body } = await request.json();
      const token = getUserToken(request);
      const { results: accounts } = await env.DB.prepare('SELECT email, can_send FROM accounts WHERE id = ?').bind(token).all();
      const fromAccount = accounts && accounts.length ? accounts[0] : null;
      if (!fromAccount) return new Response(JSON.stringify({ error: "账号异常" }), { status: 401, headers: corsHeaders });
      if (!fromAccount.can_send) return new Response(JSON.stringify({ error: "当前账号没有发信权限" }), { status: 403, headers: corsHeaders });

      // 仅做简单邮箱格式校验
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(to)) {
        return new Response(JSON.stringify({ error: '收件人邮箱格式不正确' }), { status: 400, headers: corsHeaders });
      }


      // 发信（Resend）
      let sendOk = false, sendError = "";
      if (env.RESEND_API_KEY) {
        try {
          await sendByResend({
            from: fromAccount.email,
            to,
            subject,
            text: body
          }, env.RESEND_API_KEY);
          sendOk = true;
        } catch (e) {
          sendError = e.message || String(e);
        }
      } else {
        sendOk = true; // 没配置API KEY时假发成功（本地测试用）
      }
      // 邮件写入数据库
      const now = new Date().toISOString();
      const newMail = {
        id: nanoid(),
        mail_from: fromAccount.email,
        mail_to: to,
        subject: subject || '',
        body: body || '',
        body_html: '',
        attachments: null,
        raw_email: '',
        created_at: now,
        updated_at: now,
      };
      await env.DB.prepare(`
        INSERT INTO mails 
        (id, mail_from, mail_to, subject, body, body_html, attachments, raw_email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        newMail.id, newMail.mail_from, newMail.mail_to, newMail.subject,
        newMail.body, newMail.body_html, newMail.attachments, newMail.raw_email,
        newMail.created_at, newMail.updated_at
      ).run();

      if (sendOk) {
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } else {
        return new Response(JSON.stringify({ error: sendError || "发信失败" }), { status: 500, headers: corsHeaders });
      }
    }

    // 开放邮件API
    if (path === "/api/list") {
      const { results } = await env.DB.prepare(
        `SELECT id, mail_from, mail_to, subject, created_at FROM mails ORDER BY created_at DESC LIMIT 20`
      ).all();
      return new Response(JSON.stringify({ mails: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (path === "/api/detail") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "缺少参数 id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const { results } = await env.DB.prepare(
        `SELECT * FROM mails WHERE id = ?`
      ).bind(id).all();
      return new Response(JSON.stringify({ mail: results[0] || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 404
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
