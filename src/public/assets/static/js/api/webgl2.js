import { bezier } from './bezier.js';
import { Rectangle } from './rectangle.js';
import { QuadTree } from './quadtree.js';

const is_mobile = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const random = (size) => Math.random() * size;
const easingFunction = bezier(0.45, 0.1, 0.25, 1);

let ctx;
let gl = null;
let gpuSimulation = null;
let current_update_frame;

const DOM_elements = {
    canvas: document.getElementById("noise"),
    header: document.getElementsByTagName("header")[0],
    main: document.getElementsByTagName("main")[0],
    expand_button: document.getElementById("expand_button"),
    expand_button_triangle: document.getElementById("expand_button_triangle"),
    plus_button: document.getElementById("plus_button"),
    minus_button: document.getElementById("minus_button"),
    counter: document.getElementById("counter"),
};

const canvas_info = {
    FRICTION: 0.4,
    PARTICLE_SIZE: 5.0,
    MIN_DISTANCE: 6,
    MIN_DISTANCE_SQ: 36,
    MAX_DISTANCE: 30,
    MAX_DISTANCE_SQ: 900,
    MAX_PARTICLE_MULTIPLIER: 30,
    CANVAS_MIN_HEIGHT: 73,
    is_expanded: false,
    multiplier: is_mobile() ? 3 : 10,
    get_redraw_multiplier: () =>
        DOM_elements.canvas.height <= canvas_info.CANVAS_MIN_HEIGHT
            ? 1
            : canvas_info.multiplier,
    get_canvas_height: () =>
        canvas_info.is_expanded
            ? (is_mobile() ? window.innerHeight >> 1 : window.innerHeight)
            : canvas_info.CANVAS_MIN_HEIGHT,
};

const particle_system = {
    particles: [],
    container: null,

    get length() {
        return this.particles.length;
    },

    info: [
        {
            color: [0.22, 0.45, 0.91, 1, "#3875ea"],
            count: 75,
            bounds: true,
            attraction: [0.32, -0.4, -0.4],
        },
        {
            color: [1, 0, 1, 1, "#ff00ff"],
            count: 25,
            bounds: true,
            attraction: [0.4, 0.1, -0.2],
        },
        {
            color: [0.65, 0.13, 0.38, 1, "#a62161"],
            count: 150,
            bounds: false,
            attraction: [0.4, 0, -0.15],
        },
    ],

    create_particles(multiplier) {
        this.clear_particles();

        this.container = new QuadTree(
            new Rectangle(
                DOM_elements.canvas.width / 2,
                DOM_elements.canvas.height / 2,
                DOM_elements.canvas.width,
                DOM_elements.canvas.height
            )
        );

        for (const [key, value] of this.info.entries()) {
            const add_amount = value.count * multiplier;

            for (let i = 0; i < add_amount; i++) {
                const particle = {
                    key,
                    position: [
                        random(DOM_elements.canvas.width),
                        random(DOM_elements.canvas.height),
                    ],
                    velocity: [0, 0],
                    color: value.color,
                    bounds: value.bounds,
                };

                this.particles.push(particle);
                this.container.insert(particle);
            }
        }

        if (gpuSimulation) {
            gpuSimulation.initializeParticles(this.particles);
        }
    },

    clear_particles() {
        this.particles.length = 0;
        this.container = null;
    },

    // CPU fallback, used only if WebGL2 or floating-point render targets are unavailable.
    update_positions() {
        const canvas_width = DOM_elements.canvas.width;
        const canvas_height = DOM_elements.canvas.height;

        if (!this.container) return;

        for (let i = 0; i < this.length; i++) {
            let fx = 0;
            let fy = 0;

            const seeker = this.particles[i];
            const seeker_x = seeker.position[0];
            const seeker_y = seeker.position[1];
            const rect_radius = canvas_info.MAX_DISTANCE;
            const seeker_attractions = this.info[seeker.key].attraction;

            const rect = new Rectangle(
                seeker_x,
                seeker_y,
                rect_radius,
                rect_radius
            );
            const targets = this.query_particles(rect);

            if (seeker_x < rect_radius) {
                rect.update(
                    canvas_width - (rect_radius - seeker_x),
                    seeker_y,
                    rect_radius - seeker_x,
                    rect_radius
                );
                targets.push(...this.query_particles(rect));
            } else if (canvas_width - seeker_x < rect_radius) {
                rect.update(
                    0,
                    seeker_y,
                    rect_radius - (canvas_width - seeker_x),
                    rect_radius
                );
                targets.push(...this.query_particles(rect));
            }

            if (seeker_y < rect_radius) {
                rect.update(
                    seeker_x,
                    canvas_height - (rect_radius - seeker_y),
                    rect_radius,
                    rect_radius - seeker_y
                );
                targets.push(...this.query_particles(rect));
            } else if (canvas_height - seeker_y < rect_radius) {
                rect.update(
                    seeker_x,
                    0,
                    rect_radius,
                    rect_radius - (canvas_height - seeker_y)
                );
                targets.push(...this.query_particles(rect));
            }

            for (const target of targets) {
                const attraction = seeker_attractions[target.key];
                if (attraction === 0) continue;

                let dx = seeker_x - target.position[0];
                let dy = seeker_y - target.position[1];

                if (dx > canvas_width * 0.5) dx -= canvas_width;
                else if (dx < -canvas_width * 0.5) dx += canvas_width;

                if (dy > canvas_height * 0.5) dy -= canvas_height;
                else if (dy < -canvas_height * 0.5) dy += canvas_height;

                const d = dx * dx + dy * dy;
                if (d === 0 || d > canvas_info.MAX_DISTANCE_SQ) continue;

                const distance = Math.sqrt(d);
                const force =
                    (distance <= canvas_info.MIN_DISTANCE ? 0.3 : -attraction) /
                    distance;

                fx += force * dx;
                fy += force * dy;
            }

            seeker.velocity[0] = (seeker.velocity[0] + fx) * canvas_info.FRICTION;
            seeker.velocity[1] = (seeker.velocity[1] + fy) * canvas_info.FRICTION;
            seeker.position[0] =
                (seeker.position[0] + seeker.velocity[0] + canvas_width) %
                canvas_width;
            seeker.position[1] =
                (seeker.position[1] + seeker.velocity[1] + canvas_height) %
                canvas_height;
        }

        this.container.update_positions();
    },

    query_particles(rect) {
        return this.container.query(rect);
    },
};

