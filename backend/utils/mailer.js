import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // meestal false op 587 (TLS via STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMail({ to, subject, html, text }) {
  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM, // bijv. noreply@invite.calllogix.nl
      to,
      subject,
      html,
      text,
    });
    console.log("MAIL SENT:", info);
    return info;
  } catch (e) {
    console.error("MAIL ERROR:", e);  // <-- Dit logt de SMTP/mailer error naar Railway!
    throw e;  // gooi door zodat inviteUser hem ziet
  }
}
