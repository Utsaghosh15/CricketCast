const nodemailer = require('nodemailer');

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.INVITE_EMAIL_FROM);
}

function buildViewerUrl(matchId) {
  const base = (process.env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, '');
  const id = encodeURIComponent(String(matchId || '').trim());
  return `${base}/watch/${id}`;
}

/**
 * @param {{ to: string, tempPassword: string, matchTitle: string, matchId: string }} opts
 * @returns {Promise<{ sent: boolean, skipped?: string }>}
 */
async function sendMatchInviteEmail(opts) {
  const { to, tempPassword, matchTitle, matchId } = opts;
  if (!smtpConfigured()) {
    return { sent: false, skipped: 'SMTP not configured (set SMTP_HOST and INVITE_EMAIL_FROM)' };
  }

  const port = Number(process.env.SMTP_PORT || '587');
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  const viewerUrl = buildViewerUrl(matchId);
  const subject = `You're invited to watch: ${matchTitle}`;
  const text = [
    `You've been invited to watch "${matchTitle}" on CricCast.`,
    '',
    `Open: ${viewerUrl}`,
    '',
    `Sign in with this email address and temporary password:`,
    `  Email: ${to}`,
    `  Password: ${tempPassword}`,
    '',
    'Keep this password private. You can ask the host to reset it if needed.',
  ].join('\n');

  await transporter.sendMail({
    from: process.env.INVITE_EMAIL_FROM,
    to,
    subject,
    text,
  });
  return { sent: true };
}

module.exports = { sendMatchInviteEmail, smtpConfigured };
