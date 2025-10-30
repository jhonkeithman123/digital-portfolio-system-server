import express from 'express';
import db from '../config/db.js';

const router = express.Router();

router.post('/feedback', express.json(), (req, res) => {
    const { feedback } = req.body;
    const userId = req.user.id;

    const query = 'UPDATE classroom SET feedback = ? WHERE teacher_id = ?';
    db.query(query, [feedback, userId], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, message: "server error" });
        }
        res.json({ success: true });
    });
});


export default router;