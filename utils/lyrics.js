const { getSong }               = require('genius-lyrics-api');

/**
 * Cleans Genius lyrics from extra metadata.
 * @param {string} lyrics 
 * @returns {string}
 */
function cleanGeniusLyrics(lyrics) {
    if (!lyrics) return '';
    return lyrics
        .replace(/^\d+\s*Contributors/i, '')    // Remove contributors
        .replace(/^Translations.*?\n/is, '')    // Remove translation headers
        .replace(/^[^\n]*Lyrics\s*/i, '')       // Remove "Song Title Lyrics" header
        .replace(/^\[.*?\]\s*\n/i, '')          // Remove bracketed translation info like [Перевод...]
        .replace(/\d+Embed$/i, '')              // Remove trailing "Embed" text often found in Genius scrapes
        .trim();
}

/**
 * Aggressively cleans song titles to improve search matches.
 * @param {string} title 
 * @returns {string}
 */
function cleanTitleForSearch(title) {
    return title
        .split(' (')[0]
        .split(' [')[0]
        .split(' - ')[0]
        .split(' feat.')[0]
        .split(' ft.')[0]
        .split(' w/')[0]
        .replace(/\s+w[\s\W].*$/i, '') // matches " w " followed by non-word char (like w[...)
        .replace(/[^\w\s]$/, '')       // trailing punctuation
        .trim();
}

/**
 * Fetches lyrics from LRCLIB.
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @returns {Promise<Object|null>}
 */
async function fetchLrcLib(artist, title) {
    try {
        const queryParams = new URLSearchParams({
            artist_name: artist,
            track_name: title
        });
        const response = await fetch(`https://lrclib.net/api/get?${queryParams.toString()}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.plainLyrics || data.syncedLyrics) {
                return {
                    lyrics: data.plainLyrics || data.syncedLyrics.replace(/\[\d+:\d+\.\d+\]/g, ''),
                    source: 'LRCLIB',
                    title: data.trackName,
                    artist: data.artistName,
                    url: `https://lrclib.net/track/${data.id}`
                };
            }
        }
    } catch (error) {}
    return null;
}

/**
 * Fetches lyrics from Lyrics.ovh.
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @returns {Promise<Object|null>}
 */
async function fetchLyricsOvh(artist, title) {
    try {
        const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.lyrics) {
                return {
                    lyrics: data.lyrics.trim(),
                    source: 'Lyrics.ovh',
                    title: title,
                    artist: artist,
                    url: 'https://lyrics.ovh'
                };
            }
        }
    } catch (error) {}
    return null;
}

/**
 * Fetches lyrics from Genius.
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @param {boolean} optimize - Whether to let the lib optimize the query
 * @returns {Promise<Object|null>}
 */
async function fetchGenius(artist, title, optimize = true) {
    try {
        const options = {
            apiKey: process.env.GENIUS_TOKEN,
            title: title,
            artist: artist,
            optimizeQuery: optimize
        };

        const song = await getSong(options);
        if (song && song.lyrics) {
            return {
                lyrics: cleanGeniusLyrics(song.lyrics),
                source: optimize ? 'Genius' : 'Genius (Search)',
                title: song.title,
                artist: song.artist,
                url: song.url,
                albumArt: song.albumArt
            };
        }
    } catch (error) {}
    return null;
}

/**
 * Main function to get lyrics from available providers.
 * @param {string} query - Query string (artist and title)
 * @returns {Promise<Object|null>}
 */
async function getLyrics(query) {
    let title = query;
    let artist = '';

    if (query.includes(' | ')) {
        const parts = query.split(' | ');
        title = parts[0];
        artist = parts[1];
    } else if (query.includes(' - ')) {
        const parts = query.split(' - ');
        artist = parts[0];
        title = parts[1];
    }

    const cleanTitle = cleanTitleForSearch(title);

    let result = await fetchLrcLib(artist, title);
    if (result) return result;

    result = await fetchGenius(artist, title, true);
    if (result) return result;

    if (cleanTitle !== title) {
        result = await fetchLrcLib(artist, cleanTitle);
        if (result) return result;

        result = await fetchGenius(artist, cleanTitle, true);
        if (result) return result;
    }

    result = await fetchGenius(artist, cleanTitle, false);
    if (result) return result;

    result = await fetchLyricsOvh(artist, cleanTitle);
    if (result) return result;

    try {
        const searchResponse = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(artist + ' ' + cleanTitle)}`);
        if (searchResponse.ok) {
            const results = await searchResponse.json();
            if (results.length > 0) {
                const data = results[0];
                return {
                    lyrics: data.plainLyrics || (data.syncedLyrics ? data.syncedLyrics.replace(/\[\d+:\d+\.\d+\]/g, '') : null),
                    source: 'LRCLIB (Search)',
                    title: data.trackName,
                    artist: data.artistName,
                    url: `https://lrclib.net/track/${data.id}`
                };
            }
        }
    } catch (e) {}

    return null;
}

module.exports = {
    getLyrics,
    fetchLrcLib,
    fetchLyricsOvh,
    fetchGenius
};
