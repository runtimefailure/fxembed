const sqlite3           = require('sqlite3').verbose();
const path              = require('path');

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
    async setLastFm(id, user) {
        await this.getUser(id);
        return this.run('UPDATE users SET lastfm = ? WHERE id = ?', [user, id]);
    }

    /**
     * Fetches all users who have a Last.fm username linked.
     * @returns {Promise<Array>}
     */
    async getAllLinkedUsers() {
        return this.all('SELECT id, lastfm FROM users WHERE lastfm IS NOT NULL');
    }

    /**
     * Updates a user's timezone.
     * @param {string} id - The user's Discord ID.
     * @param {string} timezone - The timezone name.
     * @returns {Promise<Object>}
     */
    async setTimezone(id, timezone) {
        await this.getUser(id);
        return this.run('UPDATE users SET timezone = ? WHERE id = ?', [timezone, id]);
    }

    async createTag(ownerId, name, content) {
        return this.run('INSERT INTO tags (owner_id, name, content) VALUES (?, ?, ?)', [ownerId, name.toLowerCase(), content]);
    }

    async getTag(name) {
        return this.get('SELECT * FROM tags WHERE name = ?', [name.toLowerCase()]);
    }

    async updateTag(name, content) {
        return this.run('UPDATE tags SET content = ? WHERE name = ?', [content, name.toLowerCase()]);
    }

    async deleteTag(name) {
        return this.run('DELETE FROM tags WHERE name = ?', [name.toLowerCase()]);
    }

    async listTags(ownerId) {
        if (ownerId) {
            return this.all('SELECT * FROM tags WHERE owner_id = ? ORDER BY name ASC', [ownerId]);
        }
        return this.all('SELECT * FROM tags ORDER BY name ASC');
    }

    async searchTags(query) {
        return this.all('SELECT name FROM tags WHERE name LIKE ? LIMIT 25', [`%${query.toLowerCase()}%`]);
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