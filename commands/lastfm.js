const { 
    ApplicationIntegrationType, 
    InteractionContextType, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
}                               = require('discord.js');
const { Command }               = require('@sapphire/framework');
const { getLyrics }             = require('../utils/lyrics');
const { logger }                = require('../index');
const db                        = require('../utils/database'); 
const { templates }             = require('../utils/templates');
const { paginate }              = require('../utils/pagination');

const PERIODS = {
    '7day': 'last 7 days',
    '1month': 'last 1 month',
    '3month': 'last 3 months',
    '6month': 'last 6 months',
    '12month': 'last 1 year',
    'overall': 'overall'
};

const PERIOD_CHOICES = Object.keys(PERIODS).map(key => ({ 
    name: key.replace('day', ' Days').replace('month', ' Months').replace('overall', 'Lifetime').replace('12 Months', '1 Year').replace('1 Months', '1 Month'), 
    value: key 
}));

/**
 * Fetches data from the Last.fm API.
 * @param {string} method - The API method to call.
 * @param {Object} params - Query parameters.
 * @returns {Promise<Object>} The parsed JSON response.
 */
async function fetchLastFm(method, params) {
    const query = new URLSearchParams({
        method,
        api_key: process.env.AUDIOSCROBBLER,
        format: 'json',
        ...params
    });
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${query}`);
    const data = await res.json();
    if (data.error) throw new Error(data.message);
    return data;
}

class LastfmCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'lastfm', description: 'lastfm commands' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) => {
            builder
                .setName('lastfm')
                .setDescription('lastfm commands')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('login').setDescription('Link your Last.fm account').addStringOption(o => o.setName('username').setDescription('Last.fm username').setRequired(true)))
                .addSubcommand(sc => sc.setName('nowplaying').setDescription('Currently playing track').addStringOption(o => o.setName('username').setDescription('Last.fm username').setRequired(false)))
                .addSubcommand(sc => sc.setName('latest').setDescription('View latest scrobbles').addStringOption(o => o.setName('username').setDescription('Last.fm username').setRequired(false)))
                .addSubcommand(sc => sc.setName('topartists').setDescription('Top artists').addStringOption(o => o.setName('username').setDescription('Last.fm username').setRequired(false)).addStringOption(o => o.setName('period').setDescription('Time period').addChoices(...PERIOD_CHOICES)))
                .addSubcommand(sc => sc.setName('toptracks').setDescription('Top tracks').addStringOption(o => o.setName('username').setDescription('Last.fm username').setRequired(false)).addStringOption(o => o.setName('period').setDescription('Time period').addChoices(...PERIOD_CHOICES)))
                .addSubcommand(sc => sc.setName('topalbums').setDescription('Top albums').addStringOption(o => o.setName('username').setDescription('Last.fm username').setRequired(false)).addStringOption(o => o.setName('period').setDescription('Time period').addChoices(...PERIOD_CHOICES)))
                .addSubcommand(sc => sc.setName('spotify').setDescription('Find current playing on Spotify').addStringOption(o => o.setName('username').setDescription('Last.fm username').setRequired(false)))
                .addSubcommand(sc => sc.setName('lyrics').setDescription('View lyrics of current playing song on Spotify').addStringOption(o => o.setName('username').setDescription('Last.fm username').setRequired(false)))
                .addSubcommand(sc => sc.setName('profile').setDescription('View a Last.fm artist profile').addStringOption(o => o.setName('artist').setDescription('Artist name').setRequired(true).setAutocomplete(true)))
                .addSubcommand(sc => sc.setName('whoknows').setDescription('Who knows an artist in this server').addStringOption(o => o.setName('artist').setDescription('Artist name').setRequired(true).setAutocomplete(true)))
                .addSubcommand(sc => sc.setName('current').setDescription('View the song currently being scrobbled').addStringOption(o => o.setName('username').setDescription('Last.fm username').setRequired(false)));
        }, { idHints: ['1486102984940196011'] });
    }

    async autocompleteRun(interaction) {
        const sub = interaction.options.getSubcommand();
        if (sub !== 'profile' && sub !== 'whoknows') return;

        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name !== 'artist') return;

        const query = focusedOption.value;
        if (!query || query.length < 2) return interaction.respond([]);

        try {
            const res = await fetchLastFm('artist.search', { artist: query, limit: 10 });
            const artists = res.results?.artistmatches?.artist || [];
            
            const results = artists.map(a => ({
                name: a.name.substring(0, 100),
                value: a.name.substring(0, 100)
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
            return;
        }
        
        const subCommand = interaction.options.getSubcommand();
        const inputUser  = interaction.options.getString('username');
        const period     = interaction.options.getString('period') || '7day';
        const userData   = await db.getUser(interaction.user.id);

        if (subCommand === 'login') {
            await db.setLastFm(interaction.user.id, inputUser);
            if (!interaction.deferred && !interaction.replied) return;
            return interaction.editReply({ content: `<:fxcheckwithbox:1487148430563475466> Successfully linked your Last.fm account to **${inputUser}**.` });
        }

        if (subCommand === 'profile') {
            const artistName = interaction.options.getString('artist');
            return this.handleProfile(interaction, artistName);
        }

        if (subCommand === 'whoknows') {
            const artistName = interaction.options.getString('artist');
            return this.handleWhoKnows(interaction, artistName);
        }

        const targetUser = inputUser || userData.lastfm;
        if (!targetUser) {
            if (!interaction.deferred && !interaction.replied) return;
            return interaction.editReply({ content: `<:fxxwithbox:1487148432501248100> You haven't linked your Last.fm account.\nUse \`/lastfm login <username>\` or provide a username in the command.` });
        }

        try {
            const userInfo = await fetchLastFm('user.getinfo', { user: targetUser });
            const totalScrobbles = Number(userInfo.user.playcount).toLocaleString();

            switch (subCommand) {
                case 'nowplaying':
                    return this.handleNowPlaying(interaction, targetUser, totalScrobbles);
                case 'latest':
                    return this.handleLatest(interaction, targetUser, totalScrobbles);
                case 'spotify':
                    return this.handleSpotify(interaction, targetUser);
                case 'lyrics':
                    return this.handleLyrics(interaction, targetUser);
                case 'current':
                    return this.handleCurrent(interaction, targetUser);
                default:
                    if (subCommand.startsWith('top')) {
                        return this.handleTopItems(interaction, targetUser, period, subCommand, totalScrobbles);
                    }
            }
        } catch (err) {
            throw err;
        }
    }

    /**
     * Handles the whoknows subcommand.
     * @param {Object} interaction - The Discord interaction.
     * @param {string} artistName - The artist name.
     */
    async handleWhoKnows(interaction, artistName) {
        if (!interaction.guild) throw new Error('This command must be used in a server.');

        const artistRes = await fetchLastFm('artist.getInfo', { artist: artistName });
        const artist = artistRes.artist;
        if (!artist) throw new Error('Artist not found.');

        const linkedUsers = await db.getAllLinkedUsers();
        if (!linkedUsers.length) throw new Error('No users in this server have linked their Last.fm account.');

        const guildMembers = await interaction.guild.members.fetch();
        const serverUsers = linkedUsers.filter(u => guildMembers.has(u.id));

        if (!serverUsers.length) throw new Error('No users in this server have linked their Last.fm account.');

        const leaderboard = [];
        let totalPlays = 0;

        await Promise.all(serverUsers.map(async (u) => {
            try {
                const info = await fetchLastFm('artist.getInfo', { artist: artistName, username: u.lastfm });
                const playcount = parseInt(info.artist?.stats?.userplaycount) || 0;
                if (playcount > 0) {
                    const member = guildMembers.get(u.id);
                    leaderboard.push({
                        id: u.id,
                        tag: member.user.username,
                        playcount
                    });
                    totalPlays += playcount;
                }
            } catch (e) {}
        }));

        if (!leaderboard.length) throw new Error(`Nobody in this server knows **${artist.name}**.`);

        leaderboard.sort((a, b) => b.playcount - a.playcount);

        const totalListeners = leaderboard.length;
        const avgPlays = Math.round(totalPlays / totalListeners);

        const formatted = leaderboard.map((u, i) => {
            const rank = i === 0 ? '👑' : `${i + 1}.`;
            const entry = `${rank} **${u.tag}** - **${u.playcount.toLocaleString()}** plays`;
            return u.id === interaction.user.id ? `**${entry}**` : entry;
        });

        const baseData = {
            username: interaction.user.username,
            title: `<:fxlastfm:1486114519343304794> Who knows ${artist.name}`,
            content: `-# ${artist.name} — ${totalListeners} listeners — ${totalPlays.toLocaleString()} plays — ${avgPlays.toLocaleString()} avg`,
            thumbnail: artist.image?.[3]?.['#text'] || artist.image?.[2]?.['#text'] || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png'
        };

        if (!interaction.deferred && !interaction.replied) return;
        return paginate(interaction, formatted, templates.toplist, baseData, { itemsPerPage: 10 });
    }

    /**
     * Handles the profile subcommand.
     * @param {Object} interaction - The Discord interaction.
     * @param {string} artistName - The artist name to look up.
     */
    async handleProfile(interaction, artistName) {
        const res = await fetchLastFm('artist.getInfo', { artist: artistName });
        const artist = res.artist;
        if (!artist) throw new Error('Artist not found.');

        const stats = artist.stats;
        const bio = (artist.bio?.content || artist.bio?.summary || 'No biography available.')
            .split('<a href')[0]
            .trim();
            
        const tags = artist.tags?.tag?.map(t => `[${t.name}](${t.url})`).join(', ') || 'N/A';
        
        let content = `## [${artist.name}](${artist.url})\n${bio.substring(0, 1500)}${bio.length > 1500 ? '...' : ''}\n\n`;
        content += `<:fxmembers:1486875899264634971> **Listeners:** ${Number(stats.listeners).toLocaleString()} • <:fxnote:1486719323257962516> **Scrobbles:** ${Number(stats.playcount).toLocaleString()}\n`;
        content += `<:fxchannel:1486875880465764465> **Tags:** ${tags}`;

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setEmoji('1486114519343304794')
                .setURL(artist.url),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setEmoji('1486719789350129755')
                .setURL(`https://open.spotify.com/search?q=${encodeURIComponent(artist.name)}`),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setEmoji('1487178649177428079')
                .setURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(artist.name)}`)
        );

        if (!interaction.deferred && !interaction.replied) return;
        return interaction.editReply(templates.utilityResult({
            authorName: interaction.user.username,
            title: `<:fxlastfm:1486114519343304794> Artist Profile`,
            content,
            thumbnail: artist.image?.[3]?.['#text'] || artist.image?.[2]?.['#text'] || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png',
            extraComponents: [buttons]
        }));
    }

    /**
     * Handles the current subcommand (generic now playing).
     * @param {Object} interaction - The Discord interaction.
     * @param {string} targetUser - The validated Last.fm username.
     */
    async handleCurrent(interaction, targetUser) {
        const recentRes = await fetchLastFm('user.getrecenttracks', { user: targetUser, limit: 1 });
        const track = recentRes.recenttracks?.track?.[0];
        if (!track) throw new Error('No recent tracks found.');

        const artistName = track.artist['#text'];
        const trackName = track.name;
        const albumName = track.album['#text'] || 'Unknown Album';

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setEmoji('1487178649177428079')
                .setURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(trackName + ' ' + artistName)}`),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setEmoji('1486719789350129755')
                .setURL(`https://open.spotify.com/search?q=${encodeURIComponent(trackName + ' ' + artistName)}`),
             new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setEmoji('1487178172255567883')
                .setURL(`https://soundcloud.com/search?q=${encodeURIComponent(trackName + ' ' + artistName)}`)
        );

        if (!interaction.deferred && !interaction.replied) return;
        return interaction.editReply(templates.utilityResult({
            authorName: targetUser,
            title: `<:fxlastfm:1486114519343304794> Currently Playing`,
            content: `**[${trackName}](${track.url})**\nby **[${artistName}](https://last.fm/music/${encodeURIComponent(artistName)})**\n\n*Album: ${albumName}*`,
            thumbnail: track.image?.[3]?.['#text'] || track.image?.[2]?.['#text'] || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png',
            extraComponents: [buttons]
        }));
    }

    /**
     * Handles the lyrics subcommand.
     * @param {Object} interaction - The Discord interaction.
     * @param {string} targetUser - The validated Last.fm username.
     */
    async handleLyrics(interaction, targetUser) {
        const recentRes = await fetchLastFm('user.getrecenttracks', { user: targetUser, limit: 1 });
        const track = recentRes.recenttracks?.track?.[0];
        if (!track) throw new Error('No recent tracks found.');

        const artistName = track.artist['#text'];
        const trackName = track.name;

        const song = await getLyrics(`${trackName} | ${artistName}`);
        
        if (!song || !song.lyrics) {
            throw new Error(`Could not find lyrics for **${trackName}** by **${artistName}** on any provider.`);
        }

        const baseData = {
            username: targetUser,
            trackName: song.title || trackName,
            trackUrl: song.url || track.url,
            artistName: song.artist || artistName,
            artistUrl: `https://last.fm/music/${encodeURIComponent(song.artist || artistName)}`,
            thumbnailUrl: song.albumArt || track.image?.[3]?.['#text'] || track.image?.[2]?.['#text'] || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png',
            source: song.source,
            geniusUrl: song.url || 'https://genius.com',
            spotifyUrl: `https://open.spotify.com/search?q=${encodeURIComponent((song.title || trackName) + ' ' + (song.artist || artistName))}`
        };

        if (!interaction.deferred && !interaction.replied) return;
        return paginate(interaction, song.lyrics, templates.lyrics, baseData, { maxChars: 1000 });
    }

    /**
     * Handles the nowplaying subcommand.
     * @param {Object} interaction - The Discord interaction.
     * @param {string} targetUser - The validated Last.fm username.
     * @param {string} totalScrobbles - The user's formatted total playcount.
     */
    async handleNowPlaying(interaction, targetUser, totalScrobbles) {
        const recentRes = await fetchLastFm('user.getrecenttracks', { user: targetUser, limit: 1 });
        const track = recentRes.recenttracks?.track?.[0];
        if (!track) throw new Error('No recent tracks found.');

        const artistName = track.artist['#text'];
        const albumName = track.album['#text'];
        
        const [trackInfo, artistInfo, albumInfo] = await Promise.all([
            fetchLastFm('track.getInfo', { user: targetUser, track: track.name, artist: artistName }).catch(() => ({})),
            fetchLastFm('artist.getInfo', { user: targetUser, artist: artistName }).catch(() => ({})),
            albumName ? fetchLastFm('album.getInfo', { user: targetUser, album: albumName, artist: artistName }).catch(() => ({})) : {}
        ]);

        if (!interaction.deferred && !interaction.replied) return;
        return interaction.editReply(templates.nowplaying({
            username: targetUser,
            trackName: track.name,
            trackUrl: track.url,
            artistName,
            artistUrl: trackInfo.track?.artist?.url || `https://last.fm/music/${encodeURIComponent(artistName)}`,
            albumName: albumName || 'Unknown Album',
            albumUrl: track.url.replace('/_/', '/'),
            thumbnailUrl: track.image?.[3]?.['#text'] || track.image?.[2]?.['#text'] || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png',
            trackScrobbles: trackInfo.track?.userplaycount || 1,
            albumScrobbles: albumInfo.album?.userplaycount || 1,
            artistScrobbles: artistInfo.artist?.stats?.userplaycount || 1,
            totalScrobbles,
            spotifyUrl: `https://open.spotify.com/search?q=${encodeURIComponent(track.name + ' ' + artistName)}`
        }));
    }

    /**
     * Handles the latest subcommand.
     * @param {Object} interaction - The Discord interaction.
     * @param {string} targetUser - The validated Last.fm username.
     * @param {string} totalScrobbles - The user's formatted total playcount.
     */
    async handleLatest(interaction, targetUser, totalScrobbles) {
        const recentRes = await fetchLastFm('user.getrecenttracks', { user: targetUser, limit: 50 });
        const tracks = recentRes.recenttracks?.track;
        if (!tracks || !tracks.length) throw new Error('No recent tracks found.');

        const formattedTracks = tracks.map(track => {
            const artistName = track.artist['#text'];
            const albumName  = track.album['#text'] || 'Unknown Album';
            const isPlaying  = track['@attr'] && track['@attr'].nowplaying === 'true';
            const timestamp  = isPlaying ? '🎶' : `<t:${track.date.uts}:R>`;
            
            return `**[${track.name}](${track.url})** by **${artistName}**\n-# ${timestamp} • *${albumName}*`;
        });

        const baseData = {
            username: targetUser,
            totalScrobbles,
            thumbnailUrl: tracks[0].image?.[3]?.['#text'] || tracks[0].image?.[2]?.['#text'] || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png'
        };

        if (!interaction.deferred && !interaction.replied) return;
        return paginate(interaction, formattedTracks, templates.latest, baseData, { itemsPerPage: 5 });
    }

    /**
     * Handles the top artists, tracks, and albums subcommands.
     * @param {Object} interaction - The Discord interaction.
     * @param {string} targetUser - The validated Last.fm username.
     * @param {string} period - The time period selected by the user.
     * @param {string} subCommand - The subcommand name to determine type.
     * @param {string} totalScrobbles - The user's formatted total playcount.
     */
    async handleTopItems(interaction, targetUser, period, subCommand, totalScrobbles) {
        let type = subCommand.replace('top', '');
        if (type === 'artists') type = 'artist';
        if (type === 'tracks')  type = 'track';
        if (type === 'albums')  type = 'album';

        const method = `user.gettop${type}s`;
        const topRes = await fetchLastFm(method, { user: targetUser, period, limit: 50 });
        
        const listContainer = topRes[`top${type}s`];
        if (!listContainer) throw new Error('No data found.');
        
        const items = listContainer[type];
        if (!items || !items.length) throw new Error('No items found.');

        const formattedItems = items.map((item, i) => {
            const playcount = Number(item.playcount).toLocaleString();
            if (type === 'artist') {
                return `${i + 1}. **[${item.name}](${item.url})** - *${playcount} plays*`;
            } else {
                return `${i + 1}. **[${item.name}](${item.url})** by [${item.artist.name}](${item.artist.url}) - *${playcount} plays*`;
            }
        });

        let thumbUrl = items[0].image?.[3]?.['#text'] || items[0].image?.[2]?.['#text'];
        if (type === 'artist' && (!thumbUrl || thumbUrl.includes('2a96cbd8b46e442fc41c2b86b821562f'))) {
            try {
                const artistInfo = await fetchLastFm('artist.getInfo', { artist: items[0].name });
                thumbUrl = artistInfo.artist?.image?.[3]?.['#text'] || artistInfo.artist?.image?.[2]?.['#text'];
            } catch (e) {}
        }

        const baseData = {
            username: targetUser,
            titleType: type === 'artist' ? 'Artists' : type === 'track' ? 'Tracks' : 'Albums',
            period: PERIODS[period],
            totalScrobbles,
            thumbnailUrl: thumbUrl || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png'
        };

        if (!interaction.deferred && !interaction.replied) return;
        return paginate(interaction, formattedItems, templates.toplist, baseData, { itemsPerPage: 10 });
    }

    /**
     * Handles the spotify subcommand.
     * @param {Object} interaction - The Discord interaction.
     * @param {string} targetUser - The validated Last.fm username.
     */
    async handleSpotify(interaction, targetUser) {
        const recentRes = await fetchLastFm('user.getrecenttracks', { user: targetUser, limit: 1 });
        const track = recentRes.recenttracks?.track?.[0];
        if (!track) throw new Error('No recent tracks found.');
        
        if (!interaction.deferred && !interaction.replied) return;
        return interaction.editReply(templates.spotify({
            username: targetUser,
            trackName: track.name,
            trackUrl: track.url,
            artistName: track.artist['#text'],
            artistUrl: `https://last.fm/music/${encodeURIComponent(track.artist['#text'])}`,
            thumbnailUrl: track.image?.[3]?.['#text'] || track.image?.[2]?.['#text'] || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png',
            spotifyUrl: `https://open.spotify.com/search?q=${encodeURIComponent(track.name + ' ' + track.artist['#text'])}`
        }));
    }
}

module.exports = { LastfmCommand };