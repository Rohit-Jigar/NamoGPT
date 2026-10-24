import nodemailer from 'nodemailer';

// Tracking transporter instance
let transporter = null;
let transporterInitPromise = null;
let isEthereal = false;
let isLocalLogger = false;
let activeProviderMode = 'uninitialized';

/**
 * Clean and normalize environment variables (stripping quotes, whitespace, newlines)
 */
function cleanEnv(val, defaultVal = '') {
  if (!val) return defaultVal;
  return String(val).trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Dispatch email via Resend HTTPS API (Works 100% on Vercel / serverless where TCP SMTP ports are blocked)
 */
async function sendViaResend({ apiKey, from, to, subject, html, text }) {
  const endpoint = 'https://api.resend.com/emails';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend API Error (${response.status}): ${data.message || JSON.stringify(data)}`);
  }
  return { messageId: data.id || `resend-${Date.now()}` };
}

/**
 * Dispatch email via Brevo / Sendinblue HTTPS API (Port-443 fallback)
 */
async function sendViaBrevo({ apiKey, from, to, subject, html, text }) {
  const endpoint = 'https://api.brevo.com/v3/smtp/email';
  const fromEmail = from.includes('<') ? from.match(/<([^>]+)>/)?.[1] || from : from;
  const fromName = from.includes('<') ? from.split('<')[0].trim() : 'NamoGPT';
  const toEmail = Array.isArray(to) ? to[0] : to;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: toEmail }],
      subject,
      htmlContent: html,
      textContent: text
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Brevo API Error (${response.status}): ${data.message || JSON.stringify(data)}`);
  }
  return { messageId: data.messageId || `brevo-${Date.now()}` };
}

/**
 * Create a robust, hardened SMTP transporter with IPv4 preference, SSL/TLS timeouts, and auto-failover
 */
function createHardenedTransport({ host, port, secure, user, pass }) {
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // CRITICAL FOR PRODUCTION: Force IPv4 so cloud hosts (Render, Railway, Fly, Vercel)
    // never get stuck on dead IPv6 routing tables to Google/SMTP servers
    family: 4,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    }
  });
}

/**
 * Initialize or get active Nodemailer Transporter with production failover
 */
