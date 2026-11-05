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

import { DRAW_FRAGMENT, GPU_VERTEX, SIM_FRAGMENT, BITONIC_SORT_FRAGMENT, BUILD_KEYS_FRAGMENT,FULLSCREEN_VERTEX } from "./shaders.js"

const compile_shader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || "Unknown shader compilation error";
        gl.deleteShader(shader);
        throw new Error(`WebGL shader compilation failed: ${message}`);
    }
    return shader;
};

const create_program = (gl, vertex_source, fragment_source) => {
    const shaders = [
        compile_shader(gl, gl.VERTEX_SHADER, vertex_source),
        compile_shader(gl, gl.FRAGMENT_SHADER, fragment_source)
    ];

    const program = gl.createProgram();

    shaders.forEach(shader => gl.attachShader(program, shader));
    gl.linkProgram(program);
    shaders.forEach(shader => gl.deleteShader(shader));
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program) || "Unknown program linking error";
        gl.deleteProgram(program);
        throw new Error(`WebGL program linking failed: ${message}`);
    }
    
    return program;
};

const next_power_of_two = (n) => {
    let p = 1;
    while (p < n) p *= 2;
    return p;
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
        if (settings) this.gpu.set_settings(settings);
    }

    step() {
        this.gpu.simulate(this.canvas.width, this.canvas.height);
    }

    render() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
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
        this.current = 0;
        this.width = 1;
        this.height = 1;
        this.sort_width = 1;
        this.sort_height = 1;
        this.sort_count = 1;
        this.sort_current = 0;
        this.grid_width = 1;
        this.grid_height = 1;
        this.settings = null;

        this.position_textures = [];
        this.velocity_textures = [];
        this.state_framebuffers = [];
        this.sort_textures = [];
        this.sort_framebuffers = [];

        this.species_texture = null;
        this.attraction_texture = null;
        this.species_colors_texture = null;

        this.sim_vao = gl.createVertexArray();
        this.render_vao = gl.createVertexArray();

        this.build_keys_program = create_program(gl, FULLSCREEN_VERTEX, BUILD_KEYS_FRAGMENT);
        this.sort_program = create_program(gl, FULLSCREEN_VERTEX, BITONIC_SORT_FRAGMENT);
        this.sim_program = create_program(gl, FULLSCREEN_VERTEX, SIM_FRAGMENT);
        this.render_program = create_program(gl, GPU_VERTEX, DRAW_FRAGMENT);

        this._cache_uniforms();
    }

    _cache_uniforms() {
        const gl = this.gl;
        const cache = (program, names) => {
            const result = {};
            for (const name of names) result[name] = gl.getUniformLocation(program, name);
            return result;
        };

        this.uBuild = cache(this.build_keys_program, [
            "u_positions", "u_stateSize", "u_particleCount",
            "u_sortWidth", "u_sortCount", "u_gridSize", "u_resolution"
        ]);
        this.uSort = cache(this.sort_program, [
            "u_items", "u_sortSize", "u_sortWidth", "u_stageJ", "u_stageK"
        ]);
        this.uSim = cache(this.sim_program, [
            "u_positions", "u_velocities", "u_species", "u_attraction",
            "u_sortedItems", "u_stateSize", "u_gridSize", "u_particleCount",
            "u_sortWidth", "u_sortCount", "u_resolution", "u_minDistance",
            "u_maxDistance", "u_friction", "u_repulsion"
        ]);
        this.uRender = cache(this.render_program, [
            "u_positions", "u_species", "u_speciesColors", "u_stateSize",
            "u_resolution", "u_pointSize"
        ]);
    }

    _texture(width, height, data, internalFormat, format) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, internalFormat, width, height, 0,
            format, gl.FLOAT, data
        );
        return texture;
    }

    _texture1(width, height, data = null) {
        return this._texture(width, height, data, this.gl.R32F, this.gl.RED);
    }
    _texture2(width, height, data = null) {
        return this._texture(width, height, data, this.gl.RG32F, this.gl.RG);
    }
    _texture4(width, height, data = null) {
        return this._texture(width, height, data, this.gl.RGBA32F, this.gl.RGBA);
    }

    _make_framebuffer(textures, attachments) {
        const gl = this.gl;
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        for (let i = 0; i < textures.length; i++) {
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER, attachments[i], gl.TEXTURE_2D, textures[i], 0
            );
        }
        gl.drawBuffers(attachments);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            gl.deleteFramebuffer(fb);
            throw new Error("WebGL floating-point framebuffer is incomplete.");
        }
        return fb;
    }

    _delete_state() {
        const gl = this.gl;
        for (const t of this.position_textures) gl.deleteTexture(t);
        for (const t of this.velocity_textures) gl.deleteTexture(t);
        for (const f of this.state_framebuffers) gl.deleteFramebuffer(f);
        for (const t of this.sort_textures) gl.deleteTexture(t);
        for (const f of this.sort_framebuffers) gl.deleteFramebuffer(f);

        if (this.species_texture) gl.deleteTexture(this.species_texture);
        if (this.attraction_texture) gl.deleteTexture(this.attraction_texture);
        if (this.species_colors_texture) gl.deleteTexture(this.species_colors_texture);

        this.position_textures = [];
        this.velocity_textures = [];
        this.state_framebuffers = [];
        this.sort_textures = [];
        this.sort_framebuffers = [];
        this.species_texture = null;
        this.attraction_texture = null;
        this.species_colors_texture = null;
    }

    initialize(particles, species, settings) {
        const gl = this.gl;
        this._delete_state();

        this.count = particles.length;
        this.set_settings(settings);

        this.width = Math.max(1, Math.ceil(Math.sqrt(this.count)));
        this.height = Math.max(1, Math.ceil(this.count / this.width));

        const max_texture_size = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        if (this.width > max_texture_size || this.height > max_texture_size) 
            throw new Error("Particle state texture exceeds MAX_TEXTURE_SIZE.");
        
        const texel_count = this.width * this.height;
        const positions = new Float32Array(texel_count * 2);
        const velocities = new Float32Array(texel_count * 2);
        const species_data = new Float32Array(texel_count);

        for (let i = 0; i < this.count; i++) {
            const offset = i * 2;
            positions.set(particles[i].position, offset);
            velocities.set(particles[i].velocity, offset);
            species_data[i] = particles[i].key;
        }

        for (let i = 0; i < 2; i++) {
            this.position_textures.push(this._texture2(this.width, this.height, positions));
            this.velocity_textures.push(this._texture2(this.width, this.height, velocities));
        }

        this.species_texture = this._texture1(this.width, this.height, species_data);
        
        this.set_species(species);

        for (let i = 0; i < 2; i++) {
            this.state_framebuffers.push(this._make_framebuffer(
                [this.position_textures[i], this.velocity_textures[i]],
                [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]
            ));
        }

        this.sort_width = next_power_of_two(this.width);
        this.sort_height = next_power_of_two(Math.ceil(this.count / this.sort_width));
        this.sort_count = this.sort_width * this.sort_height;
        if (this.sort_width > max_texture_size || this.sort_height > max_texture_size) {
            throw new Error("GPU sort texture exceeds MAX_TEXTURE_SIZE.");
        }

        for (let i = 0; i < 2; i++) {
            const texture = this._texture2(this.sort_width, this.sort_height, null);
            this.sort_textures.push(texture);
            this.sort_framebuffers.push(this._make_framebuffer(
                [texture], [gl.COLOR_ATTACHMENT0]
            ));
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.current = 0;
        this.sort_current = 0;
    }

    set_species(species) {
        if (species) {
            this._set_attraction(species);
            this._set_color(species);
        }
    }

    set_settings(settings) {
        if (settings) this.settings = settings;
    }

    _set_attraction(species) {
        const gl = this.gl;
        if (this.attraction_texture) {
            gl.deleteTexture(this.attraction_texture);
        }

        const species_count = species.length;

        const attraction_data = new Float32Array(species_count * species_count);
        for (let own = 0; own < species_count; own++) {
            for (let other = 0; other < species_count; other++) {
                attraction_data[own * species_count + other] =
                    species[own].attraction[other] ?? 0;
            }
        }
        this.attraction_texture = this._texture1(
            species_count, species_count, attraction_data
        );
    }

    _set_color(species) {
        const gl = this.gl;
        if (this.species_colors_texture) {
            gl.deleteTexture(this.species_colors_texture);
        }

        const species_count = species.length;

        const color_data = new Float32Array(species_count * 4);
        for (let i = 0; i < species_count; i++) {
            const color = species[i].color;
            const o = i * 4;
            color_data[o] = parseInt(color.slice(1, 3), 16) / 255;
            color_data[o + 1] = parseInt(color.slice(3, 5), 16) / 255;
            color_data[o + 2] = parseInt(color.slice(5, 7), 16) / 255;
            color_data[o + 3] = 1;
        }
        this.species_colors_texture = this._texture4(species_count, 1, color_data);
    }

    _build_and_sort(width, height) {
        const gl = this.gl;
        const max_distance = this.settings.MAX_DISTANCE;

        this.grid_width = Math.max(1, Math.floor(width / max_distance));
        this.grid_height = Math.max(1, Math.floor(height / max_distance));

        gl.bindVertexArray(this.sim_vao);
        gl.useProgram(this.build_keys_program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sort_framebuffers[0]);
        gl.viewport(0, 0, this.sort_width, this.sort_height);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.position_textures[this.current]);
        gl.uniform1i(this.uBuild.u_positions, 0);
        gl.uniform2i(this.uBuild.u_stateSize, this.width, this.height);
        gl.uniform1i(this.uBuild.u_particleCount, this.count);
        gl.uniform1i(this.uBuild.u_sortWidth, this.sort_width);
        gl.uniform1i(this.uBuild.u_sortCount, this.sort_count);
        gl.uniform2i(this.uBuild.u_gridSize, this.grid_width, this.grid_height);
        gl.uniform2f(this.uBuild.u_resolution, width, height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        let read_index = 0;
        for (let k = 2; k <= this.sort_count; k *= 2) {
            for (let j = k >> 1; j > 0; j >>= 1) {
                const write_index = 1 - read_index;
                gl.useProgram(this.sort_program);
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.sort_framebuffers[write_index]);
                gl.viewport(0, 0, this.sort_width, this.sort_height);
                gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this.sort_textures[read_index]);
                gl.uniform1i(this.uSort.u_items, 0);
                gl.uniform2i(this.uSort.u_sortSize, this.sort_width, this.sort_height);
                gl.uniform1i(this.uSort.u_sortWidth, this.sort_width);
                gl.uniform1i(this.uSort.u_stageJ, j);
                gl.uniform1i(this.uSort.u_stageK, k);
                gl.drawArrays(gl.TRIANGLES, 0, 3);

                read_index = write_index;
            }
        }
        this.sort_current = read_index;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    simulate(width, height) {
        const gl = this.gl;
        if (!this.count) return;

        this._build_and_sort(width, height);

        const next = 1 - this.current;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.state_framebuffers[next]);
        gl.viewport(0, 0, this.width, this.height);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

        gl.useProgram(this.sim_program);
        gl.bindVertexArray(this.sim_vao);

        const bind_texture = (unit, texture, location) => {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(location, unit);
        };

        bind_texture(0, this.position_textures[this.current], this.uSim.u_positions);
        bind_texture(1, this.velocity_textures[this.current], this.uSim.u_velocities);
        bind_texture(2, this.species_texture, this.uSim.u_species);
        bind_texture(3, this.attraction_texture, this.uSim.u_attraction);
        bind_texture(4, this.sort_textures[this.sort_current], this.uSim.u_sortedItems);

        gl.uniform2i(this.uSim.u_stateSize, this.width, this.height);
        gl.uniform2i(this.uSim.u_gridSize, this.grid_width, this.grid_height);
        gl.uniform1i(this.uSim.u_particleCount, this.count);
        gl.uniform1i(this.uSim.u_sortWidth, this.sort_width);
        gl.uniform1i(this.uSim.u_sortCount, this.sort_count);
        gl.uniform2f(this.uSim.u_resolution, width, height);
        gl.uniform1f(this.uSim.u_minDistance, this.settings.MIN_DISTANCE);
        gl.uniform1f(this.uSim.u_maxDistance, this.settings.MAX_DISTANCE);
        gl.uniform1f(this.uSim.u_friction, this.settings.FRICTION);
        gl.uniform1f(this.uSim.u_repulsion, this.settings.REPULSION);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.current = next;
    }

    render(width, height) {
        if (!this.count) return;
        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.useProgram(this.render_program);
        gl.bindVertexArray(this.render_vao);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.position_textures[this.current]);
        gl.uniform1i(this.uRender.u_positions, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.species_texture);
        gl.uniform1i(this.uRender.u_species, 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.species_colors_texture);
        gl.uniform1i(this.uRender.u_speciesColors, 2);

        gl.uniform2i(this.uRender.u_stateSize, this.width, this.height);
        gl.uniform2f(this.uRender.u_resolution, width, height);
        gl.uniform1f(this.uRender.u_pointSize, this.settings.PARTICLE_SIZE);
        gl.drawArrays(gl.POINTS, 0, this.count);
    }

    destroy() {
        this._delete_state();
        const gl = this.gl;
        gl.deleteProgram(this.build_keys_program);
        gl.deleteProgram(this.sort_program);
        gl.deleteProgram(this.sim_program);
        gl.deleteProgram(this.render_program);
        gl.deleteVertexArray(this.sim_vao);
        gl.deleteVertexArray(this.render_vao);
    }
}