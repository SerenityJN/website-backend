// emailService.js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, 
  auth: {
    user: "SV8BSHS@gmail.com",   
    pass: "yzrq eact gsmy xdnq",  
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
