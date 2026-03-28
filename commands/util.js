const { Command } = require('@sapphire/framework');
const { ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { templates } = require('../utils/templates');
const { logger } = require('../index');
const figlet = require('figlet');
const crypto = require('crypto');
const dns = require('dns').promises;
const translate = require('@iamtraction/google-translate');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const QRCode = require('qrcode');

class UtilCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'util', description: 'Utility commands' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('util')
                .setDescription('Utility commands')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])

                .addSubcommand(sc => sc.setName('asciify').setDescription('Convert text to ASCII art').addStringOption(o => o.setName('text').setDescription('Text to convert').setRequired(true)).addStringOption(o => o.setName('font').setDescription('ASCII font to use').addChoices(
                    { name: 'Standard', value: 'Standard' },
                    { name: 'Slant', value: 'Slant' },
                    { name: 'Shadow', value: 'Shadow' },
                    { name: 'Small', value: 'Small' },
                    { name: 'Script', value: 'Script' },
                    { name: 'Bubble', value: 'Bubble' },
                    { name: 'Electronic', value: 'Electronic' },
                    { name: 'Bloody', value: 'Bloody' }
                )))
                .addSubcommand(sc => sc.setName('ocr').setDescription('Extract text from an image').addAttachmentOption(o => o.setName('image').setDescription('Image to extract text from').setRequired(true)))
                .addSubcommand(sc => sc.setName('iplookup').setDescription('Lookup an IP address').addStringOption(o => o.setName('ip').setDescription('IP address to lookup').setRequired(true)))
                .addSubcommand(sc => sc.setName('resolvedns').setDescription('Resolve DNS records of a domain').addStringOption(o => o.setName('domain').setDescription('Domain to resolve').setRequired(true)))
                .addSubcommand(sc => sc.setName('subdomains').setDescription('Lookup subdomains of a domain').addStringOption(o => o.setName('domain').setDescription('Domain to lookup').setRequired(true)))
                .addSubcommand(sc => sc.setName('urban').setDescription('Search Urban Dictionary').addStringOption(o => o.setName('term').setDescription('Term to search').setRequired(true)))
                .addSubcommand(sc => sc.setName('qr').setDescription('Generate a QR code').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)))
                .addSubcommand(sc => sc.setName('calc').setDescription('Calculate a mathematical expression').addStringOption(o => o.setName('expression').setDescription('Expression to calculate').setRequired(true)))
                .addSubcommand(sc => sc.setName('weather').setDescription('Get current weather for a city').addStringOption(o => o.setName('city').setDescription('City to get weather for').setRequired(true)))
                .addSubcommand(sc => sc.setName('shorten').setDescription('Create a short link').addStringOption(o => o.setName('url').setDescription('URL to shorten').setRequired(true)).addStringOption(o => o.setName('service').setDescription('Shortener service').addChoices({ name: 'is.gd', value: 'is.gd' }, { name: 'tinyurl', value: 'tinyurl' })))
                .addSubcommand(sc => sc.setName('screenshot').setDescription('Capture a website screenshot').addStringOption(o => o.setName('url').setDescription('Website URL').setRequired(true)).addIntegerOption(o => o.setName('delay').setDescription('Delay in seconds').setMinValue(0).setMaxValue(30)))
                .addSubcommand(sc => sc.setName('ip2geo').setDescription('Geolocate an IP address').addStringOption(o => o.setName('ip').setDescription('IP address to geolocate').setRequired(true)))
                .addSubcommand(sc => sc.setName('userfinder').setDescription('Find user accounts from username').addStringOption(o => o.setName('username').setDescription('Username to find').setRequired(true)))
                .addSubcommand(sc => sc.setName('translate').setDescription('Translate text').addStringOption(o => o.setName('text').setDescription('Text to translate').setRequired(true)).addStringOption(o => o.setName('to').setDescription('Target language (e.g. en, pl)').setRequired(true)))
                .addSubcommand(sc => sc.setName('password').setDescription('Generate a secure random password').addIntegerOption(o => o.setName('length').setDescription('Password length').setMinValue(8).setMaxValue(128)))
                .addSubcommand(sc => sc.setName('hash').setDescription('Generate hashes for text').addStringOption(o => o.setName('text').setDescription('Text to hash').setRequired(true)).addStringOption(o => o.setName('algorithm').setDescription('Hash algorithm').addChoices(
                    { name: 'MD5', value: 'md5' },
                    { name: 'SHA-1', value: 'sha1' },
                    { name: 'SHA-256', value: 'sha256' },
                    { name: 'SHA-512', value: 'sha512' },
                    { name: 'SHA-3-256', value: 'sha-256' },
                    { name: 'BLAKE2b512', value: 'blake2b512' }
                )))
                .addSubcommand(sc => sc.setName('timezone').setDescription('Convert time between time zones').addStringOption(o => o.setName('time').setDescription('Time (e.g. 12:00)').setRequired(true)).addStringOption(o => o.setName('from').setDescription('From timezone (e.g. UTC)').setRequired(true)).addStringOption(o => o.setName('to').setDescription('To timezone (e.g. Europe/Warsaw)').setRequired(true)))
                .addSubcommand(sc => sc.setName('shazam').setDescription('Find a track from an audio file').addAttachmentOption(o => o.setName('audio').setDescription('The audio file to recognize').setRequired(true)))
                .addSubcommand(sc => sc.setName('lyrics').setDescription('Search for song lyrics').addStringOption(o => o.setName('query').setDescription('Song title or artist').setRequired(true).setAutocomplete(true)))
                .addSubcommand(sc => sc.setName('echo').setDescription('Make the bot say a message').addStringOption(o => o.setName('message').setDescription('Message to say').setRequired(true)).addChannelOption(o => o.setName('channel').setDescription('Channel to send message in').setRequired(false)))
        );
    }

    async autocompleteRun(interaction) {
        const sub = interaction.options.getSubcommand();
        if (sub !== 'lyrics') return;

        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name !== 'query') return;

        const query = focusedOption.value;
        if (!query || query.length < 2) return interaction.respond([]);

        try {
            const res = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${process.env.GENIUS_TOKEN}` }
            });
            const data = await res.json();
            const hits = data.response?.hits || [];
            
            const results = hits.slice(0, 25).map(hit => ({
                name: `${hit.result.full_title}`.substring(0, 100),
                value: `${hit.result.title} | ${hit.result.primary_artist.name}`.substring(0, 100)
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
            switch (sub) {
                case 'echo': {
                    const message = interaction.options.getString('message');
                    const channel = interaction.options.getChannel('channel') || interaction.channel;

                    if (interaction.guild && !interaction.member.permissions.has('ManageMessages')) {
                        throw new Error('You need Manage Messages permission to use echo.');
                    }

                    await channel.send(message.replace(/\\n/g, '\n'));
                    return await interaction.editReply({ content: `Sent message to ${channel}.`, ephemeral: true });
                }

                case 'shazam': {
                    const attachment = interaction.options.getAttachment('audio');
                    if (!attachment.contentType?.startsWith('audio') && !attachment.contentType?.startsWith('video')) {
                        throw new Error('Please upload a valid audio or video file.');
                    }

                    const fs = require('fs');
                    const os = require('os');
                    const { Shazam } = require('node-shazam');
                    const { fetchWithRetry } = require('./steam');
                    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                    
                    const tempPath = path.join(os.tmpdir(), `shazam_${Date.now()}_${attachment.name}`);
                    
                    try {
                        const resFile = await fetchWithRetry(attachment.url);
                        const buffer = Buffer.from(await resFile.arrayBuffer());
                        fs.writeFileSync(tempPath, buffer);

                        const shazam = new Shazam();
                        const result = await shazam.recognise(tempPath, 'en-US');

                        if (!result || !result.track) {
                            throw new Error('Could not recognize the music in this file.');
                        }

                        const track = result.track;
                        const spotifyProvider = track.hub?.providers?.find(p => p.type === 'SPOTIFY');
                        let spotifyUrl = spotifyProvider?.actions?.find(a => a.uri)?.uri;
                        
                        if (spotifyUrl && spotifyUrl.startsWith('spotify:')) {
                            const parts = spotifyUrl.split(':');
                            if (parts[1] && parts[2]) {
                                spotifyUrl = `https://open.spotify.com/${parts[1]}/${parts[2]}`;
                            } else {
                                spotifyUrl = null;
                            }
                        }

                        const content = `<:fxtone:1486719323257962516>   **Song:** **${track.title}**\n` +
                            `<:fxuser:1486083426166509698>  **Artist:** ${track.subtitle}\n` +
                            `<:fxcalendar:1486875894118219907>  **Genre:** ${track.genres?.primary || 'Unknown'}\n\n` +
                            `**Album:** ${track.sections?.[0]?.metadata?.find(m => m.title === 'Album')?.text || 'N/A'}`;

                        const buttons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Link)
                                .setEmoji('1487177803513331923')
                                .setURL(track.url && track.url.startsWith('http') ? track.url : 'https://shazam.com'),
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Link)
                                .setEmoji('1487178649177428079')
                                .setURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(track.title + ' ' + track.subtitle)}`)
                        );

                        if (spotifyUrl && spotifyUrl.startsWith('http')) {
                            buttons.addComponents(
                                new ButtonBuilder()
                                    .setStyle(ButtonStyle.Link)
                                    .setEmoji('1486719789350129755')
                                    .setURL(spotifyUrl)
                            );
                        } else {
                            buttons.addComponents(
                                new ButtonBuilder()
                                    .setStyle(ButtonStyle.Link)
                                    .setEmoji('1487178172255567883')
                                    .setURL(`https://soundcloud.com/search?q=${encodeURIComponent(track.title + ' ' + track.subtitle)}`)
                            );
                        }

                        return await interaction.editReply(templates.utilityResult({
                            authorName,
                            title: '<:fxshazam:1487177803513331923>  Music Recognition',
                            content,
                            thumbnail: track.images?.coverarthq || track.images?.coverart || null,
                            extraComponents: [buttons]
                        }));
                    } finally {
                        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                    }
                }
                case 'asciify': {
                    const text = interaction.options.getString('text');
                    const font = interaction.options.getString('font') || 'Standard';
                    figlet(text, { font }, async (err, data) => {
                        if (!interaction.deferred && !interaction.replied) return;
                        if (err) return interaction.editReply(templates.error({ message: err.message }));
                        return await interaction.editReply(templates.utilityResult({
                            authorName,
                            title: `ASCII Art (${font})`,
                            content: `\`\`\`\n${data}\n\`\`\``
                        }));
                    });
                    break;
                }

                case 'ocr': {
                    const attachment = interaction.options.getAttachment('image');
                    const res = await fetch(`https://api.ocr.space/parse/imageurl?apikey=helloworld&url=${encodeURIComponent(attachment.url)}`);
                    const data = await res.json();
                    const text = data.ParsedResults?.[0]?.ParsedText || 'No text found.';
                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'OCR Extraction',
                        content: `\`\`\`\n${text}\n\`\`\``,
                        footer: 'Powered by OCR.space'
                    }));
                }

                case 'iplookup':
                case 'ip2geo': {
                    const ip = interaction.options.getString('ip');
                    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,query`);
                    const data = await res.json();
                    if (data.status === 'fail') throw new Error(data.message);
                    const content = `**IP:** ${data.query}\n**Location:** ${data.city}, ${data.regionName}, ${data.country} (${data.countryCode})\n**Timezone:** ${data.timezone}\n**ISP:** ${data.isp}\n**Organization:** ${data.org}\n**AS:** ${data.as}\n\n**Info:**\n* Proxy/VPN: **${data.proxy ? 'Yes' : 'No'}**\n* Hosting: **${data.hosting ? 'Yes' : 'No'}**\n* Mobile: **${data.mobile ? 'Yes' : 'No'}**`;
                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: sub === 'iplookup' ? 'IP Lookup' : 'IP Geolocation',
                        content
                    }));
                }

                case 'resolvedns': {
                    const domain = interaction.options.getString('domain');
                    const types = ['A', 'AAAA', 'MX', 'TXT', 'NS'];
                    let results = `**DNS Records for ${domain}**\n\n`;
                    for (const type of types) {
                        try {
                            const records = await dns.resolve(domain, type);
                            results += `**${type}:** ${JSON.stringify(records, null, 1)}\n`;
                        } catch (e) {}
                    }
                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'DNS Resolver',
                        content: results
                    }));
                }

                case 'subdomains': {
                    const domain = interaction.options.getString('domain');
                    const res = await fetch(`https://api.hackertarget.com/hostsearch/?q=${domain}`);
                    const data = await res.text();
                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Subdomain Lookup',
                        content: `\`\`\`\n${data.split('\n').slice(0, 20).join('\n')}\n\`\`\``,
                        footer: 'Showing first 20 results'
                    }));
                }

                case 'urban': {
                    const term = interaction.options.getString('term');
                    const res = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
                    const data = await res.json();
                    if (!data.list || data.list.length === 0) throw new Error('No definition found.');
                    
                    const { paginate } = require('../utils/pagination');
                    return await paginate(interaction, data.list, templates.urbanDictionary, { authorName }, { itemsPerPage: 1 });
                }

                case 'qr': {
                    const text = interaction.options.getString('text');
                    const size = 1000;
                    const canvas = createCanvas(size, size);
                    const ctx = canvas.getContext('2d');

                    await QRCode.toCanvas(canvas, text, {
                        margin: 2,
                        width: size,
                        color: {
                            dark: '#000000',
                            light: '#ffffff'
                        },
                        errorCorrectionLevel: 'H'
                    });

                    const logoImage = await loadImage(path.join(process.cwd(), 'assets', 'fxlogo.png'));
                    const logoSize = size * 0.22;
                    const x = (size - logoSize) / 2;
                    const y = (size - logoSize) / 2;

                    ctx.globalCompositeOperation = 'destination-out';
                    const radius = 30;
                    ctx.beginPath();
                    ctx.moveTo(x + radius, y);
                    ctx.lineTo(x + logoSize - radius, y);
                    ctx.quadraticCurveTo(x + logoSize, y, x + logoSize, y + radius);
                    ctx.lineTo(x + logoSize, y + logoSize - radius);
                    ctx.quadraticCurveTo(x + logoSize, y + logoSize, x + logoSize - radius, y + logoSize);
                    ctx.lineTo(x + radius, y + logoSize);
                    ctx.quadraticCurveTo(x, y + logoSize, x, y + logoSize - radius);
                    ctx.lineTo(x, y + radius);
                    ctx.quadraticCurveTo(x, y, x + radius, y);
                    ctx.closePath();
                    ctx.fill();

                    ctx.globalCompositeOperation = 'source-over';
                    ctx.drawImage(logoImage, x, y, logoSize, logoSize);

                    const buffer = canvas.toBuffer('image/png');

                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'QR Code',
                        content: `Input: \`${text}\``,
                        extraFiles: [{ attachment: buffer, name: 'qr.png' }],
                        media: 'attachment://qr.png'
                    }));
                }

                case 'calc': {
                    const expr = interaction.options.getString('expression');
                    const res = await fetch(`https://api.mathjs.org/v1/?expr=${encodeURIComponent(expr)}`);
                    const result = await res.text();
                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Calculator',
                        content: `**Expression:** \`${expr}\`\n**Result:** \`${result}\``
                    }));
                }

                case 'weather': {
                    const city = interaction.options.getString('city');
                    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
                    const data = await res.json();
                    const current = data.current_condition[0];
                    const area = data.nearest_area[0];
                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.weatherResult({
                        authorName,
                        location: `${area.areaName[0].value}, ${area.country[0].value}`,
                        condition: current.weatherDesc[0].value,
                        temp: current.temp_C,
                        humidity: current.humidity,
                        wind: current.windspeedKmph
                    }));
                }

                case 'shorten': {
                    const url = interaction.options.getString('url');
                    const service = interaction.options.getString('service') || 'is.gd';
                    let shortUrl = '';
                    if (service === 'is.gd') {
                        const res = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`);
                        const data = await res.json();
                        if (data.errorcode) throw new Error(data.errormessage);
                        shortUrl = data.shorturl;
                    } else {
                        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
                        shortUrl = await res.text();
                    }
                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Link Shortener',
                        content: `**Original:** <${url}>\n**Shortened:** ${shortUrl}`
                    }));
                }

                case 'screenshot': {
                    const url = interaction.options.getString('url');
                    const delay = interaction.options.getInteger('delay') || 10;
                    const thumUrl = `https://image.thum.io/get/width/1200/crop/900/delay/${delay}/wait/${delay}/${url.startsWith('http') ? url : 'https://' + url}`;
                    
                    const imgRes = await fetch(thumUrl);
                    const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                    
                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: '<:fxcamera:1486720396123308112>  Website Screenshot',
                        content: `Source: <${url}>\nDelay: \`${delay}s\``,
                        extraFiles: [{ attachment: imgBuf, name: 'screenshot.png' }],
                        media: 'attachment://screenshot.png'
                    }));
                }

                case 'userfinder': {
                    const username = interaction.options.getString('username');
                    const sites = [
                        {   name: 'GitHub',         url: `https://github.com/${username}`                     },
                        {   name: 'Twitter',        url: `https://twitter.com/${username}`                    },
                        {   name: 'Instagram',      url: `https://instagram.com/${username}`                  },
                        {   name: 'Reddit',         url: `https://reddit.com/user/${username}`                },
                        {   name: 'YouTube',        url: `https://youtube.com/@${username}`                   },
                        {   name: 'Twitch',         url: `https://twitch.tv/${username}`                      },
                        {   name: 'Kick',           url: `https://kick.com/${username}`                       },
                        {   name: 'TikTok',         url: `https://tiktok.com/@${username}`                    },
                        {   name: 'Steam',          url: `https://steamcommunity.com/id/${username}`          },
                        {   name: 'Linktree',       url: `https://linktr.ee/${username}`                      },
                        {   name: 'Bluesky',        url: `https://bsky.app/profile/${username}.bsky.social`   },
                        {   name: 'Slat',           url: `https://feds.lol/${username}`                       },
                        {   name: 'Emogirls',       url: `https://emogir.ls/${username}`                      },
                        {   name: 'Codeberg',       url: `https://codeberg.org/${username}`                   },
                        {   name: 'Snapchat',       url: `https://snapchat.com/add/${username}`               },
                        {   name: 'Telegram',       url: `https://t.me/${username}`                           },
                        {   name: 'Spotify',        url: `https://open.spotify.com/user/${username}`          },
                        {   name: 'Pinterest',      url: `https://pinterest.com/${username}`                  },
                        {   name: 'Medium',         url: `https://medium.com/@${username}`                    },
                        {   name: 'DeviantArt',     url: `https://deviantart.com/${username}`                 },
                        {   name: 'Behance',        url: `https://behance.net/${username}`                    },
                        {   name: 'Dribbble',       url: `https://dribbble.com/${username}`                   },
                        {   name: 'Letterboxd',     url: `https://letterboxd.com/${username}`                 },
                        {   name: 'Last.fm',        url: `https://last.fm/user/${username}`                   },
                        {   name: 'GitLab',         url: `https://gitlab.com/${username}`                     },
                        {   name: 'StackOverflow',  url: `https://stackoverflow.com/users/${username}`        },
                        {   name: 'BuyMeACoffee',   url: `https://buymeacoffee.com/${username}`               },
                        {   name: 'Ko-fi',          url: `https://ko-fi.com/${username}`                      },
                        {   name: 'Mastodon',       url: `https://mastodon.social/@${username}`               },
                        {   name: 'Osu',            url: `https://osu.ppy.sh/users/${username}`               },
                        {   name: 'Itch.io',        url: `https://${username}.itch.io`                        },
                        {   name: 'Bitbucket',      url: `https://bitbucket.org/${username}`                  },
                        {   name: 'Tumblr',         url: `https://${username}.tumblr.com`                     },
                        {   name: 'SoundCloud',     url: `https://soundcloud.com/${username}`                 },
                        {   name: 'Bandcamp',       url: `https://bandcamp.com/${username}`                   },
                        {   name: 'Patreon',        url: `https://patreon.com/${username}`                    },
                        {   name: 'Vimeo',          url: `https://vimeo.com/${username}`                      },
                        {   name: 'Flickr',         url: `https://flickr.com/people/${username}`              },
                        {   name: 'Goodreads',      url: `https://goodreads.com/${username}`                  },
                        {   name: 'Chess.com',      url: `https://chess.com/member/${username}`               },
                        {   name: 'Duolingo',       url: `https://duolingo.com/profile/${username}`           },
                        {   name: 'Keybase',        url: `https://keybase.io/${username}`                     },
                        {   name: 'ProductHunt',    url: `https://producthunt.com/@${username}`               },
                        {   name: 'Trakt',          url: `https://trakt.tv/users/${username}`                 },
                        {   name: 'MyAnimeList',    url: `https://myanimelist.net/profile/${username}`        },
                        {   name: 'AniList',        url: `https://anilist.co/user/${username}`                },
                        {   name: 'DockerHub',      url: `https://hub.docker.com/u/${username}`               },
                        {   name: 'Npm',            url: `https://npmjs.com/~${username}`                     },
                        {   name: 'PyPI',           url: `https://pypi.org/user/${username}`                  }
                    ];
                    let content = `Results for **${username}**:\n\n`;
                    for (const site of sites) {
                        const response = await fetch(site.url, { method: 'HEAD' });
                        if (response.ok) {
                            content += `[${site.name}](${site.url})\n`;
                        }
                    }
                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'User Finder',
                        content,
                        footer: 'Note: Links may be 404 if user does not exist.'
                    }));
                }

                case 'translate': {
                    const text = interaction.options.getString('text');
                    const to = interaction.options.getString('to').toLowerCase();
                    
                    let result;
                    let engine = 'Google Translate';

                    try {
                        result = await translate(text, { to });
                    } catch (e) {
                        try {
                            engine = 'LibreTranslate';
                            const res = await fetchWithRetry('https://libretranslate.de/translate', {
                                method: 'POST',
                                body: JSON.stringify({ q: text, source: 'auto', target: to, format: 'text' }),
                                headers: { 'Content-Type': 'application/json' }
                            });
                            const data = await res.json();
                            result = { text: data.translatedText, from: { language: { iso: 'auto' } } };
                        } catch (e2) {
                            throw new Error('All translation services are currently unavailable. Please try again later.');
                        }
                    }

                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.translation({
                        authorName,
                        fromLanguage: result.from?.language?.iso?.toUpperCase() || 'AUTO',
                        toLanguage: to.toUpperCase(),
                        translatedText: result.text,
                        engine: engine,
                        sourceUrl: `https://translate.google.com/?sl=auto&tl=${to}&text=${encodeURIComponent(text)}&op=translate`
                    }));
                }

                case 'password': {
                    const length = interaction.options.getInteger('length') || 16;
                    const pwd = crypto.randomBytes(length).toString('base64').slice(0, length);
                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Password Generator',
                        content: `Your secure password:\n\`\`\`\n${pwd}\n\`\`\``,
                        footer: 'Generated locally using crypto module'
                    }));
                }

                case 'hash': {
                    const text = interaction.options.getString('text');
                    const algorithm = interaction.options.getString('algorithm') || 'sha256';
                    const hash = crypto.createHash(algorithm).update(text).digest('hex');
                    if (!interaction.deferred && !interaction.replied) return;
                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `Hash (${algorithm.toUpperCase()})`,
                        content: `**Input:** \`${text}\`\n\n**Output:** \`${hash}\``
                    }));
                }

                case 'timezone': {
                    const time = interaction.options.getString('time');
                    const from = interaction.options.getString('from');
                    const to = interaction.options.getString('to');
                    try {
                        const date = new Date(`2026-01-01 ${time} ${from}`);
                        const converted = date.toLocaleTimeString('en-GB', { timeZone: to, hour: '2-digit', minute: '2-digit' });
                        if (!interaction.deferred && !interaction.replied) return;
                        return interaction.editReply(templates.utilityResult({
                            authorName,
                            title: 'Timezone Converter',
                            content: `**${time}** in **${from}** is **${converted}** in **${to}**`
                        }));
                    } catch (e) {
                        throw new Error('Invalid time or timezone format.');
                    }
                }

                case 'lyrics': {
                    const query = interaction.options.getString('query');
                    const { getSong } = require('genius-lyrics-api');
                    const { paginate } = require('../utils/pagination');

                    try {
                        let title = query;
                        let artist = '';
                        
                        if (query.includes(' | ')) {
                            const parts = query.split(' | ');
                            title = parts[0];
                            artist = parts[1];
                        }

                        const options = {
                            apiKey: process.env.GENIUS_TOKEN,
                            title: title,
                            artist: artist,
                            optimizeQuery: true
                        };

                        const song = await getSong(options);
                        if (!song || !song.lyrics) {
                            throw new Error(`Could not find lyrics for **${query}** on Genius.`);
                        }

                        let cleanLyrics = song.lyrics
                            .replace(/^\d+\s*Contributors/i, '')    // Remove contributors
                            .replace(/^Translations.*?\n/is, '')    // Remove translation headers
                            .replace(/^[^\n]*Lyrics\s*/i, '')       // Remove "Song Title Lyrics" header
                            .replace(/^\[.*?\]\s*\n/i, '')          // Remove bracketed translation info like [Перевод...]
                            .replace(/\d+Embed$/i, '')              // Remove trailing "Embed" text often found in Genius scrapes
                            .trim();

                        const baseData = {
                            username: authorName,
                            trackName: song.title || title,
                            trackUrl: song.url,
                            artistName: song.artist || artist || 'Unknown Artist',
                            artistUrl: `https://genius.com/artists/${encodeURIComponent(song.artist || artist || 'Unknown Artist')}`,
                            thumbnailUrl: song.albumArt || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png',
                            source: 'Genius',
                            geniusUrl: song.url || 'https://genius.com',
                            spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent((song.title || title) + ' ' + (song.artist || artist))}`
                        };

                        if (!interaction.deferred && !interaction.replied) return;
                        return paginate(interaction, cleanLyrics, templates.lyrics, baseData, { maxChars: 1000 });
                    } catch (e) {
                        logger.error(`Lyrics command failed for query "${query}":`, e);
                        throw e;
                    }
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
