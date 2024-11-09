const canvas = document.getElementById("noise");
let ctx;
const header = document.getElementsByTagName("header")[0];
const fake_header = document.getElementsByClassName("fakeHeader")[0];
const main = document.getElementsByTagName("main")[0];
const expand_button = document.getElementById("expand_button");
const plus_button = document.getElementById("plus_button");
const minus_button = document.getElementById("minus_button");
const FRICTION = 0.4,
    PARTICLE_SIZE = 5.0,
    MIN_DISTANCE = 5,
    MAX_DISTANCE = 30,
    is_mobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    get_multiplier = () => canvas.height == 300 ? CUSTOM_MULTIPLIER : 1,
    random = (size) => Math.random() * size,
    easingFunction = bezier(0.45, 0.1, 0.25, 1);
let CUSTOM_MULTIPLIER = is_mobile() ? 3 : 10;
let quadtree = new QuadTree(new Rectangle(canvas.width / 2, canvas.height / 2, canvas.width, canvas.height));
const particles = []; let positions, colors, saved_len = 0;
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
// gets overwritten depending on ctx
let draw_particles = () => {}, update_viewport = () => {};

const create_tree = () => {
    quadtree = new QuadTree(new Rectangle(canvas.width / 2, canvas.height / 2, canvas.width, canvas.height));
    for (let i = 0; i < particles.length; i++) {
        quadtree.insert(particles[i]);
    }
}

const particle = (id, k, p, c, b) => {
    return {
        id,
        key: k,
        position: p,
        velocity: [0, 0],
        color: c,
        bounds: b
    };
}

const add_particles = (k, amount, color, b) => {
    for (let i = 0; i < amount; i++) {
        particles.push(particle(particles.length, k, [random(canvas.width), random(canvas.height)], color, b));
    }
}

const create_particles = (multiplier = 1) => {
    particles.length = 0;
    add_particles("b", 70 * multiplier, [0.22, 0.45, 0.91, 1, "#3875ea"], true);
    add_particles("m", 15 * multiplier, [1, 0, 1, 1, "ff00ff"], true);
    add_particles("p", 150 * multiplier, [0.65, 0.13, 0.38, 1, "#a62161"], false);
    create_tree();
}

const calc_next_positions = () => {
    const canvas_width = canvas.width;
    const canvas_height = canvas.height;
    for (let i = 0; i < particles.length; i++) {
        let fx = 0.0;
        let fy = 0.0;

        const seeker = particles[i];
        const rect = new Rectangle(seeker.position[0], seeker.position[1], MAX_DISTANCE, MAX_DISTANCE);
        const targets = quadtree.query(rect, []);

        for (let j = 0; j < targets.length; j++) {
            const target = targets[j];
            const attraction = attraction_dct[seeker.key][target.key];
            if (attraction == 0) continue;
            let dx, dy;
            if (seeker.bounds || target.bounds) {
                dx = seeker.position[0] - target.position[0];
                dy = seeker.position[1] - target.position[1];
            } else {
                dx = Math.abs(seeker.position[0] - target.position[0]);
                dy = Math.abs(seeker.position[1] - target.position[1]);
                if (dx > canvas_width >> 1) dx = canvas_width - dx;
                if (dy > canvas_height >> 1) dy = canvas_height - dy;
            }
            const d = dx * dx + dy * dy;
            if (d == 0 || d > MAX_DISTANCE * MAX_DISTANCE) continue;
            const d_sqrt = Math.sqrt(d);
            const F = (d_sqrt <= MIN_DISTANCE ? 0.3 : -attraction) / d_sqrt;
            fx += F * dx;
            fy += F * dy;
        }

        const old_x = seeker.position[0], old_y = seeker.position[1];
        seeker.velocity[0] = (seeker.velocity[0] + fx) * FRICTION;
        seeker.velocity[1] = (seeker.velocity[1] + fy) * FRICTION;
        seeker.position[0] = (seeker.position[0] + seeker.velocity[0] + canvas_width) % canvas_width;
        seeker.position[1] = (seeker.position[1] + seeker.velocity[1] + canvas_height) % canvas_height;

        if(quadtree.remove_particle(old_x, old_y, seeker)) quadtree.insert(seeker);
    }
}

let current_update_frame;
const update_particles = () => {
    calc_next_positions();
    quadtree.remove_nodes();
    draw_particles();
    current_update_frame = requestAnimationFrame(update_particles);
}

const animate_header = (index, start, stop) => {
    if (index <= 1) {
        const newHeight = start + (stop - start) * easingFunction(index);
        canvas.height = newHeight;
        header.style.height = fake_header.style.height = main.style.marginTop = `${newHeight}px`;
        update_viewport();
        requestAnimationFrame(() => animate_header(index + 0.01, start, stop));
        create_particles(1);
        draw_particles();
    }
    else {
        canvas.height = stop;
        header.style.height = fake_header.style.height = main.style.marginTop = `${stop}px`;
        update_viewport();
        create_particles(get_multiplier());
        update_particles();
    }
}


