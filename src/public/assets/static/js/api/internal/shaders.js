export const FULLSCREEN_VERTEX = `#version 300 es
precision highp float;
const vec2 p[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
void main() { gl_Position = vec4(p[gl_VertexID], 0., 1.); }`;

export const BUILD_KEYS_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_positions;
uniform ivec2 u_stateSize;
uniform int u_particleCount;
uniform int u_sortWidth;
uniform int u_sortCount;
uniform ivec2 u_gridSize;
uniform vec2 u_resolution;
layout(location=0) out vec2 outItem;

ivec2 stateTexel(int i) { 
    return ivec2(i % u_stateSize.x, i / u_stateSize.x);
}

void main() {
    int sortedIndex = int(gl_FragCoord.y) * u_sortWidth + int(gl_FragCoord.x);
    if (sortedIndex >= u_sortCount || sortedIndex >= u_particleCount) {
        outItem = vec2(float(u_gridSize.x * u_gridSize.y), float(sortedIndex));
        return;
    }

    vec2 p = texelFetch(u_positions, stateTexel(sortedIndex), 0).xy;
    vec2 cellSize = u_resolution / vec2(u_gridSize);
    ivec2 cell = ivec2(floor(p / cellSize));
    cell = clamp(cell, ivec2(0), u_gridSize - ivec2(1));
    int key = cell.y * u_gridSize.x + cell.x;

    outItem = vec2(float(key), float(sortedIndex));
}`;

export const BITONIC_SORT_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_items;
uniform ivec2 u_sortSize;
uniform int u_sortWidth;
uniform int u_stageJ;
uniform int u_stageK;
layout(location=0) out vec2 outItem;

ivec2 itemTexel(int i) {
    return ivec2(i % u_sortWidth, i / u_sortWidth);
}

bool lessItem(vec2 a, vec2 b) {
    return (a.x < b.x) || (a.x == b.x && a.y < b.y);
}

void main() {
    int i = int(gl_FragCoord.y) * u_sortWidth + int(gl_FragCoord.x);
    vec2 a = texelFetch(u_items, itemTexel(i), 0).xy;
    int partnerIndex = i ^ u_stageJ;
    vec2 b = texelFetch(u_items, itemTexel(partnerIndex), 0).xy;

    bool ascending = (i & u_stageK) == 0;
    bool isLowerHalf = (i & u_stageJ) == 0;
    bool takeA = (isLowerHalf == ascending) ? lessItem(a, b) : !lessItem(a, b);

    outItem = takeA ? a : b;
}`;

export const SIM_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_positions;
uniform sampler2D u_velocities;
uniform sampler2D u_species;
uniform sampler2D u_attraction;
uniform sampler2D u_sortedItems;
uniform ivec2 u_stateSize;
uniform ivec2 u_gridSize;
uniform int u_particleCount;
uniform int u_sortWidth;
uniform int u_sortCount;
uniform vec2 u_resolution;
uniform float u_minDistance;
uniform float u_maxDistance;
uniform float u_friction;
layout(location=0) out vec4 outPosition;
layout(location=1) out vec4 outVelocity;

ivec2 stateTexel(int i) {
    return ivec2(i % u_stateSize.x, i / u_stateSize.x);
}
ivec2 sortTexel(int i) {
    return ivec2(i % u_sortWidth, i / u_sortWidth);
}

int binarySearchBound(int key, bool isUpper) {
    int l = 0, r = u_particleCount;
    while (l < r) {
        int mid = l + (r - l) / 2;
        int midKey = int(texelFetch(u_sortedItems, sortTexel(mid), 0).x + 0.5);
        if (isUpper ? midKey <= key : midKey < key) l = mid + 1;
        else r = mid;
    }
    return l;
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

    float maxDistanceSq = u_maxDistance * u_maxDistance;
    vec2 force = vec2(0.0);

    vec2 cellSize = u_resolution / vec2(u_gridSize);
    ivec2 ownCell = ivec2(floor(position / cellSize));
    ownCell = ivec2(
        (ownCell.x % u_gridSize.x + u_gridSize.x) % u_gridSize.x,
        (ownCell.y % u_gridSize.y + u_gridSize.y) % u_gridSize.y
    );

    for (int oy = -1; oy <= 1; ++oy) {
        for (int ox = -1; ox <= 1; ++ox) {
            ivec2 c = ownCell + ivec2(ox, oy);
            c = ivec2(
                (c.x % u_gridSize.x + u_gridSize.x) % u_gridSize.x,
                (c.y % u_gridSize.y + u_gridSize.y) % u_gridSize.y
            );
            int cellKey = c.y * u_gridSize.x + c.x;

            int begin = binarySearchBound(cellKey, false);
            int end = binarySearchBound(cellKey, true);

            for (int s = begin; s < end; ++s) {
                int otherIndex = int(texelFetch(u_sortedItems, sortTexel(s), 0).y + 0.5);
                if (otherIndex == index) continue;

                ivec2 otherTexel = stateTexel(otherIndex);
                vec2 otherPosition = texelFetch(u_positions, otherTexel, 0).xy;
                int otherSpecies = int(texelFetch(u_species, otherTexel, 0).r + 0.5);

                vec2 delta = position - otherPosition;
                if (delta.x > u_resolution.x * 0.5) delta.x -= u_resolution.x;
                else if (delta.x < -u_resolution.x * 0.5) delta.x += u_resolution.x;
                if (delta.y > u_resolution.y * 0.5) delta.y -= u_resolution.y;
                else if (delta.y < -u_resolution.y * 0.5) delta.y += u_resolution.y;

                float d2 = dot(delta, delta);
                if (d2 <= 0.0 || d2 > maxDistanceSq) continue;

                float attraction = texelFetch(u_attraction, ivec2(otherSpecies, ownSpecies), 0).r;
                float d = sqrt(d2);
                float f = (d <= u_minDistance ? 0.3 : -attraction) / d;
                force += f * delta;
            }
        }
    }

    velocity = (velocity + force) * u_friction;
    position = mod(position + velocity, u_resolution);

    outPosition = vec4(position, 0.0, 1.0);
    outVelocity = vec4(velocity, 0.0, 1.0);
}`;

export const GPU_VERTEX = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_positions;
uniform sampler2D u_species;
uniform sampler2D u_speciesColors;
uniform ivec2 u_stateSize;
uniform vec2 u_resolution;
uniform float u_pointSize;
out vec4 v_color;

ivec2 stateTexel(int i) {
    return ivec2(i % u_stateSize.x, i / u_stateSize.x);
}

void main() {
    int index = gl_VertexID;
    ivec2 texel = stateTexel(index);
    vec2 position = texelFetch(u_positions, texel, 0).xy;
    int species = int(texelFetch(u_species, texel, 0).r + 0.5);

    vec2 clip = position / u_resolution * 2.0 - 1.0;
    gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
    gl_PointSize = u_pointSize;
    v_color = texelFetch(u_speciesColors, ivec2(species, 0), 0);
}`;

export const DRAW_FRAGMENT = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;
void main() { outColor = v_color; }`;