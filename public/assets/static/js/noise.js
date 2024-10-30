const canvas = document.getElementById("noise");
const ctx = canvas.getContext("2d");
const header = document.getElementsByTagName("header")[0];
const fake_header = document.getElementsByClassName("fakeHeader")[0];
const main = document.getElementsByTagName("main")[0];
const expand_button = document.getElementById("expand_button");
const plus_button = document.getElementById("plus_button");
const minus_button = document.getElementById("minus_button");
const FRICTION = 0.4,
    PARTICLE_SIZE = 5,
    MIN_DISTANCE = 5,
    MAX_DISTANCE = 30,
    is_mobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let CUSTOM_MULTIPLIER = is_mobile() ? 3 : 10;
let quadtree = new QuadTree(new Rectangle(canvas.width / 2, canvas.height / 2, canvas.width, canvas.height));
const particles = [];

const attraction_dct = {
    b: {
        b: 0.32,
        m: -0.4,
        p: -0.4
    },
    m: {
        b: 0.4,
        m: 0.1,
        p: -0.2
    },
    p: {
        b: 0.4,
        m: 0,
        p: -0.15
    },
}


const random = (size) => Math.random() * size;
const get_multiplier = () => canvas.height == 300 ? CUSTOM_MULTIPLIER : 1;

const particle = (k, p, c, b) => {
    return {
        key: k,
        points: p,
        velocity: new Point(0, 0),
        color: c,
        bounds: b
    };
}

const create_particle = (k, amount, color, b) => {
    for (let i = 0; i < amount; i++) {
        particles.push(particle(k, new Point(random(canvas.width), random(canvas.height)), color, b));
    }
}

const create_tree = () => {
    quadtree = new QuadTree(new Rectangle(canvas.width / 2, canvas.height / 2, canvas.width, canvas.height));
    for (let i = 0; i < particles.length; i++) {
        quadtree.insert(particles[i]);
    }
}

const create_particles = (multiplier = 1) => {
    particles.length = 0;
    create_particle("b", 70 * multiplier, "#3875ea", true);
    create_particle("m", 15 * multiplier, "magenta", true);
    create_particle("p", 150 * multiplier, "#a62161", false);
    create_tree();
}

const calc_next_positions = () => {
    for (let i = 0; i < particles.length; i++) {
        let fx = 0.0;
        let fy = 0.0;

        const seeker = particles[i];
        const rect = new Rectangle(seeker.points.x, seeker.points.y, MAX_DISTANCE, MAX_DISTANCE);
        const targets = quadtree.query(rect, []);

        for (let j = 0; j < targets.length; j++) {
            const target = targets[j];
            const attraction = attraction_dct[seeker.key][target.key];
            if (attraction == 0) continue;
            if (seeker.bounds || target.bounds) {
                dx = seeker.points.x - target.points.x;
                dy = seeker.points.y - target.points.y;
            } else {
                dx = Math.abs(seeker.points.x - target.points.x);
                dy = Math.abs(seeker.points.y - target.points.y);
                if (dx > canvas.width >> 1) dx = canvas.width - dx;
                if (dy > canvas.height >> 1) dy = canvas.height - dy;
            }
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d == 0 || d > MAX_DISTANCE) continue;
            const F = (d <= MIN_DISTANCE ? 0.3 : -attraction) / d;
            fx += F * dx;
            fy += F * dy;
        }

        seeker.velocity.x = (seeker.velocity.x + fx) * FRICTION;
        seeker.velocity.y = (seeker.velocity.y + fy) * FRICTION;
        seeker.points.x = (seeker.points.x + seeker.velocity.x + canvas.width) % canvas.width;
        seeker.points.y = (seeker.points.y + seeker.velocity.y + canvas.height) % canvas.height;
    }
}

const draw = (x, y, c, w, h) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
}

let current_update_frame;
const update_particles = () => {
    calc_next_positions();
    create_tree();
    draw_particles();
    current_update_frame = requestAnimationFrame(update_particles);
}

const draw_particles = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        draw(particles[i].points.x, particles[i].points.y, particles[i].color, PARTICLE_SIZE, PARTICLE_SIZE);
    }
}

const bezier = (x1, y1, x2, y2) => {
    const _bezier = (t, p0, p1, p2, p3) => {
        return (
            (1 - t) ** 4 * p0 +
            3 * (1 - t) ** 2 * t * p1 +
            3 * (1 - t) * t ** 2 * p2 +
            t ** 3 * p3
        );
    }

    return (t) => {
        let low = 0, high = 1, epsilon = 0.01, x;
        while (high - low > epsilon) {
            const mid = (low + high) / 2;
            x = _bezier(mid, 0, x1, x2, 1);
            if (x < t) low = mid;
            else high = mid;
        }
        
        return _bezier(low, 0, y1, y2, 1);
    };
}

const easingFunction = bezier(0.45, 0.1, 0.25, 1);

expand_button.addEventListener("click", (_) => {
    const newHeight = canvas.height === 300 ? 73 : 300;
    document.getElementById("expand_button_triangle").classList.toggle("triangle_rotate");
    if (!is_mobile()) document.getElementById("counter").classList.toggle("invisible");
    cancelAnimationFrame(current_update_frame);
    animate_header(0.0, canvas.height, newHeight);
});

const animate_header = (index, start, stop) => {
    if (index <= 1) {
        const newHeight = parseInt(start + (stop - start) * easingFunction(index));
        canvas.height = newHeight;
        header.style.height = fake_header.style.height = main.style.marginTop = `${newHeight}px`;
        requestAnimationFrame(() => animate_header(index + 0.01, start, stop));
        create_particles(1);
        draw_particles();
    }
    else {
        canvas.height = stop;
        header.style.height = fake_header.style.height = main.style.marginTop = `${stop}px`;
        create_particles(get_multiplier());
        update_particles();
    }
}

plus_button.addEventListener("click", (_) => {
    if (CUSTOM_MULTIPLIER >= 30) return;
    CUSTOM_MULTIPLIER++;
    minus_button.disabled = false;
    minus_button.classList.remove("disabled");
    create_particles(get_multiplier());
    if (CUSTOM_MULTIPLIER >= 30) {
        plus_button.disabled = true;
        plus_button.classList.add("disabled");
    }
});

minus_button.addEventListener("click", (_) => {
    if (CUSTOM_MULTIPLIER <= 1) return;
    plus_button.disabled = false;
    plus_button.classList.remove("disabled");
    CUSTOM_MULTIPLIER--;
    create_particles(get_multiplier());
    if (CUSTOM_MULTIPLIER <= 1) {
        minus_button.disabled = true;
        minus_button.classList.add("disabled");
    }
});

addEventListener("resize", (_) => {
    if (canvas.width === window.innerWidth) return;
    canvas.width = window.innerWidth;
    canvas.height = fake_header.offsetHeight;
    create_particles(get_multiplier());
});

window.dispatchEvent(new CustomEvent("resize"));
addEventListener("load", update_particles);