const insert_tiles = (file, tile_data) => {
    const split = file.split('<div class="tile-container"></div>');
    const output = [];

    output.push(split[0]);
    Object.entries(tile_data).forEach(([title, tiles]) => {
        output.push(`<h2>${title}</h2>`);
        output.push('<div class="tile-container">');
        tiles.forEach((tile, idx) => {
            const joined_tools = tile.tools?.join(' | ') || '';
            const { image, image_minified } = _get_images(tile);
            const { links } = _get_links(tile);
            output.push(`
                <div>
                    <div class="tile-item">
                        <a class="tile-link" href="#popup-${title}${idx}">
                            ${image_minified}
                        </a>
                        <div class="tile-content">
                            <h3 class="tile-title">
                            <a class="tile-link" href="#popup-${title}${idx}">
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
                            <h3 class="tile-title">${tile.title}</h3>
                            <h4><i>${tile.under_title}</i></h4>
                            <p class="tools">${joined_tools}</p>
                            <a class="close" onclick="location.href='#ignore'; history.pushState('', document.title, window.location.pathname);">&times;</a>
                            <p class="tile-description">
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
            image: `<img src="public/assets/img/${tile.image}" class="img img-pop" loading="lazy" alt="${tile.image}-screenshot">`,
            image_minified: `<img src="public/assets/img/${img[0]}.mini.${img[1]}" class="img fluid" loading="lazy" alt="${tile.image}-screenshot">`,
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
            links: tile.links.map((link) => 
                `
                <a href="${link.url}" class="tile-link tile-title-link" target="_blank" rel="noopener noreferrer">
                    ${link.icon}
                </a>
                `
            ).join('')
        }
    }

    return {
        links: ''
    };
}

module.exports = { insert_tiles };