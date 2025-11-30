import db from "./db.js";

async function createNotification({ recipientId, senderId, type, message, link }) {
  const query = `
    INSERT INTO notifications (recipient_id, sender_id, type, message, link)
    VALUES (?, ?, ?, ?, ?)
  `;
  try {
    await db.query(query, [recipientId, senderId, type, message, link]);
    console.info("[DB] createNotification OK", { recipientId, type });
  } catch (err) {
    console.error("Notification err:", err?.message || err);
  }
}

export default createNotification;