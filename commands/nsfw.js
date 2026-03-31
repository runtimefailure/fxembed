const { 
    ApplicationIntegrationType, 
    InteractionContextType 
}                               = require('discord.js');
const { Command }               = require('@sapphire/framework');
const { templates }             = require('../utils/templates');
const { logger }                = require('../index');

class NsfwCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'booru', description: 'Search for NSFW images' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('booru')
                .setDescription('Search for images on various boorus')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])

                .addStringOption(o =>
                    o.setName('site')
                        .setDescription('The booru site to search on')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Danbooru', value: 'danbooru' },
                            { name: 'Konachan', value: 'konachan' },
                            { name: 'Yandere', value: 'yandere' },
                            { name: 'Gelbooru', value: 'gelbooru' },
                            { name: 'Rule34', value: 'rule34' },
                            { name: 'Lolibooru', value: 'loli' },
                            { name: 'Safebooru', value: 'safebooru' },
                            { name: 'Xbooru', value: 'xbooru' }
                        )
                )
                .addStringOption(o => o.setName('tags').setDescription('Tags to search for (separated by spaces)').setRequired(false))
        );
    }

    async chatInputRun(interaction) {
        const site = interaction.options.getString('site');
        const tagsInput = interaction.options.getString('tags') || '';
        const tags = tagsInput.toLowerCase().split(' ').filter(t => t.length > 0);
        const authorName = interaction.user.username;

        if (interaction.guild && !interaction.channel.nsfw) {
            return interaction.reply({
                content: '<:fxreport:1486878917687250954> This command can only be used in **NSFW channels** or **DMs**.',
                ephemeral: true
            });
        }

        if (site === 'loli' || tags.includes('loli') || tags.some(t => t.includes('loli'))) {
            return interaction.reply({ 
                content: 'go kill yourself', 
                ephemeral: false 
            });
        }

        try {
            await interaction.deferReply();            
            const { search } = await import('kaori');
            
            let results;
            try {
                results = await search(site, { 
                    tags: tags, 
                    limit: 10,
                    random: true 
                });
            } catch (err) {
                if (err.message.includes('.map is not a function')) {
                    throw new Error('No images found or the site returned an invalid response.');
                }
                throw err;
            }

            if (!results || !Array.isArray(results) || results.length === 0) {
                throw new Error('No images found for those tags.');
            }

            const validResults = results.filter(r => r.fileURL && (r.fileURL.startsWith('http') || r.fileURL.startsWith('//')));
            
            if (validResults.length === 0) {
                throw new Error('Found results, but no valid image URLs were provided by the site.');
            }

            const image = validResults[Math.floor(Math.random() * validResults.length)];
            const finalUrl = image.fileURL.startsWith('//') ? `https:${image.fileURL}` : image.fileURL;
            
            const content = `<:fxlink:1486095510434480208> **Site:** \`${site}\`\n` +
                `<:fxnote:1486875868495089744> **Tags:** ${tags.length > 0 ? `\`${tags.join(', ')}\`` : '*None*'}\n` +
                `<:fxid:1486875838858264636> **ID:** \`${image.id || 'Unknown'}\`\n` +
                `[View Original](${finalUrl})`;

            return await interaction.editReply(templates.utilityResult({
                authorName,
                title: 'Booru Search Result',
                content,
                media: finalUrl,
                spoiler: true
            }));

        } catch (err) {
            logger.error(`NSFW Command Error: ${err.message}`);
            
            let userMessage = err.message;
            if (err.message.includes('timeout')) userMessage = 'The site took too long to respond. Please try again.';
            if (err.message.includes('map is not a function')) userMessage = 'No results found or the site is currently unstable.';

            if (interaction.deferred || interaction.replied) {
                return interaction.editReply(templates.error({
                    message: userMessage
                }));
            }
            return interaction.reply(templates.error({
                message: userMessage
            }));
        }
    }
}

module.exports = { NsfwCommand };
