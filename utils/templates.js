/* 
    kaori why would u stop existing
    i need this
*/

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SectionBuilder, ThumbnailBuilder, FileBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

const ASSETS = {
    separator: path.join(process.cwd(), 'assets', 'separator-info.png'),
    separatorError: path.join(process.cwd(), 'assets', 'separator-error.png'),
};

const EMOJIS = {
    memory: '1487147079334625290',
    clock: '1487147077426483260',
    color: '1487147075857813677',
    upvote: '1487147074087682239',
    x: '1487147072388988929',
    check: '1487147069322956851',
    code: '1487147066869285095',
    mention: '1487147064302502019',
    owner: '1486879424275021845',
    deleted: '1486878920136462417',
    report: '1486878917687250954',
    top: '1486878434188726292',
    members: '1486875899264634971',
    nitro: '1486875897201168464',
    calendar: '1486875894118219907',
    more: '1486875890746003649',
    onboard: '1486875885578621090',
    role: '1486875884110483497',
    info: '1486875882718105622',
    channel: '1486875880465764465',
    voice: '1486875877638672484',
    shield: '1486875870936301599',
    note: '1486875868495089744',
    integrations: '1486875862249902191',
    analytics: '1486875859703955496',
    stickers: '1486875855136493648',
    settings: '1486875853194264586',
    search: '1486875851302637608',
    id: '1486875838858264636',
    upload: '1486875837218422944',
    nodejs: '1486730451015176303',
    box: '1486730333369008178',
    camera: '1486720396123308112',
    spotify: '1486719789350129755',
    tone: '1486719323257962516',
    genius: '1486718901885599848',
    web: '1486718899478200351',
    translate: '1486486182261952512',
    link: '1486095510434480208',
    download: '1486094007133147156',
    view: '1486083699547046091',
    user: '1486083426166509698',
    repost: '1486080601822986291',
    comment: '1486080575168188547',
    like: '1486078946289127464',
    xbox: '1487148432501248100',
    checkbox: '1487148430563475466',
    roblox: '1487149343508267118',
    steam: '1487149341637476382',
    location: '1487149730600325181',
    yt: '1487178649177428079',

    dogecoin: '1486407499748999230',
    bitcoin: '1317320391672332411',
    etherium: '1317321708318752790',
    solana: '1486407163831255201',
    litecoin: '1317315167671025684',
    xrp: '1486407166918266910'
};

const getFile = (filePath) => fs.readFileSync(filePath);

