// emailService.js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEnrollmentEmail(to, subject, htmlContent) {
  try {
    const info = await transporter.sendMail({
      from: `"Enrollment System" <SV8BSHS@gmail.com>`,
      to,
      subject,
      html: htmlContent,
    });
    console.log("✅ Email sent:", info.messageId);
  } catch (error) {
    console.error("❌ Email send error:", error);
  }
}
