const { Command } = require('@sapphire/framework');
const { ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { templates } = require('../utils/templates');
const { logger } = require('../index');
const { fetchWithRetry } = require('./steam');

const EMOJIS = {
    doge: '1486407499748999230',
    btc: '1317320391672332411',
    eth: '1317321708318752790',
    sol: '1486407163831255201',
    ltc: '1317315167671025684',
    xrp: '1486407166918266910',
    color: '1487147075857813677'
};

class CryptoCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'crypto', description: 'Cryptocurrency and economy commands' });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('crypto')
                .setDescription('Cryptocurrency and economy commands')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])

                .addSubcommand(sc => sc.setName('price').setDescription('Get the current price and 24h stats of a crypto').addStringOption(o => o.setName('coin').setDescription('Coin name or symbol (e.g. bitcoin, eth)').setRequired(true)))
                .addSubcommand(sc => sc.setName('graph').setDescription('View the price graph of a crypto').addStringOption(o => o.setName('coin').setDescription('Coin name or symbol').setRequired(true)))
                .addSubcommand(sc => sc.setName('address').setDescription('Check balance and transactions of a crypto address').addStringOption(o => o.setName('ticker').setDescription('Coin ticker (btc, eth, ltc)').setRequired(true)).addStringOption(o => o.setName('address').setDescription('The wallet address').setRequired(true)))
                .addSubcommand(sc => sc.setName('track').setDescription('Track a crypto transaction hash').addStringOption(o => o.setName('ticker').setDescription('Coin ticker').setRequired(true)).addStringOption(o => o.setName('hash').setDescription('The transaction hash').setRequired(true)))
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
                case 'price':
                case 'graph': {
                    const query = interaction.options.getString('coin').toLowerCase();
                    
                    const searchRes = await fetchWithRetry(`https://api.coingecko.com/api/v3/search?query=${query}`);
                    const searchData = await searchRes.json();
                    if (!searchData.coins || searchData.coins.length === 0) throw new Error('Could not find that cryptocurrency.');
                    
                    const coinId = searchData.coins[0].id;
                    const priceRes = await fetchWithRetry(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=true`);
                    const data = await priceRes.json();
                    
                    const md = data.market_data;
                    const isUp = md.price_change_percentage_24h >= 0;

                    if (sub === 'price') {
                        const content = `<:fxid:1486875838858264636> **Symbol:** \`${data.symbol.toUpperCase()}\`\n` +
                            `<:fxreport:1486878917687250954> **Price:** **$${md.current_price.usd.toLocaleString()}**\n` +
                            `<:fxanalytics:1486875859703955496> **24h Change:** ${isUp ? '📈' : '📉'} ${md.price_change_percentage_24h.toFixed(2)}%\n` +
                            `<:fxtop:1486878434188726292> **Market Cap:** $${md.market_cap.usd.toLocaleString()}\n` +
                            `<:fxcalendar:1486875894118219907> **All Time High:** $${md.ath.usd.toLocaleString()}`;

                        return await interaction.editReply(templates.utilityResult({
                            authorName,
                            title: `${data.name} Market Data`,
                            content,
                            thumbnail: data.image.large
                        }));
                    } else {
                        const { renderChart } = require('../utils/chartRenderer');
                        const fs = require('fs');
                        const path = require('path');
                        
                        const sparkline = md.sparkline_7d.price;
                        const now = Date.now();
                        const timestamps = sparkline.map((_, i) => now - (sparkline.length - 1 - i) * 3600000);

                        const chartBuffer = renderChart(sparkline, timestamps, 1000, 400);
                        const tempPath = path.join(process.cwd(), `chart-${interaction.id}.png`);
                        fs.writeFileSync(tempPath, chartBuffer);

                        const coinSymbol = data.symbol.toLowerCase();
                        const symbolMap = {
                            'btc': 'bitcoin',
                            'eth': 'etherium',
                            'ltc': 'litecoin',
                            'doge': 'dogecoin',
                            'sol': 'solana',
                            'xrp': 'xrp'
                        };
                        const emojiKey = symbolMap[coinSymbol] || coinSymbol;
                        const emojiId = templates.EMOJIS[emojiKey] || templates.EMOJIS.color;
                        const emojiName = templates.EMOJIS[emojiKey] ? emojiKey : 'fxcolor';

                        const res = await interaction.editReply(templates.cryptoChart({
                            coinEmojiName: emojiName, 
                            coinEmoji: emojiId,
                            coinName: `${data.name} (${data.symbol.toUpperCase()})`,
                            coinUrl: `https://www.coingecko.com/en/coins/${coinId}`,
                            isUp,
                            price: md.current_price.usd.toLocaleString(),
                            change: md.price_change_24h_in_currency.usd.toLocaleString(),
                            changePct: md.price_change_percentage_24h.toFixed(2),
                            high: Math.max(...sparkline).toLocaleString(),
                            low: Math.min(...sparkline).toLocaleString(),
                            chartFile: tempPath
                        }));

                        setTimeout(() => {
                            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                        }, 10000);
                        return res;
                    }
                }

                case 'address': {
                    const ticker = interaction.options.getString('ticker').toLowerCase();
                    const address = interaction.options.getString('address');
                    
                    const res = await fetchWithRetry(`https://api.blockcypher.com/v1/${ticker}/main/addrs/${address}/balance`);
                    if (!res.ok) throw new Error('Could not find that address or the coin is not supported by this explorer.');
                    const data = await res.json();

                    const content = `<:fxid:1486875838858264636> **Address:** \`${address}\`\n` +
                        `<:fxreport:1486878917687250954> **Balance:** **${(data.balance / 10**8).toFixed(8)} ${ticker.toUpperCase()}**\n` +
                        `<:fxanalytics:1486875859703955496> **Total Received:** ${(data.total_received / 10**8).toFixed(8)}\n` +
                        `<:fxmore:1486875890746003649> **Transactions:** ${data.n_tx}`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: `${ticker.toUpperCase()} Wallet Audit`,
                        content
                    }));
                }

                case 'track': {
                    const ticker = interaction.options.getString('ticker').toLowerCase();
                    const hash = interaction.options.getString('hash');
                    
                    const res = await fetchWithRetry(`https://api.blockcypher.com/v1/${ticker}/main/txs/${hash}`);
                    if (!res.ok) throw new Error('Could not find that transaction hash.');
                    const data = await res.json();

                    const content = `<:fxid:1486875838858264636> **TX Hash:** \`${hash}\`\n` +
                        `<:fxreport:1486878917687250954> **Confirmations:** **${data.confirmations}**\n` +
                        `<:fxanalytics:1486875859703955496> **Amount:** ${(data.total / 10**8).toFixed(8)} ${ticker.toUpperCase()}\n` +
                        `<:fxcalendar:1486875894118219907> **Time:** <t:${Math.floor(new Date(data.received).getTime() / 1000)}:R>`;

                    return await interaction.editReply(templates.utilityResult({
                        authorName,
                        title: 'Transaction Tracker',
                        content,
                        footer: data.confirmations > 6 ? '✅ Transaction Confirmed' : '⏳ Pending Confirmation'
                    }));
                }
            }
        } catch (err) {
            if (!interaction.deferred && !interaction.replied) return;
            return interaction.editReply(templates.error({
                message: err.message || 'An error occurred while executing the crypto command.'
            }));
        }
    }
}

module.exports = { CryptoCommand };