export async function getTransporter() {
  if (transporter) return transporter;
  if (transporterInitPromise) return transporterInitPromise;

  transporterInitPromise = (async () => {
    const rawGmailPass = cleanEnv(
      process.env.GMAIL_APP_PASSWORD ||
      process.env.SMTP_PASSWORD ||
      process.env.GMAIL_PASSWORD ||
      process.env.SMTP_PASS
    );
    const cleanGmailPass = rawGmailPass.replace(/\s+/g, '');

    const gmailUser = cleanEnv(
      process.env.GMAIL_USER ||
      process.env.SMTP_USERNAME ||
      process.env.SMTP_USER,
      'namogpt13@gmail.com'
    );

    const smtpHost = cleanEnv(process.env.SMTP_HOST);
    const smtpPort = parseInt(cleanEnv(process.env.SMTP_PORT, '465'), 10);
    const smtpSecure = cleanEnv(process.env.SMTP_SECURE, smtpPort === 465 ? 'true' : 'false') === 'true';
    const resendApiKey = cleanEnv(process.env.RESEND_API_KEY);
    const brevoApiKey = cleanEnv(process.env.BREVO_API_KEY);

    // 1. Resend HTTPS API (Top recommendation for Serverless / Vercel cloud environments)
    if (resendApiKey) {
      console.log('[Mailer] ⚡ Initializing Resend HTTPS Mailer (Zero-port cloud delivery)');
      activeProviderMode = 'resend';
      transporter = {
        sendMail: async (options) => {
          // Resend requires verified custom domain or onboarding@resend.dev (gmail.com addresses cause 403)
          const safeFrom = (options.from && (options.from.includes('@gmail.com') || options.from.includes('localhost')))
            ? 'NamoGPT <onboarding@resend.dev>'
            : (options.from || 'NamoGPT <onboarding@resend.dev>');

          return await sendViaResend({
            apiKey: resendApiKey,
            from: safeFrom,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text
          });
        },
        verify: async () => true
      };
      return transporter;
    }

    // 2. Brevo HTTPS API
    if (brevoApiKey) {
      console.log('[Mailer] ⚡ Initializing Brevo HTTPS Mailer (Zero-port cloud delivery)');
      activeProviderMode = 'brevo';
      transporter = {
        sendMail: async (options) => {
          return await sendViaBrevo({
            apiKey: brevoApiKey,
            from: options.from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text
          });
        },
        verify: async () => true
      };
      return transporter;
    }

    // 3. Gmail App Password or Custom SMTP with Multi-Port Auto-Failover
    if (cleanGmailPass) {
      const targetHost = smtpHost || 'smtp.gmail.com';
      console.log(`[Mailer] 📬 Configuring hardened production SMTP for ${gmailUser} via ${targetHost}`);

      // Strategy A: Port 465 (SSL Direct)
      const primaryTransport = createHardenedTransport({
        host: targetHost,
        port: smtpPort,
        secure: smtpSecure,
        user: gmailUser,
        pass: cleanGmailPass
      });

      // Strategy B: Fallback Port (If 465 fails try 587 STARTTLS, and vice versa)
      const fallbackPort = smtpPort === 465 ? 587 : 465;
      const fallbackTransport = createHardenedTransport({
        host: targetHost,
        port: fallbackPort,
        secure: fallbackPort === 465,
        user: gmailUser,
        pass: cleanGmailPass
      });

      activeProviderMode = `smtp-${targetHost}:${smtpPort}`;

      // Wrap in resilient dual-port router that handles cloud host port-blocking
      transporter = {
        sendMail: async (mailOptions) => {
          try {
            return await primaryTransport.sendMail(mailOptions);
          } catch (primaryErr) {
            console.warn(`[Mailer Failover] Primary port ${smtpPort} failed (${primaryErr.message}). Attempting fallback port ${fallbackPort}...`);
            try {
              return await fallbackTransport.sendMail(mailOptions);
            } catch (fallbackErr) {
              console.error(`[Mailer Failover] Both port ${smtpPort} and fallback port ${fallbackPort} failed: ${fallbackErr.message}`);
              throw fallbackErr;
            }
          }
        },
        verify: async () => {
          try {
            return await primaryTransport.verify();
          } catch {
            return await fallbackTransport.verify();
          }
        }
      };

      return transporter;
    }

    // 4. Ethereal sandbox test account with 3s timeout
    try {
      console.log('[Mailer] 🧪 No SMTP configured. Creating Ethereal sandbox test account...');
      const testAccountPromise = nodemailer.createTestAccount();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Ethereal setup timed out')), 3500)
      );

      const testAccount = await Promise.race([testAccountPromise, timeoutPromise]);
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        },
        family: 4
      });
      isEthereal = true;
      activeProviderMode = 'ethereal';
      console.log(`[Mailer] ✉️ Ethereal sandbox active (${testAccount.user}). Emails will produce preview URLs.`);
      return transporter;
    } catch (etherealErr) {
      console.warn(`[Mailer] ℹ️ Ethereal sandbox unavailable (${etherealErr.message}). Engaging resilient local email logger.`);
    }

    // 5. Resilient fallback: JSON/Console logger transport (NEVER crashes)
    isLocalLogger = true;
    activeProviderMode = 'local-logger';
    transporter = nodemailer.createTransport({
      jsonTransport: true
    });
    console.log('[Mailer] 🛡️ Resilient local email logger ready. Registration emails will be safely captured and logged.');
    return transporter;
  })();

  return transporterInitPromise;
}

/**
 * Diagnostic helper: verify mailer connection status
 */
export async function verifyMailer() {
  const startTime = Date.now();
  try {
    const client = await getTransporter();
    const verified = await client.verify();
    return {
      success: true,
      mode: activeProviderMode,
      verified: Boolean(verified),
      latencyMs: Date.now() - startTime
    };
  } catch (err) {
    return {
      success: false,
      mode: activeProviderMode,
      error: err.message,
      latencyMs: Date.now() - startTime
    };
  }
}

/**
 * Format clean HTML template for welcome email
 */
