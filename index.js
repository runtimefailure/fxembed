require('dotenv').config();
const startTime = Date.now();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.removeAllListeners('warning');

const { SapphireClient, LogLevel, version: sapphireVersion }        = require('@sapphire/framework');
const { GatewayIntentBits, ActivityType, version: djsVersion }      = require('discord.js');
const figlet                                                        = require('figlet');
const gradient                                                      = require('gradient-string').default;
const { bold, blue, cyan, gray, red, yellow, green, white, dim }    = require('colorette');
const fxGradient                                                    = gradient(['#1055bc', '#4d8fea', '#1055bc']);

/**
 * Global fetch override to handle "fetch failed" errors with retries.
 */
const fs = require('fs');
const path = require('path');

const originalFetch = global.fetch;
global.fetch = async (url, options, retries = 3) => {
    // Handle local file paths if someone tries to fetch them (fixes node-shazam on Node 18+)
    if (typeof url === 'string' && !url.startsWith('http') && !url.startsWith('data:')) {
        try {
            const absolutePath = path.isAbsolute(url) ? url : path.resolve(process.cwd(), url);
            if (fs.existsSync(absolutePath)) {
                const buffer = fs.readFileSync(absolutePath);
                return {
                    ok: true,
                    status: 200,
                    buffer: async () => buffer,
                    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
                    text: async () => buffer.toString(),
                    json: async () => JSON.parse(buffer.toString()),
                    blob: async () => new Blob([buffer])
                };
            }
        } catch (e) {
            // Fall through to originalFetch which will likely throw "Invalid URL protocol"
        }
    }

    const isHttp = typeof url === 'string' && url.startsWith('http');
    
    for (let i = 0; i < (isHttp ? retries : 1); i++) {
        try {
            return await originalFetch(url, options);
        } catch (err) {
            const isLastAttempt = i === (isHttp ? retries : 1) - 1;
            const isFetchFailed = err.message?.includes('fetch failed') || err.code === 'UND_ERR_CONNECT_TIMEOUT';
            
            if (isHttp && isFetchFailed && !isLastAttempt) {
                const delay = Math.pow(2, i) * 1000;
                await new Promise(res => setTimeout(res, delay));
                continue;
            }
            throw err;
        }
    }
};

/**
 * Centers text based on the current terminal width.
 * @param {string} text - The raw text to center.
 * @returns {string} The centered text string.
 */
function formatCentered(text) {
    const cols = process.stdout.columns || 80;
    return text.split('\n').map(line => {
        const pad = Math.max(0, Math.floor((cols - line.length) / 2));
        return ' '.repeat(pad) + line;
    }).join('\n');
}

/**
 * Generates a formatted timestamp for the logger.
 * @returns {string} The formatted timestamp.
 */
function getTimestamp() {
    return dim(gray(new Date().toLocaleTimeString('en-GB')));
}

/**
 * Custom styled logger instance.
 */
const logger = {
    info:  (...args) => console.log(`${getTimestamp()}  ${bold(fxGradient('INFO  '))}  ${white(args.join(' '))}`),
    warn:  (...args) => console.log(`${getTimestamp()}  ${bold(yellow('WARN  '))}      ${white(args.join(' '))}`),
    error: (...args) => console.log(`${getTimestamp()}  ${bold(red('ERROR '))}         ${white(args.join(' '))}`),
    fatal: (...args) => console.log(`${getTimestamp()}  ${bold(red('FATAL '))}         ${white(args.join(' '))}`),
    debug: (...args) => console.log(`${getTimestamp()}  ${bold(fxGradient('DEBUG '))}  ${white(args.join(' '))}`),
    trace: (...args) => console.log(`${getTimestamp()}  ${bold(gray('TRACE '))}        ${white(args.join(' '))}`),
};

const requiredKeys = ['CLIENT_TOKEN', 'AUDIOSCROBBLER'];
const missingKeys  = requiredKeys.filter(key => !process.env[key]);

if (missingKeys.length > 0) {
    logger.fatal(`Missing required environment variables: ${bold(red(missingKeys.join(', ')))}`);
    logger.info(`Please create a ${bold(cyan('.env'))} file and fill in the missing values before starting.`);
    process.exit(1);
}

const client = new SapphireClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildPresences,
    ],
    rest: { timeout: 30000 },
    baseUserDirectory: __dirname,
    logger: { level: LogLevel.None },
    loadMessageCommandListeners: true,
});

