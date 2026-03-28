const { Command } = require('@sapphire/framework');
const { ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { templates } = require('../utils/templates');
const { logger } = require('../index');

class ConvertCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'convert', description: 'Conversion and lookup commands' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('convert')
                .setDescription('Conversion and lookup commands')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])

                .addSubcommand(sc => sc.setName('discord2user').setDescription('Get Discord User info from an ID').addStringOption(o => o.setName('id').setDescription('The Discord User ID').setRequired(true)))
                .addSubcommand(sc => sc.setName('discord2id').setDescription('Get Discord User ID from a username (must be in the same server)').addStringOption(o => o.setName('username').setDescription('The Discord username').setRequired(true)))
                .addSubcommand(sc => sc.setName('roblox2user').setDescription('Get Roblox User info from an ID').addStringOption(o => o.setName('id').setDescription('The Roblox User ID').setRequired(true)))
                .addSubcommand(sc => sc.setName('roblox2id').setDescription('Get Roblox User ID from a username').addStringOption(o => o.setName('username').setDescription('The Roblox username').setRequired(true)))
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
                case 'discord2user': {
                    const userId = interaction.options.getString('id');
                    const user = await this.container.client.users.fetch(userId).catch(() => null);
                    if (!user) throw new Error('User not found. Ensure the ID is correct.');

                    const content = `**User:** ${user} (\`${user.tag}\`)\n` +
                        `**ID:** \`${user.id}\`\n` +
                        `**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R> (<t:${Math.floor(user.createdTimestamp / 1000)}:F>)\n` +
                        `**Bot:** ${user.bot ? 'Yes' : 'No'}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Discord User Lookup',
                        content,
                        thumbnail: user.displayAvatarURL({ dynamic: true, size: 512 })
                    }));
                }

                case 'discord2id': {
                    const username = interaction.options.getString('username').toLowerCase();
                    
                    let member;
                    if (interaction.guild) {
                        const members = await interaction.guild.members.fetch({ query: username, limit: 1 }).catch(() => null);
                        member = members ? members.first() : null;
                    }

                    if (!member) {
                        member = this.container.client.users.cache.find(u => u.username.toLowerCase() === username || u.tag.toLowerCase() === username);
                    }

                    if (!member) {
                        throw new Error('User not found. Try providing their full Discord username or ensuring they are in this server.');
                    }

                    const user = member.user || member;
                    const content = `<:fxmention:1487147064302502019> **User:** ${user} (\`${user.tag}\`)\n` +
                        `<:fxid:1486875838858264636> **ID:** \`${user.id}\``;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Discord ID Lookup',
                        content,
                        thumbnail: user.displayAvatarURL({ dynamic: true, size: 512 })
                    }));
                }

                case 'roblox2user': {
                    const userId = interaction.options.getString('id');
                    const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
                    if (!res.ok) throw new Error('Roblox user not found.');
                    const data = await res.json();

                    const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
                    const thumbData = await thumbRes.json();
                    const avatarUrl = thumbData.data?.[0]?.imageUrl;

                    const content = `**Username:** [${data.name}](https://www.roblox.com/users/${data.id}/profile)\n` +
                        `**Display Name:** ${data.displayName}\n` +
                        `**ID:** \`${data.id}\`\n` +
                        `**Description:** ${data.description ? `\n\`\`\`\n${data.description.substring(0, 300)}${data.description.length > 300 ? '...' : ''}\n\`\`\`` : '*No description*'}\n` +
                        `**Joined:** ${new Date(data.created).toLocaleDateString()}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Roblox User Lookup',
                        content,
                        thumbnail: avatarUrl,
                        footer: data.isBanned ? '⚠️ This user is currently banned.' : null
                    }));
                }

                case 'roblox2id': {
                    const username = interaction.options.getString('username');
                    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
                    });
                    const data = await res.json();
                    const user = data.data?.[0];

                    if (!user) throw new Error(`Could not find a Roblox user named \`${username}\`.`);

                    const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${user.id}&size=420x420&format=Png&isCircular=false`);
                    const thumbData = await thumbRes.json();
                    const avatarUrl = thumbData.data?.[0]?.imageUrl;

                    const content = `**Username:** [${user.name}](https://www.roblox.com/users/${user.id}/profile)\n` +
                        `**Display Name:** ${user.displayName}\n` +
                        `**ID:** \`${user.id}\``;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Roblox ID Lookup',
                        content,
                        thumbnail: avatarUrl
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

module.exports = { ConvertCommand };
