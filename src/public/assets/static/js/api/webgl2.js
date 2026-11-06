/*
 * AI generated this jawn after I mentioned wanting GPU rendering/calculations.
 *
 * It's based on my fallback/CPU-intensive system, so I have a general idea of how it works. 
 * However, I'm not familiar with WebGL or GPU programming in general, 
 * and tackling it properly is currently a bit too daunting with the limited resources I have. 
 * On top of that, it currently works without any noticeable performance issues 
 * (as far as I'm aware), so I don't have much incentive to dig deeper into it for now.
 *
 * If you have any suggestions or ideas for improvements, feel free to reach out!
 */

import {
    DRAW_FRAGMENT, GPU_VERTEX, SIM_FRAGMENT, INTEGRATE_FRAGMENT, REORDER_FRAGMENT,
    RANGES_FRAGMENT, BITONIC_SORT_FRAGMENT, BUILD_KEYS_FRAGMENT, FULLSCREEN_VERTEX
} from "./shaders.js"

// Sort + neighbor search run every FORCE_INTERVAL steps; the steps in between only
// integrate with the cached force. 1 = recompute the force every step.
const FORCE_INTERVAL = 2;

// Grid cells are max_distance / CELL_DIVISOR wide, but never narrower than MIN_CELL_SIZE px.
const CELL_DIVISOR = 3;
const MIN_CELL_SIZE = 6;

const TEXTURE_FORMATS = { 1: ["R32F", "RED"], 2: ["RG32F", "RG"], 4: ["RGBA32F", "RGBA"] };

// ceil(log2(n)) for n >= 1
const log2_ceil = (n) => 32 - Math.clz32(n - 1);

