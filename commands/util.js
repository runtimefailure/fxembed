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
const figlet                        = require('figlet');
const crypto                        = require('crypto');
const dns                           = require('dns').promises;
const translate                     = require('@iamtraction/google-translate');
const { createCanvas, loadImage }   = require('canvas');
const path                          = require('path');
const QRCode                        = require('qrcode');
const fs                            = require('fs');
const os                            = require('os');
const { Shazam }                    = require('node-shazam');
const { fetchWithRetry }            = require('./steam');
const { paginate }                  = require('../utils/pagination');
const { getLyrics }                 = require('../utils/lyrics');

const db = require('../utils/database');

class UtilCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'util', description: 'Utility and information commands' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('util')
                .setDescription('Utility commands')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('ping').setDescription('Check bot latency'))
                .addSubcommand(sc => sc.setName('banner').setDescription('Get a user\'s banner').addUserOption(o => o.setName('target').setDescription('The user').setRequired(false)))
                .addSubcommand(sc => sc.setName('avatar').setDescription('Get a user\'s avatar').addUserOption(o => o.setName('target').setDescription('The user').setRequired(false)))
                .addSubcommand(sc => sc.setName('whois').setDescription('Get information about a user').addUserOption(o => o.setName('target').setDescription('The user').setRequired(false)))
                .addSubcommand(sc => sc.setName('server').setDescription('Get information about the server'))
                .addSubcommand(sc => sc.setName('lyrics').setDescription('Search for song lyrics').addStringOption(o => o.setName('query').setDescription('Song title and artist').setRequired(true)))
                .addSubcommand(sc => sc.setName('shazam').setDescription('Identify a song from an audio file').addAttachmentOption(o => o.setName('file').setDescription('Audio file to identify').setRequired(true)))
                .addSubcommand(sc => 
                    sc.setName('qrcode')
                        .setDescription('QR code utilities')
                        .addStringOption(o => o.setName('text').setDescription('Text to generate QR for'))
                        .addAttachmentOption(o => o.setName('image').setDescription('Image containing QR code to scan'))
                )
                .addSubcommand(sc => sc.setName('translate').setDescription('Translate text').addStringOption(o => o.setName('text').setDescription('Text to translate').setRequired(true)).addStringOption(o => o.setName('to').setDescription('Target language (ISO code, e.g. "en", "ru")').setRequired(false)))
                .addSubcommand(sc => 
                    sc.setName('badtranslate')
                        .setDescription('Badly translate some text')
                        .addStringOption(o => o.setName('text').setDescription('Text to badly translate').setRequired(true))
                        .addIntegerOption(o => o.setName('count').setDescription('Amount of translations').setMinValue(2).setMaxValue(15))
                        .addBooleanOption(o => o.setName('chain').setDescription('Show language chain'))
                )
                .addSubcommand(sc => sc.setName('hash').setDescription('Generate a hash (SHA-256)').addStringOption(o => o.setName('text').setDescription('Text to hash').setRequired(true)))
                .addSubcommand(sc => sc.setName('dns').setDescription('Lookup DNS records').addStringOption(o => o.setName('domain').setDescription('Domain name').setRequired(true)))
                .addSubcommand(sc => sc.setName('ascii').setDescription('Convert text to ASCII art').addStringOption(o => o.setName('text').setDescription('Text to convert').setRequired(true)))
                .addSubcommand(sc => 
                    sc.setName('timezone')
                        .setDescription('Timezone related commands')
                        .addStringOption(o => o.setName('timezone').setDescription('The timezone to set for your profile').setRequired(true).setAutocomplete(true))
                )
                .addSubcommand(sc => 
                    sc.setName('timezoneview')
                        .setDescription('View the current time for a timezone or user')
                        .addStringOption(o => o.setName('timezone').setDescription('The timezone to get the current time for').setAutocomplete(true))
                        .addUserOption(o => o.setName('user').setDescription('The user to check the timezone for'))
                )
                .addSubcommand(sc =>
                    sc.setName('search')
                        .setDescription('Web search utilities')
                        .addStringOption(o => o.setName('query').setDescription('What to search for').setRequired(true))
                        .addStringOption(o => o.setName('engine').setDescription('Search engine to use').addChoices(
                            { name: 'DuckDuckGo', value: 'duckduckgo' },
                            { name: 'Google', value: 'google' },
                            { name: 'Bing', value: 'bing' },
                            { name: 'Yahoo', value: 'yahoo' }
                        ))
                )
                .addSubcommand(sc =>
                    sc.setName('news')
                        .setDescription('Search the web for news')
                        .addStringOption(o => o.setName('query').setDescription('What news to search for').setRequired(true))
                        .addStringOption(o => o.setName('engine').setDescription('Search engine to use').addChoices(
                            { name: 'DuckDuckGo', value: 'duckduckgo' },
                            { name: 'Google', value: 'google' },
                            { name: 'Bing', value: 'bing' }
                        ))
                        .addStringOption(o => o.setName('time').setDescription('Time filter').addChoices(
                            { name: 'Past Day', value: 'd' },
                            { name: 'Past Week', value: 'w' },
                            { name: 'Past Month', value: 'm' }
                        ))
                )
        );
    }

    async autocompleteRun(interaction) {
        const focused = interaction.options.getFocused(true);
        if (focused.name === 'timezone') {
            const timezones = Intl.supportedValuesOf('timeZone');
            const filtered = timezones
                .filter(tz => tz.toLowerCase().includes(focused.value.toLowerCase()))
                .slice(0, 25);
            
            return interaction.respond(filtered.map(tz => ({ name: tz, value: tz })));
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
            switch (sub) {
                case 'timezone': {
                    const tz = interaction.options.getString('timezone');
                    try {
                        new Intl.DateTimeFormat('en-US', { timeZone: tz });
                    } catch (e) {
                        throw new Error('Invalid timezone name.');
                    }
                    await db.setTimezone(interaction.user.id, tz);
                    return interaction.editReply({ content: `<:fxcheckwithbox:1487148430563475466> Successfully set your timezone to **${tz}**.` });
                }

                case 'timezoneview': {
                    let tz = interaction.options.getString('timezone');
                    const targetUser = interaction.options.getUser('user');

                    if (targetUser) {
                        const userData = await db.getUser(targetUser.id);
                        if (!userData.timezone) throw new Error(`${targetUser.username} hasn't set their timezone.`);
                        tz = userData.timezone;
                    }

                    if (!tz) {
                        const userData = await db.getUser(interaction.user.id);
                        tz = userData.timezone;
                    }

                    if (!tz) throw new Error('Please provide a timezone or link yours with `/util timezone`.');

                    const now = new Date();
                    const formatted = new Intl.DateTimeFormat('en-GB', {
                        timeZone: tz,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        timeZoneName: 'short'
                    }).format(now);

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `<:fxcalendar:1486875894118219907> Current Time`,
                        content: `The current time in **${tz}** is:\n## ${formatted}`
                    }));
                }

                case 'search': {
                    const query = interaction.options.getString('query');
                    const engine = interaction.options.getString('engine') || 'duckduckgo';
                    let url = '';

                    switch (engine) {
                        case 'google': url = `https://www.google.com/search?q=${encodeURIComponent(query)}`; break;
                        case 'bing': url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`; break;
                        case 'yahoo': url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`; break;
                        default: url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
                    }

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `<:fxsearch:1486875851302637608> Web Search`,
                        content: `**Query:** ${query}\n**Engine:** ${engine.charAt(0).toUpperCase() + engine.slice(1)}\n\n<:fxlink:1486095510434480208> [View Search Results](${url})`
                    }));
                }

                case 'news': {
                    const query = interaction.options.getString('query');
                    const engine = interaction.options.getString('engine') || 'duckduckgo';
                    const time = interaction.options.getString('time') || 'w';
                    let url = '';

                    switch (engine) {
                        case 'google': url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws&tbs=qdr:${time}`; break;
                        case 'bing': url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&qft=interval%3d"${time === 'd' ? '7' : time === 'w' ? '8' : '9'}"`; break;
                        default: url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=news&ia=news`;
                    }

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `<:fxsearch:1486875851302637608> News Search`,
                        content: `**Query:** ${query}\n**Engine:** ${engine.charAt(0).toUpperCase() + engine.slice(1)}\n\n<:fxlink:1486095510434480208> [View News Results](${url})`
                    }));
                }
                case 'ping': {
                    const wsPing = interaction.client.ws.ping;
                    const msgPing = Date.now() - interaction.createdTimestamp;
                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Pong!',
                        content: `<:fxping:1486875865961463868> **WebSocket:** ${wsPing}ms\n<:fxclock:1486875894118219907> **Response:** ${msgPing}ms`
                    }));
                }

                case 'ascii': {
                    const text = interaction.options.getString('text');
                    figlet(text, (err, data) => {
                        if (err) throw err;
                        return interaction.editReply(templates.utilityResult({
                            authorName,
                            title: 'ASCII Art',
                            content: `\`\`\`\n${data.substring(0, 1900)}\n\`\`\``
                        }));
                    });
                    break;
                }

                case 'dns': {
                    const domain = interaction.options.getString('domain');
                    const records = await dns.resolveAny(domain);
                    const formatted = records.map(r => `**${r.type}**: ${JSON.stringify(r.value || r.address || r.exchange)}`).join('\n');
                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `DNS Records: ${domain}`,
                        content: formatted.substring(0, 2000)
                    }));
                }

                case 'hash': {
                    const text = interaction.options.getString('text');
                    const hash = crypto.createHash('sha256').update(text).digest('hex');
                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'SHA-256 Hash',
                        content: `**Input:** ${text}\n**Hash:** \`${hash}\``
                    }));
                }

                case 'badtranslate': {
                    const text = interaction.options.getString('text');
                    const count = interaction.options.getInteger('count') || 8;
                    const showChain = interaction.options.getBoolean('chain') || false;

                    const langs = ['af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'zh-CN', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'he', 'hi', 'hmn', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jw', 'kn', 'kk', 'km', 'ko', 'ku', 'ky', 'lo', 'la', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ny', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu'];
                    
                    let currentText = text;
                    let chain = ['en'];

                    for (let i = 0; i < count; i++) {
                        const nextLang = langs[Math.floor(Math.random() * langs.length)];
                        const res = await translate(currentText, { to: nextLang });
                        currentText = res.text;
                        chain.push(nextLang);
                    }

                    const finalRes = await translate(currentText, { to: 'en' });
                    chain.push('en');

                    let content = `**Original:** ${text}\n**Result:** ${finalRes.text}`;
                    if (showChain) content += `\n\n**Chain:** ${chain.join(' ➜ ')}`;

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Bad Translation',
                        content: content.substring(0, 2000)
                    }));
                }

                case 'qrcode': {
                    const text = interaction.options.getString('text');
                    const attachment = interaction.options.getAttachment('image');

                    if (text) {
                        const buffer = await QRCode.toBuffer(text);
                        return interaction.editReply(templates.utilityResult({
                            authorName,
                            title: 'QR Code Generated',
                            content: `**Content:** ${text}`,
                            extraFiles: [{ attachment: buffer, name: 'qrcode.png' }],
                            media: 'attachment://qrcode.png'
                        }));
                    } else if (attachment) {
                        const image = await loadImage(attachment.url);
                        const canvas = createCanvas(image.width, image.height);
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(image, 0, 0);
                        
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const jsQR = require('jsqr');
                        const code = jsQR(imageData.data, imageData.width, imageData.height);

                        if (!code) throw new Error('Could not find a valid QR code in this image.');

                        return interaction.editReply(templates.utilityResult({
                            authorName,
                            title: 'QR Code Scanned',
                            content: `**Result:**\n\`\`\`\n${code.data}\n\`\`\``
                        }));
                    } else {
                        throw new Error('Please provide either text to generate or an image to scan.');
                    }
                }

                case 'shazam': {
                    const attachment = interaction.options.getAttachment('file');
                    const shazam = new Shazam();                    
                    const tempName = `shazam_${crypto.randomBytes(8).toString('hex')}${path.extname(attachment.name) || '.mp3'}`;
                    const tempPath = path.join(os.tmpdir(), tempName);
                    
                    try {
                        const response = await fetch(attachment.url);
                        if (!response.ok) throw new Error('Failed to download audio file.');
                        const buffer = await response.arrayBuffer();
                        fs.writeFileSync(tempPath, Buffer.from(buffer));

                        const result = await shazam.recognise(tempPath);
                        if (!result || !result.track) throw new Error('Could not identify song.');

                        const track = result.track;
                        return interaction.editReply(templates.utilityResult({
                            authorName,
                            title: `<:fxshazam:1487177803513331923> Song Identified`,
                            content: `**[${track.title}](${track.url})**\nby **${track.subtitle}**`,
                            thumbnail: track.images?.coverart || track.images?.background,
                            media: track.hub?.options?.find(o => o.caption === 'LISTEN')?.actions?.[0]?.uri
                        }));
                    } finally {
                        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                    }
                }

                case 'lyrics': {
                    const query = interaction.options.getString('query');

                    try {
                        const song = await getLyrics(query);
                        
                        if (!song || !song.lyrics) {
                            throw new Error(`Could not find lyrics for **${query}** on any provider.`);
                        }

                        const baseData = {
                            username: authorName,
                            trackName: song.title || query,
                            trackUrl: song.url,
                            artistName: song.artist || 'Unknown Artist',
                            artistUrl: `https://genius.com/artists/${encodeURIComponent(song.artist || 'Unknown Artist')}`,
                            thumbnailUrl: song.albumArt || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png',
                            source: song.source,
                            geniusUrl: song.url || 'https://genius.com',
                            spotifyUrl: `https://open.spotify.com/search?q=${encodeURIComponent((song.title || query) + ' ' + (song.artist || ''))}`
                        };

                        if (!interaction.deferred && !interaction.replied) return;
                        return paginate(interaction, song.lyrics, templates.lyrics, baseData, { maxChars: 1000 });
                    } catch (e) {
                        logger.error(`Lyrics command failed for query "${query}":`, e);
                        throw e;
                    }
                }

                case 'whois': {
                    const target = interaction.options.getUser('target') || interaction.user;
                    const member = interaction.guild?.members.cache.get(target.id);
                    
                    const roles = member?.roles.cache
                        .filter(r => r.name !== '@everyone')
                        .map(r => r.toString())
                        .join(', ') || 'None';

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `User Info: ${target.tag}`,
                        thumbnail: target.displayAvatarURL({ dynamic: true }),
                        content: `<:fxuser:1486083426166509698> **ID:** ${target.id}\n` +
                                `<:fxcalendar:1486875894118219907> **Created:** <t:${Math.floor(target.createdTimestamp / 1000)}:R>\n` +
                                (member ? `<:fxping:1486875865961463868> **Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n` : '') +
                                `<:fxrole:1486875884110483497> **Roles:** ${roles.substring(0, 500)}`
                    }));
                }

                case 'server': {
                    const guild = interaction.guild;
                    if (!guild) throw new Error('This command must be used in a server.');

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `Server Info: ${guild.name}`,
                        thumbnail: guild.iconURL({ dynamic: true }),
                        content: `<:fxuser:1486083426166509698> **Owner:** <@${guild.ownerId}>\n` +
                                `<:fxmembers:1486875899264634971> **Members:** ${guild.memberCount}\n` +
                                `<:fxcalendar:1486875894118219907> **Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>\n` +
                                `<:fxrole:1486875884110483497> **Roles:** ${guild.roles.cache.size}\n` +
                                `<:fxping:1486875865961463868> **Emojis:** ${guild.emojis.cache.size}`
                    }));
                }

                case 'avatar': {
                    const target = interaction.options.getUser('target') || interaction.user;
                    const url = target.displayAvatarURL({ dynamic: true, size: 1024 });
                    
                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `${target.username}'s Avatar`,
                        content: `[Link to Avatar](${url})`,
                        media: url
                    }));
                }

                case 'banner': {
                    const target = interaction.options.getUser('target') || interaction.user;
                    const user = await interaction.client.users.fetch(target.id, { force: true });
                    const url = user.bannerURL({ dynamic: true, size: 1024 });
                    
                    if (!url) throw new Error('User does not have a banner.');

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `${target.username}'s Banner`,
                        content: `[Link to Banner](${url})`,
                        media: url
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

module.exports = { UtilCommand };