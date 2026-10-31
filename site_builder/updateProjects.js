const { TILE_DATA } = require('./tiles-section-data.js');
const { insert_tiles } = require('./tiles-section.js');
const { insert_scripts } = require('./js-files-section.js');
const { lstatSync, readdirSync, readFileSync, writeFileSync } = require('fs');
const path = require('path');

const get_all_files = (path_name, file_names = []) => {
    if (lstatSync(path_name).isDirectory())
    {
        const folder = readdirSync(path_name, { encoding: 'utf8' });
        for (const fn of folder) 
        {
            get_all_files(
                path.join(path_name, fn),
                file_names
            );
        }
    }
    else
    {
        return file_names.push(path_name);
    }

    return file_names;
}

const args = process.argv.slice(2);

const getArg = (name) => {
    const index = args.indexOf(`--${name}`);
    return index !== -1 ? args[index + 1] : undefined;
};

const mode = getArg("mode")?.toLowerCase();

if (!mode && (mode != "debug" || mode != "prod")) {
    throw new Error("Missing argument: mode (debug/prod)");
}

const index_template = readFileSync(path.join(__dirname, 'index_template.html'), { encoding: 'utf8' });

const script = mode === "debug"
    ? [path.join("public", "assets", "static", "js", "particle_life.js")]
    : [path.join("dist", "assets", "static", "js", "main.min.js")];


let output = insert_tiles(index_template, TILE_DATA);
output = insert_scripts(output, script);


writeFileSync(
    path.join(__dirname, '../src/index.html'),
    output, 
    { encoding: 'utf8', }
);