let m = document.getElementById("noise");
let width = m.width;
let height = m.height;
m = m.getContext("2d");

draw = (x, y, c, s) => {
    m.fillStyle = c;
    m.fillRect(x, y, s, s);
}
particles = []
particle = (x, y, c) => {
    return { "x": x, "y": y, "vx": 0, "vy": 0, "color": c };
}
random = () => Math.random() * 100 + 50;
create = (number, color) => {
    group = []
    for (let i = 0; i < number; i++) {
        group.push(particle(random(), random(), color));
        particles.push(group[i]);
    }
    return group;
}

rule = (particles1, particles2, g) => {
    for (let i = 0; i < particles1.length; i++) {
        fx = 0;
        fy = 0;

        for (let j = 0; j < particles2.length; j++) {
            a = particles1[i];
            b = particles2[j];
            dx = a.x - b.x;
            dy = a.y - b.y;
            d = Math.sqrt(dx * dx + dy * dy);
            if (d > 0 && d < 80) {
                F = g * 1 / d;
                fx += (F * dx);
                fy += (F * dy);
            }
            
        }
        a.vx = (a.vx + fx) * 0.5;
        a.vy = (a.vy + fy) * 0.5;
        a.x += a.vx;
        a.y += a.vy;
        if (a.x <= 0 || a.x >= width * 0.9) { a.vx *= -1; }
        if (a.y <= 0 || a.y >= height * 0.9) { a.vy *= -1; }
    }
}

blue = create(70, "#3875ea");
magenta = create(10, "magenta");
purple = create(100, "#a62161");
update = () => {
    rule(blue, blue, -0.32);
    rule(blue, magenta, -0.17);
    rule(blue, purple, 0.35);
    rule(magenta, magenta, -0.1);
    rule(magenta, blue, -0.34);
    rule(purple, purple, 0.15);
    rule(purple, blue, -0.2);
    rule(purple, magenta, 0.2);
    m.clearRect(0, 0, 1000, 500);
    draw(0, 0, "rgb(23 23 23)", 1000);
    for (let i = 0; i < particles.length; i++) {
        draw(particles[i].x, particles[i].y, particles[i].color, 5);
    }
    requestAnimationFrame(update);
}
update();