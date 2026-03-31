const { serve } = require('@hono/node-server');
const { Hono } = require('hono');

/**
 * Starts the lightweight API server if enabled.
 * @param {import('@sapphire/framework').SapphireClient} client 
 */
function startApi(client) {
    if (process.env.API_HOST !== 'true') return;

    const app = new Hono();

    app.get('/usercount', (c) => {
        const guildCount = client.guilds.cache.size;
        const userCount = client.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);
        
        return c.json({
            user_count: userCount,
            // premium_count: 0,
            discord_user_install_count: 0,
            discord_guild_count: guildCount
        });
    });

    app.get('/commands', async (c) => {
        const commands = [];
        const sapphireStore = client.stores.get('commands');
        
        const globalCommands = await client.application.commands.fetch().catch(() => client.application.commands.cache);

        /**
         * Maps Discord command type integers to strings.
         * @param {number} type 
         * @returns {string}
         */
        const getTypeName = (type) => {
            switch(type) {
                case 1: return 'chat_input';
                case 2: return 'user';
                case 3: return 'message';
                default: return 'unknown';
            }
        };

        globalCommands.forEach(cmd => {
            const localCmd = sapphireStore.get(cmd.name);
            const cogName = localCmd ? localCmd.location.full.split(/[\\/]/).pop().replace('.js', '') : 'general';

            /**
             * Formats command options into an arguments array.
             * @param {Array} options 
             * @returns {Array}
             */
            const parseArgs = (options) => {
                if (!options) return [];
                const optionTypes = {
                    1: 'subcommand',
                    2: 'subcommand_group',
                    3: 'string',
                    4: 'integer',
                    5: 'boolean',
                    6: 'user',
                    7: 'channel',
                    8: 'role',
                    9: 'mentionable',
                    10: 'number',
                    11: 'attachment'
                };
                return options.map(o => ({
                    name: o.name,
                    description: o.description,
                    type: optionTypes[o.type] || 'unknown',
                    required: o.required || false,
                    choices: o.choices?.map(choice => ({ name: choice.name, value: choice.value })) || []
                }));
            };

            const isGroup = cmd.options?.some(o => o.type === 1 || o.type === 2) || false;

            const baseData = {
                name: cmd.name,
                id: cmd.id,
                description: cmd.description,
                type: getTypeName(cmd.type),
                command_type: 'interaction',
                mention: `</${cmd.name}:${cmd.id}>`,
                is_hybrid: false,
                is_group: isGroup,
                cog: cogName
                // is_premium: false
            };

            if (isGroup) {
                commands.push({ ...baseData, arguments: [] });

                cmd.options.forEach(opt => {
                    if (opt.type === 1) {
                        commands.push({
                            ...baseData,
                            name: `${cmd.name} ${opt.name}`,
                            description: opt.description,
                            type: 'subcommand',
                            mention: `</${cmd.name} ${opt.name}:${cmd.id}>`,
                            is_group: false,
                            arguments: parseArgs(opt.options)
                        });
                    } else if (opt.type === 2) {
                        opt.options?.forEach(sub => {
                            commands.push({
                                ...baseData,
                                name: `${cmd.name} ${opt.name} ${sub.name}`,
                                description: sub.description,
                                type: 'subcommand',
                                mention: `</${cmd.name} ${opt.name} ${sub.name}:${cmd.id}>`,
                                is_group: false,
                                arguments: parseArgs(sub.options)
                            });
                        });
                    }
                });
            } else {
                commands.push({
                    ...baseData,
                    arguments: parseArgs(cmd.options)
                });
            }
        });

        return c.json({
            commands,
            statistics: {
                total_commands: commands.length
            }
        });
    });

    const port = process.env.API_PORT || 3000;
    serve({ fetch: app.fetch, port });
}

module.exports = { startApi };
