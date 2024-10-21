let canvas = document.getElementById("noise");
canvas.width = window.innerWidth;
canvas.height = document.getElementsByTagName("header")[0].offsetHeight;
const MULTIPLIER = 0.3;
ctx = canvas.getContext("2d");



draw = (x, y, c, w, h) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
}
particles = []
particle = (x, y, c) => {
    return { "x": x, "y": y, "vx": 0, "vy": 0, "color": c };
}
random = () => Math.random() * canvas.width + 50;
create = (amount, color) => {
    group = []
    for (let i = 0; i < amount; i++) {
        group.push(particle(random(), random(), color));
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
            dx = seeker.x - target.x;
            dy = seeker.y - target.y;
            d = Math.sqrt(dx * dx + dy * dy);
            if (d > 0 && d <= 100) {
                F = -attraction / d;
                fx += F * dx;
                fy += F * dy;
            }
        }
        seeker.vx = (seeker.vx + fx) * MULTIPLIER;
        seeker.vy = (seeker.vy + fy) * MULTIPLIER;
        seeker.x += seeker.vx;
        seeker.y += seeker.vy;
        if (seeker.x < 0) { seeker.x = canvas.width; }
		else if (seeker.x > canvas.width) { seeker.x = 0; }
		if (seeker.y < 0) { seeker.y = canvas.height; }
		else if (seeker.y > canvas.height) { seeker.y = 0; }
    }
}

blue = create(70, "#3875ea");
magenta = create(10, "magenta");
purple = create(150, "#a62161");
update = () => {
    rule(blue, blue, 0.32);
    rule(blue, magenta, 0.17);
    rule(blue, purple, -0.35);
    rule(magenta, magenta, 0.1);
    rule(magenta, blue, 0.34);
    rule(purple, purple, -0.35);
    rule(purple, blue, 0.2);
    rule(purple, magenta, -0.2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        draw(particles[i].x, particles[i].y, particles[i].color, 5, 5);
    }
    requestAnimationFrame(update);
}
update();

addEventListener("resize", (_) => {
    canvas.width = window.innerWidth;
    canvas.height = document.getElementsByTagName("header")[0].offsetHeight;
});