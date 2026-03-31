const { 
    ApplicationIntegrationType, 
    InteractionContextType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
}                                   = require('discord.js');
const { Command }                   = require('@sapphire/framework');
const { templates }                 = require('../utils/templates');
const { logger }                    = require('../index');
const db                            = require('../utils/database');
const { paginate }                  = require('../utils/pagination');

class TagsCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'tags', description: 'Global tag system' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('tags')
                .setDescription('Global tag system')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('create').setDescription('Create a global tag').addStringOption(o => o.setName('tag').setDescription('Tag name').setRequired(true)).addStringOption(o => o.setName('text').setDescription('Tag content').setRequired(true)))
                .addSubcommand(sc => sc.setName('send').setDescription('Send a tag').addStringOption(o => o.setName('tag').setDescription('Tag name').setRequired(true).setAutocomplete(true)))
                .addSubcommand(sc => sc.setName('delete').setDescription('Delete one of your tags').addStringOption(o => o.setName('tag').setDescription('Tag name').setRequired(true).setAutocomplete(true)))
                .addSubcommand(sc => sc.setName('edit').setDescription('Edit one of your tags').addStringOption(o => o.setName('tag').setDescription('Tag name').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('text').setDescription('New tag content').setRequired(true)))
                .addSubcommand(sc => sc.setName('list').setDescription('List all your tags'))
        );
    }

    async autocompleteRun(interaction) {
        const focused = interaction.options.getFocused(true);
        if (focused.name === 'tag') {
            const results = await db.searchTags(focused.value);
            return interaction.respond(results.map(r => ({ name: r.name, value: r.name })));
        }
    }

    async chatInputRun(interaction) {
        try {
            await interaction.deferReply();
        } catch (err) {
            return;
        }

        const sub = interaction.options.getSubcommand();
        const authorName = interaction.user.username;

        try {
            switch (sub) {
                case 'create': {
                    const name = interaction.options.getString('tag').toLowerCase();
                    const content = interaction.options.getString('text');

                    const existing = await db.getTag(name);
                    if (existing) throw new Error(`Tag \`${name}\` already exists.`);

                    await db.createTag(interaction.user.id, name, content);
                    return interaction.editReply({ content: `<:fxcheckwithbox:1487148430563475466> Successfully created tag **${name}**.` });
                }

                case 'send': {
                    const name = interaction.options.getString('tag').toLowerCase();
                    const tag = await db.getTag(name);
                    if (!tag) throw new Error(`Tag \`${name}\` not found.`);

                    // Tags send the raw content
                    return interaction.editReply({ content: tag.content });
                }

                case 'edit': {
                    const name = interaction.options.getString('tag').toLowerCase();
                    const content = interaction.options.getString('text');

                    const tag = await db.getTag(name);
                    if (!tag) throw new Error(`Tag \`${name}\` not found.`);
                    if (tag.owner_id !== interaction.user.id) throw new Error('You do not own this tag.');

                    await db.updateTag(name, content);
                    return interaction.editReply({ content: `<:fxcheckwithbox:1487148430563475466> Successfully updated tag **${name}**.` });
                }

                case 'delete': {
                    const name = interaction.options.getString('tag').toLowerCase();
                    const tag = await db.getTag(name);
                    if (!tag) throw new Error(`Tag \`${name}\` not found.`);
                    if (tag.owner_id !== interaction.user.id) throw new Error('You do not own this tag.');

                    await db.deleteTag(name);
                    return interaction.editReply({ content: `<:fxcheckwithbox:1487148430563475466> Successfully deleted tag **${name}**.` });
                }

                case 'list': {
                    const tags = await db.listTags(interaction.user.id);
                    if (tags.length === 0) throw new Error('You haven\'t created any tags yet.');

                    const formatted = tags.map(t => `**${t.name}** - ${t.content.substring(0, 50)}${t.content.length > 50 ? '...' : ''}`);
                    
                    const baseData = {
                        username: authorName,
                        title: 'Your Tags',
                        content: `You have created **${tags.length}** tags.`
                    };

                    return paginate(interaction, formatted, templates.utilityResult, baseData, { itemsPerPage: 10 });
                }
            }
        } catch (err) {
            if (!interaction.deferred && !interaction.replied) return;
            return interaction.editReply(templates.error({
                message: err.message || 'An error occurred while managing tags.'
            }));
        }
    }
}

module.exports = { TagsCommand };
