const { Command } = require('@sapphire/framework');
const { ApplicationIntegrationType, InteractionContextType, PermissionFlagsBits } = require('discord.js');
const { templates } = require('../utils/templates');
const { logger } = require('../index');

class StaffCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'staff', description: 'Server administration and moderation commands' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('staff')
                .setDescription('Server administration and moderation commands')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
                .setContexts([InteractionContextType.Guild])
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
                
                .addSubcommand(sc => 
                    sc.setName('purge')
                        .setDescription('Purge messages with advanced filters')
                        .addIntegerOption(o => o.setName('amount').setDescription('Number of messages to scan (up to 100)').setMinValue(1).setMaxValue(100))
                        .addStringOption(o => o.setName('from').setDescription('Start purging from this message ID'))
                        .addStringOption(o => o.setName('to').setDescription('Stop purging at this message ID'))
                        .addUserOption(o => o.setName('user').setDescription('Filter by user'))
                        .addStringOption(o => o.setName('content').setDescription('Filter by content keywords'))
                        .addStringOption(o => o.setName('type').setDescription('Filter by type').addChoices(
                            { name: 'All', value: 'all' },
                            { name: 'Messages Only', value: 'msg' },
                            { name: 'Images/Attachments', value: 'img' },
                            { name: 'Reactions Only (LATER)', value: 'reactions' }
                        ))
                )
                .addSubcommand(sc =>
                    sc.setName('embed')
                        .setDescription('Send a fully customized embed')
                        .addStringOption(o => o.setName('title').setDescription('Embed title'))
                        .addStringOption(o => o.setName('description').setDescription('Embed description (supports \\n)'))
                        .addStringOption(o => o.setName('color').setDescription('Hex color (e.g. #ff0000)'))
                        .addStringOption(o => o.setName('image').setDescription('Image URL'))
                        .addStringOption(o => o.setName('thumbnail').setDescription('Thumbnail URL'))
                        .addStringOption(o => o.setName('footer').setDescription('Footer text'))
                        .addStringOption(o => o.setName('author').setDescription('Author text'))
                        .addChannelOption(o => o.setName('channel').setDescription('Channel to send in'))
                )
                .addSubcommand(sc => sc.setName('role').setDescription('Manage roles for a user').addUserOption(o => o.setName('target').setDescription('The user').setRequired(true)).addRoleOption(o => o.setName('role').setDescription('The role').setRequired(true)))
                .addSubcommand(sc =>
                    sc.setName('timeout')
                        .setDescription('Timeout a user')
                        .addUserOption(o => o.setName('target').setDescription('The user').setRequired(true))
                        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true).addChoices(
                            { name: '1 Minute', value: 1 },
                            { name: '5 Minutes', value: 5 },
                            { name: '10 Minutes', value: 10 },
                            { name: '1 Hour', value: 60 },
                            { name: '1 Day', value: 1440 },
                            { name: '1 Week', value: 10080 }
                        ))
                        .addStringOption(o => o.setName('reason').setDescription('Reason for timeout'))
                )
                .addSubcommand(sc => sc.setName('ban').setDescription('Ban a user').addUserOption(o => o.setName('target').setDescription('The user to ban').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason for ban')))
                .addSubcommand(sc => sc.setName('kick').setDescription('Kick a user').addUserOption(o => o.setName('target').setDescription('The user to kick').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason for kick')))
        );
    }

    async chatInputRun(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
        } catch (err) {
            logger.error(`Failed to defer interaction: ${err.message}`);
            return;
        }

        const sub = interaction.options.getSubcommand();
        const authorName = interaction.user.username;

        try {
            switch (sub) {
                case 'purge': {
                    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) throw new Error('Missing Permissions: Manage Messages');
                    
                    const amount = interaction.options.getInteger('amount') || 100;
                    const fromId = interaction.options.getString('from');
                    const toId = interaction.options.getString('to');
                    const filterUser = interaction.options.getUser('user');
                    const filterContent = interaction.options.getString('content');
                    const filterType = interaction.options.getString('type') || 'all';

                    let messages = [];
                    
                    if (fromId || toId) {
                        // Fetch messages in range
                        // Simplification: fetch around and filter. 
                        // Real implementation would need pagination for large ranges.
                        // We will fetch up to 100 for now.
                        messages = await interaction.channel.messages.fetch({ limit: 100 });
                        if (fromId) {
                            const index = messages.findIndex(m => m.id === fromId);
                            if (index !== -1) messages = messages.first(index + 1);
                        }
                        if (toId) {
                            const index = messages.findIndex(m => m.id === toId);
                            if (index !== -1) messages = messages.filter((m, id) => id >= toId);
                        }
                    } else {
                        messages = await interaction.channel.messages.fetch({ limit: amount });
                    }

                    // Apply filters
                    let toDelete = messages.filter(m => {
                        if (m.id === interaction.id) return false;
                        if (filterUser && m.author.id !== filterUser.id) return false;
                        if (filterContent && !m.content.toLowerCase().includes(filterContent.toLowerCase())) return false;
                        if (filterType === 'msg' && (m.attachments.size > 0 || m.embeds.length > 0)) return false;
                        if (filterType === 'img' && m.attachments.size === 0) return false;
                        return true;
                    });

                    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
                    const youngMessages = toDelete.filter(m => m.createdTimestamp > twoWeeksAgo);
                    const oldMessages = toDelete.filter(m => m.createdTimestamp <= twoWeeksAgo);

                    let deletedCount = 0;
                    if (youngMessages.size > 0) {
                        const bulk = await interaction.channel.bulkDelete(youngMessages, true);
                        deletedCount += bulk.size;
                    }
                    
                    // Manual delete for old messages or if bulk fails/skips
                    const remaining = toDelete.filter(m => !youngMessages.has(m.id) || !youngMessages.find(ym => ym.id === m.id));
                    // bulkDelete with 'true' skips old ones.
                    
                    for (const m of oldMessages.values()) {
                        try {
                            await m.delete();
                            deletedCount++;
                        } catch (e) {
                            logger.error(`Failed to delete old message ${m.id}: ${e.message}`);
                        }
                    }

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Messages Purged',
                        content: `<:fxreport:1486878917687250954> Successfully deleted **${deletedCount}** messages.`
                    }));
                }

                case 'embed': {
                    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) throw new Error('Missing Permissions: Manage Messages');
                    
                    const title = interaction.options.getString('title');
                    const description = interaction.options.getString('description');
                    const color = interaction.options.getString('color');
                    const image = interaction.options.getString('image');
                    const thumbnail = interaction.options.getString('thumbnail');
                    const footer = interaction.options.getString('footer');
                    const author = interaction.options.getString('author');
                    const channel = interaction.options.getChannel('channel') || interaction.channel;

                    const { EmbedBuilder } = require('discord.js');
                    const embed = new EmbedBuilder();

                    if (title) embed.setTitle(title);
                    if (description) embed.setDescription(description.replace(/\\n/g, '\n'));
                    if (color) embed.setColor(color.startsWith('#') ? color : `#${color}`);
                    if (image) embed.setImage(image);
                    if (thumbnail) embed.setThumbnail(thumbnail);
                    if (footer) embed.setFooter({ text: footer });
                    if (author) embed.setAuthor({ name: author });

                    await channel.send({ embeds: [embed] });
                    return await interaction.editReply({ content: `Embed sent to ${channel}.`, ephemeral: true });
                }

                case 'role': {
                    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error('Missing Permissions: Manage Roles');
                    const target = interaction.options.getMember('target');
                    const role = interaction.options.getRole('role');

                    if (target.roles.cache.has(role.id)) {
                        await target.roles.remove(role);
                        return await interaction.editReply(templates.utilityResult({
                            authorName,
                            title: 'Role Removed',
                            content: `<:fxrole:1486875884110483497> Removed role ${role} from ${target}.`
                        }));
                    } else {
                        await target.roles.add(role);
                        return await interaction.editReply(templates.utilityResult({
                            authorName,
                            title: 'Role Added',
                            content: `<:fxrole:1486875884110483497> Added role ${role} to ${target}.`
                        }));
                    }
                }

                case 'timeout': {
                    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) throw new Error('Missing Permissions: Moderate Members');
                    const target = interaction.options.getMember('target');
                    const duration = interaction.options.getInteger('duration');
                    const reason = interaction.options.getString('reason') || 'No reason provided';

                    await target.timeout(duration * 60 * 1000, reason);
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'User Timed Out',
                        content: `<:fxreport:1486878917687250954> **Target:** ${target}\n` +
                            `<:fxcalendar:1486875894118219907> **Duration:** ${duration} minutes\n` +
                            `<:fxnote:1486875868495089744> **Reason:** ${reason}`
                    }));
                }

                case 'ban': {
                    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) throw new Error('Missing Permissions: Ban Members');
                    const target = interaction.options.getUser('target');
                    const reason = interaction.options.getString('reason') || 'No reason provided';

                    await interaction.guild.members.ban(target, { reason });
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'User Banned',
                        content: `<:fxreport:1486878917687250954> **Target:** ${target.tag}\n` +
                            `<:fxnote:1486875868495089744> **Reason:** ${reason}`
                    }));
                }

                case 'kick': {
                    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) throw new Error('Missing Permissions: Kick Members');
                    const target = interaction.options.getMember('target');
                    const reason = interaction.options.getString('reason') || 'No reason provided';

                    await target.kick(reason);
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'User Kicked',
                        content: `<:fxreport:1486878917687250954> **Target:** ${target}\n` +
                            `<:fxnote:1486875868495089744> **Reason:** ${reason}`
                    }));
                }
            }
        } catch (err) {
            if (!interaction.deferred && !interaction.replied) return;
            return interaction.editReply(templates.error({
                message: err.message || 'An error occurred while executing the moderation command.'
            }));
        }
    }
}

module.exports = { StaffCommand };
