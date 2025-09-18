const tiles = 
{
    "Projects" :
    [
        {
            "title": "OSRS Hiscore scrape",
            "under_title": "Scripts to interact with OSRS hiscores.",
            "image": "osrs-hiscore.png",
            "tools": ["Python", "PyTest", "Scraping"],
            "description": "This project is a data tool built around Old School RuneScape player Hiscores. It helps organize and filter player information, such as skills and boss achievements, and can save these results for later use. The tool can also analyze groups of players to highlight patterns, like averages or highest scores. In addition, it provides quick access to individual player profiles.",
        },
        {
            "title": ".Inside",
            "under_title": "A visitor registration tool",
            "image": "inside.png",
            "tools": [".NET", "C#", "ASP.NET Core", "REST API", "WPF", "ADO.NET", "SQL Server", "MySQL", "XUnit", "Moq"],
            "description": "A business park with a central reception wanted an application to register visitors to the park. This is necessary for fire safety, so that it is always known who is present on the site. Everyone visiting one of the companies must first register at the reception. To make this process as fast as possible, visitors are given the opportunity to register themselves via a touchscreen provided at the entrance. Through the touchscreen, they can enter their own information and the person they have an appointment with. Upon departure, visitors can check out again using the same touchscreen. We ensure that the privacy of visitors is respected in accordance with GDPR regulations. Visitors that came with a car can park at the car park.",
        },
        {
            "title": "Mogcord - WOP",
            "under_title": "A simple messaging platform",
            "image": "mogcord.png",
            "tools": ["Rust", "MongoDB", "REST API", "JWT", "Auth", "AlpineJs", "HTMX", "Tailwind"],
            "description": "A messaging platform which allows the user to chat with individuals or with a group of people.",
        },
        {
            "title": "Follow-up system",
            "under_title": "An interactive platform for tests",
            "image": "web3.png",
            "tools": ["React", "Node.Js", "REST API", "JWT", "Auth", "Express", "WebSockets", "MySQL", "Tailwind"],
            "description": "A follow-up system where teachers can monitor or modify the timer for a test, see asked questions, and extra requested time by students in real time. Also allows the teacher to import bulk csv data.",
        },
        {
            "title": "Electronic Receipts",
            "under_title": "Tool created to manage expenses",
            "image": "electronic-receipts.png",
            "tools": [".NET Framework", "C#", "Winforms", "Entity Framework Core", "SQL Server", "SAP Crystal Reports", "OpenXML"],
            "description": "An internal bookkeeping tool, it allows users to manage expenses made for customers or generate PDFs and Excel reports.",
        },
        {
            "title": "Monkeys",
            "under_title": "Optimal escape simulation",
            "image": "monkeys.png",
            "tools": [".NET", "C#", "MongoDB", "Bitmap"],
            "description": "Developed a simulation project focused on performance optimization. The challenge involved running large-scale simulations with complex interactions, which initially took minutes to hours to complete. By applying efficient algorithms and restructuring the system into manageable chunks, execution time was reduced to just a few seconds."
        },
        {
            "title": "Mog Site",
            "under_title": "Personal tool hub",
            "image": "mogsite.png",
            "tools": [".NET", "C#", "ASP .NET CORE", "Angular.Js", "JWT", "Auth", "Private Nuget", "Tailwind", "'Next.Js'"],
            "description": "Developed a centralized platform to consolidate all frequently used tools in one place, improving accessibility and workflow efficiency.",
        },
        {
            "title": "Mogsweeper",
            "under_title": "Minesweeper clone",
            "image": "mogsweeper.png",
            "tools": [".NET", "C#", "WPF"],
            "description": "Built a functional clone of Minesweeper game using .NET WPF. Event-driven programming, and clean implementation of game logic while recreating a familiar and interactive user experience.",
        },
        {
            "title": "Restaurant manager",
            "under_title": "REST API to book and manage reservations",
            "image": "web4.png",
            "tools": ["ASP .NET CORE", "C#", "XUNIT", "Moq", "REST API", "ADO.NET", "SQL Server",],
            "description": "Created a REST API for managing restaurant reservations, enabling viewing, booking, and updating of reservations.",
        },
    ],
    "Hobbies":
    [
        {
            "title": "Advent of Code",
            "under_title": "Holiday-themed event",
            "image": "aoc.png",
            "tools": [],
            "description": "An annual holiday-themed event featuring a series of 50 daily programming puzzles, released one per day from December 1st to December 25th.",
        },
        {
            "title": "LeetCode",
            "under_title": "Algorithm library",
            "image": "leetcode.png",
            "tools": [],
            "description": "A popular online platform providing a vast library of coding and algorithmic problems used by software developers to improve their skills, practice for technical interviews, and participate in coding competitions.",
        },
    ],
    "Contributions":
    [
        {
            "title": "NeetCode",
            "under_title": "Community-Driven Coding Interview Resource",
            "tools": [],
            "description": "I contributed solutions to NeetCode, a platform for coding interview preparation, by implementing efficient answers to algorithm and data structure challenges that support learners in mastering problem-solving techniques.",
        },
    ]
}

const fs = require("fs");

const template = fs.readFileSync("./_data/index_template.html", { encoding: 'utf8' });
const split = template.split('<div class="tile-container"></div>')
const arr = [];
arr.push(split[0]);
Object.entries(tiles).forEach(([title, tile]) => {
    arr.push(`<h2>${title}</h2>`);
    arr.push('<div class="tile-container">');
    tile.forEach((props, idx) => {
        let mini_img = '';
        let big_img = '';
        if (props.image)
        {
            const img = props.image?.split('.');
            mini_img = `<img src="public/assets/img/${img[0]}.mini.${img[1]}" class="img fluid" loading="lazy" alt="${props.image}-screenshot">`
            big_img = `<img src="public/assets/img/${props.image}" class="img img-pop" loading="lazy" alt="${props.image}-screenshot">`
        }
        arr.push(`
            <div>
                <div class="tile-item">
                    <div>
                        <a class="tile-link" href="#popup-${title}${idx}">
                            ${mini_img}
                            <div class="tile-content">
                                <h3 class="tile-title">${props.title}</h3>
                                <h4><i>${props.under_title}</i></h4>
                                <p class="tools">${props.tools.join(' | ')}</p>
                            </div>
                        </a>
                    </div>
                </div>
                <div id="popup-${title}${idx}" class="overlay" onclick="location.href='#ignore'; history.pushState('', document.title, window.location.pathname);">
                    <div class="popup" onclick="event.stopPropagation();">
                        ${big_img}
                        <h3 class="tile-title">${props.title}</h3>
                        <h4><i>${props.under_title}</i></h4>
                        <a class="close" onclick="location.href='#ignore'; history.pushState('', document.title, window.location.pathname);">&times;</a>
                        <p class="tile-description">
                            ${props.description}
                        </p>
                    </div>
                </div>
            </div>
        `);
    });
    arr.push('</div>');
});
arr.push(split[1]);

const output = arr.join('');

fs.writeFileSync('index.html', output, {
    encoding: 'utf8',
});