const insert_tiles = (file, tile_data) => {
    const split = file.split('<div class="tile_container"></div>');
    const output = [];

    output.push(split[0]);
    Object.entries(tile_data).forEach(([title, tiles]) => {
        output.push(`<h2>${title}</h2>`);
        output.push('<div class="tile_container">');
        tiles.forEach((tile, idx) => {
            const joined_tools = tile.tools?.join(' | ') || '';
            const { image, image_minified } = _get_images(tile);
            const { links } = _get_links(tile);
            output.push(`
                <div>
                    <div class="tile_item">
                        <a class="tile_link" href="#popup-${title}${idx}" aria-label="View details for ${tile.title}">
                            ${image_minified}
                        </a>
                        <div class="tile_content">
                            <h3 class="tile_title">
                            <a class="tile_link" href="#popup-${title}${idx}">
                                ${tile.title} 
                            </a>
                            ${links}
                            </h3>
                            <h4><i>${tile.under_title}</i></h4>
                            <p class="tools">${joined_tools}</p>
                        </div>
                    </div>
                    <div id="popup-${title}${idx}" class="overlay" onclick="location.href='#ignore'; history.pushState('', document.title, window.location.pathname);">
                        <div class="popup" onclick="event.stopPropagation();">
                            ${image}
                            <h3 class="tile_title">${tile.title}</h3>
                            <h4><i>${tile.under_title}</i></h4>
                            <p class="tools">${joined_tools}</p>
                            <a class="close" aria-label="Close ${tile.title} details" onclick="location.href='#ignore'; history.pushState('', document.title, window.location.pathname);">&times;</a>
                            <p class="tile_description">
                                ${tile.description}
                            </p>
                        </div>
                    </div>
                </div>
            `);
        });
        output.push('</div>');
    });
    output.push(split[1]);

    return output.join('');
}

const _get_images = (tile) =>
{
    if (tile.image)
    {
        const img = tile.image?.split('.');
        return {
            image: `<img src="public/assets/img/${tile.image}" class="img img_pop" loading="lazy" alt="${tile.title} project screenshot">`,
            image_minified: `<img src="public/assets/img/${img[0]}.mini.${img[1]}" class="img fluid" loading="lazy" alt="${tile.title} project screenshot">`,
        }
    }

    return {
        image: '',
        image_minified: '',
    }
}

const _get_links = (tile) =>
{
    if (tile.links)
    {
        return {
           links: tile.links.map((link) => {
                if (link.action) {
                    return `
                        <button 
                            type="button" 
                            id="${link.action}" 
                            class="tile_link tile_title_link tile_action"
                            aria-label="Visit ${tile.title} on ${link.icon.label}"
                        >
                            ${link.icon.html}
                        </button>
                    `;
                }

                return `
                    <a href="${link.url}" 
                        class="tile_link tile_title_link" 
                        target="_blank" rel="noopener noreferrer" 
                        aria-label="Visit ${tile.title} on ${link.icon.label}"
                    >
                        ${link.icon.html}
                    </a>
                `;
            }).join('')
        }
    }

    return {
        links: ''
    };
}

module.exports = { insert_tiles };