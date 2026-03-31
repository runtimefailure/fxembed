const { 
    ApplicationIntegrationType, 
    InteractionContextType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
}                                           = require('discord.js');
const { Command }                           = require('@sapphire/framework');
const { templates }                         = require('../utils/templates');
const { logger }                            = require('../index');
const { navy, checkUsage, updateUsage }     = require('../utils/ai');

class AiCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'ai', description: 'AI powered utilities' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('ai')
                .setDescription('AI utilities')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('geolocate').setDescription('Use AI to geolocate an image').addAttachmentOption(o => o.setName('image').setDescription('The image to geolocate').setRequired(true)))
                .addSubcommand(sc => sc.setName('deepgeolocate').setDescription('✨ Use AI to geolocate & deeply analyze an image').addAttachmentOption(o => o.setName('image').setDescription('The image to geolocate').setRequired(true)))
                .addSubcommand(sc => sc.setName('perplexity').setDescription('✨ Search the web with Perplexity Sonar').addStringOption(o => o.setName('query').setDescription('Your query for Sonar').setRequired(true)).addAttachmentOption(o => o.setName('image').setDescription('Image to attach')))
                .addSubcommand(sc => sc.setName('tts').setDescription('✨ Convert text to audio using AI').addStringOption(o => o.setName('text').setDescription('Text to convert to speech').setRequired(true)).addStringOption(o => o.setName('voice').setDescription('Voice style to use').addChoices({ name: 'Alloy', value: 'alloy' }, { name: 'Echo', value: 'echo' }, { name: 'Fable', value: 'fable' }, { name: 'Onyx', value: 'onyx' }, { name: 'Nova', value: 'nova' }, { name: 'Shimmer', value: 'shimmer' })))
                .addSubcommand(sc => sc.setName('llama').setDescription('Ask LLaMA-3.1-8b-instant a question').addStringOption(o => o.setName('prompt').setDescription('The prompt for the AI').setRequired(true)))
                .addSubcommand(sc => sc.setName('chatgpt').setDescription('Ask ChatGPT a question').addStringOption(o => o.setName('prompt').setDescription('The prompt for the AI').setRequired(true)).addBooleanOption(o => o.setName('web').setDescription('✨ Use a web search model?')))
                .addSubcommand(sc => sc.setName('ocr').setDescription('Extract text from images using AI').addAttachmentOption(o => o.setName('image').setDescription('Image to extract text from').setRequired(true)))
                .addSubcommand(sc => sc.setName('grok-imagine').setDescription('✨ Use Grok to generate an image').addStringOption(o => o.setName('prompt').setDescription('The prompt to generate the image from').setRequired(true)))
                .addSubcommand(sc => sc.setName('usage').setDescription('Check your AI usage limits'))
        );
    }

    async chatInputRun(interaction) {
        try {
            await interaction.deferReply();
        } catch (err) {
            return;
        }

        const sub = interaction.options.getSubcommand();
        const authorName = interaction.user.username;

        const usage = await checkUsage(interaction.user.id);
        if (!usage.allowed && sub !== 'usage') {
            throw new Error(`You have reached your daily limit of **${usage.limit}** tokens. Limits reset at midnight.`);
        }

        try {
            switch (sub) {
                case 'usage': {
                    const used = Math.max(0, usage.used);
                    const limit = usage.limit;
                    const percent = Math.min(100, (used / limit) * 100);
                    
                    const filledCount = Math.min(10, Math.max(0, Math.floor(percent / 10)));
                    const emptyCount = Math.min(10, Math.max(0, 10 - filledCount));

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'AI Usage Limits',
                        content: `<:fxanalytics:1486875859703955496> **Tokens Used Today:** ${used.toLocaleString()} / ${limit.toLocaleString()}\n` +
                                 `[${'▮'.repeat(filledCount)}${'▯'.repeat(emptyCount)}] **${percent.toFixed(1)}%**\n\n` +
                                 `-# Limits reset daily at 00:00 UTC.`
                    }));
                }

                case 'llama': {
                    const prompt = interaction.options.getString('prompt');
                    const res = await navy.chat.completions.create({
                        model: 'llama-3.1-8b-instant',
                        messages: [{ role: 'user', content: prompt }]
                    });

                    const reply = res.choices[0].message.content;
                    await updateUsage(interaction.user.id, res.usage.total_tokens);

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'LLaMA 3.1 Response',
                        content: reply.substring(0, 2000),
                        footer: `Used ${res.usage.total_tokens} tokens`
                    }));
                }

                case 'chatgpt': {
                    const prompt = interaction.options.getString('prompt');
                    const useWeb = interaction.options.getBoolean('web') || false;
                    
                    const res = await navy.chat.completions.create({
                        model: useWeb ? 'gpt-4o-mini' : 'gpt-4.1',
                        messages: [{ role: 'user', content: prompt }]
                    });

                    const reply = res.choices[0].message.content;
                    await updateUsage(interaction.user.id, res.usage.total_tokens);

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: useWeb ? 'ChatGPT (Web) Response' : 'ChatGPT Response',
                        content: reply.substring(0, 2000),
                        footer: `Used ${res.usage.total_tokens} tokens`
                    }));
                }

                case 'geolocate': {
                    const attachment = interaction.options.getAttachment('image');
                    const res = await navy.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: 'Where is this image taken? Give me coordinates or a specific location name.' },
                                    { type: 'image_url', image_url: { url: attachment.url } }
                                ]
                            }
                        ]
                    });

                    const reply = res.choices[0].message.content;
                    await updateUsage(interaction.user.id, res.usage.total_tokens);

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'AI Geolocation',
                        content: reply,
                        thumbnail: attachment.url
                    }));
                }

                case 'ocr': {
                    const attachment = interaction.options.getAttachment('image');
                    const res = await navy.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: 'Extract all readable text from this image. Only return the text found.' },
                                    { type: 'image_url', image_url: { url: attachment.url } }
                                ]
                            }
                        ]
                    });

                    const reply = res.choices[0].message.content;
                    await updateUsage(interaction.user.id, res.usage.total_tokens);

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'AI OCR Extraction',
                        content: reply.substring(0, 2000)
                    }));
                }

                case 'grok-imagine': {
                    const prompt = interaction.options.getString('prompt');
                    const res = await navy.images.generate({
                        model: 'grok-2-vision-1212',
                        prompt: prompt
                    });

                    const imageUrl = res.data[0].url;
                    await updateUsage(interaction.user.id, 1000);

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Grok Image Generation',
                        content: `**Prompt:** ${prompt}`,
                        media: imageUrl
                    }));
                }

                case 'tts': {
                    const text = interaction.options.getString('text');
                    const voice = interaction.options.getString('voice') || 'alloy';
                    
                    const mp3 = await navy.audio.speech.create({
                        model: 'tts-1',
                        voice: voice,
                        input: text,
                    });

                    const buffer = Buffer.from(await mp3.arrayBuffer());
                    await updateUsage(interaction.user.id, 500);

                    return interaction.editReply({
                        ...templates.utilityResult({
                            authorName,
                            title: 'AI Text-to-Speech',
                            content: `**Text:** ${text.substring(0, 100)}...\n**Voice:** ${voice}`,
                        }),
                        files: [{ attachment: buffer, name: 'tts.mp3' }]
                    });
                }

                case 'perplexity': {
                    const query = interaction.options.getString('query');
                    const res = await navy.chat.completions.create({
                        model: 'sonar-reasoning',
                        messages: [{ role: 'user', content: query }]
                    });

                    const reply = res.choices[0].message.content;
                    await updateUsage(interaction.user.id, res.usage.total_tokens);

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Perplexity Search',
                        content: reply.substring(0, 2000)
                    }));
                }

                case 'deepgeolocate': {
                    const attachment = interaction.options.getAttachment('image');
                    const res = await navy.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: 'Perform a deep forensic analysis of this image to determine its location. Look at flora, architecture, license plates, signage, and weather. Be extremely detailed.' },
                                    { type: 'image_url', image_url: { url: attachment.url } }
                                ]
                            }
                        ]
                    });

                    const reply = res.choices[0].message.content;
                    await updateUsage(interaction.user.id, res.usage.total_tokens);

                    return interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Deep AI Geolocation Analysis',
                        content: reply.substring(0, 2000),
                        media: attachment.url
                    }));
                }
            }
        } catch (err) {
            if (!interaction.deferred && !interaction.replied) return;
            return interaction.editReply(templates.error({
                message: err.message || 'An error occurred while using the AI service.'
            }));
        }
    }
}

module.exports = { AiCommand };
