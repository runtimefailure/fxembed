require('dotenv').config();
const startTime = Date.now();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.removeAllListeners('warning');

const { GatewayIntentBits, ActivityType, version: djsVersion, SlashCommandBuilder, ActionRowBuilder, Partials } = require('discord.js');
const { SapphireClient, LogLevel, version: sapphireVersion }        = require('@sapphire/framework');
const figlet                                                        = require('figlet');
const gradient                                                      = require('gradient-string').default;
const { bold, blue, cyan, gray, red, yellow, green, white, dim }    = require('colorette');
const fxGradient                                                    = gradient(['#1055bc', '#4d8fea', '#1055bc']);
const fs                                                            = require('fs');
const path                                                          = require('path');
const { templates }                                                 = require('./utils/templates');
const { startApi }                                                  = require('./utils/api');

const originalFetch = global.fetch;

function formatCentered(text) {
    const cols = process.stdout.columns || 80;
    return text.split('\n').map(line => {
        const pad = Math.max(0, Math.floor((cols - line.length) / 2));
        return ' '.repeat(pad) + line;
    }).join('\n');
}

function getTimestamp() {
    return dim(gray(new Date().toLocaleTimeString('en-GB')));
}

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
    process.exit(1);
}

const client = new SapphireClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction],
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
    
    let commandCount = 0;
    const commandStore = client.stores.get('commands');
    
    if (commandStore) {
        commandStore.forEach(cmd => {
            try {
                const registries = cmd.applicationCommandRegistry.chatInputCommands;
                if (registries && registries.size > 0) {
                    for (const entry of registries) {
                        let json;
                        if (typeof entry === 'function') {
                            const builder = new SlashCommandBuilder().setName(cmd.name).setDescription(cmd.description || 'No description');
                            entry(builder);
                            json = builder.toJSON();
                        } else {
                            json = entry.toJSON ? entry.toJSON() : entry;
                        }
                        if (json.options && json.options.some(o => o.type === 1 || o.type === 2)) {
                            commandCount += json.options.filter(o => o.type === 1 || o.type === 2).length;
                        } else {
                            commandCount += 1;
                        }
                    }
                } else {
                    commandCount += 1;
                }
            } catch (e) {
                commandCount += 1;
            }
        });
    }

    const startupDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    startApi(c);

    c.user.setPresence({
        status: 'online',
        activities: [{
            name: 'v.gd/sysmd | /help',
            type: ActivityType.Custom,
            emoji: { id: '1486150485982445579', name: 'logo' }
        }]
    });

    console.log("\n");
    logger.info(`Logged in as ${bold(cyan(c.user.tag))}`);
    logger.info(`Serving ${bold(white(guildCount))} guilds · ${bold(white(userCount))} users · ${bold(white((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)))} MB`);
    logger.info(`Loaded ${bold(white(commandCount))} commands in ${bold(white(startupDuration))}s`);
    logger.info(`Running Node ${bold(white(process.version))} · d.js ${bold(white(djsVersion))} · sapphire ${bold(white(sapphireVersion))}`);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) return;

    if (interaction.isButton()) {
        if (interaction.customId === 'paginator:cancel') {
            try {
                if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
                await interaction.message.delete().catch(async () => {
                    await interaction.webhook.deleteMessage(interaction.message.id).catch(() => {});
                });
                if (interaction.guild) await interaction.channel.messages.delete(interaction.message.id).catch(() => {});
            } catch (e) {}
            return;
        }

        if (interaction.customId.startsWith('paginator:')) {
            if (interaction.replied || interaction.deferred) return;

            try {
                const rows = interaction.message.components.map(row => {
                    const newRow = ActionRowBuilder.from(row.toJSON());
                    newRow.components.forEach(c => {
                        if (c.data.custom_id?.startsWith('paginator:')) c.data.disabled = true;
                    });
                    return newRow;
                });
                await interaction.message.edit({ components: rows });
            } catch (e) {}

            return interaction.reply({
                ...templates.error({ message: 'This pagination session has expired (the bot may have restarted). Please run the command again.' }),
                ephemeral: true
            });
        }
    }
});

process.on('uncaughtException', (err) => {
    if (err.code === 'MODULE_NOT_FOUND') {
        const moduleName = err.message.split('\n')[0].replace('Cannot find module ', '');
        logger.fatal(`Missing dependency: ${bold(red(moduleName))}`);
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

client.login(process.env.CLIENT_TOKEN).catch((err) => {
    logger.fatal('Failed to login:', err);
    process.exit(1);
});
