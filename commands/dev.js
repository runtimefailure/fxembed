const { Command } = require('@sapphire/framework');
const { ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { templates } = require('../utils/templates');
const { logger } = require('../index');

class DevCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'dev', description: 'Development and coding tools' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('dev')
                .setDescription('Development and coding tools')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('npm').setDescription('Search for packages on the npm registry').addStringOption(o => o.setName('package').setDescription('Package name').setRequired(true)))
                .addSubcommand(sc => sc.setName('pypi').setDescription('Search for Python packages on PyPI').addStringOption(o => o.setName('package').setDescription('Package name').setRequired(true)))
                .addSubcommand(sc => sc.setName('httpstatus').setDescription('Explain what a specific HTTP status code means').addIntegerOption(o => o.setName('code').setDescription('HTTP status code (e.g. 404)').setRequired(true)))
                .addSubcommand(sc => sc.setName('color').setDescription('Preview a Hex color and get its variants').addStringOption(o => o.setName('hex').setDescription('Hex color code (e.g. #ff0000)').setRequired(true)))
        );
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
                case 'npm': {
                    const pkg = interaction.options.getString('package');
                    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`);
                    if (!res.ok) throw new Error('Package not found.');
                    const data = await res.json();
                    
                    const latest = data['dist-tags'].latest;
                    const version = data.versions[latest];

                    const content = `<:fxlink:1486095510434480208> **Package:** [${data.name}](https://www.npmjs.com/package/${data.name})\n` +
                        `<:fxnote:1486875868495089744> **Description:** ${data.description || 'No description.'}\n` +
                        `<:fxmore:1486875890746003649> **Latest Version:** \`v${latest}\`\n` +
                        `<:fxowner:1486879424275021845> **License:** ${version.license || 'Unknown'}\n` +
                        `<:fxcalendar:1486875894118219907> **Last Modified:** <t:${Math.floor(new Date(data.time.modified).getTime() / 1000)}:R>`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'NPM Package',
                        content,
                        footer: `Maintainers: ${data.maintainers.map(m => m.name).join(', ')}`
                    }));
                }

                case 'pypi': {
                    const pkg = interaction.options.getString('package');
                    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`);
                    if (!res.ok) throw new Error('Package not found.');
                    const data = await res.json();
                    const info = data.info;

                    const content = `<:fxlink:1486095510434480208> **Package:** [${info.name}](${info.package_url})\n` +
                        `<:fxnote:1486875868495089744> **Description:** ${info.summary || 'No description.'}\n` +
                        `<:fxmore:1486875890746003649> **Version:** \`${info.version}\`\n` +
                        `<:fxowner:1486879424275021845> **Author:** ${info.author || 'Unknown'}\n` +
                        `<:fxreport:1486878917687250954> **License:** ${info.license || 'Unknown'}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'PyPI Package',
                        content
                    }));
                }

                case 'httpstatus': {
                    const code = interaction.options.getInteger('code');
                    const statuses = {
                        200: 'OK - The request was successful.',
                        201: 'Created - The request was successful and a new resource was created.',
                        204: 'No Content - The request was successful but there is no content to return.',
                        400: 'Bad Request - The server cannot process the request due to client error.',
                        401: 'Unauthorized - The request requires user authentication.',
                        403: 'Forbidden - The server understood the request but refuses to authorize it.',
                        404: 'Not Found - The server cannot find the requested resource.',
                        405: 'Method Not Allowed - The request method is not supported for the resource.',
                        429: 'Too Many Requests - The user has sent too many requests in a given amount of time.',
                        500: 'Internal Server Error - The server encountered an unexpected condition.',
                        502: 'Bad Gateway - The server received an invalid response from an upstream server.',
                        503: 'Service Unavailable - The server is currently unable to handle the request.',
                        504: 'Gateway Timeout - The server did not receive a timely response from an upstream server.'
                    };

                    const description = statuses[code] || 'Unknown status code.';
                    const content = `<:fxid:1486875838858264636> **Code:** \`${code}\`\n` +
                        `<:fxreport:1486878917687250954> **Meaning:** ${description}\n\n` +
                        `[View Image](https://http.cat/${code})`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'HTTP Status Code Explanation',
                        content,
                        thumbnail: `https://http.cat/${code}`
                    }));
                }

                case 'color': {
                    let hex = interaction.options.getString('hex').replace('#', '');
                    if (!/^[0-9A-F]{6}$/i.test(hex)) throw new Error('Invalid Hex color code.');
                    
                    const res = await fetch(`https://www.thecolorapi.com/id?hex=${hex}`);
                    const data = await res.json();

                    const content = `<:fxid:1486875838858264636> **Hex:** \`${data.hex.value}\`\n` +
                        `<:fxreport:1486878917687250954> **RGB:** \`${data.rgb.value}\`\n` +
                        `<:fxreport:1486878917687250954> **HSL:** \`${data.hsl.value}\`\n` +
                        `<:fxnote:1486875868495089744> **Name:** ${data.name.value}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Color Preview',
                        content,
                        thumbnail: `https://singlecolorimage.com/get/${hex}/400x150`
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

module.exports = { DevCommand };
