const { Command } = require('@sapphire/framework');
const { ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { templates, EMOJIS } = require('../utils/templates');
const { logger } = require('../index');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

class RobloxCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'roblox', description: 'Roblox information and tools' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('roblox')
                .setDescription('Roblox information and tools')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('avatar').setDescription("View a Roblox user's current avatar").addStringOption(o => o.setName('username').setDescription('Roblox username').setRequired(true).setAutocomplete(true)))
                .addSubcommand(sc => sc.setName('blendavatars').setDescription('Blend two Roblox avatars headshots side by side').addStringOption(o => o.setName('user1').setDescription('First Roblox username').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('user2').setDescription('Second Roblox username').setRequired(true).setAutocomplete(true)))
                .addSubcommand(sc => sc.setName('britcheck').setDescription('Check if a Roblox user is British').addStringOption(o => o.setName('username').setDescription('Roblox username').setRequired(true).setAutocomplete(true)))
                .addSubcommand(sc => sc.setName('calctax').setDescription('Calculate Robux taxes (30%)').addIntegerOption(o => o.setName('amount').setDescription('Amount of Robux').setRequired(true)))
                .addSubcommand(sc => sc.setName('devex').setDescription('Calculate the USD value from Developer Exchange').addIntegerOption(o => o.setName('robux').setDescription('Amount of Robux').setRequired(true)))
                .addSubcommand(sc => sc.setName('followers').setDescription("View a Roblox user's followers").addStringOption(o => o.setName('username').setDescription('Roblox username').setRequired(true).setAutocomplete(true)))
                .addSubcommand(sc => sc.setName('recentbadges').setDescription("View a Roblox user's recent earned badges").addStringOption(o => o.setName('username').setDescription('Roblox username').setRequired(true).setAutocomplete(true)))
                .addSubcommand(sc => 
                    sc.setName('render')
                        .setDescription('Render Roblox assets or avatars')
                        .addSubcommand(ssc => ssc.setName('asset').setDescription('Render a Roblox asset into a 3D model').addStringOption(o => o.setName('assetid').setDescription('Asset ID').setRequired(true)))
                        .addSubcommand(ssc => ssc.setName('avatar').setDescription('Render a Roblox avatar into a 3D model').addStringOption(o => o.setName('username').setDescription('Roblox username').setRequired(true).setAutocomplete(true)))
                )
                .addSubcommand(sc => sc.setName('user').setDescription('View detailed information about a Roblox user').addStringOption(o => o.setName('username').setDescription('Roblox username').setRequired(true).setAutocomplete(true)).addBooleanOption(o => o.setName('card').setDescription('Display as a profile card').setRequired(false)))
        );
    }

    async autocompleteRun(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name !== 'username' && focusedOption.name !== 'user1' && focusedOption.name !== 'user2') return;

        const query = focusedOption.value;
        if (!query || query.length < 2) return interaction.respond([]);

        try {
            const res = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(query)}&limit=25`);
            const data = await res.json();
            const users = data.data || [];
            
            const results = users.slice(0, 25).map(u => ({
                name: `@${u.name} (${u.id})`.substring(0, 100),
                value: u.name
            }));

            return interaction.respond(results);
        } catch (err) {
            return interaction.respond([]);
        }
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
            const fetchUser = async (username) => {
                const idMatch = username.match(/\[(\d+)\]$/);
                let userId;
                if (idMatch) {
                    userId = idMatch[1];
                } else {
                    const res = await fetch(`https://users.roblox.com/v1/usernames/users`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
                    });
                    const data = await res.json();
                    if (!data.data || data.data.length === 0) throw new Error(`User \`${username}\` not found.`);
                    userId = data.data[0].id;
                }
                
                const detailRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
                if (!detailRes.ok) throw new Error('Failed to fetch user details.');
                return await detailRes.json();
            };

            switch (sub) {
                case 'avatar': {
                    const username = interaction.options.getString('username');
                    const user = await fetchUser(username);
                    
                    const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${user.id}&size=720x720&format=Png&isCircular=false`);
                    const thumbData = await thumbRes.json();
                    const avatarUrl = thumbData.data?.[0]?.imageUrl;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `${user.displayName}'s Avatar`,
                        content: `<:fxid:1486875838858264636> **ID:** \`${user.id}\`\n<:fxlink:1486095510434480208> [Profile Link](https://www.roblox.com/users/${user.id}/profile)`,
                        media: avatarUrl
                    }));
                }

                case 'blendavatars': {
                    const u1name = interaction.options.getString('user1');
                    const u2name = interaction.options.getString('user2');
                    
                    const user1 = await fetchUser(u1name);
                    const user2 = await fetchUser(u2name);

                    const getHeadshot = async (id) => {
                        const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`);
                        const data = await res.json();
                        return data.data?.[0]?.imageUrl;
                    };

                    const h1 = await getHeadshot(user1.id);
                    const h2 = await getHeadshot(user2.id);

                    if (!h1 || !h2) throw new Error('Could not fetch headshots.');

                    const img1 = await loadImage(h1);
                    const img2 = await loadImage(h2);

                    const canvas = createCanvas(300, 150);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img1, 0, 0, 150, 150);
                    ctx.drawImage(img2, 150, 0, 150, 150);
                    const buffer = canvas.toBuffer('image/png');

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `Avatar Blend`,
                        content: `**${user1.displayName}** & **${user2.displayName}**`,
                        extraFiles: [{ attachment: buffer, name: 'blend.png' }],
                        media: 'attachment://blend.png'
                    }));
                }

                case 'britcheck': {
                    const username = interaction.options.getString('username');
                    const user = await fetchUser(username);
                    
                    const groupsRes = await fetch(`https://groups.roblox.com/v1/users/${user.id}/groups/roles`);
                    const groupsData = await groupsRes.json();
                    const groups = groupsData.data || [];
                    
                    const isBritish = groups.some(g => g.group.name.toLowerCase().includes('british') || g.group.name.toLowerCase().includes('united kingdom') || g.group.name.toLowerCase().includes('london'));
                    const hasBioMention = user.description.toLowerCase().includes('british') || user.description.toLowerCase().includes('uk') || user.description.toLowerCase().includes('england');

                    const score = (isBritish ? 50 : 0) + (hasBioMention ? 30 : 0);
                    const result = score >= 50 ? 'Likely British 🇬🇧' : (score > 0 ? 'Possibly British 🇬🇧?' : 'Probably not British 🏳️');

                    const content = `<:fxuser:1486083426166509698> **User:** \`${user.name}\`\n` +
                        `<:fxreport:1486878917687250954> **Result:** **${result}**\n` +
                        `<:fxgroups:1487149343508267118> **British Groups Found:** ${groups.filter(g => g.group.name.toLowerCase().includes('british')).length}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `Britcheck Results`,
                        content
                    }));
                }

                case 'calctax': {
                    const amount = interaction.options.getInteger('amount');
                    const received = Math.floor(amount * 0.7);
                    const tax = amount - received;

                    const content = `<:fxroblox:1487149343508267118> **Total Robux:** \`${amount.toLocaleString()}\`\n` +
                        `<:fxreport:1486878917687250954> **You Receive:** **${received.toLocaleString()}**\n` +
                        `<:fxdelete:1486878920136462417> **Tax (30%):** \`${tax.toLocaleString()}\``;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `Robux Tax Calculator`,
                        content
                    }));
                }

                case 'devex': {
                    const robux = interaction.options.getInteger('robux');
                    const usd = (robux * 0.0035).toFixed(2);

                    const content = `<:fxroblox:1487149343508267118> **Robux:** \`${robux.toLocaleString()}\`\n` +
                        `<:fxanalytics:1486875859703955496> **USD Value:** **$${parseFloat(usd).toLocaleString()}**\n` +
                        `-# *Rate: 100,000 Robux = $350 USD*`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `Developer Exchange Calculator`,
                        content
                    }));
                }

                case 'followers': {
                    const username = interaction.options.getString('username');
                    const user = await fetchUser(username);
                    
                    const followRes = await fetch(`https://friends.roblox.com/v1/users/${user.id}/followers/count`);
                    const followData = await followRes.json();
                    
                    const friendRes = await fetch(`https://friends.roblox.com/v1/users/${user.id}/friends/count`);
                    const friendData = await friendRes.json();

                    const content = `<:fxuser:1486083426166509698> **User:** [${user.displayName}](https://www.roblox.com/users/${user.id}/profile)\n` +
                        `<:fxmembers:1486875899264634971> **Followers:** **${followData.count.toLocaleString()}**\n` +
                        `<:fxrole:1486875884110483497> **Friends:** **${friendData.count.toLocaleString()}**`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `Roblox Social Stats`,
                        content
                    }));
                }

                case 'recentbadges': {
                    const username = interaction.options.getString('username');
                    const user = await fetchUser(username);

                    const badgesRes = await fetch(`https://badges.roblox.com/v1/users/${user.id}/badges?limit=25&sortOrder=Desc`);
                    const badgesData = await badgesRes.json();
                    const badgesList = badgesData.data || [];

                    if (badgesList.length === 0) throw new Error(`User \`${user.name}\` has no badges.`);

                    const { paginate } = require('../utils/pagination');
                    
                    const items = await Promise.all(badgesList.map(async (b) => {
                        const detailRes = await fetch(`https://badges.roblox.com/v1/badges/${b.id}`);
                        const detail = await detailRes.json();
                        
                        return {
                            title: `${user.displayName} (@${user.name})'s badges`,
                            authorUrl: `https://www.roblox.com/users/${user.id}/badges`,
                            badgeName: b.name,
                            description: b.description || 'No description.',
                            badgeId: b.id,
                            awardedTimestamp: Math.floor(new Date(b.awardedDate).getTime() / 1000),
                            creatorName: detail.creator?.name || 'Unknown',
                            creatorId: detail.creator?.id || 0,
                            creatorType: detail.creator?.type || 'User',
                            universeName: detail.awardingUniverse?.name || 'Unknown',
                            rootPlaceId: detail.awardingUniverse?.rootPlaceId || 0,
                            timesAwarded: detail.statistics?.pastDayAwardedCount || 0,
                            badgeIcon: b.displayIcon,
                            totalBadges: badgesList.length,
                            userHeadshot: true /* Placeholder */
                        };
                    }));

                    return paginate(interaction, items, templates.robloxBadge, {}, { itemsPerPage: 1 });
                }

                case 'render': {
                    const subSub = interaction.options.getSubcommand();
                    if (subSub === 'asset') {
                        const assetId = interaction.options.getString('assetid');
                        const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=420x420&format=Png`);
                        const thumbData = await thumbRes.json();
                        const url = thumbData.data?.[0]?.imageUrl;

                        if (!url) throw new Error('Could not render that asset.');

                        return await interaction.editReply(templates.utilityResult({
                            authorName,
                            title: `Asset Render: ${assetId}`,
                            content: `<:fxlink:1486095510434480208> [Asset Link](https://www.roblox.com/catalog/${assetId}/)`,
                            media: url
                        }));
                    } else {
                        const username = interaction.options.getString('username');
                        const user = await fetchUser(username);
                        const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${user.id}&size=720x720&format=Png&isCircular=false`);
                        const thumbData = await thumbRes.json();
                        const url = thumbData.data?.[0]?.imageUrl;

                        if (!url) throw new Error('Could not render that avatar.');

                        return await interaction.editReply(templates.utilityResult({
                            authorName,
                            title: `Avatar Render: ${user.displayName}`,
                            content: `<:fxlink:1486095510434480208> [Profile Link](https://www.roblox.com/users/${user.id}/profile)`,
                            media: url
                        }));
                    }
                }

                case 'user': {
                    const username = interaction.options.getString('username');
                    const user = await fetchUser(username);
                    const isCard = interaction.options.getBoolean('card') || false;

                    const followRes = await fetch(`https://friends.roblox.com/v1/users/${user.id}/followers/count`);
                    const followData = await followRes.json();
                    
                    const groupsRes = await fetch(`https://groups.roblox.com/v1/users/${user.id}/groups/roles`);
                    const groupsData = await groupsRes.json();

                    const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${user.id}&size=720x720&format=Png&isCircular=false`);
                    const thumbData = await thumbRes.json();
                    const avatarUrl = thumbData.data?.[0]?.imageUrl;

                    const createdAt = new Date(user.created);
                    const ageDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

                    if (isCard) {
                        const canvas = createCanvas(600, 300);
                        const ctx = canvas.getContext('2d');
                        
                        ctx.fillStyle = '#1e1e2e';
                        ctx.fillRect(0, 0, 600, 300);
                        
                        if (avatarUrl) {
                            const avatar = await loadImage(avatarUrl);
                            ctx.drawImage(avatar, 20, 20, 260, 260);
                        }
                        
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 32px sans-serif';
                        ctx.fillText(user.displayName, 300, 60);
                        
                        ctx.font = '20px sans-serif';
                        ctx.fillStyle = '#a6adc8';
                        ctx.fillText(`@${user.name}`, 300, 90);
                        
                        ctx.fillStyle = '#ffffff';
                        ctx.font = '18px sans-serif';
                        ctx.fillText(`ID: ${user.id}`, 300, 130);
                        ctx.fillText(`Created: ${createdAt.toLocaleDateString()}`, 300, 160);
                        ctx.fillText(`Account Age: ${ageDays.toLocaleString()} days`, 300, 190);
                        ctx.fillText(`Followers: ${followData.count.toLocaleString()}`, 300, 220);
                        ctx.fillText(`Groups: ${groupsData.data.length}`, 300, 250);
                        
                        const buffer = canvas.toBuffer('image/png');
                        return await interaction.editReply(templates.utilityResult({
                            authorName,
                            title: `Roblox User Card`,
                            content: `Profile card for **${user.displayName}**`,
                            extraFiles: [{ attachment: buffer, name: 'card.png' }],
                            media: 'attachment://card.png'
                        }));
                    }

                    const content = `<:fxid:1486875838858264636> **ID:** \`${user.id}\`\n` +
                        `<:fxuser:1486083426166509698> **Display Name:** \`${user.displayName}\`\n` +
                        `<:fxcalendar:1486875894118219907> **Joined:** <t:${Math.floor(createdAt.getTime() / 1000)}:R>\n` +
                        `<:fxmembers:1486875899264634971> **Followers:** **${followData.count.toLocaleString()}**\n` +
                        `<:fxgroups:1487149343508267118> **Groups:** **${groupsData.data.length}**\n\n` +
                        `**Bio:**\n${user.description || 'No bio provided.'}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `Roblox User Info`,
                        content,
                        thumbnail: avatarUrl
                    }));
                }
            }
        } catch (err) {
            if (!interaction.deferred && !interaction.replied) return;
            return await interaction.editReply(templates.error({
                message: err.message || 'An error occurred while executing the Roblox command.'
            }));
        }
    }
}

module.exports = { RobloxCommand };