const compile_shader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`WebGL shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
};

// Links a program, collects its uniform locations and binds the listed samplers to units 0..n.
const create_pass = (gl, vertex_source, fragment_source, samplers = []) => {
    const program = gl.createProgram();
    const shaders = [
        compile_shader(gl, gl.VERTEX_SHADER, vertex_source),
        compile_shader(gl, gl.FRAGMENT_SHADER, fragment_source)
    ];
    shaders.forEach(shader => gl.attachShader(program, shader));
    gl.linkProgram(program);
    shaders.forEach(shader => gl.deleteShader(shader));

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`WebGL program linking failed: ${gl.getProgramInfoLog(program)}`);
    }

    const u = {};
    for (let i = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i--;) {
        const { name } = gl.getActiveUniform(program, i);
        u[name] = gl.getUniformLocation(program, name);
    }

    gl.useProgram(program);
    samplers.forEach((name, unit) => gl.uniform1i(u[name], unit));
    return { program, u };
};

export default class WebGLBackend {
    constructor(canvas) {
        this.canvas = canvas;
        this.background = [0, 0, 0, 0];

        const gl = canvas.getContext("webgl2", {
            alpha: true,
            antialias: false,
            powerPreference: "high-performance"
        });
        if (!gl) throw new Error("WebGL2 is unavailable.");
        if (!gl.getExtension("EXT_color_buffer_float"))
            throw new Error("GPU simulation requires EXT_color_buffer_float.");

        gl.disable(gl.DEPTH_TEST);
        this.gl = gl;
        this.gpu = new GpuSimulation(gl);
    }

    initialize(particles, species, settings) {
        this.gpu.initialize(particles, species, settings);
    }

    set_species(species) {
        if (species) this.gpu.set_species(species);
    }

    set_settings(settings) {
        if (settings) this.gpu.settings = settings;
    }

    step() {
        this.gpu.simulate(this.canvas.width, this.canvas.height);
    }

    render() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(...this.background);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.gpu.render(this.canvas.width, this.canvas.height);
    }

    destroy() {
        if (this.gpu) this.gpu.destroy();
        this.gpu = null;
    }
}

class GpuSimulation {
    constructor(gl) {
        this.gl = gl;
        this.count = 0;
        this.step_count = 0;
        this.current = 0;       // which of the two position/velocity texture pairs is live
        this.settings = null;
        this.shift = 0;         // log2 of the state texture width
        this.width = 1;         // state texture size (powers of two)
        this.height = 1;
        this.rows = 1;          // texture rows that contain real particles

        // Every texture and framebuffer is created once and re-specified on resize.
        const textures = (n) => Array.from({ length: n }, () => gl.createTexture());
        this.pos = textures(2);
        this.vel = textures(2);
        this.items = textures(2);     // sort items: (cell key, particle index)
        this.force = gl.createTexture();
        this.ranges = { texture: gl.createTexture(), framebuffer: null, width: 0, height: 0 };
        this.species = { attraction: gl.createTexture(), colors: gl.createTexture() };
        this.framebuffers = null;

        // all passes draw with gl_VertexID, so an empty VAO is all they need
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        this.passes = {
            keys: create_pass(gl, FULLSCREEN_VERTEX, BUILD_KEYS_FRAGMENT, ["u_positions"]),
            sort: create_pass(gl, FULLSCREEN_VERTEX, BITONIC_SORT_FRAGMENT, ["u_items"]),
            ranges: create_pass(gl, FULLSCREEN_VERTEX, RANGES_FRAGMENT, ["u_items"]),
            reorder: create_pass(gl, FULLSCREEN_VERTEX, REORDER_FRAGMENT, ["u_positions", "u_velocities", "u_items"]),
            sim: create_pass(gl, FULLSCREEN_VERTEX, SIM_FRAGMENT, ["u_positions", "u_velocities", "u_attraction", "u_ranges"]),
            integrate: create_pass(gl, FULLSCREEN_VERTEX, INTEGRATE_FRAGMENT, ["u_positions", "u_velocities", "u_forces"]),
            render: create_pass(gl, GPU_VERTEX, DRAW_FRAGMENT, ["u_positions", "u_speciesColors"]),
        };
    }

    // (Re)specifies a float texture with 1, 2 or 4 channels. Reusing the texture object
    // is fine even if the size changes.
    _texture(texture, width, height, data, channels) {
        const gl = this.gl;
        const [internal, format] = TEXTURE_FORMATS[channels];
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl[internal], width, height, 0, gl[format], gl.FLOAT, data);
    }

    _framebuffer(textures) {
        const gl = this.gl;
        const attachments = textures.map((_, i) => gl.COLOR_ATTACHMENT0 + i);
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        textures.forEach((texture, i) =>
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachments[i], gl.TEXTURE_2D, texture, 0)
        );
        gl.drawBuffers(attachments);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error("WebGL floating-point framebuffer is incomplete.");
        }
        return framebuffer;
    }

    // Selects a pass, its target and input textures (units 0..n), and the shared layout uniform.
    _use(pass, framebuffer, textures, width, height) {
        const gl = this.gl;
        gl.useProgram(pass.program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, width, height);
        textures.forEach((texture, unit) => {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
        });
        gl.uniform1i(pass.u.u_layoutShift, this.shift);
    }

    _draw() {
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
    }

    initialize(particles, species, settings) {
        this.settings = settings;
        this.set_species(species);
        this.count = particles.length;
        this.step_count = 0;
        if (!this.count) return;

        // State textures are W x H (both powers of two): particle i sits at (i & (W-1), i >> shift).
        // Indices travel through float32 sort items, so W * H must stay below 2^24.
        this.shift = log2_ceil(Math.ceil(Math.sqrt(this.count)));
        const W = this.width = 1 << this.shift;
        this.rows = Math.ceil(this.count / W);
        const H = this.height = 1 << log2_ceil(this.rows);

        const positions = new Float32Array(W * H * 4);   // x, y, species, unused
        const velocities = new Float32Array(W * H * 2);
        particles.forEach((p, i) => {
            positions.set(p.position, i * 4);
            positions[i * 4 + 2] = p.key;
            velocities.set(p.velocity, i * 2);
        });

        for (let i = 0; i < 2; i++) {
            this._texture(this.pos[i], W, H, positions, 4);
            this._texture(this.vel[i], W, H, velocities, 2);
            this._texture(this.items[i], W, H, null, 2);
        }
        this._texture(this.force, W, H, null, 2);

        this.framebuffers ??= {
            state: [0, 1].map(i => this._framebuffer([this.pos[i], this.vel[i]])),
            sim: [0, 1].map(i => this._framebuffer([this.pos[i], this.vel[i], this.force])),
            items: [0, 1].map(i => this._framebuffer([this.items[i]])),
        };
        this.current = 0;
    }

    set_species(species) {
        const n = species.length;
        const attraction = new Float32Array(n * n);
        const colors = new Float32Array(n * 4);

        species.forEach((s, own) => {
            for (let other = 0; other < n; other++) {
                attraction[own * n + other] = s.attraction[other] ?? 0;
            }
            const rgb = parseInt(s.color.slice(1), 16);
            colors.set([(rgb >> 16 & 255) / 255, (rgb >> 8 & 255) / 255, (rgb & 255) / 255, 1], own * 4);
        });

        this._texture(this.species.attraction, n, n, attraction, 1);
        this._texture(this.species.colors, n, 1, colors, 4);
    }

    // Grid size, plus how many cells to scan around a particle to cover max_distance.
    _grid(width, height) {
        const max_distance = Math.max(1, this.settings.MAX_DISTANCE);
        const cell = Math.max(max_distance / CELL_DIVISOR, MIN_CELL_SIZE);
        const gx = Math.max(1, Math.floor(width / cell));
        const gy = Math.max(1, Math.floor(height / cell));
        // cells are at least `cell` wide, so the radius is <= CELL_DIVISOR; the epsilon keeps
        // float noise from turning an exact 3 into 4
        const radius = (size, cells) => Math.max(1, Math.ceil(max_distance * cells / size - 1e-6));
        return { gx, gy, rx: radius(width, gx), ry: radius(height, gy) };
    }

    // keys -> sort -> cell ranges -> reorder into sorted order -> force + integrate
    _force_step(width, height) {
        const gl = this.gl;
        const { passes, framebuffers, pos, vel, items } = this;
        const { width: W, height: H } = this;
        const cur = this.current, other = 1 - cur;
        const { gx, gy, rx, ry } = this._grid(width, height);

        const ranges = this.ranges;
        if (ranges.width !== gx || ranges.height !== gy) {
            this._texture(ranges.texture, gx, gy, null, 2);
            ranges.framebuffer ??= this._framebuffer([ranges.texture]);
            ranges.width = gx;
            ranges.height = gy;
        }

        let u = passes.keys.u;
        this._use(passes.keys, framebuffers.items[0], [pos[cur]], W, H);
        gl.uniform1i(u.u_particleCount, this.count);
        gl.uniform2i(u.u_gridSize, gx, gy);
        gl.uniform2f(u.u_resolution, width, height);
        this._draw();

        // bitonic sort, two stages per pass, ping-ponging between the item buffers
        u = passes.sort.u;
        this._use(passes.sort, framebuffers.items[1], [items[0]], W, H);
        let read = 0;
        for (let k = 2; k <= W * H; k *= 2) {
            for (let j = k >> 1; j > 0; j >>= 2) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers.items[1 - read]);
                gl.bindTexture(gl.TEXTURE_2D, items[read]);
                gl.uniform1i(u.u_stageJ, j);
                gl.uniform1i(u.u_stageK, k);
                this._draw();
                read = 1 - read;
            }
        }
        const sorted = items[read];

        u = passes.ranges.u;
        this._use(passes.ranges, ranges.framebuffer, [sorted], gx, gy);
        gl.uniform1i(u.u_particleCount, this.count);
        gl.uniform2i(u.u_gridSize, gx, gy);
        this._draw();

        // live buffer `cur` -> sorted copy in `other`
        this._use(passes.reorder, framebuffers.state[other], [pos[cur], vel[cur], sorted], W, this.rows);
        this._draw();

        // sorted state in `other` -> new state + force back in `cur` (so `current` stays put)
        u = passes.sim.u;
        const s = this.settings;
        this._use(passes.sim, framebuffers.sim[cur], [pos[other], vel[other], this.species.attraction, ranges.texture], W, this.rows);
        gl.uniform1i(u.u_particleCount, this.count);
        gl.uniform2i(u.u_gridSize, gx, gy);
        gl.uniform2i(u.u_cellRadius, rx, ry);
        gl.uniform2f(u.u_resolution, width, height);
        gl.uniform1f(u.u_minDistSq, s.MIN_DISTANCE * s.MIN_DISTANCE);
        gl.uniform1f(u.u_maxDistSq, s.MAX_DISTANCE * s.MAX_DISTANCE);
        gl.uniform1f(u.u_friction, s.FRICTION);
        gl.uniform1f(u.u_repulsion, s.REPULSION);
        this._draw();
    }

    _integrate_step(width, height) {
        const gl = this.gl;
        const { passes, pos, vel } = this;
        const cur = this.current, next = 1 - cur;
        const u = passes.integrate.u;

        this._use(passes.integrate, this.framebuffers.state[next], [pos[cur], vel[cur], this.force], this.width, this.rows);
        gl.uniform1i(u.u_particleCount, this.count);
        gl.uniform2f(u.u_resolution, width, height);
        gl.uniform1f(u.u_friction, this.settings.FRICTION);
        this._draw();
        this.current = next;
    }

    simulate(width, height) {
        if (!this.count) return;
        if (this.step_count++ % FORCE_INTERVAL === 0) this._force_step(width, height);
        else this._integrate_step(width, height);
    }

    render(width, height) {
        if (!this.count) return;
        const gl = this.gl;
        const pass = this.passes.render;

        this._use(pass, null, [this.pos[this.current], this.species.colors], gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform2f(pass.u.u_resolution, width, height);
        gl.uniform1f(pass.u.u_pointSize, this.settings.PARTICLE_SIZE);
        gl.drawArrays(gl.POINTS, 0, this.count);
    }

    destroy() {
        const gl = this.gl;
        Object.values(this.passes).forEach(({ program }) => gl.deleteProgram(program));
        [...this.pos, ...this.vel, ...this.items, this.force, this.ranges.texture, ...Object.values(this.species)]
            .forEach(texture => gl.deleteTexture(texture));
        [...Object.values(this.framebuffers ?? {}).flat(), this.ranges.framebuffer]
            .forEach(framebuffer => gl.deleteFramebuffer(framebuffer));
        gl.deleteVertexArray(this.vao);
    }
}