client.once('clientReady', async (c) => {
    const banner = figlet.textSync('\nfxmbed', { font: 'ANSI Shadow' });
    console.log(fxGradient(formatCentered(banner)));
    console.log(fxGradient(formatCentered('fxmbed is a discord all-in-one app  ·  beta\n\n')));

    const guildCount = c.guilds.cache.size;
    const userCount = c.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);
    
    // Improved command counting (includes subcommands)
    let commandCount = 0;
    const commandStore = client.stores.get('commands');
    
    if (commandStore && commandStore.size > 0) {
        commandStore.forEach(cmd => {
            try {
                const registries = cmd.applicationCommandRegistry.chatInputCommands;
                if (registries && registries.size > 0) {
                    for (const entry of registries) {
                        // We need a dummy builder to extract the JSON if it's a function
                        const { SlashCommandBuilder } = require('discord.js');
                        let json;
                        if (typeof entry === 'function') {
                            const builder = new SlashCommandBuilder().setName(cmd.name).setDescription(cmd.description || 'No description');
                            entry(builder);
                            json = builder.toJSON();
                        } else {
                            json = entry.toJSON ? entry.toJSON() : entry;
                        }
                        
                        // Check for subcommands (type 1) or subcommand groups (type 2)
                        if (json.options && json.options.some(o => o.type === 1 || o.type === 2)) {
                            const subcommands = json.options.filter(o => o.type === 1 || o.type === 2);
                            commandCount += subcommands.length;
                        } else {
                            commandCount += 1;
                        }
                    }
                } else {
                    // Fallback to 1 if no registry entries found but command exists
                    commandCount += 1;
                }
            } catch (e) {
                commandCount += 1;
            }
        });
    } else {
        commandCount = 0;
    }

    if (commandCount === 0 && commandStore) commandCount = commandStore.size;

    const startupDuration = ((Date.now() - startTime) / 1000).toFixed(2);

    c.user.setPresence({
        status: 'online',
        activities: [{
            name: 'v.gd/sysmd | /help',
            type: ActivityType.Custom,
            emoji: { id: '1486150485982445579', name: 'logo' }
        }]
    });
    logger.info(`Presence set to ${green('online')}`);


    console.log("\n")
    logger.info(`Logged in as ${bold(cyan(c.user.tag))}`);
    logger.info(`Serving ${bold(white(guildCount))} guilds · ${bold(white(userCount))} users · ${bold(white((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)))} MB`);
    logger.info(`Loaded ${bold(white(commandCount))} commands in ${bold(white(startupDuration))}s`);
    logger.info(`Running Node ${bold(white(process.version))} · d.js ${bold(white(djsVersion))} · sapphire ${bold(white(sapphireVersion))}`);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) return;

    if (interaction.isButton()) {
        if (interaction.customId.startsWith('paginator:')) {
            // If we're here, it means no local collector caught the interaction (e.g. after restart)
            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply({ 
                    content: '❌ This pagination session has expired (the bot may have restarted). Please run the command again.', 
                    ephemeral: true 
                });
            }
        }
    }
});

process.on('uncaughtException', (err) => {
    if (err.code === 'MODULE_NOT_FOUND') {
        const moduleName = err.message.split('\n')[0].replace('Cannot find module ', '');
        logger.fatal(`Missing dependency: ${bold(red(moduleName))}`);
        logger.info(`Please run ${bold(cyan('npm install'))} to install all required packages before starting.`);
        process.exit(1);
    }
    logger.error('Uncaught exception:', err?.stack || err);
    process.exit(1);
});

process.on('SIGINT', async () => {
    logger.warn('Shutting down...');
    await client.destroy();
    process.exit(0);
});

module.exports = { logger };

/**
 * Handle login with a simple timeout catch. 
 * Sapphire pieces can break if login is called multiple times on the same instance.
 */
client.login(process.env.CLIENT_TOKEN).catch((err) => {
    const isTimeout = err.message?.includes('Connect Timeout Error') || err.code === 'UND_ERR_CONNECT_TIMEOUT';
    if (isTimeout) {
        logger.error('Login failed due to connect timeout. Check your connection or Discord status.');
    } else {
        logger.fatal('Failed to login:', err);
    }
    process.exit(1);
});