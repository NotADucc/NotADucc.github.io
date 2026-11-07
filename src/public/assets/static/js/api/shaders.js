/*
 * Force step:  keys -> bitonic sort -> per-cell ranges -> reorder state -> sim (force + integrate)
 * Other steps: integrate only, reusing the cached force.
 *
 * Every state texture shares one layout: particle i sits at texel
 * (i & (W-1), i >> u_layoutShift) with W = 1 << u_layoutShift.
 * Positions are RGBA32F (x, y, species, unused); velocities and forces are RG32F.
 */

const HEAD = `#version 300 es
precision highp float;
precision highp int;
`;

const LAYOUT = `
uniform int u_layoutShift;
ivec2 layoutTexel(int i) { return ivec2(i & ((1 << u_layoutShift) - 1), i >> u_layoutShift); }
int layoutIndex(ivec2 t) { return (t.y << u_layoutShift) | t.x; }
`;

export const FULLSCREEN_VERTEX = `#version 300 es
precision highp float;
const vec2 p[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
void main() { gl_Position = vec4(p[gl_VertexID], 0., 1.); }`;

// (cell key, particle index) per particle. Padding sorts last via an out-of-range key.
export const BUILD_KEYS_FRAGMENT = HEAD + `
uniform sampler2D u_positions;
uniform int u_particleCount;
uniform ivec2 u_gridSize;
uniform vec2 u_resolution;
${LAYOUT}
layout(location=0) out vec2 outItem;

void main() {
    ivec2 texel = ivec2(gl_FragCoord.xy);
    int index = layoutIndex(texel);
    if (index >= u_particleCount) {
        outItem = vec2(float(u_gridSize.x * u_gridSize.y), float(index));
        return;
    }
    vec2 p = texelFetch(u_positions, texel, 0).xy;
    ivec2 cell = clamp(ivec2(floor(p / (u_resolution / vec2(u_gridSize)))), ivec2(0), u_gridSize - ivec2(1));
    outItem = vec2(float(cell.y * u_gridSize.x + cell.x), float(index));
}`;

// Two bitonic stages (j and j/2) per pass. When j == 1, h is 0 and the four fetched
// items collapse into two identical pairs, so the pass is exactly one stage.
export const BITONIC_SORT_FRAGMENT = HEAD + `
uniform sampler2D u_items;
uniform int u_stageJ;
uniform int u_stageK;
${LAYOUT}
layout(location=0) out vec2 outItem;

vec2 fetchItem(int i) { return texelFetch(u_items, layoutTexel(i), 0).xy; }

// Items are unique (the index is part of the key), so this is a strict order.
bool lessItem(vec2 a, vec2 b) { return a.x < b.x || (a.x == b.x && a.y < b.y); }

void cex(inout vec2 lo, inout vec2 hi, bool asc) {
    if (asc ? lessItem(hi, lo) : lessItem(lo, hi)) { vec2 t = lo; lo = hi; hi = t; }
}

void main() {
    int i = layoutIndex(ivec2(gl_FragCoord.xy));
    int j = u_stageJ;
    int h = j >> 1;
    int base = i & ~(j | h);

    vec2 e00 = fetchItem(base);
    vec2 e01 = fetchItem(base | h);
    vec2 e10 = fetchItem(base | j);
    vec2 e11 = fetchItem(base | j | h);

    bool asc = (base & u_stageK) == 0;
    cex(e00, e10, asc); cex(e01, e11, asc);   // stage j
    cex(e00, e01, asc); cex(e10, e11, asc);   // stage j/2

    bool upJ = (i & j) != 0;
    bool upH = (i & h) != 0;
    outItem = upJ ? (upH ? e11 : e10) : (upH ? e01 : e00);
}`;

// One texel per grid cell: [begin, end) of that cell in the sorted array.
export const RANGES_FRAGMENT = HEAD + `
uniform sampler2D u_items;
uniform int u_particleCount;
uniform ivec2 u_gridSize;
${LAYOUT}
layout(location=0) out vec2 outRange;

int lowerBound(int start, int key) {
    int l = start, r = u_particleCount;
    while (l < r) {
        int mid = (l + r) >> 1;
        if (int(texelFetch(u_items, layoutTexel(mid), 0).x + 0.5) < key) l = mid + 1;
        else r = mid;
    }
    return l;
}

void main() {
    ivec2 cell = ivec2(gl_FragCoord.xy);
    int key = cell.y * u_gridSize.x + cell.x;
    int begin = lowerBound(0, key);
    outRange = vec2(float(begin), float(lowerBound(begin, key + 1)));
}`;

// Texel j receives the state of the particle that sorted into slot j.
export const REORDER_FRAGMENT = HEAD + `
uniform sampler2D u_positions;
uniform sampler2D u_velocities;
uniform sampler2D u_items;
${LAYOUT}
layout(location=0) out vec4 outPosition;
layout(location=1) out vec4 outVelocity;

void main() {
    ivec2 source = layoutTexel(int(texelFetch(u_items, ivec2(gl_FragCoord.xy), 0).y + 0.5));
    outPosition = texelFetch(u_positions, source, 0);
    outVelocity = texelFetch(u_velocities, source, 0);
}`;

