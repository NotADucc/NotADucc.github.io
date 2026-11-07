const insert_tiles = (file, tile_data) => {
    const split = file.split('<div class="tile_container"></div>');
    const output = [];

    output.push(split[0]);

    Object.entries(tile_data).forEach(([title, tiles]) => {
        output.push(`<h2>${title}</h2>`);
        output.push('<div class="tile_container">');

        tiles.forEach((tile, idx) => {
            const joined_tools = tile.tools?.join(' | ') || '';

            const is_above_fold = idx < 9;
            const loading = is_above_fold ? 'eager' : 'lazy';
            const fetch_priority = idx === 0 ? 'high' : 'auto';

            const { image, image_minified } = _get_images(tile, loading, fetch_priority);
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
};

const _get_images = (tile, loading = 'lazy', fetch_priority = 'auto') => {
    if (tile.image) {
        const image_path = `public/assets/img/${tile.image}`;
        const extension = image_path.match(/\.[^.]+$/)?.[0] || '';
        const thumbnail_base = image_path.replace(/\.[^.]+$/, '.mini');
        const thumbnail_sizes = [640, 1024];

        const srcset = thumbnail_sizes
            .map(width => `${thumbnail_base}-${width}${extension} ${width}w`)
            .join(', ');

        const sizes = '(min-width: 1400px) 23.3vw, (min-width: 900px) 35vw, (min-width: 600px) 80vw, 90vw';
        const alt = `${tile.title} project screenshot`;

        return {
            image: `<img 
                src="${image_path}" 
                class="img img_pop" 
                loading="auto" 
                alt="${alt}"
                >`,
            image_minified: `<img 
                src="${thumbnail_base}-640${extension}" 
                srcset="${srcset}" 
                sizes="${sizes}" 
                class="img fluid" 
                width="640"
                height="360"
                loading="${loading}" 
                fetchpriority="${fetch_priority}" 
                alt="${alt}"
                >`
        };
    }

    return {
        image: '',
        image_minified: ''
    };
};

const _get_links = (tile) => {
    if (tile.links) {
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
        };
    }

    return {
        links: ''
    };
};

module.exports = { insert_tiles };