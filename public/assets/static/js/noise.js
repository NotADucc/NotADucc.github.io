const is_mobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    random = (size) => Math.random() * size,
    easingFunction = bezier(0.45, 0.1, 0.25, 1);

let ctx, quadtree;

const DOM_elements = {
    canvas: document.getElementById("noise"),
    header: document.getElementsByTagName("header")[0],
    main: document.getElementsByTagName("main")[0],
    expand_button: document.getElementById("expand_button"),
    expand_button_triangle: document.getElementById("expand_button_triangle"),
    plus_button: document.getElementById("plus_button"),
    minus_button: document.getElementById("minus_button"),
    counter: document.getElementById("counter"),
}

const canvas_info = {
    FRICTION: 0.4,
    PARTICLE_SIZE: 5.0,
    MIN_DISTANCE: 5,
    MAX_DISTANCE: 30,
    MAX_PARTICLE_MULTIPLIER: 30,
    CANVAS_MIN_HEIGHT: 73,
    is_expanded: false,
    custom_multiplier: is_mobile() ? 3 : 10,
    get_multiplier: () => DOM_elements.canvas.height <= canvas_info.CANVAS_MIN_HEIGHT ? 1 : canvas_info.custom_multiplier,
    get_canvas_height: () => canvas_info.is_expanded ? is_mobile() ? window.innerHeight >> 1 : window.innerHeight : canvas_info.CANVAS_MIN_HEIGHT,
}

const particles = [];
const particle_info = {
    c1: {
        color: [0.22, 0.45, 0.91, 1, "#3875ea"],
        count: 70,
        bounds: true,
        attraction:{
            c1: 0.32,
            c2: -0.4,
            c3: -0.4
        }
    },
    c2: {
        color: [1, 0, 1, 1, "#ff00ff"],
        count: 25,
        bounds: true,
        attraction:{
            c1: 0.4,
            c2: 0.1,
            c3: -0.2
        }
    },
    c3: {
        color: [0.65, 0.13, 0.38, 1, "#a62161"],
        count: 150,
        bounds: false,
        attraction:{
            c1: 0.4,
            c2: 0,
            c3: -0.15
        }
    },
}

// gets overwritten depending on ctx
let draw_particles = () => {}, update_viewport = () => {};

const create_tree = () => {
    quadtree = new QuadTree(new Rectangle(DOM_elements.canvas.width / 2, DOM_elements.canvas.height / 2, DOM_elements.canvas.width, DOM_elements.canvas.height));
    for (let i = 0; i < particles.length; i++) {
        quadtree.insert(particles[i]);
    }
}

const particle = (k, p, c, b) => {
    return {
        key: k,
        position: p,
        velocity: [0, 0],
        color: c,
        bounds: b
    };
}

const add_particles = (k, amount, color, b) => {
    for (let i = 0; i < amount; i++) {
        particles.push(particle(k, [random(DOM_elements.canvas.width), random(DOM_elements.canvas.height)], color, b));
    }
}

const create_particles = (multiplier) => {
    particles.length = 0;
    for (const [key, value] of Object.entries(particle_info)) {
        add_particles(key, value.count * multiplier, value.color, value.bounds);
    }
    create_tree();
}

const calc_next_positions = () => {
    const canvas_width = DOM_elements.canvas.width;
    const canvas_height = DOM_elements.canvas.height;
    for (let i = 0; i < particles.length; i++) {
        let fx = 0.0;
        let fy = 0.0;

        const seeker = particles[i];
        const rect = new Rectangle(seeker.position[0], seeker.position[1], canvas_info.MAX_DISTANCE, canvas_info.MAX_DISTANCE);
        const targets = quadtree.query(rect, []);

        for (let j = 0; j < targets.length; j++) {
            const target = targets[j];
            const attraction = particle_info[seeker.key].attraction[target.key];
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
            if (d == 0 || d > canvas_info.MAX_DISTANCE * canvas_info.MAX_DISTANCE) continue;
            const d_sqrt = Math.sqrt(d);
            const F = (d_sqrt <= canvas_info.MIN_DISTANCE ? 0.3 : -attraction) / d_sqrt;
            fx += F * dx;
            fy += F * dy;
        }

        seeker.velocity[0] = (seeker.velocity[0] + fx) * canvas_info.FRICTION;
        seeker.velocity[1] = (seeker.velocity[1] + fy) * canvas_info.FRICTION;
        seeker.position[0] = (seeker.position[0] + seeker.velocity[0] + canvas_width) % canvas_width;
        seeker.position[1] = (seeker.position[1] + seeker.velocity[1] + canvas_height) % canvas_height;
    }
}

