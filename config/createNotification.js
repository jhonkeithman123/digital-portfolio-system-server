import db from "./db.js";

function createNotification({ recipientId, senderId, type, message, link }) {
    const query = `
        INSERT INTO notifications (recipient_id, sender_id, type, message, link)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(query, [recipientId, senderId, type, message, link], (err) => {
        if (err) console.error("Notification err:", err);
    });
}

export default createNotification;