let draw_particles = () => {};
let update_viewport = () => {};

const particles_render_loop = () => {
    if (!gpuSimulation) particle_system.update_positions();
    draw_particles();
    current_update_frame = requestAnimationFrame(particles_render_loop);
};

const update_width = (new_width) => {
    DOM_elements.canvas.width = new_width;
};

const update_height = (new_height) => {
    DOM_elements.canvas.height = new_height;
    DOM_elements.header.style.height = DOM_elements.main.style.marginTop = `${new_height}px`;
};

const animate_header = (index, start, stop) => {
    if (index <= 1) {
        const new_height = start + (stop - start) * easingFunction(index);
        update_height(new_height);
        update_viewport();
        requestAnimationFrame(() => animate_header(index + 0.01, start, stop));
        particle_system.create_particles(1);
        draw_particles();
    } else {
        update_height(stop);
        update_viewport();
        particle_system.create_particles(canvas_info.get_redraw_multiplier());
        particles_render_loop();
    }
};

// --- WebGL2 GPU simulation -------------------------------------------------
// The simulation uses two RGBA32F textures for position and velocity. Each
// fragment updates one particle, scanning the position texture for neighbors.
// This is O(N^2), but all force and movement calculations happen on the GPU.
// No particle positions or velocities are copied back to JavaScript per frame.

const SIMULATION_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D u_positions;
uniform sampler2D u_velocities;
uniform sampler2D u_species;
uniform ivec2 u_stateSize;
uniform int u_particleCount;
uniform vec2 u_resolution;
uniform float u_attraction[9];
uniform float u_minDistance;
uniform float u_maxDistance;
uniform float u_friction;

layout(location = 0) out vec4 outPosition;
layout(location = 1) out vec4 outVelocity;

ivec2 particleTexel(int index) {
    return ivec2(index % u_stateSize.x, index / u_stateSize.x);
}

