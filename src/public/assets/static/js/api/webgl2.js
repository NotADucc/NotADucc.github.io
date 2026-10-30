const compileShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || "Unknown shader compilation error";
        gl.deleteShader(shader);
        throw new Error(`WebGL shader compilation failed: ${message}`);
    }
    return shader;
}

const createProgram = (gl, vertexSource, fragmentSource) => {
    const shaders = [
        compileShader(gl, gl.VERTEX_SHADER, vertexSource),
        compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
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
}

const DRAW_FRAGMENT = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;
void main() { outColor = v_color; }`;

const SIM_FRAGMENT = `#version 300 es
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
layout(location=0) out vec4 outPosition;
layout(location=1) out vec4 outVelocity;

ivec2 texelFor(int i) {
    return ivec2(i % u_stateSize.x, i / u_stateSize.x);
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

    for (int j = 0; j < u_particleCount; ++j) {
        if (j == index) continue;
        ivec2 otherTexel = texelFor(j);
        vec2 otherPosition = texelFetch(u_positions, otherTexel, 0).xy;
        int otherSpecies = int(texelFetch(u_species, otherTexel, 0).r + 0.5);
        vec2 delta = position - otherPosition;

        if (delta.x > u_resolution.x * 0.5) delta.x -= u_resolution.x;
        else if (delta.x < -u_resolution.x * 0.5) delta.x += u_resolution.x;
        if (delta.y > u_resolution.y * 0.5) delta.y -= u_resolution.y;
        else if (delta.y < -u_resolution.y * 0.5) delta.y += u_resolution.y;

        float d = dot(delta, delta);
        if (d <= 0.0 || d > maxDistanceSq) continue;

        float d_sqrt = sqrt(d);
        float attraction = u_attraction[ownSpecies * 3 + otherSpecies];
        float f = (d_sqrt <= u_minDistance ? 0.3 : -attraction) / d_sqrt;
        force += f * delta;
    }

    velocity = (velocity + force) * u_friction;
    position = mod(position + velocity + u_resolution, u_resolution);
    outPosition = vec4(position, 0.0, 1.0);
    outVelocity = vec4(velocity, 0.0, 1.0);
}`;

const GPU_VERTEX = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_positions;
uniform sampler2D u_species;
uniform ivec2 u_stateSize;
uniform int u_particleCount;
uniform vec2 u_resolution;
uniform float u_pointSize;
out vec4 v_color;
ivec2 texelFor(int i) { return ivec2(i % u_stateSize.x, i / u_stateSize.x); }
void main() {
    int index = gl_VertexID;
    if (index >= u_particleCount) {
        gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
        gl_PointSize = 0.0;
        v_color = vec4(0.0);
        return;
    }
    ivec2 texel = texelFor(index);
    vec2 position = texelFetch(u_positions, texel, 0).xy;
    int species = int(texelFetch(u_species, texel, 0).r + 0.5);
    vec2 clip = position / u_resolution * 2.0 - 1.0;
    gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
    gl_PointSize = u_pointSize;
    if (species == 0) v_color = vec4(0.22, 0.45, 0.91, 1.0);
    else if (species == 1) v_color = vec4(1.0, 0.0, 1.0, 1.0);
    else v_color = vec4(0.65, 0.13, 0.38, 1.0);
}`;

export default class WebGLBackend {
    constructor(canvas) {
        this.canvas = canvas;
        this.background = [0, 0, 0, 0];
        this.gl = canvas.getContext("webgl2", {
            alpha: true,
            antialias: false,
            powerPreference: "high-performance",
        });
        if (!this.gl) throw new Error("WebGL2 is unavailable.");
        this.gl.disable(this.gl.DEPTH_TEST);
        this.gpu = null;

        if (!this.gl.getExtension("EXT_color_buffer_float")) {
            throw new Error("GPU simulation requires EXT_color_buffer_float.");
        }
        this.gpu = new GpuSimulation(this.gl);
    }


    initialize(particles, species, settings) {
        this.gpu.initialize(particles, species, settings);
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
    }
}

class GpuSimulation {
    constructor(gl) {
        this.gl = gl;
        this.current = 0;
        this.count = 0;
        this.width = 1;
        this.height = 1;
        this.positionTextures = [];
        this.velocityTextures = [];
        this.framebuffers = [];
        this.species = null;
        this.speciesTexture = null;
        this.settings = null;
        this.simVao = gl.createVertexArray();
        this.renderVao = gl.createVertexArray();
        const fullscreenVertex = `#version 300 es
        precision highp float;
        const vec2 p[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
        void main() { gl_Position = vec4(p[gl_VertexID],0.,1.); }`;
        this.simProgram = createProgram(gl, fullscreenVertex, SIM_FRAGMENT);
        this.renderProgram = createProgram(gl, GPU_VERTEX, DRAW_FRAGMENT);
    }

    _floatTexture(width, height, data = null) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        for (const [parameter, value] of [
            [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
            [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
            [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
            [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]
        ]) {
            gl.texParameteri(gl.TEXTURE_2D, parameter, value);
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
        return texture;
    }

    _deleteState() {
        const gl = this.gl;
        this.positionTextures.forEach(t => gl.deleteTexture(t));
        this.velocityTextures.forEach(t => gl.deleteTexture(t));
        this.framebuffers.forEach(f => gl.deleteFramebuffer(f));
        if (this.speciesTexture) gl.deleteTexture(this.speciesTexture);
        this.positionTextures = [];
        this.velocityTextures = [];
        this.framebuffers = [];
        this.speciesTexture = null;
    }

    initialize(particles, species, settings) {
        const gl = this.gl;
        this._deleteState();
        this.count = particles.length;
        this.species = species;
        this.width = Math.max(1, Math.ceil(Math.sqrt(this.count)));
        this.height = Math.max(1, Math.ceil(this.count / this.width));
        this.settings = settings;
        const texels = this.width * this.height;
        const pos = new Float32Array(texels * 4);
        const vel = new Float32Array(texels * 4);
        const sp = new Float32Array(texels * 4);

        for (let i = 0; i < this.count; i++) {
            const o = i * 4;
            const p = particles[i];
            
            pos.set([...p.position, 0, 1], o);
            vel.set([...p.velocity, 0, 1], o);
            sp.set([p.key, 0, 0, 1], o);
        }

        for (let i = 0; i < 2; i++) {
            this.positionTextures.push(this._floatTexture(this.width, this.height, pos));
            this.velocityTextures.push(this._floatTexture(this.width, this.height, vel));
        }
        this.speciesTexture = this._floatTexture(this.width, this.height, sp);

        for (let i = 0; i < 2; i++) {
            const fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.positionTextures[i], 0);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.velocityTextures[i], 0);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
                throw new Error("WebGL floating-point framebuffer is incomplete.");
            }
            this.framebuffers.push(fb);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.current = 0;
    }

    _common(program, width, height) {
        const gl = this.gl;
        gl.uniform2i(gl.getUniformLocation(program, "u_stateSize"), this.width, this.height);
        gl.uniform1i(gl.getUniformLocation(program, "u_particleCount"), this.count);
        gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), width, height);
    }

    simulate(width, height) {
        const gl = this.gl;
        if (!this.count) return;
        const next = 1 - this.current;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[next]);
        gl.viewport(0, 0, this.width, this.height);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        gl.useProgram(this.simProgram);
        gl.bindVertexArray(this.simVao);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.positionTextures[this.current]);
        gl.uniform1i(gl.getUniformLocation(this.simProgram, "u_positions"), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.velocityTextures[this.current]);
        gl.uniform1i(gl.getUniformLocation(this.simProgram, "u_velocities"), 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.speciesTexture);
        gl.uniform1i(gl.getUniformLocation(this.simProgram, "u_species"), 2);
        this._common(this.simProgram, width, height);
        gl.uniform1fv(
            gl.getUniformLocation(this.simProgram, "u_attraction[0]"),
            new Float32Array(this.species.flatMap(s => s.attraction))
        );
        gl.uniform1f(gl.getUniformLocation(this.simProgram, "u_minDistance"), this.settings.MIN_DISTANCE);
        gl.uniform1f(gl.getUniformLocation(this.simProgram, "u_maxDistance"), this.settings.MAX_DISTANCE);
        gl.uniform1f(gl.getUniformLocation(this.simProgram, "u_friction"), this.settings.FRICTION);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.current = next;
    }

    render(width, height) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.useProgram(this.renderProgram);
        gl.bindVertexArray(this.renderVao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.positionTextures[this.current]);
        gl.uniform1i(gl.getUniformLocation(this.renderProgram, "u_positions"), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.speciesTexture);
        gl.uniform1i(gl.getUniformLocation(this.renderProgram, "u_species"), 1);
        this._common(this.renderProgram, width, height);
        gl.uniform1f(gl.getUniformLocation(this.renderProgram, "u_pointSize"), this.settings.PARTICLE_SIZE);
        gl.drawArrays(gl.POINTS, 0, this.count);
    }

    destroy() {
        this._deleteState();
        const gl = this.gl;
        gl.deleteProgram(this.simProgram);
        gl.deleteProgram(this.renderProgram);
        gl.deleteVertexArray(this.simVao);
        gl.deleteVertexArray(this.renderVao);
    }
}