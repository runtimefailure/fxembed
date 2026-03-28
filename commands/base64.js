const { Command } = require('@sapphire/framework');
const { ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { templates } = require('../utils/templates');
const { logger } = require('../index');

class Base64Command extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'base64', description: 'Base64 encoding and decoding commands' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('base64')
                .setDescription('Base64 encoding and decoding commands')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('encode').setDescription('Encode a string to Base64').addStringOption(o => o.setName('text').setDescription('The text to encode').setRequired(true)))
                .addSubcommand(sc => sc.setName('decode').setDescription('Decode a Base64 string').addStringOption(o => o.setName('text').setDescription('The Base64 string to decode').setRequired(true)))
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
        const text = interaction.options.getString('text');
        const authorName = interaction.user.username;

        try {
            if (sub === 'encode') {
                const encoded = Buffer.from(text).toString('base64');
                return await interaction.editReply(templates.utilityResult({
                    authorName,
                    title: 'Base64 Encode',
                    content: `**Input:** \`${text}\`\n\n**Output:** \`\`\`\n${encoded}\n\`\`\``
                }));
            } else if (sub === 'decode') {
                const decoded = Buffer.from(text, 'base64').toString('utf-8');
                
                return await interaction.editReply(templates.utilityResult({
                    authorName,
                    title: 'Base64 Decode',
                    content: `**Input:** \`${text}\`\n\n**Output:** \`\`\`\n${decoded}\n\`\`\``
                }));
            }
        } catch (err) {
            if (!interaction.deferred && !interaction.replied) return;
            return interaction.editReply(templates.error({
                message: err.message || 'An error occurred while executing the command.'
            }));
        }
    }
}

module.exports = { Base64Command };
