// 📧 emailService.js
import { Resend } from "resend";

// Initialize Resend with your API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send enrollment confirmation email
 * @param {string} to - recipient email
 * @param {string} subject - email subject
 * @param {string} html - email HTML content
 */
export const sendEnrollmentEmail = async (to, subject, html) => {
  try {
    const data = await resend.emails.send({
      from: "SVSHS Enrollment <enrollment@sv8bshs.site>", // customize this name
      to,
      subject,
      html,
    });
    console.log("✅ Email sent successfully:", data);
  } catch (error) {
    console.error("❌ Email send error:", error);
  }
};