const init = () => {
    ctx = canvas.getContext('webgl');
    if (ctx) {
        update_viewport = () => {
            ctx.viewport(0, 0, ctx.drawingBufferWidth, ctx.drawingBufferHeight);
        }
        const vertexShaderSrc = `
            precision lowp float;
            attribute vec2 a_position;
            attribute vec4 a_color;
            uniform vec2 u_resolution;
            uniform float u_pointSize;
            varying vec4 v_color;
        
            void main() {
                vec2 zeroToOne = a_position / u_resolution;
                vec2 zeroToTwo = zeroToOne * 2.0;
                vec2 clipSpace = zeroToTwo - 1.0;
        
                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                gl_PointSize  = u_pointSize;
                v_color = a_color;
            }
        `;

        const fragmentShaderSrc = `
            precision lowp float;
            varying vec4 v_color;

            void main() {
                gl_FragColor = v_color;
            }
        `;

        const createShader = (ctx, type, source) => {
            const shader = ctx.createShader(type);
            ctx.shaderSource(shader, source);
            ctx.compileShader(shader);
            if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
                console.error("Shader compile error: ", ctx.getShaderInfoLog(shader));
                ctx.deleteShader(shader);
                return null;
            }
            return shader;
        }

        const vertexShader = createShader(ctx, ctx.VERTEX_SHADER, vertexShaderSrc);
        const fragmentShader = createShader(ctx, ctx.FRAGMENT_SHADER, fragmentShaderSrc);

        const program = ctx.createProgram();
        ctx.attachShader(program, vertexShader);
        ctx.attachShader(program, fragmentShader);
        ctx.linkProgram(program);

        if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
            console.error("Program linking error: ", ctx.getProgramInfoLog(program));
            return;
        }

        const positionLocation = ctx.getAttribLocation(program, "a_position");
        const colorLocation = ctx.getAttribLocation(program, "a_color");
        const resolutionLocation = ctx.getUniformLocation(program, "u_resolution");
        const uPointSizeLocation  = ctx.getUniformLocation(program, "u_pointSize");
        
        const positionBuffer = ctx.createBuffer();
        const colorBuffer = ctx.createBuffer();
        
        draw_particles = () => {   
            if (particles.length !== saved_len) {
                positions = new Float32Array(particles.length << 1);
                colors = new Float32Array(particles.length << 2);
                saved_len = particles.length;
            }
            
            for (let i = 0; i < particles.length; i++) {
                const prtl = particles[i];
                positions[i << 1] = prtl.position[0];
                positions[(i << 1) + 1] = prtl.position[1];
                colors[(i << 2)] = prtl.color[0];
                colors[(i << 2) + 1] = prtl.color[1];
                colors[(i << 2) + 2] = prtl.color[2];
                colors[(i << 2) + 3] = 1;
            }
            
            ctx.bindBuffer(ctx.ARRAY_BUFFER, positionBuffer);
            ctx.bufferData(ctx.ARRAY_BUFFER, positions, ctx.DYNAMIC_DRAW);
            ctx.enableVertexAttribArray(positionLocation);
            ctx.vertexAttribPointer(positionLocation, 2, ctx.FLOAT, false, 0, 0);
            
            ctx.bindBuffer(ctx.ARRAY_BUFFER, colorBuffer);
            ctx.bufferData(ctx.ARRAY_BUFFER, colors, ctx.DYNAMIC_DRAW);
            ctx.enableVertexAttribArray(colorLocation);
            ctx.vertexAttribPointer(colorLocation, 4, ctx.FLOAT, false, 0, 0);
            
            ctx.useProgram(program);
            ctx.uniform2f(resolutionLocation, canvas.width, canvas.height);
            ctx.uniform1f(uPointSizeLocation, PARTICLE_SIZE);
            ctx.clear(ctx.COLOR_BUFFER_BIT);
            
            ctx.drawArrays(ctx.position, 0, particles.length);
        }

    } else {
        ctx = canvas.getContext('2d');

        const draw = (x, y, c, w, h) => {
            ctx.fillStyle = c;
            ctx.fillRect(x, y, w, h);
        }

        draw_particles = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < particles.length; i++) {
                draw(particles[i].position[0], particles[i].position[1], particles[i].color[4], PARTICLE_SIZE, PARTICLE_SIZE);
            }
        }
    }
    window.dispatchEvent(new CustomEvent("resize"));
    update_particles();
}


// EVENT LISTENERS

expand_button.addEventListener("click", (_) => {
  const newHeight = canvas.height === 300 ? 73 : 300;
  document.getElementById("expand_button_triangle").classList.toggle("triangle_rotate");
  if (!is_mobile()) document.getElementById("counter").classList.toggle("invisible");
  cancelAnimationFrame(current_update_frame);
  animate_header(0.0, canvas.height, newHeight);
});

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
    update_viewport();
    create_particles(get_multiplier());
});

addEventListener("load", init);