void main() {
    ivec2 texel = ivec2(gl_FragCoord.xy);
    int index = texel.y * u_stateSize.x + texel.x;

    if (index >= u_particleCount) {
        outPosition = vec4(0.0);
        outVelocity = vec4(0.0);
        return;
    }

    vec2 position = texelFetch(u_positions, texel, 0).xy;
    vec2 velocity = texelFetch(u_velocities, texel, 0).xy;
    int ownSpecies = int(texelFetch(u_species, texel, 0).r + 0.5);

    vec2 force = vec2(0.0);
    float maxDistanceSq = u_maxDistance * u_maxDistance;
    float minDistance = u_minDistance;

    for (int j = 0; j < u_particleCount; ++j) {
        if (j == index) continue;

        ivec2 otherTexel = particleTexel(j);
        vec2 otherPosition = texelFetch(u_positions, otherTexel, 0).xy;
        int otherSpecies = int(texelFetch(u_species, otherTexel, 0).r + 0.5);

        vec2 delta = position - otherPosition;

        if (delta.x > u_resolution.x * 0.5) delta.x -= u_resolution.x;
        else if (delta.x < -u_resolution.x * 0.5) delta.x += u_resolution.x;

        if (delta.y > u_resolution.y * 0.5) delta.y -= u_resolution.y;
        else if (delta.y < -u_resolution.y * 0.5) delta.y += u_resolution.y;

        float distanceSq = dot(delta, delta);
        if (distanceSq <= 0.0 || distanceSq > maxDistanceSq) continue;

        float distanceToOther = sqrt(distanceSq);
        float attraction = u_attraction[ownSpecies * 3 + otherSpecies];
        float interactionForce =
            (distanceToOther <= minDistance ? 0.3 : -attraction) /
            distanceToOther;

        force += interactionForce * delta;
    }

    velocity = (velocity + force) * u_friction;
    position = mod(position + velocity + u_resolution, u_resolution);

    outPosition = vec4(position, 0.0, 1.0);
    outVelocity = vec4(velocity, 0.0, 1.0);
}
`;

const RENDER_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D u_positions;
uniform sampler2D u_species;
uniform ivec2 u_stateSize;
uniform int u_particleCount;
uniform vec2 u_resolution;
uniform float u_pointSize;

out vec4 v_color;

ivec2 particleTexel(int index) {
    return ivec2(index % u_stateSize.x, index / u_stateSize.x);
}

void main() {
    int index = gl_VertexID;
    if (index >= u_particleCount) {
        gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
        gl_PointSize = 0.0;
        v_color = vec4(0.0);
        return;
    }

    ivec2 texel = particleTexel(index);
    vec2 position = texelFetch(u_positions, texel, 0).xy;
    int species = int(texelFetch(u_species, texel, 0).r + 0.5);

    vec2 clip = position / u_resolution * 2.0 - 1.0;
    gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
    gl_PointSize = u_pointSize;

    if (species == 0) v_color = vec4(0.22, 0.45, 0.91, 1.0);
    else if (species == 1) v_color = vec4(1.0, 0.0, 1.0, 1.0);
    else v_color = vec4(0.65, 0.13, 0.38, 1.0);
}
`;

const RENDER_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;

