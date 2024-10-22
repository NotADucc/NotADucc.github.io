addEventListener("resize", (_) => {
    canvas.width = window.innerWidth;
    canvas.height = document.getElementsByClassName("fakeHeader")[0].offsetHeight;
});

const FRICTION = 0.6; const PARTICLE_SIZE = 5; const MIN_DISTANCE = 5; const MAX_DISTANCE = 30;
const canvas = document.getElementById("noise");
const button = document.getElementById("expand_button");
button.addEventListener("click", (_) => {
    const main = document.getElementsByTagName("main")[0];
    const height = canvas.height == 300 ? 73 : 300;
    document.getElementsByTagName("header")[0].style.height = `${height}px`;
    document.getElementsByClassName("fakeHeader")[0].style.height = `${height}px`;
    document.getElementById("expand_button_text").classList.toggle("triangle_rotate");
    main.style.marginTop = `${height}px`;
    canvas.height = height;
});
window.dispatchEvent(new CustomEvent("resize"));
const ctx = canvas.getContext("2d");


const draw = (x, y, c, w, h) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
}

const particle = (x, y, c, b) => {
    return { "x": x, "y": y, "vx": 0, "vy": 0, "color": c, "bounds": b };
}

const random = () => Math.random() *  50;

const create = (amount, color, b) => {
    const group = [];
    for (let i = 0; i < amount; i++) {
        group.push(particle(random(), random(), color, b));
        particles.push(group[i]);
    }
    return group;
}

const rule = (seekers, targets, attraction) => {
    for (let i = 0; i < seekers.length; i++) {
        let fx = 0.0;
        let fy = 0.0;
        
        const seeker = seekers[i];
        for (let j = 0; j < targets.length; j++) {
            const target = targets[j];
            if (seeker.bounds || target.bounds) {
                dx = seeker.x - target.x;
                dy = seeker.y - target.y;
            }
            else {
                dx = Math.abs(seeker.x - target.x);
                dy = Math.abs(seeker.y - target.y);
                if (dx > canvas.width >> 1) dx = canvas.width - dx;
                if (dy > canvas.height >> 1) dy = canvas.height - dy;
            }
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d == 0 || d > MAX_DISTANCE) continue;
            const F = (d <= MIN_DISTANCE ? 0.3 : -attraction) / d;
            fx += F * dx;
            fy += F * dy;
        }
        
        seeker.vx = (seeker.vx + fx) * FRICTION;
        seeker.vy = (seeker.vy + fy) * FRICTION;
        seeker.x = (seeker.x + seeker.vx + canvas.width) % canvas.width;
        seeker.y = (seeker.y + seeker.vy + canvas.height) % canvas.height;
    }
}

const update = () => {
    rule(blue, blue, 0.32);
    rule(blue, magenta, -0.4);
    rule(blue, purple, -0.4);
    rule(magenta, magenta, 0.1);
    rule(magenta, purple, -0.2);
    rule(magenta, blue, 0.4);
    rule(purple, purple, -0.15);
    rule(purple, blue, 0.4);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        draw(particles[i].x, particles[i].y, particles[i].color, PARTICLE_SIZE, PARTICLE_SIZE);
    }
    requestAnimationFrame(update);
}

const particles = [];
const blue = create(70, "#3875ea", true);
const magenta = create(15, "magenta", true);
const purple = create(150, "#a62161", false);
update();