const projects = 
[
    {
        "title": "Mogcord",
        "under_title": "A simple messaging paltform",
        "image": "mogcord.png",
        "tools": ["Rust", "MongoDB", "REST API", "JWT", "Auth", "AlpineJs", "HTMX", "Tailwind"],
        "description": "A messaging platform which allows the user to chat with individuals or with a group of people.",
    },
    {
        "title": ".Inside",
        "under_title": "A visitor registration tool",
        "image": "inside.png",
        "tools": [".NET", "C#", "ASP.NET Core", "REST API", "WPF", "ADO.NET", "SQL SERVER", "MySQL"],
        "description": "A business park with a central reception wanted an application to register visitors to the park. This is necessary for fire safety, so that it is always known who is present on the site. Everyone visiting one of the companies must first register at the reception. To make this process as fast as possible, visitors are given the opportunity to register themselves via a touchscreen provided at the entrance. Through the touchscreen, they can enter their own information and the person they have an appointment with. Upon departure, visitors can check out again using the same touchscreen. We ensure that the privacy of visitors is respected in accordance with GDPR regulations. Visitors that came with a car can park at the car park.",
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
        "description": "An internal tool that acts as a bookkeeping tool, it allows users to manage expenses made for customers or generate PDF and Excel reports.",
    },
    {
        "title": "Monkeys",
        "under_title": "Optimal simulation where monkeys escape a forest",
        "image": "monkeys.png",
        "tools": [".NET", "C#", "MongoDB", "Bitmap"],
        "description": "A simulation where x amount of monkeys are dropped in a xx * yy sized forest with y trees. The goal was to optimize it as much as possible; to accomplish this, chunks and distance algorithms were used.",
    },
    {
        "title": "Mog Site",
        "under_title": "Personal tool hub",
        "image": "mogsite.png",
        "tools": [".NET", "C#", "ASP .NET CORE", "Angular.Js", "JWT", "Auth", "Private Nuget", "Tailwind", "'Next.Js'"],
        "description": "Personalized platform where all my most frequently used tools are centralized.",
    },
    {
        "title": "Mogsweeper",
        "under_title": "Minesweeper clone",
        "image": "mogsweeper.png",
        "tools": [".NET", "C#", "WPF"],
        "description": "Minesweeper clone made in .NET WPF.",
    },
    {
        "title": "Restaurant manager",
        "under_title": "REST API to book and manage reservations",
        "image": "web4.png",
        "tools": ["ASP .NET CORE", "C#", "XUNIT", "Moq", "REST API", "ADO.NET", "SQL SERVER",],
        "description": "REST API to view and manage reservations.",
    },
];

const proj_container = document.getElementsByClassName("project-container")[0];

projects.forEach(x => {
    const proj_item = document.createElement('div');
    proj_item.className = 'project-item';
    proj_item.innerHTML = `
        <div>
            <a href="public/assets/img/${x.image}" target="_blank" rel="noreferrer">
                <img src="public/assets/img/${x.image}" class="img-fluid" loading="lazy" alt="${x.image}-screenshot">
            </a>
            <div class="project-content">
                <h3 class="project-title">${x.title}</h3>
                <h4><i>${x.under_title}</i></h4>
                <p class="tools">${x.tools.join(' | ')}</p>
                <p class="project-description">
                    ${x.description}
                </p>
            </div>
        </div>
    `;
    proj_container.appendChild(proj_item);
});