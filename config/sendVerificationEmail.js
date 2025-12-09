import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const SMTP_HOST = process.env.EMAIL_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.EMAIL_PORT || 587);
const SMTP_SECURE = (process.env.EMAIL_SECURE || "false") === "true"; // true for 465
const SMTP_USER = process.env.EMAIL_USER;
const SMTP_PASS = process.env.EMAIL_PASS;

const FROM_EMAIL = (process.env.MAIL_FROM_EMAIL || process.env.EMAIL_USER || "no-reply@example.com").trim();
const FROM_NAME = (process.env.MAIL_FROM_NAME || "Digital Portfolio").trim();

if (!SMTP_USER || !SMTP_PASS) {
  console.warn(
    "SMTP credentials are not fully configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS."
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

export const sendVerificationEmail = async (to, code, expiry) => {
  if (!to) throw new Error("Missing recipient email address.");

  const maskedTo = typeof to === "string" ? to.replace(/(.{2}).+(@.+)/, "$1***$2") : String(to);
  const subject = "Verify Your Email";
  const html = `
    <p>Your verification code is:</p>
    <h2 style="color:#2e86de;">${code}</h2>
    <p>This code will expire at <strong>${expiry}</strong>.</p>
    <p>If you didn't request this, please ignore the message.</p>
  `;
  const text = `Your verification code is: ${code}\nExpires: ${expiry}\nIf you didn't request this, ignore.`;

  console.info(`[MAIL] preparing to send verification to=${maskedTo} expiry=${expiry}`);
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      text,
      html,
    });
    console.info(`[MAIL] sent verification to=${maskedTo} messageId=${info.messageId}`);
    return info;
  } catch (err) {
    console.error("[MAIL] error sending email:", err?.message || err, { stack: err?.stack });
    throw err;
  }
};