const { 
    ApplicationIntegrationType, 
    InteractionContextType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ComponentType
}                                   = require('discord.js');
const { Command }                   = require('@sapphire/framework');
const { templates }                 = require('../utils/templates');
const { logger }                    = require('../index');
const { navy, checkUsage, updateUsage, getCustomAi, saveCustomAi } = require('../utils/ai');

class CustomCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'custom', description: 'Custom AI utilities' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('custom')
                .setDescription('Custom utilities')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('ai-chat').setDescription('✨ Chat to your custom AI').addStringOption(o => o.setName('prompt').setDescription('The prompt for the AI').setRequired(true)))
                .addSubcommand(sc => sc.setName('ai-build').setDescription('✨ Build your custom AI'))
        );
    }

    async chatInputRun(interaction) {
        const sub = interaction.options.getSubcommand();
        const authorName = interaction.user.username;

        try {
            if (sub === 'ai-build') {
                const config = await getCustomAi(interaction.user.id);

                const select = new StringSelectMenuBuilder()
                    .setCustomId('custom_ai_model')
                    .setPlaceholder('Select AI Model')
                    .addOptions(
                        { label: 'GPT-4.1 (Default)', value: 'gpt-4.1', description: 'Balanced and smart', default: config.model === 'gpt-4.1' },
                        { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20240620', description: 'Very creative and detailed', default: config.model === 'claude-3-5-sonnet-20240620' },
                        { label: 'Llama 3.1 405B', value: 'llama-3.1-405b-instruct', description: 'Massive open source model', default: config.model === 'llama-3.1-405b-instruct' }
                    );

                const btn = new ButtonBuilder()
                    .setCustomId('custom_ai_prompt')
                    .setLabel('Set System Prompt')
                    .setEmoji('1486875868495089744')
                    .setStyle(ButtonStyle.Primary);

                const row1 = new ActionRowBuilder().addComponents(select);
                const row2 = new ActionRowBuilder().addComponents(btn);

                const msg = await interaction.reply({
                    ...templates.utilityResult({
                        authorName,
                        title: 'Custom AI Builder',
                        content: `<:fxsettings:1486875853194264586> **Current Config:**\n` +
                                 `<:fxrole:1486875884110483497> **Model:** \`${config.model}\`\n` +
                                 `<:fxnote:1486875868495089744> **System Prompt:**\n\`\`\`\n${config.system_prompt}\n\`\`\``
                    }),
                    components: [row1, row2],
                    ephemeral: true
                });

                const collector = msg.createMessageComponentCollector({ time: 60000 });

                collector.on('collect', async (i) => {
                    if (i.customId === 'custom_ai_model') {
                        await saveCustomAi(interaction.user.id, config.name, config.system_prompt, i.values[0]);
                        return i.update({ content: `<:fxcheckwithbox:1487148430563475466> Model updated to **${i.values[0]}**!` });
                    }

                    if (i.customId === 'custom_ai_prompt') {
                        const modal = new ModalBuilder()
                            .setCustomId('custom_ai_modal')
                            .setTitle('Custom AI System Prompt');

                        const promptInput = new TextInputBuilder()
                            .setCustomId('system_input')
                            .setLabel('Personality / Instructions')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('e.g. You are a helpful cat that only meows...')
                            .setValue(config.system_prompt)
                            .setRequired(true);

                        modal.addComponents(new ActionRowBuilder().addComponents(promptInput));
                        await i.showModal(modal);

                        const submitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);
                        if (submitted) {
                            const newPrompt = submitted.fields.getTextInputValue('system_input');
                            await saveCustomAi(interaction.user.id, config.name, newPrompt, config.model);
                            await submitted.reply({ content: '<:fxcheckwithbox:1487148430563475466> System prompt updated!', ephemeral: true });
                        }
                    }
                });
                return;
            }

            if (sub === 'ai-chat') {
                await interaction.deferReply();
                const usage = await checkUsage(interaction.user.id);
                if (!usage.allowed) throw new Error(`Token limit reached.`);

                const config = await getCustomAi(interaction.user.id);
                const prompt = interaction.options.getString('prompt');

                const res = await navy.chat.completions.create({
                    model: config.model,
                    messages: [
                        { role: 'system', content: config.system_prompt },
                        { role: 'user', content: prompt }
                    ]
                });

                const reply = res.choices[0].message.content;
                await updateUsage(interaction.user.id, res.usage.total_tokens);

                return interaction.editReply(templates.utilityResult({
                    authorName,
                    title: `${config.name} (${config.model})`,
                    content: reply.substring(0, 2000),
                    footer: `Used ${res.usage.total_tokens} tokens`
                }));
            }
        } catch (err) {
            if (!interaction.deferred && !interaction.replied) return;
            return interaction.editReply(templates.error({ message: err.message }));
        }
    }
}

module.exports = { CustomCommand };
