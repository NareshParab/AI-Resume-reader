import nodemailer from "nodemailer";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const from = process.env.EMAIL_FROM ?? "Gcarbon Resume AI <no-reply@example.com>";

  await transporter.sendMail({
    from,
    to,
    subject: "Reset your Gcarbon Resume AI password",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f13;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#1a1a24;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 36px;">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6366f1;">Gcarbon Resume AI</p>
              <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#f0f0f8;">Reset your password</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a0a0b8;">
                We received a request to reset the password for your account. Click the button below to choose a new password.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);">
                    <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#a0a0b8;">
                This link expires in <strong style="color:#f0f0f8;">30 minutes</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:13px;color:#a0a0b8;">
                If you did not request a password reset, you can safely ignore this email — your password will not change.
              </p>
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:0 0 20px;" />
              <p style="margin:0;font-size:12px;color:#606078;">
                If the button above does not work, copy and paste this URL into your browser:
                <br />
                <span style="color:#6366f1;word-break:break-all;">${resetUrl}</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}
