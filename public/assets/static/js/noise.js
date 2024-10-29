const canvas = document.getElementById("noise");
const ctx = canvas.getContext("2d");
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
};


const random = (size) => Math.random() * size;

const particle = (k, p, c, b) => {
    return {
        "key": k,
        "points": p,
        "velocity": new Point(0, 0),
        "color": c,
        "bounds": b
    };
}

const create = (k, amount, color, b) => {
    for (let i = 0; i < amount; i++) {
        particles.push(particle(k, new Point(random(canvas.width), random(canvas.height)), color, b));
    }
}

const recreate_tree = () => {
    quadtree = new QuadTree(new Rectangle(canvas.width / 2, canvas.height / 2, canvas.width, canvas.height));
    for (let i = 0; i < particles.length; i++) {
        quadtree.insert(particles[i]);
    }
}

const create_particles = (multiplier = 1) => {
    create("b", 70 * multiplier, "#3875ea", true);
    create("m", 15 * multiplier, "magenta", true);
    create("p", 150 * multiplier, "#a62161", false);
    recreate_tree();
}

const recreate_particles = () => {
    const multiplier = canvas.height == 300 ? CUSTOM_MULTIPLIER : 1;
    particles.length = 0;
    create_particles(multiplier);
};

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
    recreate_tree();
    redraw_particles();
    current_update_frame = requestAnimationFrame(update_particles);
}

const redraw_particles = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        draw(particles[i].points.x, particles[i].points.y, particles[i].color, PARTICLE_SIZE, PARTICLE_SIZE);
    }
}

const bezier = (t, initial, p1, p2, final) => {
    return (1 - t) * (1 - t) * (1 - t) * initial +
        3 * (1 - t) * (1 - t) * t * p1 +
        3 * (1 - t) * t * t * p2 +
        t * t * t * final;
}

expand_button.addEventListener("click", (_) => {
    const main = document.getElementsByTagName("main")[0];
    const newHeight = canvas.height === 300 ? 73 : 300;
    document.getElementsByTagName("header")[0].style.height = `${newHeight}px`;
    document.getElementsByClassName("fakeHeader")[0].style.height = `${newHeight}px`;
    main.style.marginTop = `${newHeight}px`;
    document.getElementById("expand_button_triangle").classList.toggle("triangle_rotate");
    if (!is_mobile()) document.getElementById("counter").classList.toggle("invisible");
    cancelAnimationFrame(current_update_frame);
    animateCanvas(0.0, canvas.height, newHeight);
});

const animateCanvas = (index, start, stop) => {
    if (index <= 1) {
        canvas.height = parseInt(bezier(index, start, 0.25, 0.25, stop));
        requestAnimationFrame(() => animateCanvas(index + 0.01, start, stop));
        recreate_particles();
        redraw_particles();
    }
    else {
        canvas.height = stop;
        recreate_particles();
        update_particles();
    }
}

plus_button.addEventListener("click", (_) => {
    if (CUSTOM_MULTIPLIER >= 30) return;
    CUSTOM_MULTIPLIER++;
    minus_button.disabled = false;
    minus_button.classList.remove("disabled");
    recreate_particles();
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
    recreate_particles();
    if (CUSTOM_MULTIPLIER <= 1) {
        minus_button.disabled = true;
        minus_button.classList.add("disabled");
    }
});

addEventListener("resize", (_) => {
    canvas.width = window.innerWidth;
    canvas.height = document.getElementsByClassName("fakeHeader")[0].offsetHeight;
    recreate_particles();
});

window.dispatchEvent(new CustomEvent("resize"));
addEventListener("load", update_particles);