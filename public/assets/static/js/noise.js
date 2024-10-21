let canvas = document.getElementById("noise");
canvas.width = window.innerWidth;
canvas.height = document.getElementsByTagName("header")[0].offsetHeight;
document.getElementsByClassName("fakeHeader")[0].offsetHeight = canvas.height;
const FRICTION = 0.3; const PARTICLE_SIZE = 5;
ctx = canvas.getContext("2d");



draw = (x, y, c, w, h) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
}
particles = []
particle = (x, y, c, b) => {
    return { "x": x, "y": y, "vx": 0, "vy": 0, "color": c, "bounds": b };
}
random = () => Math.random() * canvas.width + 50;
create = (amount, color, bounds) => {
    group = []
    for (let i = 0; i < amount; i++) {
        group.push(particle(random(), random(), color, bounds));
        particles.push(group[i]);
    }
    return group;
}

rule = (seekers, targets, attraction) => {
    for (let i = 0; i < seekers.length; i++) {
        fx = 0.0;
        fy = 0.0;

        for (let j = 0; j < targets.length; j++) {
            seeker = seekers[i];
            target = targets[j];
            if (seeker.bounds || target.bounds) {
                dx = seeker.x - target.x;
                dy = seeker.y - target.y;
            } else {
                dx = Math.abs(seeker.x - target.x);
                dy = Math.abs(seeker.y - target.y);
                if (dx > canvas.width >> 1) dx = canvas.width - dx;
                if (dy > canvas.height >> 1) dy = canvas.height - dy;
            }
            d = Math.sqrt(dx * dx + dy * dy);
            if (d > 0 && d <= 7) {
                F = 0.9 / d;
                fx += F * dx;
                fy += F * dy;
            } 
            else if (d > 0 && d <= 80) {
                F = -attraction / d;
                fx += F * dx;
                fy += F * dy;
            }
        }
        seeker.vx = (seeker.vx + fx) * FRICTION;
        seeker.vy = (seeker.vy + fy) * FRICTION;
        seeker.x = (seeker.x + seeker.vx + canvas.width) % canvas.width;
        seeker.y = (seeker.y + seeker.vy + canvas.height) % canvas.height;
    }
}

blue = create(70, "#3875ea", true);
magenta = create(10, "magenta", true);
purple = create(150, "#a62161", false);
update = () => {
    rule(blue, blue, 0.32);
    rule(blue, magenta, -0.4);
    rule(blue, purple, -0.4);
    rule(magenta, magenta, 0.1);
    rule(magenta, blue, 0.4);
    rule(purple, purple, -0.15);
    rule(purple, blue, 0.2);
    rule(purple, magenta, -0.2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        draw(particles[i].x, particles[i].y, particles[i].color, PARTICLE_SIZE, PARTICLE_SIZE);
    }
    requestAnimationFrame(update);
}
update();

addEventListener("resize", (_) => {
    canvas.width = window.innerWidth;
    canvas.height = document.getElementsByTagName("header")[0].offsetHeight;
    document.getElementsByClassName("fakeHeader")[0].offsetHeight = canvas.height;
});