const { Command } = require('@sapphire/framework');
const { ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { templates } = require('../utils/templates');
const { logger } = require('../index');

/**
 * Utility for fetching with retries and timeout handling
 */
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), options.timeout || 10000);
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return res;
        } catch (err) {
            if (i === retries - 1) throw err;
            logger.warn(`Fetch failed (${url}), retrying ${i + 1}/${retries}...`);
            await new Promise(resolve => setTimeout(resolve, backoff * (i + 1)));
        }
    }
}

class SteamCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'steam', description: 'Steam information commands' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('steam')
                .setDescription('Steam information commands')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('profile').setDescription("View a Steam user's statistics").addStringOption(o => o.setName('target').setDescription('The Steam ID or vanity URL').setRequired(true)))
                .addSubcommand(sc => sc.setName('inventory').setDescription("View a user's public Steam inventory").addStringOption(o => o.setName('target').setDescription('The Steam ID or vanity URL').setRequired(true)))
                .addSubcommand(sc => sc.setName('bans').setDescription('Check for VAC or game bans on an account').addStringOption(o => o.setName('target').setDescription('The Steam ID or vanity URL').setRequired(true)))
                .addSubcommand(sc => sc.setName('playing').setDescription('See what a user is currently playing').addStringOption(o => o.setName('target').setDescription('The Steam ID or vanity URL').setRequired(true)))
                .addSubcommand(sc => sc.setName('game').setDescription('View steam game information').addStringOption(o => o.setName('name').setDescription('The name of the game').setRequired(true)))
        );
    }

    async chatInputRun(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
        } catch (err) {
            logger.error(`Failed to defer interaction: ${err.message}`);
            return;
        }

        const sub = interaction.options.getSubcommand();
        const authorName = interaction.user.username;
        const target = interaction.options.getString('target') || interaction.options.getString('name');

        try {
            const fetchSteamXML = async (val) => {
                const url = isNaN(val) || val.length < 16
                    ? `https://steamcommunity.com/id/${val}/?xml=1` 
                    : `https://steamcommunity.com/profiles/${val}/?xml=1`;
                
                const res = await fetchWithRetry(url);
                if (!res.ok) throw new Error('Could not find that Steam profile.');
                const text = await res.text();
                
                const getValue = (key) => {
                    const match = text.match(new RegExp(`<${key}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${key}>`, 's'));
                    return match ? match[1].trim() : null;
                };

                const steamID64 = getValue('steamID64');
                if (!steamID64) throw new Error('Failed to retrieve Steam user data.');

                return {
                    steamID64,
                    steamID: getValue('steamID') || 'Unknown User',
                    stateMessage: getValue('stateMessage') || 'Offline',
                    privacyState: getValue('privacyState') || 'private',
                    onlineState: getValue('onlineState') || 'offline',
                    avatarFull: getValue('avatarFull') || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
                    customURL: getValue('customURL'),
                    vacBanned: getValue('vacBanned') || '0',
                    tradeBanState: getValue('tradeBanState') || 'None',
                    isLimitedAccount: getValue('isLimitedAccount') || '0',
                    memberSince: getValue('memberSince'),
                    location: getValue('location'),
                    summary: getValue('summary'),
                    inGameInfo: {
                        gameName: getValue('gameName'),
                        gameLink: getValue('gameLink'),
                        gameIcon: getValue('gameIcon')
                    }
                };
            };

            switch (sub) {
                case 'profile': {
                    const data = await fetchSteamXML(target);
                    const content = `**User:** [${data.steamID}](https://steamcommunity.com/profiles/${data.steamID64})\n` +
                        `**Status:** ${data.stateMessage.replace(/<br\/>/g, ' ')}\n` +
                        `**ID64:** \`${data.steamID64}\`\n` +
                        `**Joined:** ${data.memberSince || 'Hidden'}\n` +
                        `<:fxlocation:1487149730600325181> **Location:** ${data.location || 'Unknown'}\n\n` +
                        `**Privacy:** ${data.privacyState === 'public' ? '✅ Public' : '❌ Private'}\n` +
                        `**Summary:**\n${data.summary ? data.summary.replace(/<br\/>/g, '\n').substring(0, 300) + '...' : 'No summary provided.'}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `<:fxsteam:1487149341637476382> Steam Profile`,
                        content,
                        media: data.avatarFull,
                        footer: `Custom URL: ${data.customURL || 'None'}`
                    }));
                }

                case 'inventory': {
                    const data = await fetchSteamXML(target);
                    if (data.privacyState !== 'public') throw new Error('This profile is private.');

                    const content = `**User:** ${data.steamID}\n` +
                        `**Status:** Public\n\n` +
                        `**Quick Links:**\n` +
                        `* [Counter-Strike 2](https://steamcommunity.com/profiles/${data.steamID64}/inventory/#730)\n` +
                        `* [Team Fortress 2](https://steamcommunity.com/profiles/${data.steamID64}/inventory/#440)\n` +
                        `* [Dota 2](https://steamcommunity.com/profiles/${data.steamID64}/inventory/#570)\n` +
                        `* [Steam Items](https://steamcommunity.com/profiles/${data.steamID64}/inventory/#753)`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `<:fxsteam:1487149341637476382> Steam Inventory`,
                        content,
                        media: data.avatarFull
                    }));
                }

                case 'bans': {
                    const data = await fetchSteamXML(target);
                    const vacStatus = data.vacBanned === '0' ? '✅ None' : '❌ **BANNED**';
                    const tradeStatus = data.tradeBanState === 'None' ? '✅ None' : `❌ **${data.tradeBanState}**`;

                    const content = `**User:** ${data.steamID} (\`${data.steamID64}\`)\n\n` +
                        `**VAC Bans:** ${vacStatus}\n` +
                        `**Trade Ban:** ${tradeStatus}\n` +
                        `**Limited Account:** ${data.isLimitedAccount === '0' ? 'No' : 'Yes'}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `<:fxsteam:1487149341637476382> Steam Ban Check`,
                        content,
                        media: data.avatarFull
                    }));
                }

                case 'playing': {
                    const data = await fetchSteamXML(target);
                    let content = `**User:** ${data.steamID}\n`;
                    let media = data.avatarFull;

                    if (data.inGameInfo && data.inGameInfo.gameName) {
                        content += `**Currently Playing:** [${data.inGameInfo.gameName}](${data.inGameInfo.gameLink})\n` +
                            `**Status:** ${data.stateMessage.replace(/<br\/>/g, ' ')}`;
                        media = data.inGameInfo.gameIcon || data.avatarFull;
                    } else {
                        content += `**Currently Playing:** *Nothing*\n` +
                            `**Status:** ${data.stateMessage.replace(/<br\/>/g, ' ')}`;
                    }

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `<:fxsteam:1487149341637476382> Steam Playing Info`,
                        content,
                        media
                    }));
                }

                case 'game': {
                    const searchRes = await fetchWithRetry(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(target)}&l=en&cc=us`);
                    const searchData = await searchRes.json();
                    if (!searchData.total) throw new Error(`Could not find a game named \`${target}\`.`);
                    
                    const appid = searchData.items[0].id;
                    const detailRes = await fetchWithRetry(`https://store.steampowered.com/api/appdetails?appids=${appid}`);
                    const detailData = await detailRes.json();
                    const data = detailData[appid].data;

                    if (!data) throw new Error('Failed to retrieve game details.');

                    const content = `**Game:** [${data.name}](https://store.steampowered.com/app/${appid})\n` +
                        `**Price:** ${data.is_free ? 'Free' : (data.price_overview ? data.price_overview.final_formatted : 'Unknown')}\n` +
                        `**Developers:** ${data.developers ? data.developers.join(', ') : 'Unknown'}\n\n` +
                        `**About:**\n${data.short_description ? data.short_description.substring(0, 300) + '...' : 'No description.'}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `<:fxsteam:1487149341637476382> Steam Game Info`,
                        content,
                        media: data.header_image,
                        footer: `AppID: ${appid}`
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

module.exports = { SteamCommand, fetchWithRetry };