let current_update_frame;
const update_particles = () => {
    calc_next_positions();
    quadtree.update_tree(quadtree);
    quadtree.remove_nodes();
    draw_particles();
    current_update_frame = requestAnimationFrame(update_particles);
}

const update_width = (new_width) => {
    DOM_elements.canvas.width = new_width;
}

const update_height = (new_height) => {
    DOM_elements.canvas.height = new_height;
    DOM_elements.header.style.height = DOM_elements.main.style.marginTop = `${new_height}px`;
}

const animate_header = (index, start, stop) => {
    if (index <= 1) {
        const new_height = start + (stop - start) * easingFunction(index);
        update_height(new_height);
        update_viewport();
        requestAnimationFrame(() => animate_header(index + 0.01, start, stop));
        create_particles(1);
        draw_particles();
    }
    else {
        update_height(stop);
        update_viewport();
        create_particles(canvas_info.get_multiplier());
        update_particles();
    }
}


const init = () => {
    ctx = DOM_elements.canvas.getContext('webgl');
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
            const positions = new Float32Array(particles.length << 1);
            const colors = new Float32Array(particles.length << 2);
            
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
            ctx.uniform2f(resolutionLocation, DOM_elements.canvas.width, DOM_elements.canvas.height);
            ctx.uniform1f(uPointSizeLocation, canvas_info.PARTICLE_SIZE);
            ctx.clear(ctx.COLOR_BUFFER_BIT);
            
            ctx.drawArrays(ctx.position, 0, particles.length);
        }

    } else {
        ctx = DOM_elements.canvas.getContext('2d');

        const draw = (x, y, c, w, h) => {
            ctx.fillStyle = c;
            ctx.fillRect(x, y, w, h);
        }

        draw_particles = () => {
            ctx.clearRect(0, 0, DOM_elements.canvas.width, DOM_elements.canvas.height);
            for (let i = 0; i < particles.length; i++) {
                draw(particles[i].position[0], particles[i].position[1], particles[i].color[4], canvas_info.PARTICLE_SIZE, canvas_info.PARTICLE_SIZE);
            }
        }
    }
    window.dispatchEvent(new CustomEvent("resize"));
    update_particles();
}


// EVENT LISTENERS

DOM_elements.expand_button.addEventListener("click", (_) => {
    canvas_info.is_expanded = !canvas_info.is_expanded;
    const new_height = canvas_info.get_canvas_height();
    DOM_elements.expand_button_triangle.classList.toggle("triangle_rotate");
    if (!is_mobile()) DOM_elements.counter.classList.toggle("invisible");
    cancelAnimationFrame(current_update_frame);
    animate_header(0.0, DOM_elements.canvas.height, new_height);
});


function update_buttons() {
    DOM_elements.plus_button.disabled = canvas_info.custom_multiplier >= canvas_info.MAX_PARTICLE_MULTIPLIER;
    DOM_elements.minus_button.disabled = canvas_info.custom_multiplier <= 1;

    DOM_elements.plus_button.classList.toggle("disabled", DOM_elements.plus_button.disabled);
    DOM_elements.minus_button.classList.toggle("disabled", DOM_elements.minus_button.disabled);
}

function change_multiplier(delta) {
    const newMultiplier = canvas_info.custom_multiplier + delta;

    if (newMultiplier < 1 || newMultiplier > canvas_info.MAX_PARTICLE_MULTIPLIER) return;

    canvas_info.custom_multiplier = newMultiplier;
    create_particles(canvas_info.get_multiplier());
    update_buttons();
}

DOM_elements.plus_button.addEventListener("click", () => change_multiplier(1));
DOM_elements.minus_button.addEventListener("click", () => change_multiplier(-1));

addEventListener("resize", (_) => {
    const height = canvas_info.get_canvas_height();
    if (DOM_elements.canvas.width === window.innerWidth && (is_mobile() || DOM_elements.canvas.innerHeight === height)) 
        return;
    update_width(window.innerWidth);
    update_height(height);
    update_viewport();
    create_particles(canvas_info.get_multiplier());
});

addEventListener("load", init);