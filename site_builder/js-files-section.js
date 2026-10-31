const insert_scripts = (file, js_files) => {
    const split = file.split(/(?<=<\/body>)\s*(?=<\/html>)/i);
    return [
        split[0],
        ...js_files.map(file => `<script type="module" fetchpriority="high" src="${file}"></script>\n`),
        split[1],
    ].join('');
}

module.exports = { insert_scripts };