// Reads the sorted state; writes new state (same order) plus the force.
export const SIM_FRAGMENT = HEAD + `
uniform sampler2D u_positions;
uniform sampler2D u_velocities;
uniform sampler2D u_attraction;   // x = other species, y = own species
uniform sampler2D u_ranges;
uniform int u_particleCount;
uniform ivec2 u_gridSize;
uniform ivec2 u_cellRadius;       // cells to scan in each direction
uniform vec2 u_resolution;
uniform float u_minDistSq;
uniform float u_maxDistSq;
uniform float u_friction;
uniform float u_repulsion;
${LAYOUT}
layout(location=0) out vec4 outPosition;
layout(location=1) out vec4 outVelocity;
layout(location=2) out vec4 outForce;

vec2 g_position;
vec2 g_force;
int g_species;

// Cells firstCell..lastCell of one grid row are contiguous in sorted order,
// so the whole run is a single [begin, end) range.
void scan(int row, int firstCell, int lastCell) {
    int begin = int(texelFetch(u_ranges, ivec2(firstCell, row), 0).x + 0.5);
    int end = int(texelFetch(u_ranges, ivec2(lastCell, row), 0).y + 0.5);

    for (int s = begin; s < end; ++s) {
        vec4 other = texelFetch(u_positions, layoutTexel(s), 0);

        vec2 delta = g_position - other.xy;
        delta -= u_resolution * floor(delta / u_resolution + 0.5);

        float d2 = dot(delta, delta);
        if (d2 <= 0.0 || d2 > u_maxDistSq) continue;

        float f = d2 <= u_minDistSq
            ? u_repulsion
            : -texelFetch(u_attraction, ivec2(int(other.z + 0.5), g_species), 0).r;
        g_force += f * delta * inversesqrt(d2);
    }
}

void main() {
    ivec2 texel = ivec2(gl_FragCoord.xy);
    if (layoutIndex(texel) >= u_particleCount) {
        outPosition = outVelocity = outForce = vec4(0.0);
        return;
    }

    vec4 own = texelFetch(u_positions, texel, 0);
    vec2 velocity = texelFetch(u_velocities, texel, 0).xy;
    g_position = own.xy;
    g_species = int(own.z + 0.5);
    g_force = vec2(0.0);

    int gx = u_gridSize.x, gy = u_gridSize.y;
    ivec2 cell = clamp(ivec2(floor(g_position / (u_resolution / vec2(u_gridSize)))), ivec2(0), u_gridSize - ivec2(1));

    // A window covering a whole axis visits every cell exactly once (no double counting on tiny grids).
    bool wholeRow = 2 * u_cellRadius.x + 1 >= gx;
    bool wholeCol = 2 * u_cellRadius.y + 1 >= gy;
    int rows = wholeCol ? gy : 2 * u_cellRadius.y + 1;
    int x0 = cell.x - u_cellRadius.x;
    int x1 = cell.x + u_cellRadius.x;

    for (int iy = 0; iy < rows; ++iy) {
        // not wholeCol => radius < gy/2, so the sum below is never negative
        int row = wholeCol ? iy : (cell.y - u_cellRadius.y + iy + gy) % gy;

        if (wholeRow)      scan(row, 0, gx - 1);
        else if (x0 < 0)  { scan(row, x0 + gx, gx - 1); scan(row, 0, x1); }
        else if (x1 >= gx) { scan(row, x0, gx - 1); scan(row, 0, x1 - gx); }
        else               scan(row, x0, x1);
    }

    velocity = (velocity + g_force) * u_friction;
    outPosition = vec4(mod(g_position + velocity, u_resolution), own.z, 1.0);
    outVelocity = vec4(velocity, 0.0, 1.0);
    outForce = vec4(g_force, 0.0, 1.0);
}`;

// Between force steps: reuse the cached force.
export const INTEGRATE_FRAGMENT = HEAD + `
uniform sampler2D u_positions;
uniform sampler2D u_velocities;
uniform sampler2D u_forces;
uniform int u_particleCount;
uniform vec2 u_resolution;
uniform float u_friction;
${LAYOUT}
layout(location=0) out vec4 outPosition;
layout(location=1) out vec4 outVelocity;

void main() {
    ivec2 texel = ivec2(gl_FragCoord.xy);
    if (layoutIndex(texel) >= u_particleCount) {
        outPosition = outVelocity = vec4(0.0);
        return;
    }
    vec4 p = texelFetch(u_positions, texel, 0);
    vec2 v = (texelFetch(u_velocities, texel, 0).xy + texelFetch(u_forces, texel, 0).xy) * u_friction;
    outPosition = vec4(mod(p.xy + v, u_resolution), p.z, 1.0);
    outVelocity = vec4(v, 0.0, 1.0);
}`;

export const GPU_VERTEX = HEAD + `
uniform sampler2D u_positions;
uniform sampler2D u_speciesColors;
uniform vec2 u_resolution;
uniform float u_pointSize;
${LAYOUT}
out vec4 v_color;

void main() {
    vec4 p = texelFetch(u_positions, layoutTexel(gl_VertexID), 0);
    vec2 clip = p.xy / u_resolution * 2.0 - 1.0;
    gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
    gl_PointSize = u_pointSize;
    v_color = texelFetch(u_speciesColors, ivec2(int(p.z + 0.5), 0), 0);
}`;

export const DRAW_FRAGMENT = HEAD + `
in vec4 v_color;
out vec4 outColor;
void main() { outColor = v_color; }`;
