import dotenv from "dotenv";
import { MailerSend, EmailParams, Sender, Recipient, MailerSend } from "mailersend";

dotenv.config();

const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY;
const FROM_EMAIL = (process.env.MAILERSEND_FROM_EMAIL || "").trim();
const FROM_NAME = (process.env.MAILERSEND_FROM_NAME || "Digital Portfolio").trim();

if (!MAILERSEND_API_KEY) {
  console.error("MAILERSEND_API_KEY not set. Email sending will fail. Set MAILERSEND_API_KEY in your environment.");
}

export const sendVerificationEmail = async (toString, code, expiry) => {
  if (!MAILERSEND_API_KEY) {
    throw new Error("No MailerSend API key configured (MAILERSEND_API_KEY).");
  }

  if (!to) throw new Error("Missing recipient email address.");

  const html = `
    <p>Your verification code is:</p>
    <h2 style="color:#2e86de;">${code}</h2>
    <p>This code will expire at <strong>${expiry}</strong>.</p>
    <p>If you didn't request this, please ignore the message.</p>
  `;

  const text = `Your verification code is: ${code}\nExpires: ${expiry}\nIf you didn't request this, ignore.`;

  try {
    const mailerSend = new MailerSend({ apiKey: MAILERSEND_API_KEY });
    const sentFrom = new Sender(FROM_EMAIL || "no-reply@example.com", FROM_NAME);
    const recipients = [new Recipient(to)];

    const params = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setReplyTo(sentFrom)
      .setSubject("Verify Your Email")
      .setHtml(html)
      .setText(text);

      await mailerSend.email.send(params);
      console.info(`[MAILERSEND] verification sent to ${to}`);
  } catch (e) {
    console.error("[MAILERSEND] error sending email:", err?.message || err);
    throw err;
  }
};