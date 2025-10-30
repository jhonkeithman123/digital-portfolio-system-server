import db from './db.js';

const test_db = () => {
    db.query('SELECT 1 + 1 AS result', (err, results) => {
        if (err) {
            console.error('Database test failed:', err);
        }

        console.log('Database test success:', results[0].result);
    });
};

test_db();