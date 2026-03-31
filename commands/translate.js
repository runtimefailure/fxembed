const { 
    ApplicationIntegrationType, 
    InteractionContextType 
}                               = require('discord.js');
const { Command }               = require('@sapphire/framework');
const { templates }             = require('../utils/templates');
const { logger }                = require('../index');
const translate                 = require('@iamtraction/google-translate');
const path                      = require('path');

const ASSETS = {
    separatorError: path.join(process.cwd(), 'assets', 'separator-error.png'),
};

class TranslateCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'translate', description: 'Translate text to a different language' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('translate')
                .setDescription('Translate text to a different language')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addStringOption(o => o.setName('text').setDescription("Text to translate").setRequired(true))
                .addStringOption(o => o.setName('to').setDescription("Language to translate to (e.g, 'pl', 'en')").setRequired(true))

        );
    }

    async chatInputRun(interaction) {
        try {
            await interaction.deferReply();
        } catch (err) {
            logger.error(`Failed to defer interaction: ${err.message}`);
            return;
        }

        const text = interaction.options.getString('text');
        const to = interaction.options.getString('to').toLowerCase();

        try {
            const res = await translate(text, { to });

            const payload = templates.translation({
                authorName: interaction.user.username,
                fromLanguage: res.from.language.iso.toUpperCase(),
                toLanguage: to.toUpperCase(),
                translatedText: res.text,
                engine: 'Google Translate',
                sourceUrl: `https://translate.google.com/?sl=auto&tl=${to}&text=${encodeURIComponent(text)}&op=translate`
            });

            if (!interaction.deferred && !interaction.replied) return;
            return await interaction.editReply(payload);
        } catch (err) {
            const errorPayload = templates.error({
                message: `The language code **${to}** is invalid or the service is down.`
            });

            errorPayload.files = [{ attachment: ASSETS.separatorError, name: 'separator-error.png' }];

            if (!interaction.deferred && !interaction.replied) return;
            return await interaction.editReply(errorPayload);
        }
    }
}

module.exports = { TranslateCommand };