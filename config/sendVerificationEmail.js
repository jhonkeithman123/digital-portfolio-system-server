import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const email = process.env.EMAIL_USER;
const password = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: email,
    pass: password,
  },
});

export const sendVerificationEmail = async (to, code, expiry) => {
  try {
    await transporter.sendMail({
      from: `"" <${email}>`,
      to,
      subject: "Verify Your Email",
      html: `
        <p>Your verification code is:</p>
        <h2 style="color:#2e86de;">${code}</h2>
        <p>This code will expire at <strong>${expiry}</strong>.</p>
        <p>If you didn't request this, please ignore the message.</p>
      `,
    });
  } catch (error) {
    console.error("Error transporting email:", error);
  }
};