const templates = {
    EMOJIS,

    nowplaying: (data) => {
        const author = new TextDisplayBuilder()
            .setContent(`<:fxlastfm:1486114519343304794>  **Now playing for ${data.username}**`);
            
        const separator = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://separator-info.png'));
    
        const track = new TextDisplayBuilder()
            .setContent(`## [${data.trackName}](${data.trackUrl})`);
    
        const artist = new TextDisplayBuilder()
            .setContent(`[${data.artistName}](${data.artistUrl}) • *[${data.albumName}](${data.albumUrl})*`);
    
        const stats = new TextDisplayBuilder()
            .setContent(`-# <:fxuser:1486083426166509698> ${data.trackScrobbles} track scrobbles · ${data.albumScrobbles} album scrobbles\n-# ${data.artistScrobbles} artist scrobbles · ${data.totalScrobbles} total scrobbles`);
    
        const section = new SectionBuilder()
            .addTextDisplayComponents(track, artist, stats)
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(data.thumbnailUrl));

        const container = new ContainerBuilder()
            .setAccentColor(0x1055bc)
            .addTextDisplayComponents(author)
            .addMediaGalleryComponents(separator)
            .addSectionComponents(section);
    
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(data.spotifyUrl || 'https://spotify.com')
                .setEmoji({ name: 'fxspotify', id: '1486719789350129755' }),
                // .setLabel('Open in Spotify'),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('nowplayingaudio')
                .setEmoji({ name: 'audio', id: '1345517095101923439' })
                .setDisabled(true)
        );
    
        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container, row],
            files: [{ attachment: getFile(ASSETS.separator), name: 'separator-info.png' }]
        };
    },

    toplist: (data) => {
        const author = new TextDisplayBuilder()
            .setContent(`<:fxlastfm:1486114519343304794>  **${data.username}'s Top ${data.titleType} (${data.period})**`);
            
        const separator = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://separator-info.png'));
    
        const list = new TextDisplayBuilder()
            .setContent(data.listData);
    
        const footer = new TextDisplayBuilder()
            .setContent(`-# <:fxuser:1486083426166509698> Page ${data.currentPage || 1}/${data.totalPages || 5} • ${data.username} has ${data.totalScrobbles} scrobbles`);
            
        const section = new SectionBuilder()
            .addTextDisplayComponents(list, footer)
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(data.thumbnailUrl));

        const container = new ContainerBuilder()
            .setAccentColor(0x1055bc)
            .addTextDisplayComponents(author)
            .addMediaGalleryComponents(separator)
            .addSectionComponents(section);
    
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Primary)
                .setCustomId('paginator:previous')
                .setEmoji({ name: 'left', id: '1265476224742850633' })
                .setDisabled(data.disabled || (data.currentPage || 1) === 1),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Primary)
                .setCustomId('paginator:next')
                .setEmoji({ name: 'right', id: '1265476229876678768' })
                .setDisabled(data.disabled || (data.currentPage || 1) === (data.totalPages || 5)),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('paginator:navigate')
                .setEmoji({ name: 'sort', id: '1317260205381386360' })
                .setDisabled(data.disabled || false),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Danger)
                .setCustomId('paginator:cancel')
                .setEmoji({ name: 'bin', id: '1317214464231079989' })
                .setDisabled(data.disabled || false)
        );

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container, row],
            files: [{ attachment: getFile(ASSETS.separator), name: 'separator-info.png' }]
        };
    },

    latest: (data) => {
        const author = new TextDisplayBuilder()
            .setContent(`<:fxlastfm:1486114519343304794>  **Latest tracks for ${data.username}**`);
            
        const separator = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://separator-info.png'));
    
        const list = new TextDisplayBuilder()
            .setContent(data.listData);
    
        const footer = new TextDisplayBuilder()
            .setContent(`-# <:fxuser:1486083426166509698> Page ${data.currentPage || 1}/${data.totalPages} • ${data.username} has ${data.totalScrobbles} scrobbles`);
            
        const section = new SectionBuilder()
            .addTextDisplayComponents(list, footer)
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(data.thumbnailUrl));

        const container = new ContainerBuilder()
            .setAccentColor(0x1055bc)
            .addTextDisplayComponents(author)
            .addMediaGalleryComponents(separator)
            .addSectionComponents(section);
    
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Primary)
                .setCustomId('paginator:previous')
                .setEmoji({ name: 'left', id: '1265476224742850633' })
                .setDisabled(data.disabled || (data.currentPage || 1) === 1),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Primary)
                .setCustomId('paginator:next')
                .setEmoji({ name: 'right', id: '1265476229876678768' })
                .setDisabled(data.disabled || (data.currentPage || 1) === data.totalPages),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('paginator:navigate')
                .setEmoji({ name: 'sort', id: '1317260205381386360' })
                .setDisabled(data.disabled || false),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Danger)
                .setCustomId('paginator:cancel')
                .setEmoji({ name: 'bin', id: '1317214464231079989' })
                .setDisabled(data.disabled || false)
        );

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container, row],
            files: [{ attachment: getFile(ASSETS.separator), name: 'separator-info.png' }]
        };
    },

    spotify: (data) => {
        const title = new TextDisplayBuilder()
            .setContent(`<:fxlastfm:1486114519343304794>  **Stream on Spotify**`);
            
        const info = new TextDisplayBuilder()
            .setContent(`**[${data.trackName}](${data.trackUrl})** by **[${data.artistName}](${data.artistUrl})**\n\n<:fxspotify:1486719789350129755> [Open in Spotify](${data.spotifyUrl})`);
            
        const footer = new TextDisplayBuilder()
            .setContent(`-# <:fxuser:1486083426166509698> ${data.username} • Last.fm to Spotify`);

        const section = new SectionBuilder()
            .addTextDisplayComponents(info, footer)
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(data.thumbnailUrl));

        const container = new ContainerBuilder()
            .setAccentColor(0x1055bc)
            .addTextDisplayComponents(title)
            .addSectionComponents(section);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(data.spotifyUrl)
                .setEmoji({ name: 'fxspotify', id: '1486719789350129755' })
                // .setLabel('Open in Spotify')
        );

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container, row]
        };
    },

    audio: (data) => {
        const author = new TextDisplayBuilder()
            .setContent(`<:fxuser:1486083426166509698> **${data.authorName}**`);
    
        const attachment = new FileBuilder()
            .setURL(`attachment://${data.filename}`);
    
        const title = new TextDisplayBuilder()
            .setContent(`[${data.trackTitle}](${data.trackUrl})`);
    
        const info = new TextDisplayBuilder()
            .setContent(`-# By **[${data.artistName}](${data.artistUrl})**\n-# Duration: **\`${data.duration}\`**\n\n`);
    
        const stats = new TextDisplayBuilder()
            .setContent(`-# <:fxlike:1486078946289127464> ${data.likes} • <:fxview:1486083699547046091> ${data.views} • <:fxrepost:1486080601822986291> ${data.shares} | ${data.date}`);
    
        const section = new SectionBuilder()
            .addTextDisplayComponents(title, info, stats)
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(data.thumbnailUrl));
    
        const container = new ContainerBuilder()
            .setAccentColor(data.accentColor)
            .addTextDisplayComponents(author)
            // .addFileComponents(attachment)
            .addSectionComponents(section);
    
        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container],
        };
    },

    video: (data) => {
        const gallery = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://fxmbed.mp4'));

        const separator = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://separator-info.png'));

        const author = new TextDisplayBuilder()
            .setContent(`<:fxuser:1486083426166509698> **${data.authorName}** (@${data.authorUsername})`);

        const title = new TextDisplayBuilder()
            .setContent(data.videoTitle || '');

        const stats = new TextDisplayBuilder()
            .setContent(`-# <:fxlike:1486078946289127464> ${data.likes} • <:fxview:1486083699547046091> ${data.views} • <:fxcomment:1486080575168188547> ${data.comments} • <:fxrepost:1486080601822986291> ${data.shares}`);

        const container = new ContainerBuilder()
            .setAccentColor(data.accentColor)
            .addTextDisplayComponents(author)
            .addMediaGalleryComponents(separator)
            .addMediaGalleryComponents(gallery)
            .addTextDisplayComponents(title)
            .addTextDisplayComponents(stats);

        const sourceRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel(data.platformLabel)
                .setEmoji({ id: '1486095510434480208', name: 'fxlink' })
                .setStyle(ButtonStyle.Link)
                .setURL(data.originUrl)
        );

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container, sourceRow],
            files: [{ attachment: getFile(ASSETS.separator), name: 'separator-info.png' }]
        };
    },

    loading: () => {
        const separator = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://separator-info.png'));
    
        const header = new TextDisplayBuilder()
            .setContent(`<:fxdownload:1486094007133147156>  **Fetching content**`);
    
        const body = new TextDisplayBuilder()
            .setContent(`Retrieving media and metadata from the source.\nThis may take a few seconds depending on file size and platform.`);
    
        const container = new ContainerBuilder()
            .setAccentColor(0x1055bc)
            .addTextDisplayComponents(header)
            .addMediaGalleryComponents(separator)
            .addTextDisplayComponents(body)
            // .addTextDisplayComponents(statusText);
    
        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container],
            files: [{ attachment: getFile(ASSETS.separator), name: 'separator-info.png' }]
        };
    },

    error: (data) => {

        const header = new TextDisplayBuilder()
            .setContent(`## \`❌\`  An error occurred`);

        const separator = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://separator-error.png'));
    
        const errorText = new TextDisplayBuilder()
            .setContent(`\n${data.message}\n\n-# If this keeps happening, report it to the staff.`);
    
        const container = new ContainerBuilder()
            .setAccentColor(0xff0000)
            .addTextDisplayComponents(header)
            .addMediaGalleryComponents(separator)
            .addTextDisplayComponents(errorText);
    
        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container],
            files: [{ attachment: getFile(ASSETS.separatorError), name: 'separator-error.png' }]
        };
    },

    cryptoChart: (data) => {
        const header = new TextDisplayBuilder()
            .setContent(`<:${data.coinEmojiName}:${data.coinEmoji}> [${data.coinName}](${data.coinUrl})`);
    
        const chart = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://chart.png'));
    
        const sign    = data.isUp ? '+' : '';
        const arrow   = data.isUp
            ? '<:fxchartup:1486405250557542561>'
            : '<:fxchartdown:1486406117335760988>';
    
        const footer = new TextDisplayBuilder()
            .setContent(
                `-# **Price:** ${data.price} USD | ` +
                `**24H Change:** ${sign}${data.change} (${sign}${data.changePct}%) ${arrow} | ` +
                `**24H High:** ${data.high} USD | ` +
                `**24H Low:** ${data.low} USD`
            );
    
        const container = new ContainerBuilder()
            .setAccentColor(0x293e57)
            .addTextDisplayComponents(header)
            .addMediaGalleryComponents(chart)
            .addTextDisplayComponents(footer);
    
        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container],
            files: [{ attachment: getFile(data.chartFile), name: 'chart.png' }]
    };
    },

    cryptoAddress: (data) => {
        const title = new TextDisplayBuilder()
            .setContent(`<:${data.coinEmojiName}:${data.coinEmoji}> [${data.coinName} Address](${data.explorerUrl})`);
            
        const addressText = new TextDisplayBuilder()
            .setContent(`**${data.address}**`);
            
        const stats = new TextDisplayBuilder()
            .setContent(`-# ### Funds \n* Balance: **\`${data.balance}\`** ${data.ticker} (**${data.balanceUsd} USD**)\n* Received: **\`${data.received}\`** ${data.ticker} (**${data.receivedUsd} USD**)\n* Sent: **\`${data.sent}\`** ${data.ticker} (**${data.sentUsd} USD**)`);
            
        const footer = new TextDisplayBuilder()
            .setContent(`-# first seen ${data.firstSeen} • ${data.txCount} transactions • 1 ${data.ticker.toLowerCase()} = ${data.currentPrice} usd`);

        const section = new SectionBuilder()
            .addTextDisplayComponents(stats, footer)
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(data.thumbUrl));

        const container = new ContainerBuilder()
            .setAccentColor(data.color)
            .addTextDisplayComponents(title)
            .addTextDisplayComponents(addressText)
            .addSectionComponents(section);

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container]
        };
    },

    translation: (data) => {
        const author = new TextDisplayBuilder()
            .setContent(`<:fxuser:1486083426166509698> **@${data.authorName}**`);

        const header = new TextDisplayBuilder()
            .setContent(`## **${data.fromLanguage}** ➜ **${data.toLanguage}**`);

        const separator = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://separator-info.png'));

        const output = new TextDisplayBuilder()
            .setContent(`\`\`\`\n${data.translatedText}\n\`\`\``);

        const footer = new TextDisplayBuilder()
            .setContent(`-# <:fxtranslate:1486486182261952512>  Translated via ${data.engine} • [Original Text](${data.sourceUrl})`);

        const container = new ContainerBuilder()
            .setAccentColor(0x1055bc)
            .addTextDisplayComponents(author)
            .addMediaGalleryComponents(separator)
            .addTextDisplayComponents(header)
            .addTextDisplayComponents(output)
            .addTextDisplayComponents(footer);

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container],
            files: [{ attachment: getFile(ASSETS.separator), name: 'separator-info.png' }]
        };
    },

    robloxBadge: (data) => {
        const author = new TextDisplayBuilder()
            .setContent(`${data.userHeadshot ? '' : '<:fxuser:1486083426166509698> '}**${data.title}**`)
            .setURL(data.authorUrl);

        const badgeName = new TextDisplayBuilder().setContent(`**Badge Name**\n${data.badgeName}`);
        const description = new TextDisplayBuilder().setContent(`**Description**\n${data.description}`);
        
        const badgeId = new TextDisplayBuilder().setContent(`**Badge ID**\n[\`${data.badgeId}\`](https://www.roblox.com/badges/${data.badgeId})`);
        const awardedDate = new TextDisplayBuilder().setContent(`**Awarded Date**\n<t:${data.awardedTimestamp}:f>`);
        
        const creator = new TextDisplayBuilder().setContent(`**Creator**\n[${data.creatorName}](https://www.roblox.com/${data.creatorType === 'Group' ? 'groups' : 'users'}/${data.creatorId}/)`);
        const awardedBy = new TextDisplayBuilder().setContent(`**Awarded By**\n[${data.universeName}](https://www.roblox.com/games/${data.rootPlaceId}/)`);
        const timesAwarded = new TextDisplayBuilder().setContent(`**Times Awarded**\n${data.timesAwarded.toLocaleString()}`);

        const footer = new TextDisplayBuilder()
            .setContent(`-# Total Badges: ${data.totalBadges} • ${data.currentPage}/${data.totalBadges}`);

        const section = new SectionBuilder()
            .addTextDisplayComponents(badgeName, description, badgeId, awardedDate, creator, awardedBy, timesAwarded)
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(data.badgeIcon));

        const container = new ContainerBuilder()
            .setAccentColor(0xd3d3d3)
            .addTextDisplayComponents(author)
            .addSectionComponents(section)
            .addTextDisplayComponents(footer);

        if (data.userHeadshot) {
            // Section doesn't support author icon directly in this builder, 
            // but we can use Thumbnail or a hack if needed. 
            // For now, let's just use the Headshot as a secondary thumbnail if possible or just skip.
        }

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container],
            // We can't easily add the paginator here without returning rows, 
            // but the paginate helper handles that.
        };
    },

    github: (data) => {
        const author = new TextDisplayBuilder()
            .setContent(`<:fxgithub:1486095510434480208> **GitHub Profile: ${data.login}**`);

        const userInfo = new TextDisplayBuilder()
            .setContent(`## [${data.name || data.login}](${data.html_url})\n${data.bio || 'No bio provided.'}`);

        const stats = new TextDisplayBuilder()
            .setContent(
                `<:fxmembers:1486875899264634971> **Followers:** ${data.followers.toLocaleString()} • **Following:** ${data.following.toLocaleString()}\n` +
                `<:fxreport:1486878917687250954> **Public Repos:** ${data.public_repos} • **Public Gists:** ${data.public_gists}\n` +
                `<:fxcalendar:1486875894118219907> **Created:** <t:${Math.floor(new Date(data.created_at).getTime() / 1000)}:R>`
            );

        const extraInfo = new TextDisplayBuilder()
            .setContent(
                (data.location ? `<:fxlocation:1487149730600325181> **Location:** ${data.location}\n` : '') +
                (data.company ? `<:fxrole:1486875884110483497> **Company:** ${data.company}\n` : '') +
                (data.blog ? `<:fxlink:1486095510434480208> **Website:** [${data.blog}](${data.blog.startsWith('http') ? data.blog : 'https://' + data.blog})\n` : '') +
                (data.twitter_username ? `<:fxview:1486083699547046091> **Twitter:** [@${data.twitter_username}](https://twitter.com/${data.twitter_username})` : '')
            );

        const separator = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://separator-info.png'));

        const section = new SectionBuilder()
            .addTextDisplayComponents(userInfo, stats, extraInfo)
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(data.avatar_url));

        const container = new ContainerBuilder()
            .setAccentColor(0x24292e)
            .addTextDisplayComponents(author)
            .addMediaGalleryComponents(separator)
            .addSectionComponents(section);

        if (data.media) {
            const gallery = new MediaGalleryBuilder()
                .addItems(new MediaGalleryItemBuilder().setURL(data.media));
            container.addMediaGalleryComponents(gallery);
        }

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container],
            files: [{ attachment: getFile(ASSETS.separator), name: 'separator-info.png' }]
        };
    },

    utilityResult: (data) => {
        const author = new TextDisplayBuilder()
            .setContent(`<:fxuser:1486083426166509698> **@${data.authorName}**`);

        const header = new TextDisplayBuilder()
            .setContent(`## **${data.title}**`);

        const separator = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://separator-info.png'));

        const content = new TextDisplayBuilder()
            .setContent(data.content);

        const container = new ContainerBuilder()
            .setAccentColor(0x1055bc)
            .addTextDisplayComponents(author)
            .addMediaGalleryComponents(separator);

        if (data.thumbnail) {
            const section = new SectionBuilder()
                .addTextDisplayComponents(header, content);
            
            if (data.footer) {
                section.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${data.footer}`));
            }
            
            section.setThumbnailAccessory(new ThumbnailBuilder().setURL(data.thumbnail));
            container.addSectionComponents(section);
        } else {
            container.addTextDisplayComponents(header, content);
            if (data.footer) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${data.footer}`));
            }
        }

        const rows = data.extraComponents || [];

        if (data.media) {
            const gallery = new MediaGalleryBuilder();
            if (Array.isArray(data.media)) {
                data.media.forEach(url => {
                    const item = new MediaGalleryItemBuilder().setURL(url);
                    if (data.spoiler) item.setSpoiler(true);
                    gallery.addItems(item);
                });
            } else {
                const item = new MediaGalleryItemBuilder().setURL(data.media);
                if (data.spoiler) item.setSpoiler(true);
                gallery.addItems(item);
            }
            container.addMediaGalleryComponents(gallery);
        }

        const result = {
            flags: MessageFlags.IsComponentsV2,
            components: [container, ...rows],
            files: [{ attachment: getFile(ASSETS.separator), name: 'separator-info.png' }]
        };

        if (data.extraFiles) {
            result.files.push(...data.extraFiles);
        }

        return result;
    },

    urbanDictionary: (data) => {
        const author = new TextDisplayBuilder()
            .setContent(`<:fxuser:1486083426166509698> **@${data.authorName}**`);

        const title = new TextDisplayBuilder()
            .setContent(`## [${data.word}](${data.url})`);

        const separator = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://separator-info.png'));

        const definition = new TextDisplayBuilder()
            .setContent(`**Definition:**\n${data.definition}`);

        const example = new TextDisplayBuilder()
            .setContent(`\n**Example:**\n*${data.example}*`);

        const footer = new TextDisplayBuilder()
            .setContent(`-# 👍 ${data.thumbsUp} • 👎 ${data.thumbsDown} | Defined by ${data.contributor}${data.totalPages > 1 ? ` • Page ${data.currentPage}/${data.totalPages}` : ''}`);

        const container = new ContainerBuilder()
            .setAccentColor(0x1055bc)
            .addTextDisplayComponents(author)
            .addMediaGalleryComponents(separator)
            .addTextDisplayComponents(title)
            .addTextDisplayComponents(definition)
            .addTextDisplayComponents(example)
            .addTextDisplayComponents(footer);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Primary)
                .setCustomId('paginator:previous')
                .setEmoji({ name: 'left', id: '1265476224742850633' })
                .setDisabled(data.disabled || (data.currentPage || 1) === 1),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Primary)
                .setCustomId('paginator:next')
                .setEmoji({ name: 'right', id: '1265476229876678768' })
                .setDisabled(data.disabled || (data.currentPage || 1) === (data.totalPages || 1)),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Danger)
                .setCustomId('paginator:cancel')
                .setEmoji({ name: 'bin', id: '1317214464231079989' })
                .setDisabled(data.disabled || false)
        );

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container, row],
            files: [{ attachment: getFile(ASSETS.separator), name: 'separator-info.png' }]
        };
    },

    weatherResult: (data) => {
        const author = new TextDisplayBuilder()
            .setContent(`<:fxuser:1486083426166509698> **@${data.authorName}**`);

        const header = new TextDisplayBuilder()
            .setContent(`## Weather in **${data.location}**`);

        const separator = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://separator-info.png'));

        const stats = new TextDisplayBuilder()
            .setContent(`**Condition:** ${data.condition}\n**Temperature:** ${data.temp}°C\n**Humidity:** ${data.humidity}%\n**Wind:** ${data.wind} km/h`);

        const container = new ContainerBuilder()
            .setAccentColor(0x1055bc)
            .addTextDisplayComponents(author)
            .addMediaGalleryComponents(separator)
            .addTextDisplayComponents(header)
            .addTextDisplayComponents(stats);

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container],
            files: [{ attachment: getFile(ASSETS.separator), name: 'separator-info.png' }]
        };
    },

    lyrics: (data) => {
        const author = new TextDisplayBuilder()
            .setContent(`<:fxtone:1486719323257962516>  **Lyrics for ${data.username}**`);
            
        const separator = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('attachment://separator-info.png'));
    
        const trackInfo = new TextDisplayBuilder()
            .setContent(`## [${data.trackName}](${data.trackUrl})\n**[${data.artistName}](${data.artistUrl})**`);
    
        const lyricsContent = new TextDisplayBuilder()
            .setContent(`\`\`\`yaml\n${data.lyrics}\`\`\``);
    
        const footerText = data.totalPages > 1 
            ? `-# <:fxuser:1486083426166509698> ${data.username} • Genius • ${data.currentPage}/${data.totalPages}`
            : `-# <:fxuser:1486083426166509698> ${data.username} • Lyrics provided by ${data.source}`;

        const footer = new TextDisplayBuilder()
            .setContent(footerText);
            
        const section = new SectionBuilder()
            .addTextDisplayComponents(trackInfo, lyricsContent, footer)
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(data.thumbnailUrl));

        const container = new ContainerBuilder()
            .setAccentColor(0x1055bc)
            .addTextDisplayComponents(author)
            .addMediaGalleryComponents(separator)
            .addSectionComponents(section);
    
        const rows = [];
        
        const linkRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(data.spotifyUrl || 'https://spotify.com')
                // .setLabel('Open in Spotify')
                .setEmoji({ name: 'fxspotify', id: '1486719789350129755' }),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(data.geniusUrl || 'https://genius.com')
                .setEmoji({ name: 'fxgenius', id: '1486718901885599848' })
        );
        rows.push(linkRow);

        if (data.totalPages > 1) {
            const navRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Primary)
                    .setCustomId('paginator:previous')
                    .setEmoji({ name: 'left', id: '1265476224742850633' })
                    .setDisabled(data.disabled || data.currentPage === 1),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Primary)
                    .setCustomId('paginator:next')
                    .setEmoji({ name: 'right', id: '1265476229876678768' })
                    .setDisabled(data.disabled || data.currentPage === data.totalPages),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId('paginator:navigate')
                    .setEmoji({ name: 'sort', id: '1317260205381386360' })
                    .setDisabled(data.disabled || false),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Danger)
                    .setCustomId('paginator:cancel')
                    .setEmoji({ name: 'bin', id: '1317214464231079989' })
                    .setDisabled(data.disabled || false)
            );
            rows.push(navRow);
        }

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container, ...rows],
            files: [{ attachment: getFile(ASSETS.separator), name: 'separator-info.png' }]
        };
    },

};

module.exports = { templates, EMOJIS };