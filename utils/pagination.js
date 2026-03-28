/**
 * Utility for handling message pagination with Discord Components V2.
 */

const { ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

/**
 * Paginates a command's output.
 * @param {Object} interaction - The Discord interaction.
 * @param {Array|string} items - The items to paginate (array for lists, string for lyrics).
 * @param {Function} templateFn - The template function from templates.js.
 * @param {Object} baseData - Common data required by the template.
 * @param {Object} options - Pagination options.
 * @param {number} options.itemsPerPage - Items per page (for lists).
 * @param {number} options.maxChars - Max characters per page (for strings).
 */
async function paginate(interaction, items, templateFn, baseData, options = {}) {
    const itemsPerPage = options.itemsPerPage || 5;
    const maxChars = options.maxChars || 800; // conservative for Components V2 limits
    
    let pages = [];
    if (Array.isArray(items)) {
        // List pagination
        for (let i = 0; i < items.length; i += itemsPerPage) {
            pages.push(items.slice(i, i + itemsPerPage));
        }
    } else if (typeof items === 'string') {
        // Text/Lyrics pagination
        const lines = items.split('\n');
        let currentPageText = '';
        
        for (const line of lines) {
            if ((currentPageText + line).length > maxChars) {
                pages.push(currentPageText.trim());
                currentPageText = '';
            }
            currentPageText += line + '\n';
        }
        if (currentPageText.trim()) pages.push(currentPageText.trim());
    }

    let currentPage = 1;
    const totalPages = pages.length;

    const getPageData = (pageIndex) => {
        const data = { ...baseData };
        data.currentPage = pageIndex + 1;
        data.totalPages = totalPages;
        
        if (Array.isArray(items)) {
            const pageItems = pages[pageIndex];
            if (itemsPerPage === 1) {
                const entry = pageItems[0];
                if (typeof entry === 'object') {
                    // For Urban Dictionary and similar
                    Object.assign(data, {
                        word: entry.word,
                        url: entry.permalink,
                        definition: entry.definition?.replace(/[\[\]]/g, ''),
                        example: entry.example?.replace(/[\[\]]/g, ''),
                        thumbsUp: entry.thumbs_up,
                        thumbsDown: entry.thumbs_down,
                        contributor: entry.author
                    });
                }
            }
            data.listData = pageItems.join('\n\n');
        } else {
            data.lyrics = pages[pageIndex];
        }
        
        return data;
    };

    const initialMessage = await interaction.editReply(templateFn(getPageData(0)));

    if (totalPages <= 1) return;

    const collector = initialMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000, // 5 minutes
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: '❌ This paginator is not for you.', ephemeral: true });
        }

        if (i.customId === 'paginator:next') {
            currentPage++;
        } else if (i.customId === 'paginator:previous') {
            currentPage--;
        } else if (i.customId === 'paginator:cancel') {
            try {
                await interaction.deleteReply();
            } catch (e) {}
            return collector.stop();
        } else if (i.customId === 'paginator:navigate') {
            const modalId = `modal_nav_${i.id}`;
            const modal = new ModalBuilder()
                .setCustomId(modalId)
                .setTitle('Navigate to Page');

            const pageInput = new TextInputBuilder()
                .setCustomId('page_number')
                .setLabel('Page Number')
                .setPlaceholder(`Enter page number (1-${totalPages})`)
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(String(totalPages).length)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(pageInput));

            await i.showModal(modal);

            try {
                const submission = await i.awaitModalSubmit({
                    time: 60000,
                    filter: (sub) => sub.customId === modalId && sub.user.id === i.user.id,
                });

                const newPage = parseInt(submission.fields.getTextInputValue('page_number'));
                if (isNaN(newPage) || newPage < 1 || newPage > totalPages) {
                    return submission.reply({ content: `❌ Invalid page number. Please enter a number between 1 and ${totalPages}.`, ephemeral: true });
                }

                currentPage = newPage;
                await submission.update(templateFn(getPageData(currentPage - 1)));
                return;
            } catch (err) {
                return; // Timeout or error
            }
        }

        // Clamp page
        currentPage = Math.max(1, Math.min(currentPage, totalPages));
        
        await i.update(templateFn(getPageData(currentPage - 1)));
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'messageDelete') return;
        try {
            const finalData = getPageData(currentPage - 1);
            finalData.disabled = true;
            await interaction.editReply(templateFn(finalData));
        } catch (e) {}
    });
}

module.exports = { paginate };
