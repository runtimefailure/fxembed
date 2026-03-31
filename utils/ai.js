const OpenAI = require('openai');
const db = require('./database');

const navy = new OpenAI({
    apiKey: process.env.NAVY_KEY,
    baseURL: 'https://api.navy/v1',
});

const DAILY_TOKEN_LIMIT = 5000;

/**
 * Checks if a user has exceeded their daily AI usage limit.
 * @param {string} userId 
 * @returns {Promise<{allowed: boolean, used: number, limit: number}>}
 */
async function checkUsage(userId) {
    let usage = await db.get('SELECT * FROM ai_usage WHERE user_id = ?', [userId]);
    
    if (!usage) {
        await db.run('INSERT INTO ai_usage (user_id, tokens_used) VALUES (?, 0)', [userId]);
        usage = { tokens_used: 0, last_reset: new Date().toISOString() };
    }

    const lastReset = new Date(usage.last_reset);
    const now = new Date();
    
    if (now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        await db.run('UPDATE ai_usage SET tokens_used = 0, last_reset = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
        return { allowed: true, used: 0, limit: DAILY_TOKEN_LIMIT };
    }

    return {
        allowed: usage.tokens_used < DAILY_TOKEN_LIMIT,
        used: Math.max(0, usage.tokens_used),
        limit: DAILY_TOKEN_LIMIT
    };
}

/**
 * Updates a user's token usage.
 * @param {string} userId 
 * @param {number} tokens 
 */
async function updateUsage(userId, tokens) {
    await db.run('UPDATE ai_usage SET tokens_used = tokens_used + ? WHERE user_id = ?', [tokens, userId]);
}

/**
 * Gets a user's custom AI configuration.
 * @param {string} userId 
 */
async function getCustomAi(userId) {
    let config = await db.get('SELECT * FROM custom_ai WHERE user_id = ?', [userId]);
    if (!config) {
        await db.run('INSERT INTO custom_ai (user_id) VALUES (?)', [userId]);
        config = await db.get('SELECT * FROM custom_ai WHERE user_id = ?', [userId]);
    }
    return config;
}

/**
 * Saves a user's custom AI configuration.
 */
async function saveCustomAi(userId, name, prompt, model) {
    return db.run('UPDATE custom_ai SET name = ?, system_prompt = ?, model = ? WHERE user_id = ?', [name, prompt, model, userId]);
}

module.exports = {
    navy,
    checkUsage,
    updateUsage,
    getCustomAi,
    saveCustomAi,
    DAILY_TOKEN_LIMIT
};