void main() {
    outColor = v_color;
}
`;

function compileShader(glContext, type, source) {
    const shader = glContext.createShader(type);
    glContext.shaderSource(shader, source);
    glContext.compileShader(shader);

    if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
        const error = glContext.getShaderInfoLog(shader);
        glContext.deleteShader(shader);
        throw new Error(`WebGL shader compile error: ${error}`);
    }

    return shader;
}

function createProgram(glContext, vertexSource, fragmentSource) {
    const vertexShader = compileShader(glContext, glContext.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(glContext, glContext.FRAGMENT_SHADER, fragmentSource);
    const program = glContext.createProgram();

    glContext.attachShader(program, vertexShader);
    glContext.attachShader(program, fragmentShader);
    glContext.linkProgram(program);

    glContext.deleteShader(vertexShader);
    glContext.deleteShader(fragmentShader);

    if (!glContext.getProgramParameter(program, glContext.LINK_STATUS)) {
        const error = glContext.getProgramInfoLog(program);
        glContext.deleteProgram(program);
        throw new Error(`WebGL program link error: ${error}`);
    }

    return program;
}

class WebGLParticleSimulation {
    constructor(glContext) {
        this.gl = glContext;
        this.count = 0;
        this.stateWidth = 1;
        this.stateHeight = 1;
        this.positionTextures = [];
        this.velocityTextures = [];
        this.framebuffers = [];
        this.current = 0;
        this.speciesTexture = null;
        this.simProgram = null;
        this.renderProgram = null;
        this.simVao = null;
        this.renderVao = null;
        this.background = [0.025, 0.03, 0.045, 1];
        this._initPrograms();
    }

    _initPrograms() {
        const glContext = this.gl;
        this.simProgram = createProgram(
            glContext,
            `#version 300 es
            precision highp float;
            const vec2 positions[3] = vec2[3](
                vec2(-1.0, -1.0),
                vec2(3.0, -1.0),
                vec2(-1.0, 3.0)
            );
            void main() {
                gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
            }`,
            SIMULATION_FRAGMENT_SHADER
        );
        this.renderProgram = createProgram(
            glContext,
            RENDER_VERTEX_SHADER,
            RENDER_FRAGMENT_SHADER
        );

        this.simVao = glContext.createVertexArray();
        this.renderVao = glContext.createVertexArray();
    }

    _createFloatTexture(width, height, data = null) {
        const glContext = this.gl;
        const texture = glContext.createTexture();
        glContext.bindTexture(glContext.TEXTURE_2D, texture);
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.NEAREST);
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.NEAREST);
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
        glContext.texImage2D(
            glContext.TEXTURE_2D,
            0,
            glContext.RGBA32F,
            width,
            height,
            0,
            glContext.RGBA,
            glContext.FLOAT,
            data
        );
        return texture;
    }

    _deleteStateTextures() {
        const glContext = this.gl;
        for (const texture of this.positionTextures) glContext.deleteTexture(texture);
        for (const texture of this.velocityTextures) glContext.deleteTexture(texture);
        for (const framebuffer of this.framebuffers) glContext.deleteFramebuffer(framebuffer);
        if (this.speciesTexture) glContext.deleteTexture(this.speciesTexture);

        this.positionTextures = [];
        this.velocityTextures = [];
        this.framebuffers = [];
        this.speciesTexture = null;
    }

    initializeParticles(particles) {
        const glContext = this.gl;
        this._deleteStateTextures();

        this.count = particles.length;
        this.stateWidth = Math.max(1, Math.ceil(Math.sqrt(this.count)));
        this.stateHeight = Math.max(1, Math.ceil(this.count / this.stateWidth));

        const texelCount = this.stateWidth * this.stateHeight;
        const positionData = new Float32Array(texelCount * 4);
        const velocityData = new Float32Array(texelCount * 4);
        const speciesData = new Float32Array(texelCount * 4);

        for (let i = 0; i < this.count; i++) {
            const offset = i * 4;
            const particle = particles[i];

            positionData[offset] = particle.position[0];
            positionData[offset + 1] = particle.position[1];
            positionData[offset + 3] = 1;

            velocityData[offset] = particle.velocity[0];
            velocityData[offset + 1] = particle.velocity[1];
            velocityData[offset + 3] = 1;

            speciesData[offset] = particle.key;
            speciesData[offset + 3] = 1;
        }

        for (let i = 0; i < 2; i++) {
            this.positionTextures.push(
                this._createFloatTexture(this.stateWidth, this.stateHeight, positionData)
            );
            this.velocityTextures.push(
                this._createFloatTexture(this.stateWidth, this.stateHeight, velocityData)
            );
        }

        this.speciesTexture = this._createFloatTexture(
            this.stateWidth,
            this.stateHeight,
            speciesData
        );

        for (let i = 0; i < 2; i++) {
            const framebuffer = glContext.createFramebuffer();
            glContext.bindFramebuffer(glContext.FRAMEBUFFER, framebuffer);
            glContext.framebufferTexture2D(
                glContext.FRAMEBUFFER,
                glContext.COLOR_ATTACHMENT0,
                glContext.TEXTURE_2D,
                this.positionTextures[i],
                0
            );
            glContext.framebufferTexture2D(
                glContext.FRAMEBUFFER,
                glContext.COLOR_ATTACHMENT1,
                glContext.TEXTURE_2D,
                this.velocityTextures[i],
                0
            );
            glContext.drawBuffers([
                glContext.COLOR_ATTACHMENT0,
                glContext.COLOR_ATTACHMENT1,
            ]);

            if (glContext.checkFramebufferStatus(glContext.FRAMEBUFFER) !== glContext.FRAMEBUFFER_COMPLETE) {
                throw new Error(
                    "WebGL2 floating-point framebuffer is incomplete. Check EXT_color_buffer_float support."
                );
            }

            this.framebuffers.push(framebuffer);
        }

        glContext.bindFramebuffer(glContext.FRAMEBUFFER, null);
        this.current = 0;
    }

    _setCommonUniforms(program, canvasWidth, canvasHeight) {
        const glContext = this.gl;
        glContext.uniform2i(
            glContext.getUniformLocation(program, "u_stateSize"),
            this.stateWidth,
            this.stateHeight
        );
        glContext.uniform1i(
            glContext.getUniformLocation(program, "u_particleCount"),
            this.count
        );
        glContext.uniform2f(
            glContext.getUniformLocation(program, "u_resolution"),
            canvasWidth,
            canvasHeight
        );
    }

    simulate(canvasWidth, canvasHeight) {
        const glContext = this.gl;
        if (!this.count) return;

        const next = 1 - this.current;
        glContext.bindFramebuffer(glContext.FRAMEBUFFER, this.framebuffers[next]);
        glContext.viewport(0, 0, this.stateWidth, this.stateHeight);
        glContext.drawBuffers([
            glContext.COLOR_ATTACHMENT0,
            glContext.COLOR_ATTACHMENT1,
        ]);
        glContext.useProgram(this.simProgram);
        glContext.bindVertexArray(this.simVao);

        glContext.activeTexture(glContext.TEXTURE0);
        glContext.bindTexture(glContext.TEXTURE_2D, this.positionTextures[this.current]);
        glContext.uniform1i(glContext.getUniformLocation(this.simProgram, "u_positions"), 0);

        glContext.activeTexture(glContext.TEXTURE1);
        glContext.bindTexture(glContext.TEXTURE_2D, this.velocityTextures[this.current]);
        glContext.uniform1i(glContext.getUniformLocation(this.simProgram, "u_velocities"), 1);

        glContext.activeTexture(glContext.TEXTURE2);
        glContext.bindTexture(glContext.TEXTURE_2D, this.speciesTexture);
        glContext.uniform1i(glContext.getUniformLocation(this.simProgram, "u_species"), 2);

        this._setCommonUniforms(this.simProgram, canvasWidth, canvasHeight);

        glContext.uniform1fv(
            glContext.getUniformLocation(this.simProgram, "u_attraction[0]"),
            new Float32Array(particle_system.info.flatMap((species) => species.attraction))
        );
        glContext.uniform1f(
            glContext.getUniformLocation(this.simProgram, "u_minDistance"),
            canvas_info.MIN_DISTANCE
        );
        glContext.uniform1f(
            glContext.getUniformLocation(this.simProgram, "u_maxDistance"),
            canvas_info.MAX_DISTANCE
        );
        glContext.uniform1f(
            glContext.getUniformLocation(this.simProgram, "u_friction"),
            canvas_info.FRICTION
        );

        glContext.drawArrays(glContext.TRIANGLES, 0, 3);
        glContext.bindFramebuffer(glContext.FRAMEBUFFER, null);
        this.current = next;
    }

    render(canvasWidth, canvasHeight) {
        const glContext = this.gl;
        glContext.bindFramebuffer(glContext.FRAMEBUFFER, null);
        glContext.viewport(0, 0, glContext.drawingBufferWidth, glContext.drawingBufferHeight);
        glContext.clearColor(0.025, 0.03, 0.045, 1);
        glContext.clear(glContext.COLOR_BUFFER_BIT);
        glContext.useProgram(this.renderProgram);
        glContext.bindVertexArray(this.renderVao);

        glContext.activeTexture(glContext.TEXTURE0);
        glContext.bindTexture(glContext.TEXTURE_2D, this.positionTextures[this.current]);
        glContext.uniform1i(glContext.getUniformLocation(this.renderProgram, "u_positions"), 0);

        glContext.activeTexture(glContext.TEXTURE1);
        glContext.bindTexture(glContext.TEXTURE_2D, this.speciesTexture);
        glContext.uniform1i(glContext.getUniformLocation(this.renderProgram, "u_species"), 1);

        this._setCommonUniforms(this.renderProgram, canvasWidth, canvasHeight);
        glContext.uniform1f(
            glContext.getUniformLocation(this.renderProgram, "u_pointSize"),
            canvas_info.PARTICLE_SIZE
        );
        glContext.drawArrays(glContext.POINTS, 0, this.count);
    }

    destroy() {
        this._deleteStateTextures();
        this.gl.deleteProgram(this.simProgram);
        this.gl.deleteProgram(this.renderProgram);
        this.gl.deleteVertexArray(this.simVao);
        this.gl.deleteVertexArray(this.renderVao);
    }
}

function createCpuWebGLRenderer(glContext) {
    const vertexSource = `#version 300 es
    precision highp float;
    in vec2 a_position;
    in vec4 a_color;
    uniform vec2 u_resolution;
    uniform float u_pointSize;
    out vec4 v_color;
    void main() {
        vec2 clip = a_position / u_resolution * 2.0 - 1.0;
        gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
        gl_PointSize = u_pointSize;
        v_color = a_color;
    }`;
    const fragmentSource = `#version 300 es
    precision highp float;
    in vec4 v_color;
    out vec4 outColor;
    void main() { outColor = v_color; }`;
    const program = createProgram(glContext, vertexSource, fragmentSource);
    const positionBuffer = glContext.createBuffer();
    const colorBuffer = glContext.createBuffer();
    const vao = glContext.createVertexArray();
    const positionLocation = glContext.getAttribLocation(program, "a_position");
    const colorLocation = glContext.getAttribLocation(program, "a_color");
    const resolutionLocation = glContext.getUniformLocation(program, "u_resolution");
    const pointSizeLocation = glContext.getUniformLocation(program, "u_pointSize");
    let positions = new Float32Array(0);
    let colors = new Float32Array(0);

    return () => {
        const count = particle_system.length;
        if (positions.length !== count * 2) {
            positions = new Float32Array(count * 2);
            colors = new Float32Array(count * 4);
        }
        for (let i = 0; i < count; i++) {
            const particle = particle_system.particles[i];
            positions[i * 2] = particle.position[0];
            positions[i * 2 + 1] = particle.position[1];
            colors[i * 4] = particle.color[0];
            colors[i * 4 + 1] = particle.color[1];
            colors[i * 4 + 2] = particle.color[2];
            colors[i * 4 + 3] = 1;
        }

        glContext.bindFramebuffer(glContext.FRAMEBUFFER, null);
        glContext.viewport(0, 0, glContext.drawingBufferWidth, glContext.drawingBufferHeight);
        glContext.clearColor(0.025, 0.03, 0.045, 1);
        glContext.clear(glContext.COLOR_BUFFER_BIT);
        glContext.useProgram(program);
        glContext.bindVertexArray(vao);

        glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, positions, glContext.DYNAMIC_DRAW);
        glContext.enableVertexAttribArray(positionLocation);
        glContext.vertexAttribPointer(positionLocation, 2, glContext.FLOAT, false, 0, 0);

        glContext.bindBuffer(glContext.ARRAY_BUFFER, colorBuffer);
        glContext.bufferData(glContext.ARRAY_BUFFER, colors, glContext.DYNAMIC_DRAW);
        glContext.enableVertexAttribArray(colorLocation);
        glContext.vertexAttribPointer(colorLocation, 4, glContext.FLOAT, false, 0, 0);

        glContext.uniform2f(resolutionLocation, DOM_elements.canvas.width, DOM_elements.canvas.height);
        glContext.uniform1f(pointSizeLocation, canvas_info.PARTICLE_SIZE);
        glContext.drawArrays(glContext.POINTS, 0, count);
    };
}

const init = () => {
    gl = DOM_elements.canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        powerPreference: "high-performance",
    });

    if (gl && gl.getExtension("EXT_color_buffer_float")) {
        ctx = gl;

        try {
            gpuSimulation = new WebGLParticleSimulation(gl);
            update_viewport = () => {
                gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            };
            draw_particles = () => {
                if (!gpuSimulation) return;
                gpuSimulation.simulate(DOM_elements.canvas.width, DOM_elements.canvas.height);
                gpuSimulation.render(DOM_elements.canvas.width, DOM_elements.canvas.height);
            };
        } catch (error) {
            console.error("GPU particle simulation initialization failed; using CPU fallback.", error);
            gpuSimulation?.destroy();
            gpuSimulation = null;
        }
    }

    if (!gpuSimulation) {
        if (gl) {
            // If float render targets are unavailable, keep WebGL2 rendering but
            // run the simulation on the CPU as a compatibility fallback.
            draw_particles = createCpuWebGLRenderer(gl);
            update_viewport = () => {
                gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            };
        } else {
            ctx = DOM_elements.canvas.getContext("2d");
            const draw = (x, y, color, width, height) => {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, width, height);
            };
            draw_particles = () => {
                if (!ctx || !ctx.clearRect) return;
                ctx.clearRect(0, 0, DOM_elements.canvas.width, DOM_elements.canvas.height);
                for (const particle of particle_system.particles) {
                    draw(
                        particle.position[0], particle.position[1], particle.color[4],
                        canvas_info.PARTICLE_SIZE, canvas_info.PARTICLE_SIZE
                    );
                }
            };
            update_viewport = () => {};
        }
    }

    window.dispatchEvent(new CustomEvent("resize"));
    particle_system.create_particles(canvas_info.get_redraw_multiplier());
    particles_render_loop();
};
