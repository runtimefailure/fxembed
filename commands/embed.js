const { Command }       = require('@sapphire/framework');
const { templates }     = require('../utils/templates');
const { logger }        = require('../index');
const path              = require('path');
const fs                = require('fs');
const os                = require('os');
const ytDlp             = require('youtube-dl-exec');
const ffmpegPath        = require('ffmpeg-static');

const ASSETS = {
    separator:      path.join(process.cwd(), 'assets', 'separator-info.png'),
    separatorError: path.join(process.cwd(), 'assets', 'separator-error.png'),
};

const PLATFORMS = {
    'instagram.com':  { label: 'View on Instagram',  type: 'video'   },
    'tiktok.com':     { label: 'View on TikTok',     type: 'video'   },
    'youtube.com':    { label: 'View on YouTube',    type: 'video'   },
    'youtu.be':       { label: 'View on YouTube',    type: 'video'   },
    'twitter.com':    { label: 'View on Twitter',    type: 'video'   },
    'x.com':          { label: 'View on X',          type: 'video'   },
    'reddit.com':     { label: 'View on Reddit',     type: 'video'   },
    'soundcloud.com': { label: 'View on SoundCloud', type: 'audio'   },
    'spotify.com':    { label: 'View on Spotify',    type: 'spotify' },
    'open.spotify':   { label: 'View on Spotify',    type: 'spotify' },
};

/**
 * Resolves platform configuration based on URL.
 * @param {string} url - The requested media URL.
 * @returns {{ label: string, type: 'video' | 'audio' | 'spotify' }}
 */
function resolveHost(url) {
    for (const [domain, info] of Object.entries(PLATFORMS)) {
        if (url.includes(domain)) return info;
    }
    return { label: 'View Source', type: 'video' };
}

/**
 * Parses yt-dlp execution errors into user-friendly strings.
 * @param {Error & { stderr?: string }} err - The execution error.
 * @returns {string|null} Normalized error message or null if unknown.
 */
function parseErr(err) {
    const stderr = err.stderr || err.message || '';
    if (stderr.includes('inappropriate') || stderr.includes('unavailable for certain audiences'))
        return 'This content is age-restricted or unavailable.';
    if (stderr.includes('private'))
        return 'This content is private.';
    if (stderr.includes('no_match_found'))
        return 'Could not find this track on any supported platform.';
    if (stderr.includes('not exist') || stderr.includes('404'))
        return 'This content does not exist or was deleted.';
    if (stderr.includes('Unsupported URL'))
        return 'This URL is not supported.';
    if (stderr.includes('File not found after download'))
        return 'The file could not be downloaded. Try again.';
    if (stderr.includes('DRM'))
        return 'This content is DRM protected and cannot be downloaded.';
    return null;
}

/**
 * Fetches track metadata from Spotify via Google proxy.
 * @param {string} url - The Spotify track URL.
 * @returns {Promise<{ title: string, artist: string, thumb: string | null }>}
 */
async function fetchSpotify(url) {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    
    const res = await fetch(oembedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!res.ok) throw new Error('spotify_metadata_failed');
    
    const data = await res.json();
    let rawTitle = data.title || '';
    let artist   = data.author_name || '';

    if (rawTitle.includes(' - ')) {
        const parts = rawTitle.split(' - ');
        artist = parts[0];
        rawTitle = parts.slice(1).join(' - ');
    }

    if (!artist || artist.toLowerCase().includes('spotify') || artist === 'Unknown Artist') {
        artist = '';
    }

    return {
        title: rawTitle.trim() || 'Unknown Track',
        artist: artist.trim(),
        thumb: data.thumbnail_url || null
    };
}

/**
 * Formats numeric metrics into compact strings (e.g., 1.5M, 10k).
 * @param {number} n - The numeric value.
 * @returns {string}
 */
const fmtCount = (n) => {
    if (!n) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
    return `${n}`;
};

/**
 * Converts seconds into HH:MM:SS or MM:SS.
 * @param {number} sec - Duration in seconds.
 * @returns {string}
 */
const fmtTime = (sec) => {
    if (!sec) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Parses a YYYYMMDD date string into MM/DD/YYYY.
 * @param {string} dateStr - Raw YYYYMMDD string.
 * @returns {string}
 */
const fmtDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 8) return 'Unknown Date';
    return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
};

