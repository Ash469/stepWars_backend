import nodemailer from "nodemailer";

const sendEmail = async ({ to, subject, html, from = process.env.EMAIL_FROM }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
     tls: { rejectUnauthorized: false } // allow self-signed certs
  });

  await transporter.sendMail({ from, to, subject, html });
  console.log(`→ Email sent to ${to}: "${subject}"`);
};

export default sendEmail;
