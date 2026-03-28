const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(process.cwd(), 'users.sqlite'));
        this.init();
    }

    /**
     * Initializes the database and creates the default users table.
     */
    init() {
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                lastfm TEXT,
                wallet INTEGER DEFAULT 0,
                bank INTEGER DEFAULT 0
            )`);
        });
    }

    /**
     * Executes a SQL query without returning result rows.
     * @param {string} sql - The SQL query.
     * @param {Array} params - Query parameters.
     * @returns {Promise<Object>}
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    /**
     * Retrieves a single row from the database.
     * @param {string} sql - The SQL query.
     * @param {Array} params - Query parameters.
     * @returns {Promise<Object>}
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * Retrieves all matching rows from the database.
     * @param {string} sql - The SQL query.
     * @param {Array} params - Query parameters.
     * @returns {Promise<Array>}
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Fetches a user by ID, creating them if they don't exist.
     * @param {string} id - The user's Discord ID.
     * @returns {Promise<Object>} The user record.
     */
    async getUser(id) {
        let user = await this.get('SELECT * FROM users WHERE id = ?', [id]);
        if (!user) {
            await this.run('INSERT INTO users (id) VALUES (?)', [id]);
            user = await this.get('SELECT * FROM users WHERE id = ?', [id]);
        }
        return user;
    }

    /**
     * Updates a user's Last.fm username.
     * @param {string} id - The user's Discord ID.
     * @param {string} user - The Last.fm username.
     * @returns {Promise<Object>}
     */
    async setFm(id, user) {
        await this.getUser(id);
        return this.run('UPDATE users SET lastfm = ? WHERE id = ?', [user, id]);
    }

    /**
     * Adds or removes currency from a user's wallet or bank.
     * @param {string} id - The user's Discord ID.
     * @param {'wallet' | 'bank'} type - The balance type to update.
     * @param {number} amt - The amount to add (can be negative).
     * @returns {Promise<Object>}
     */
    async updateBal(id, type, amt) {
        await this.getUser(id);
        return this.run(`UPDATE users SET ${type} = ${type} + ? WHERE id = ?`, [amt, id]);
    }
}

module.exports = new Database();