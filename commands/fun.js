const { Command } = require('@sapphire/framework');
const { ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { templates } = require('../utils/templates');
const { logger } = require('../index');

class FunCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'fun', description: 'Funny and entertainment commands' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('fun')
                .setDescription('Funny and entertainment commands')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => sc.setName('ship').setDescription('Calculate compatibility between two users').addUserOption(o => o.setName('user1').setDescription('First user').setRequired(true)).addUserOption(o => o.setName('user2').setDescription('Second user').setRequired(false)))
                .addSubcommand(sc => sc.setName('8ball').setDescription('Get an answer from the magic 8-ball').addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)))
                .addSubcommand(sc => sc.setName('meme').setDescription('Fetch a random meme from Reddit'))
                .addSubcommand(sc => sc.setName('cat').setDescription('Fetch a random cat image'))
                .addSubcommand(sc => sc.setName('poll').setDescription('Create a quick reaction-based poll').addStringOption(o => o.setName('question').setDescription('The poll question').setRequired(true)).addStringOption(o => o.setName('options').setDescription('Comma-separated options (max 10)').setRequired(false)))
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
                case 'poll': {
                    const question = interaction.options.getString('question');
                    const optionsInput = interaction.options.getString('options');
                    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                    
                    let content = `<:fxreport:1486878917687250954> **Question:** ${question}\n\n`;
                    let choices = [];

                    if (optionsInput) {
                        choices = optionsInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
                        if (choices.length > 10) throw new Error('Maximum 10 options allowed.');
                        if (choices.length < 2) throw new Error('Please provide at least 2 options.');

                        choices.forEach((choice, i) => {
                            content += `${emojis[i]} ${choice}\n`;
                        });
                    } else {
                        content += `👍 Yes\n👎 No`;
                        choices = ['👍', '👎'];
                    }

                    const msg = await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Server Poll',
                        content,
                        footer: 'React to vote!'
                    }));

                    try {
                        const channel = interaction.channel || await interaction.user.createDM();
                        const fullMsg = await channel.messages.fetch(msg.id);
                        
                        if (optionsInput) {
                            for (let i = 0; i < choices.length; i++) {
                                await fullMsg.react(emojis[i]);
                            }
                        } else {
                            await fullMsg.react('👍');
                            await fullMsg.react('👎');
                        }
                    } catch (e) {
                        logger.error(`Failed to add reactions to poll: ${e.message}`);
                    }
                    return;
                }
                case 'ship': {
                    const u1 = interaction.options.getUser('user1');
                    const u2 = interaction.options.getUser('user2') || interaction.user;
                    
                    const combinedId = [u1.id, u2.id].sort().join('');
                    let hash = 0;
                    for (let i = 0; i < combinedId.length; i++) {
                        hash = ((hash << 5) - hash) + combinedId.charCodeAt(i);
                        hash |= 0;
                    }
                    const percent = Math.abs(hash % 101);
                    
                    let comment = '';
                    if (percent === 0) comment = "Absolute zero. Stay away.";
                    else if (percent < 25) comment = "Not looking good...";
                    else if (percent < 50) comment = "There's a spark, maybe?";
                    else if (percent < 75) comment = "Great match!";
                    else if (percent < 90) comment = "Soulmates!";
                    else comment = "Perfect destiny. ❤️";

                    const barFull = Math.round(percent / 10);
                    const bar = '❤️'.repeat(barFull) + '🖤'.repeat(10 - barFull);

                    const content = `<:fxrole:1486875884110483497> **Shipping:** ${u1} & ${u2}\n` +
                        `<:fxreport:1486878917687250954> **Compatibility:** **${percent}%**\n` +
                        `[${bar}]\n\n` +
                        `-# ${comment}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Matchmaking Results',
                        content
                    }));
                }

                case '8ball': {
                    const question = interaction.options.getString('question');
                    const answers = [
                        'It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes - definitely.',
                        'You may rely on it.', 'As I see it, yes.', 'Most likely.', 'Outlook good.',
                        'Yes.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.',
                        'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.',
                        'Don\'t count on it.', 'My reply is no.', 'My sources say no.',
                        'Outlook not so good.', 'Very doubtful.'
                    ];
                    const answer = answers[Math.floor(Math.random() * answers.length)];

                    const content = `<:fxnote:1486875868495089744> **Question:** ${question}\n` +
                        `<:fxmore:1486875890746003649> **Answer:** ${answer}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: '8-Ball',
                        content
                    }));
                }

                case 'meme': {
                    const res = await fetch('https://meme-api.com/gimme/memes');
                    const data = await res.json();
                    if (!data.url) throw new Error('Failed to fetch meme.');

                    const content = `<:fxlink:1486095510434480208> **Title:** [${data.title}](${data.postLink})\n` +
                        `<:fxowner:1486879424275021845> **Author:** ${data.author}\n` +
                        `<:fxnitro:1486875897201168464> **Upvotes:** ${data.ups}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `Meme from r/${data.subreddit}`,
                        content,
                        media: data.url
                    }));
                }

                case 'cat': {
                    const res = await fetch('https://api.thecatapi.com/v1/images/search');
                    const data = await res.json();
                    if (!data[0] || !data[0].url) throw new Error('Failed to fetch cat image.');

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Random Cat',
                        content: 'Meow! 🐱',
                        media: data[0].url
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

module.exports = { FunCommand };
