const { Command } = require('@sapphire/framework');
const { ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { templates } = require('../utils/templates');
const { logger } = require('../index');
const { createCanvas, loadImage } = require('canvas');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
const path = require('path');

class MediaCommand extends Command {
    constructor(context, options) {
        super(context, { ...options, name: 'media', description: 'Multimedia commands' });
    }

    registerApplicationCommands(registry) {
        const addGifOption = (sc) => sc.addBooleanOption(o => o.setName('to_gif').setDescription('Output as a GIF'));

        registry.registerChatInputCommand((builder) =>
            builder
                .setName('media')
                .setDescription('Multimedia commands')
                .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
                .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
                
                .addSubcommand(sc => addGifOption(sc.setName('imagetogif').setDescription('Convert an image to GIF').addAttachmentOption(o => o.setName('image').setDescription('Image to convert').setRequired(true))))
                .addSubcommand(sc => addGifOption(sc.setName('speechbubble').setDescription('Add a speech bubble cutout to an image').addAttachmentOption(o => o.setName('image').setDescription('Image to process').setRequired(true))))
                .addSubcommand(sc => addGifOption(sc.setName('caption').setDescription('Add caption to an image').addAttachmentOption(o => o.setName('image').setDescription('Image to process').setRequired(true)).addStringOption(o => o.setName('text').setDescription('Caption text').setRequired(true))))
                .addSubcommand(sc => addGifOption(sc.setName('deepfry').setDescription('Deepfry an image').addAttachmentOption(o => o.setName('image').setDescription('Image to process').setRequired(true))))
                .addSubcommand(sc => addGifOption(sc.setName('flip').setDescription('Flip an image').addAttachmentOption(o => o.setName('image').setDescription('Image to process').setRequired(true)).addStringOption(o => o.setName('direction').setDescription('Flip direction').setRequired(true).addChoices({ name: 'Horizontal', value: 'h' }, { name: 'Vertical', value: 'v' }))))
                .addSubcommand(sc => addGifOption(sc.setName('invert').setDescription('Invert image colors').addAttachmentOption(o => o.setName('image').setDescription('Image to process').setRequired(true))))
                .addSubcommand(sc => addGifOption(sc.setName('overlay').setDescription('Overlay one image on another').addAttachmentOption(o => o.setName('base').setDescription('Base image').setRequired(true)).addAttachmentOption(o => o.setName('overlay').setDescription('Image to overlay').setRequired(true))))
                .addSubcommand(sc => addGifOption(sc.setName('stretch').setDescription('Stretch an image horizontally').addAttachmentOption(o => o.setName('image').setDescription('Image to process').setRequired(true)).addIntegerOption(o => o.setName('factor').setDescription('Stretch factor (%)').setMinValue(50).setMaxValue(500))))
                .addSubcommand(sc => addGifOption(sc.setName('resize').setDescription('Change image dimensions').addAttachmentOption(o => o.setName('image').setDescription('Image to process').setRequired(true)).addIntegerOption(o => o.setName('width').setDescription('New width (px)')).addIntegerOption(o => o.setName('height').setDescription('New height (px)'))))
                .addSubcommand(sc => addGifOption(sc.setName('compress').setDescription('Reduce image file size').addAttachmentOption(o => o.setName('image').setDescription('Image to process').setRequired(true)).addIntegerOption(o => o.setName('quality').setDescription('Quality (1-100)').setMinValue(1).setMaxValue(100))))
                .addSubcommand(sc => addGifOption(sc.setName('removebg').setDescription('Remove a specific color from an image').addAttachmentOption(o => o.setName('image').setDescription('Image to process').setRequired(true)).addStringOption(o => o.setName('color').setDescription('Hex color to remove (e.g. #ffffff)').setRequired(true))))
                .addSubcommand(sc => addGifOption(sc.setName('grayscale').setDescription('Convert an image to black and white').addAttachmentOption(o => o.setName('image').setDescription('Image to process').setRequired(true))))
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
        const toGif = interaction.options.getBoolean('to_gif') || (sub === 'imagetogif');

        try {
            const attachment = interaction.options.getAttachment('image') || interaction.options.getAttachment('base');
            const img = await loadImage(attachment.url);
            
            let canvas = createCanvas(img.width, img.height);
            let ctx = canvas.getContext('2d');

            let format = 'image/png';
            let extension = 'png';

            switch (sub) {
                case 'flip': {
                    const dir = interaction.options.getString('direction');
                    if (dir === 'h') {
                        ctx.translate(img.width, 0);
                        ctx.scale(-1, 1);
                    } else {
                        ctx.translate(0, img.height);
                        ctx.scale(1, -1);
                    }
                    ctx.drawImage(img, 0, 0);
                    break;
                }

                case 'invert': {
                    ctx.drawImage(img, 0, 0);
                    const data = ctx.getImageData(0, 0, img.width, img.height);
                    for (let i = 0; i < data.data.length; i += 4) {
                        data.data[i] = 255 - data.data[i];
                        data.data[i + 1] = 255 - data.data[i + 1];
                        data.data[i + 2] = 255 - data.data[i + 2];
                    }
                    ctx.putImageData(data, 0, 0);
                    break;
                }

                case 'grayscale': {
                    ctx.drawImage(img, 0, 0);
                    const data = ctx.getImageData(0, 0, img.width, img.height);
                    for (let i = 0; i < data.data.length; i += 4) {
                        const avg = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
                        data.data[i] = data.data[i + 1] = data.data[i + 2] = avg;
                    }
                    ctx.putImageData(data, 0, 0);
                    break;
                }

                case 'stretch': {
                    const factor = (interaction.options.getInteger('factor') || 200) / 100;
                    canvas = createCanvas(img.width * factor, img.height);
                    ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, img.width * factor, img.height);
                    break;
                }

                case 'resize': {
                    const w = interaction.options.getInteger('width') || img.width;
                    const h = interaction.options.getInteger('height') || img.height;
                    canvas = createCanvas(w, h);
                    ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    break;
                }

                case 'overlay': {
                    const overlayAttr = interaction.options.getAttachment('overlay');
                    const overlayImg = await loadImage(overlayAttr.url);
                    ctx.drawImage(img, 0, 0);
                    ctx.drawImage(overlayImg, 0, 0, img.width, img.height);
                    break;
                }

                case 'caption': {
                    const text = interaction.options.getString('text').toUpperCase();
                    const headerHeight = Math.floor(img.height * 0.15);
                    canvas = createCanvas(img.width, img.height + headerHeight);
                    ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, headerHeight);
                    ctx.drawImage(img, 0, headerHeight);
                    ctx.fillStyle = '#000000';
                    const fontSize = Math.floor(headerHeight * 0.7);
                    ctx.font = `bold ${fontSize}px Impact, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(text, canvas.width / 2, headerHeight / 2);
                    break;
                }

                case 'speechbubble': {
                    ctx.drawImage(img, 0, 0);
                    ctx.globalCompositeOperation = 'destination-out';
                    const w = img.width;
                    const h = img.height;
                    const bh = h * 0.12;
                    // * bubble
                    ctx.beginPath();
                    ctx.ellipse(w / 2, -bh * 0.1, w * 0.48, bh, 0, 0, Math.PI * 2);
                    ctx.fill();
                    // * arrow
                    ctx.beginPath();
                    ctx.moveTo(w * 0.75, bh * 0.5);
                    ctx.quadraticCurveTo(w * 0.85, bh * 0.8, w * 0.9, bh * 1.5);
                    ctx.quadraticCurveTo(w * 0.88, bh * 0.8, w * 0.82, bh * 0.5);
                    ctx.fill();
                    break;
                }

                case 'deepfry': {
                    ctx.drawImage(img, 0, 0);
                    const data = ctx.getImageData(0, 0, img.width, img.height);
                    for (let i = 0; i < data.data.length; i += 4) {
                        data.data[i] = Math.min(255, data.data[i] * 1.5);
                        data.data[i + 1] = Math.min(255, data.data[i + 1] * 0.8);
                        data.data[i + 2] = Math.min(255, data.data[i + 2] * 0.5);
                    }
                    ctx.putImageData(data, 0, 0);
                    break;
                }

                case 'removebg': {
                    const color = interaction.options.getString('color') || '#ffffff';
                    const r = parseInt(color.replace('#', '').slice(0, 2), 16);
                    const g = parseInt(color.replace('#', '').slice(2, 4), 16);
                    const b = parseInt(color.replace('#', '').slice(4, 6), 16);
                    ctx.drawImage(img, 0, 0);
                    const data = ctx.getImageData(0, 0, img.width, img.height);
                    for (let i = 0; i < data.data.length; i += 4) {
                        const dr = Math.abs(data.data[i] - r);
                        const dg = Math.abs(data.data[i+1] - g);
                        const db = Math.abs(data.data[i+2] - b);
                        if (dr < 35 && dg < 35 && db < 35) data.data[i+3] = 0;
                    }
                    ctx.putImageData(data, 0, 0);
                    break;
                }

                default: {
                    ctx.drawImage(img, 0, 0);
                    break;
                }
            }

            let finalBuffer = canvas.toBuffer('image/png');
            extension = 'png';

            if (toGif) {
                finalBuffer = await new Promise((resolve, reject) => {
                    const ff = spawn(ffmpegPath, ['-i', 'pipe:0', '-f', 'gif', 'pipe:1']);
                    const chunks = [];
                    ff.stdout.on('data', chunk => chunks.push(chunk));
                    ff.on('close', () => resolve(Buffer.concat(chunks)));
                    ff.on('error', reject);
                    ff.stdin.write(canvas.toBuffer('image/png'));
                    ff.stdin.end();
                });
                extension = 'gif';
            }

            if (!interaction.deferred && !interaction.replied) return;
            return await interaction.editReply(templates.utilityResult({
                authorName,
                title: `Media: ${sub.charAt(0).toUpperCase() + sub.slice(1)}`,
                content: 'Processed image:',
                extraFiles: [{ attachment: finalBuffer, name: `processed.${extension}` }],
                media: `attachment://processed.${extension}`
            }));

        } catch (err) {
            if (!interaction.deferred && !interaction.replied) return;
            return await interaction.editReply(templates.error({
                message: err.message || 'An error occurred while processing the image.'
            }));
        }
    }
}

module.exports = { MediaCommand };
