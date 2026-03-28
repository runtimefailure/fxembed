const { Listener, Events }      = require('@sapphire/framework');
const { templates }             = require('../utils/templates');
const { logger }                = require('../index');
const path                      = require('path');

const ASSETS = {
    errorIcon: path.join(process.cwd(), 'assets', 'separator-error.png'),
};

/**
 * Sanitizes error stack traces by masking local system paths and truncating length.
 * @param {string} stackTrace - The raw error stack or message string.
 * @returns {string} The sanitized stack trace ready for Discord output.
 */
const sanitizeStack = (stackTrace) => (stackTrace || 'Unknown error')
    .replace(/[A-Z]:\\[^\s]*/gi, '[●●●●●●]')
    .replace(/\/[^\s]*/g, '[●●●●●●]')
    .slice(0, 800);

class ErrorHandler extends Listener {
    constructor(context, options) {
        super(context, { ...options, event: Events.ChatInputCommandError });
    }

    /**
     * Executes when a chat input command throws an error.
     * @param {Error & { parsed?: boolean }} err - The thrown error object.
     * @param {Object} payload - The Sapphire event payload containing the interaction.
     */
    async run(err, { interaction }) {
        logger.error(err?.stack || err?.message || err);        
        if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;

        const errorMsg = err.parsed 
            ? err.message 
            : `\`\`\`js\n${sanitizeStack(err.stack || err.message)}\n\`\`\``;

        try {
            const responsePayload = {
                ...templates.error({ message: errorMsg }),
                files: [{ attachment: ASSETS.errorIcon, name: 'separator-error.png' }]
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(responsePayload);
            } else {
                await interaction.reply(responsePayload);
            }
        } catch (fallbackErr) {
            if (fallbackErr.code !== 10062 && !fallbackErr.message?.includes('Unknown interaction')) {
                logger.error('Failed to send error reply:', fallbackErr?.message || fallbackErr);
            }
        }
    }
}

module.exports = { ErrorHandler };