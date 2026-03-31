const { 
    ApplicationIntegrationType, 
    InteractionContextType, 
    version: sapphireVersion
}                               = require('discord.js');
const { Command }               = require('@sapphire/framework');
const { version: djsVersion }   = require('discord.js');
const { templates }             = require('../utils/templates');
const { logger }                = require('../index');
const os                        = require('os');

class InfoCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'info', description: 'General information and statistics' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('info')
                .setDescription('General information and statistics')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('bot').setDescription('View bot statistics and uptime'))
                .addSubcommand(sc => sc.setName('ping').setDescription('Check bot latency'))
                .addSubcommand(sc => sc.setName('uptime').setDescription('Show how long the bot has been online'))
        );
    }

    async chatInputRun(interaction) {
        try {
            await interaction.deferReply();
        } catch (err) {
            logger.error(`Failed to defer interaction: ${err.message}`);
            return;
        }

        const sub = interaction.options.getSubcommand();
        const authorName = interaction.user.username;

        try {
            switch (sub) {
                case 'bot': {
                    const uptime = this.formatDuration(this.container.client.uptime);
                    const guilds = this.container.client.guilds.cache.size;
                    const users = this.container.client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
                    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

                    const content = `<:fxrole:1486875884110483497> **Bot:** \`fxmbed\`\n` +
                        `<:fxanalytics:1486875859703955496> **Stats:** ${guilds} guilds | ${users} users\n` +
                        `<:fxmemory:1487147079334625290> **Memory:** ${memory} MB\n` +
                        `<:fxcalendar:1486875894118219907> **Uptime:** ${uptime}\n\n` +
                        `**Software:**\n` +
                        `<:fxnote:1486875868495089744> Node.js: \`${process.version}\`\n` +
                        `<:fxnote:1486875868495089744> Discord.js: \`v${djsVersion}\`\n` +
                        `<:fxnote:1486875868495089744> Sapphire: \`v${this.container.stores.get('commands').get('info').container.client.version || '5.5.0'}\``;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Bot Statistics',
                        content,
                        thumbnail: this.container.client.user.displayAvatarURL()
                    }));
                }

                case 'ping': {
                    const ping = this.container.client.ws.ping;
                    const heartbeat = Date.now() - interaction.createdTimestamp;

                    const content = `<:fxreport:1486878917687250954> **WebSocket:** \`${ping}ms\`\n` +
                        `<:fxreport:1486878917687250954> **Latency:** \`${Math.abs(heartbeat)}ms\``;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Bot Latency',
                        content
                    }));
                }

                case 'uptime': {
                    const duration = this.formatDuration(this.container.client.uptime);
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'System Uptime',
                        content: `<:fxcalendar:1486875894118219907> The bot has been online for: **${duration}**`
                    }));
                }
            }
        } catch (err) {
            if (!interaction.deferred && !interaction.replied) return;
            return interaction.editReply(templates.error({
                message: err.message || 'An error occurred.'
            }));
        }
    }



    /**
     * Format timestamp to time.
     * @param {number} ms - The timestamp itself.
     * @returns {string}
     */
    formatDuration(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));

        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
}

module.exports = { InfoCommand };