/**
 * Generates a sanitized local filename.
 * @param {Object} info - yt-dlp metadata.
 * @param {boolean} isAudio - If target is audio.
 * @returns {string}
 */
const safeFile = (info, isAudio) => {
    if (!isAudio) return 'fxmbed.mp4';
    const artist  = info.uploader || info.creator || 'Unknown Artist';
    const title   = info.title    || 'Unknown Track';
    return `${artist} - ${title}`.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim().replace(/[^a-zA-Z0-9.\-_]/g, '_') + '.mp3';
};

class EmbedCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'embed', description: 'fxmbed' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('embed')
                .setDescription('Download and embed a video or audio track')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addStringOption(o => o.setName('link').setDescription('The URL to download').setRequired(true))
        );
    }

    async chatInputRun(interaction) {
        try {
            await interaction.deferReply();
        } catch (err) {
            logger.error(`Failed to defer interaction: ${err.message}`);
            return;
        }

        const link     = interaction.options.getString('link');
        const platform = resolveHost(link);
        const isAudio  = platform.type === 'audio' || platform.type === 'spotify';

        const tmpDir  = os.tmpdir();
        const tmpBase = `fxmbed_${Date.now()}`;
        const ext     = isAudio ? 'mp3' : 'mp4';
        const tmpFile = path.join(tmpDir, `${tmpBase}.${ext}`);

        try {
            if (!interaction.deferred && !interaction.replied) return;
            await interaction.editReply({
                ...templates.loading(),
                files: [{ attachment: ASSETS.separator, name: 'separator-info.png' }]
            });

            let info;

            if (platform.type === 'spotify') {
                const spotifyMeta = await fetchSpotify(link);
                // console.log('spotify metadata:', spotifyMeta); // used for debug
            
                const searchTerm = spotifyMeta.artist
                    ? `${spotifyMeta.artist} ${spotifyMeta.title}`
                    : spotifyMeta.title;
            
                const queries = [
                    `scsearch1:${searchTerm}`,
                    `scsearch1:${spotifyMeta.title}`,
                    `ytsearch10:${searchTerm}`,
                    `ytsearch10:${spotifyMeta.title}`,
                ];
            
                let bestMatch = null;
            
                for (const q of queries) {
                    const res = await ytDlp(q, {
                        dumpSingleJson:     true,
                        noWarnings:         true,
                        noCheckCertificate: true,
                    }).catch((e) => {
                        console.warn('Search failed for query:', q, e.stderr?.split('\n')[0]);
                        return null;
                    });
            
                    if (!res) continue;
            
                    if (res.entries && res.entries.length > 0) {
                        const validEntries = res.entries.filter(Boolean);
                        if (validEntries.length === 0) continue;
            
                        bestMatch = validEntries.find(e =>
                            e.title && e.title.toLowerCase().includes(spotifyMeta.title.toLowerCase())
                        ) || validEntries[0];
                        break;
                    }
            
                    if (res.webpage_url) {
                        bestMatch = res;
                        break;
                    }
                }
            
                if (!bestMatch) throw new Error('no_match_found');
            
                await ytDlp(bestMatch.webpage_url, {
                    output:         tmpFile,
                    noWarnings:     true,
                    noCheckCertificate: true,
                    ffmpegLocation: ffmpegPath,
                    extractAudio:   true,
                    audioFormat:    'mp3',
                });
            
                const resolvedArtist = spotifyMeta.artist
                    || bestMatch.uploader
                    || bestMatch.artist
                    || bestMatch.creator
                    || 'Unknown Artist';
            
                info = {
                    ...bestMatch,
                    title:        spotifyMeta.title,
                    uploader:     resolvedArtist,
                    uploader_url: resolvedArtist !== 'Unknown Artist'
                    ? `https://www.last.fm/music/${encodeURIComponent(resolvedArtist)}`
                    : null,
                    thumbnail:    spotifyMeta.thumb || bestMatch.thumbnail,
                };

            } else if (isAudio) {
                const [fetchedInfo] = await Promise.all([
                    ytDlp(link, {
                        dumpSingleJson:     true,
                        noWarnings:         true,
                        noCheckCertificate: true,
                        preferFreeFormats:  true,
                    }),
                    ytDlp(link, {
                        output:             tmpFile,
                        noWarnings:         true,
                        noCheckCertificate: true,
                        ffmpegLocation:     ffmpegPath,
                        extractAudio:       true,
                        audioFormat:        'mp3',
                    })
                ]);
                info = fetchedInfo;

            } else {
                const [fetchedInfo] = await Promise.all([
                    ytDlp(link, {
                        dumpSingleJson:     true,
                        noWarnings:         true,
                        noCheckCertificate: true,
                        preferFreeFormats:  true,
                    }),
                    ytDlp(link, {
                        output:            tmpFile,
                        noWarnings:        true,
                        noCheckCertificate: true,
                        format:            'bestvideo+bestaudio/best',
                        formatSort:        'vcodec:h264',
                        mergeOutputFormat: 'mp4',
                        ffmpegLocation:    ffmpegPath
                    })
                ]);
                info = fetchedInfo;
            }

            const safeFilename = safeFile(info, isAudio);
            const tmpFiles     = fs.readdirSync(tmpDir).filter(f => f.startsWith(tmpBase) && f.endsWith(`.${ext}`));
            const actualFile   = tmpFiles.length > 0 ? path.join(tmpDir, tmpFiles[0]) : null;
            
            if (!actualFile) throw new Error('File not found after download');

            if (isAudio) {
                const response = templates.audio({
                    authorName:   info.uploader     || info.channel  || 'Unknown User',
                    trackTitle:   info.title        || 'Unknown Track',
                    trackUrl:     platform.type === 'spotify' ? link : (info.webpage_url || link),
                    artistName:   info.uploader     || info.creator  || 'Unknown Artist',
                    artistUrl:    info.uploader_url || link,
                    duration:     fmtTime(info.duration),
                    likes:        fmtCount(info.like_count),
                    views:        fmtCount(info.view_count || info.playback_count),
                    shares:       fmtCount(info.repost_count),
                    date:         fmtDate(info.upload_date),
                    thumbnailUrl: info.thumbnail    || 'https://git.cursi.ng/soundcloud_logo.png',
                    accentColor:  0x1055bc,
                    filename:     safeFilename,
                });

                if (!interaction.deferred && !interaction.replied) return;
                await interaction.editReply({
                    files:      [{ attachment: ASSETS.separator, name: 'separator-info.png' }],
                    flags:      response.flags,
                    components: response.components,
                });

                if (!interaction.deferred && !interaction.replied) return;
                await interaction.followUp({
                    files: [{ attachment: actualFile, name: safeFilename }]
                });

            } else {
                const response = templates.video({
                    originUrl:      link,
                    platformLabel:  platform.label,
                    accentColor:    0x1055bc,
                    authorName:     info.uploader || 'Unknown',
                    authorUsername: info.channel  || info.uploader_id || '',
                    videoTitle:     info.description
                        ? info.description.slice(0, 300) + (info.description.length > 300 ? '...' : '')
                        : (info.title || ''),
                    likes:          fmtCount(info.like_count),
                    views:          fmtCount(info.view_count),
                    comments:       fmtCount(info.comment_count),
                    shares:         fmtCount(info.repost_count),
                });

                if (!interaction.deferred && !interaction.replied) return;
                await interaction.editReply({
                    files: [
                        { attachment: actualFile,       name: 'fxmbed.mp4'         },
                        { attachment: ASSETS.separator, name: 'separator-info.png' },
                    ],
                    flags:      response.flags,
                    components: response.components,
                });
            }

        } catch (err) {
            // throw err;
            const parsedError = parseErr(err) || 'An unexpected error occurred while downloading the media.';
            
            if (!interaction.deferred && !interaction.replied) return;
            await interaction.editReply({
                ...templates.error({ message: parsedError }),
                files: [{ attachment: ASSETS.separatorError, name: 'separator-error.png' }]
            });
        } finally {
            const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(tmpBase));
            for (const f of files) fs.unlinkSync(path.join(tmpDir, f));
        }
    }
}

module.exports = { EmbedCommand };