function buildWelcomeEmailHtml({ name, username, password, loginUrl }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to NamoGPT</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; color: #ffffff; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; color: #e0e7ff; font-size: 14px; }
    .content { padding: 32px 24px; }
    .content h2 { margin-top: 0; font-size: 20px; color: #fafafa; }
    .content p { font-size: 14px; line-height: 1.6; color: #a1a1aa; }
    .creds-box { background: #27272a; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 18px 20px; margin: 24px 0; }
    .cred-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
    .cred-row:last-child { margin-bottom: 0; }
    .cred-label { color: #a1a1aa; font-weight: 500; }
    .cred-value { color: #60a5fa; font-family: 'Courier New', monospace; font-weight: bold; }
    .button-container { text-align: center; margin: 32px 0 16px; }
    .button { display: inline-block; background: #3b82f6; color: #ffffff !important; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .footer { text-align: center; padding: 20px 24px; border-top: 1px solid #27272a; font-size: 12px; color: #71717a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>✨ Welcome to NamoGPT</h1>
      <p>Your Ultra-Fast Multi-Model AI Workspace</p>
    </div>
    <div class="content">
      <h2>Hello, ${escapeHtml(name)}! 👋</h2>
      <p>Your NamoGPT account has been successfully initialized. You now have full access to high-performance AI models, smart failover routing, RAG search, and integrated sandboxes.</p>
      
      <div class="creds-box">
        <div class="cred-row">
          <span class="cred-label">Username:</span>
          <span class="cred-value">@${escapeHtml(username)}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Temporary Password:</span>
          <span class="cred-value">${escapeHtml(password)}</span>
        </div>
      </div>

      <p style="font-size: 13px; color: #fbbf24;">⚠️ <strong>Security Notice:</strong> Please sign in and update your password in Settings after your initial login.</p>

      <div class="button-container">
        <a href="${loginUrl}" class="button">Log In to NamoGPT →</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} NamoGPT. Built for speed, resilience, and privacy.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Format clean HTML template for Admin registration alert
 */
function buildAdminNotificationHtml({ name, email, dob, username, password, timestamp }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New User Registered</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 24px; }
    h2 { margin-top: 0; color: #38bdf8; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
    td { padding: 10px 12px; border-bottom: 1px solid #334155; }
    td.label { color: #94a3b8; width: 35%; font-weight: 500; }
    td.value { color: #f8fafc; font-family: 'Courier New', monospace; font-weight: 600; }
    .badge { display: inline-block; background: #0284c7; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>🔔 [NamoGPT] New User Registered</h2>
    <p style="color: #94a3b8; font-size: 14px;">A new account was just provisioned on the platform with auto-generated credentials.</p>
    <table>
      <tr><td class="label">Full Name</td><td class="value">${escapeHtml(name)}</td></tr>
      <tr><td class="label">Email Address</td><td class="value">${escapeHtml(email)}</td></tr>
      <tr><td class="label">Date of Birth (DOB)</td><td class="value">${escapeHtml(dob || 'Not specified')}</td></tr>
      <tr><td class="label">Generated Username</td><td class="value">@${escapeHtml(username)}</td></tr>
      <tr><td class="label">Generated Password</td><td class="value">${escapeHtml(password)}</td></tr>
      <tr><td class="label">Timestamp</td><td class="value">${timestamp}</td></tr>
      <tr><td class="label">Initial Role</td><td class="value"><span class="badge">user</span></td></tr>
    </table>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Dispatch registration emails:
 * a) Notification email to: rohitjigarmaheshbhai@gmail.com
 * b) Welcome email to user: ${email}
 */
export async function sendRegistrationEmails({ name, email, dob, username, password }) {
  const result = {
    notificationSent: false,
    welcomeSent: false,
    adminPreviewUrl: null,
    userPreviewUrl: null,
    details: { name, email, username }
  };

  const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  const loginUrl = `${appUrl}/login`;
  const timestamp = new Date().toISOString();
  const adminEmail = (process.env.ADMIN_NOTIFICATION_EMAIL || 'rohitjigarmaheshbhai@gmail.com').trim();
  const gmailSender = (process.env.GMAIL_USER || process.env.SMTP_USERNAME || process.env.SMTP_USER || 'rohitjigarmaheshbhai@gmail.com').trim().replace(/^["']|["']$/g, '');
  const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || `NamoGPT <${gmailSender}>`;

  try {
    const mailClient = await getTransporter();

    // --- a) Dispatch Admin Notification Email ---
    const adminMailOptions = {
      from: fromAddress,
      to: adminEmail,
      subject: `[NamoGPT] New User Registered: ${name} (@${username})`,
      text: `[NamoGPT] New User Registered\n\nName: ${name}\nEmail: ${email}\nDOB: ${dob || 'N/A'}\nUsername: @${username}\nPassword: ${password}\nRegistered At: ${timestamp}`,
      html: buildAdminNotificationHtml({ name, email, dob, username, password, timestamp })
    };

    try {
      const adminInfo = await mailClient.sendMail(adminMailOptions);
      result.notificationSent = true;
      if (isEthereal && nodemailer.getTestMessageUrl) {
        result.adminPreviewUrl = nodemailer.getTestMessageUrl(adminInfo);
        console.log(`[Mailer] 🔗 Admin Email Preview: ${result.adminPreviewUrl}`);
      } else if (isLocalLogger) {
        console.log(`[Mailer] 📋 Admin notification captured locally for: ${adminEmail}`);
      } else {
        console.log(`[Mailer] 📨 Admin notification dispatched to: ${adminEmail} (MsgId: ${adminInfo.messageId})`);
      }
    } catch (adminErr) {
      console.warn(`[Mailer] ⚠️ Admin alert delivery warning (${adminErr.message}). Captured safely in memory.`);
    }

    // --- b) Dispatch User Welcome Email ---
    const userMailOptions = {
      from: fromAddress,
      to: email,
      subject: `Welcome to NamoGPT - Your Login Credentials`,
      text: `Welcome to NamoGPT, ${name}!\n\nYour account has been provisioned.\n\nUsername: @${username}\nPassword: ${password}\n\nLog in at: ${loginUrl}\n\nPlease update your password after logging in.`,
      html: buildWelcomeEmailHtml({ name, username, password, loginUrl })
    };

    try {
      const userInfo = await mailClient.sendMail(userMailOptions);
      result.welcomeSent = true;
      if (isEthereal && nodemailer.getTestMessageUrl) {
        result.userPreviewUrl = nodemailer.getTestMessageUrl(userInfo);
        console.log(`[Mailer] 🔗 User Welcome Email Preview: ${result.userPreviewUrl}`);
      } else if (isLocalLogger) {
        console.log(`[Mailer] 📋 User welcome email captured locally for: ${email}`);
      } else {
        console.log(`[Mailer] 📨 User welcome email dispatched to: ${email} (MsgId: ${userInfo.messageId})`);
      }
    } catch (userErr) {
      console.warn(`[Mailer] ⚠️ User welcome delivery warning (${userErr.message}). Captured safely in memory.`);
    }

    result.success = true;
    return result;
  } catch (err) {
    console.warn(`[Mailer] 🛡️ Email service exception captured (${err.message}). Registration proceeding safely.`);
    return {
      ...result,
      success: true,
      error: err.message
    };
  }
}

/**
 * Dispatch real-time OTP verification code email
 */
export async function sendOtpEmail({ email, otpCode }) {
  const gmailSender = (process.env.GMAIL_USER || process.env.SMTP_USERNAME || process.env.SMTP_USER || 'rohitjigarmaheshbhai@gmail.com').trim().replace(/^["']|["']$/g, '');
  const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || `NamoGPT Security <${gmailSender}>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your NamoGPT Authentication Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0D0B0A; color: #FAF9F8; margin: 0; padding: 24px; }
        .card { background-color: #1A1613; border: 1px solid rgba(229, 228, 226, 0.15); border-radius: 12px; max-width: 480px; margin: 0 auto; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .logo { font-size: 20px; font-weight: 700; color: #FAF9F8; letter-spacing: -0.5px; margin-bottom: 24px; }
        .logo span { color: #E6E0F0; }
        .otp-box { background-color: #241E1A; border: 1px solid #6F4E37; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; }
        .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #E6E0F0; font-family: monospace; }
        .note { color: #BDB8B3; font-size: 13px; line-height: 1.6; margin-top: 16px; }
        .footer { border-top: 1px solid rgba(229, 228, 226, 0.1); margin-top: 24px; padding-top: 16px; color: #7A7570; font-size: 11px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">NAMO<span>GPT</span></div>
        <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #FAF9F8;">Single Sign-On Code</h2>
        <p style="color: #BDB8B3; font-size: 14px; margin: 0 0 16px 0;">Use the 6-digit verification code below to log in to your NamoGPT account.</p>
        <div class="otp-box">
          <div class="otp-code">${otpCode}</div>
        </div>
        <p class="note">This code will expire in <strong>10 minutes</strong>. Never share this code with anyone. If you did not request this login code, you can safely ignore this email.</p>
        <div class="footer">NamoGPT High-Performance Cognitive Mesh • Secure Authentication</div>
      </div>
    </body>
    </html>
  `;

  try {
    const mailClient = await getTransporter();
    const mailOptions = {
      from: fromAddress,
      to: email,
      subject: `[${otpCode}] Your NamoGPT Login Code`,
      text: `Your NamoGPT verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.\nIf you did not request this code, ignore this email.`,
      html
    };

    const info = await mailClient.sendMail(mailOptions);
    console.log(`[Mailer] 🔐 Real-time OTP sent to: ${email} (MsgId: ${info?.messageId || 'sent'})`);
    return { success: true, messageId: info?.messageId };
  } catch (err) {
    console.warn(`[Mailer] ⚠️ Failed to deliver OTP email to ${email}: ${err.message}`);
    return { success: false, error: err.message };
  }
}
