const { 
    ApplicationIntegrationType, 
    InteractionContextType 
}                               = require('discord.js');
const { Command }               = require('@sapphire/framework');
const { templates }             = require('../utils/templates');
const { logger }                = require('../index');

class SocialCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'social', description: 'Social media and profile commands' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('social')
                .setDescription('Social media and profile commands')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('github').setDescription('View GitHub profile and statistics').addStringOption(o => o.setName('username').setDescription('GitHub username').setRequired(true)))
                .addSubcommand(sc => sc.setName('mc-skin').setDescription("View a Minecraft player's skin and UUID").addStringOption(o => o.setName('username').setDescription('Minecraft username').setRequired(true)))
                .addSubcommand(sc => sc.setName('roblox-group').setDescription('View statistics of a Roblox group').addStringOption(o => o.setName('group_id').setDescription('Roblox Group ID').setRequired(true)))
                .addSubcommand(sc => sc.setName('namecheck').setDescription('Check availability of a username across platforms').addStringOption(o => o.setName('username').setDescription('Username to check').setRequired(true)))
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
                case 'github': {
                    const username = interaction.options.getString('username');
                    const res = await fetch(`https://api.github.com/users/${username}`);
                    if (!res.ok) throw new Error('GitHub user not found.');
                    const data = await res.json();

                    return await interaction.editReply(templates.github({
                        ...data,
                        media: `https://ghchart.rshah.org/${data.login}`
                    }));
                }

                case 'mc-skin': {
                    const username = interaction.options.getString('username');
                    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
                    if (!res.ok) throw new Error('Minecraft player not found.');
                    const data = await res.json();
                    
                    const uuid = data.id;
                    const skinUrl = `https://visage.surgeplay.com/full/512/${uuid}.png`;
                    const headUrl = `https://visage.surgeplay.com/face/128/${uuid}.png`;

                    const content = `**Player:** \`${data.name}\`\n` +
                        `**UUID:** \`${uuid}\`\n` +
                        `**History:** [NameMC](https://namemc.com/profile/${data.name})`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `<:fxminecraft:1486095510434480208> Minecraft Skin`,
                        content,
                        media: skinUrl,
                        footer: `UUID: ${uuid}`
                    }));
                }

                case 'roblox-group': {
                    const groupId = interaction.options.getString('group_id');
                    const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}`);
                    if (!res.ok) throw new Error('Roblox group not found.');
                    const data = await res.json();

                    const iconRes = await fetch(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupId}&size=150x150&format=Png&isCircular=false`);
                    const iconData = await iconRes.json();
                    const iconUrl = iconData.data?.[0]?.imageUrl;

                    const content = `**Name:** [${data.name}](https://www.roblox.com/groups/${data.id})\n` +
                        `**Owner:** ${data.owner ? `[${data.owner.username}](https://www.roblox.com/users/${data.owner.userId}/profile)` : 'None'}\n` +
                        `**Members:** **${data.memberCount.toLocaleString()}**\n\n` +
                        `**Description:**\n${data.description.length > 500 ? data.description.substring(0, 500) + '...' : data.description || 'No description.'}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `<:fxroblox:1487149343508267118> Roblox Group`,
                        content,
                        media: iconUrl,
                        footer: `Group ID: ${data.id}`
                    }));
                }

                case 'namecheck': {
                    const username = interaction.options.getString('username');
                    const platforms = [
                        { name: 'GitHub', url: `https://api.github.com/users/${username}`, check: (r) => r.status === 404 },
                        { name: 'Instagram', url: `https://www.instagram.com/${username}/`, check: (r) => r.status === 404 },
                        { name: 'Twitter', url: `https://twitter.com/${username}`, check: (r) => r.status === 404 },
                        { name: 'Reddit', url: `https://www.reddit.com/user/${username}/`, check: (r) => r.status === 404 },
                        { name: 'Twitch', url: `https://www.twitch.tv/${username}`, check: (r) => r.status === 404 },
                        { name: 'YouTube', url: `https://www.youtube.com/@${username}`, check: (r) => r.status === 404 },
                        { name: 'Steam', url: `https://steamcommunity.com/id/${username}/`, check: (r) => r.status === 404 },
                        { name: 'Minecraft', url: `https://api.mojang.com/users/profiles/minecraft/${username}`, check: (r) => r.status === 204 || r.status === 404 },
                    ];

                    let results = [];
                    for (const platform of platforms) {
                        try {
                            const r = await fetch(platform.url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
                            const available = platform.check(r);
                            results.push(`${available ? '✅' : '❌'} **${platform.name}**: ${available ? 'Available' : 'Taken'}`);
                        } catch (e) {
                            results.push(`⚠️ **${platform.name}**: Error`);
                        }
                    }

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `Username Availability: ${username}`,
                        content: results.join('\n'),
                        footer: 'Note: Some platforms may return false positives due to rate limiting or restricted names.'
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

module.exports = { SocialCommand };
