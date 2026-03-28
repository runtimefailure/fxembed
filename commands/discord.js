const { Command } = require('@sapphire/framework');
const { ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { templates } = require('../utils/templates');
const { logger } = require('../index');

class DiscordCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'discord', description: 'Discord information commands' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('discord')
                .setDescription('Discord information commands')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('user').setDescription("View a Discord user's profile").addStringOption(o => o.setName('target').setDescription('The user mention or ID').setRequired(false)))
                .addSubcommand(sc => sc.setName('avatar').setDescription("View a Discord user's avatar").addStringOption(o => o.setName('target').setDescription('The user mention or ID').setRequired(false)))
                .addSubcommand(sc => sc.setName('banner').setDescription("View a Discord user's banner").addStringOption(o => o.setName('target').setDescription('The user mention or ID').setRequired(false)))
                .addSubcommand(sc => sc.setName('dsa').setDescription('View Discord DSA violations for a user').addStringOption(o => o.setName('target').setDescription('The user mention or ID').setRequired(false)))
                .addSubcommand(sc => sc.setName('server').setDescription('View Discord Server information').addStringOption(o => o.setName('target').setDescription('The server ID or Invite link').setRequired(false)))
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
        const input = interaction.options.getString('target');

        try {
            const resolveUser = async (val) => {
                if (!val) return interaction.user;
                const id = val.replace(/[<@!>]/g, '');
                return await this.container.client.users.fetch(id).catch(() => null);
            };

            switch (sub) {
                case 'user': {
                    const user = await resolveUser(input);
                    if (!user) throw new Error('Could not find that user.');
                    const member = interaction.guild ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;

                    let content = `<:fxrole:1486875884110483497> **User:** ${user} (\`${user.tag}\`)\n` +
                        `<:fxid:1486875838858264636> **ID:** \`${user.id}\`\n` +
                        `<:fxcalendar:1486875894118219907> **Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R> (<t:${Math.floor(user.createdTimestamp / 1000)}:F>)\n`;

                    if (member) {
                        content += `<:fxcalendar:1486875894118219907> **Joined Server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n` +
                            `<:fxmembers:1486875899264634971> **Roles:** ${member.roles.cache.size - 1}\n` +
                            `<:fxtop:1486878434188726292> **Highest Role:** ${member.roles.highest}`;
                    }

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Discord User Profile',
                        content,
                        thumbnail: user.displayAvatarURL({ dynamic: true, size: 512 })
                    }));
                }

                case 'avatar': {
                    const user = await resolveUser(input);
                    if (!user) throw new Error('Could not find that user.');

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `${user.username}'s Avatar`,
                        content: `<:fxupload:1486875837218422944> [Download Avatar](${user.displayAvatarURL({ dynamic: true, size: 4096 })})`,
                        media: user.displayAvatarURL({ dynamic: true, size: 1024 })
                    }));
                }

                case 'banner': {
                    const user = await resolveUser(input);
                    if (!user) throw new Error('Could not find that user.');
                    const fullUser = await this.container.client.users.fetch(user.id, { force: true });
                    
                    if (!fullUser.bannerURL()) {
                        throw new Error(`${user.username} does not have a profile banner.`);
                    }

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `${user.username}'s Banner`,
                        content: `<:fxupload:1486875837218422944> [Download Banner](${fullUser.bannerURL({ dynamic: true, size: 4096 })})`,
                        media: fullUser.bannerURL({ dynamic: true, size: 1024 })
                    }));
                }

                case 'dsa': {
                    const user = await resolveUser(input);
                    if (!user) throw new Error('Could not find that user.');
                    
                    const res = await fetch(`https://dsa.discord.food/api/search?sort=createdAt&order=desc&parsedId=${user.id}&includeTotalCount=true`, {
                        headers: {
                            'accept': '*/*',
                            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
                        }
                    });

                    if (!res.ok) throw new Error('Failed to fetch DSA data.');
                    const data = await res.json();
                    
                    let content = `<:fxrole:1486875884110483497> **User:** ${user.tag} (\`${user.id}\`)\n\n`;
                    
                    if (!data.actions || data.pagination.total === 0) {
                        content += `<:fxreport:1486878917687250954> **Status:** ✅ **Clear**\n` +
                            `No Digital Services Act (DSA) violations found for this account.\n\n` +
                            `-# This user is currently compliant with the Discord Terms of Service.`;
                    } else {
                        content += `<:fxreport:1486878917687250954> **Status:** ⚠️ **Violations Found (${data.pagination.total})**\n\n`;
                        
                        const visibleActions = data.actions.slice(0, 5);
                        visibleActions.forEach((action, i) => {
                            const date = new Date(action.createdAt).toLocaleDateString('en-GB');
                            const ground = action.incompatibleContentGround || 'No specific ground provided';
                            const category = action.category.replace('STATEMENT_CATEGORY_', '').replace(/_/g, ' ').toLowerCase();
                            
                            content += `**${i + 1}.** \`${date}\` — ${ground}\n`;
                            content += `-# Category: ${category} | Type: ${action.type}\n\n`;
                        });
                        
                        if (data.pagination.total > 5) {
                            content += `-# ... and ${data.pagination.total - 5} more violations.`;
                        }
                    }

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Discord Safety & DSA Audit',
                        content,
                        footer: 'Data provided by dsa.discord.food Transparency API',
                        media: user.displayAvatarURL({ dynamic: true, size: 512 })
                    }));
                }

                case 'server': {
                    let guild = interaction.guild;
                    let fromInvite = false;
                    let inviteData = null;

                    if (input) {
                        const inviteMatch = input.match(/(discord\.gg\/|discord\.com\/invite\/)([a-zA-Z0-9-]+)/);
                        if (inviteMatch) {
                            const code = inviteMatch[2];
                            inviteData = await this.container.client.fetchInvite(code).catch(() => null);
                            if (!inviteData) throw new Error('Invalid or expired invite link.');
                            fromInvite = true;
                        } else {
                            const fetchedGuild = await this.container.client.guilds.fetch(input).catch(() => null);
                            if (fetchedGuild) guild = fetchedGuild;
                            else throw new Error('Could not find a server with that ID that the bot is in.');
                        }
                    }

                    if (fromInvite && inviteData) {
                        const g = inviteData.guild;
                        const content = `<:fxnote:1486875868495089744> **Name:** ${g.name}\n` +
                            `<:fxid:1486875838858264636> **ID:** \`${g.id}\`\n` +
                            `<:fxlink:1486095510434480208> **Invite Code:** \`${inviteData.code}\`\n` +
                            `<:fxlink:1486095510434480208> **Vanity:** ${g.vanityURLCode || 'None'}\n\n` +
                            `**Stats (via Invite):**\n` +
                            `<:fxmembers:1486875899264634971> * Members: **${inviteData.memberCount.toLocaleString()}**\n` +
                            `<:fxrole:1486875884110483497> * Online: **${inviteData.presenceCount.toLocaleString()}**\n` +
                            `<:fxshield:1486875870936301599> * Verification: **${g.verificationLevel}**`;

                        return await interaction.editReply(templates.utilityResult({
                            authorName,
                            title: 'Server Information (Public)',
                            content,
                            thumbnail: g.iconURL({ dynamic: true, size: 512 })
                        }));
                    }

                    if (!guild) throw new Error('Please provide a server ID or use this in a server.');
                    
                    const owner = await guild.fetchOwner().catch(() => ({ user: { tag: 'Unknown' } }));
                    const content = `<:fxnote:1486875868495089744> **Name:** ${guild.name}\n` +
                        `<:fxid:1486875838858264636> **ID:** \`${guild.id}\`\n` +
                        `<:fxowner:1486879424275021845> **Owner:** \`${owner.user.tag}\`\n` +
                        `<:fxcalendar:1486875894118219907> **Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>\n\n` +
                        `**Stats:**\n` +
                        `<:fxmembers:1486875899264634971> * Members: **${guild.memberCount.toLocaleString()}**\n` +
                        `<:fxnitro:1486875897201168464> * Boosts: **${guild.premiumSubscriptionCount || 0}** (Level ${guild.premiumTier})\n` +
                        `<:fxshield:1486875870936301599> * Verification: **${guild.verificationLevel}**\n` +
                        `<:fxchannel:1486875880465764465> * Channels: **${guild.channels.cache.size}**\n` +
                        `<:fxrole:1486875884110483497> * Roles: **${guild.roles.cache.size}**`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Server Information',
                        content,
                        thumbnail: guild.iconURL({ dynamic: true, size: 512 })
                    }));
                }
            }
        } catch (err) {
            if (!interaction.deferred && !interaction.replied) return;
            return interaction.editReply(templates.error({
                message: err.message || 'An error occurred while executing the command.'
            }));
        }
    }
}

module.exports = { DiscordCommand };
