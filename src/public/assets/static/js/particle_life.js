import { DOM_elements, is_mobile, random } from './shared.js';
import { register_header_events, header_info, animate_header, counter_button_container_on_click } from './header.js';
import {get_particle_backend_factory} from './api/api-factory.js'

const PARTICLE_WORLD_INFO = {
    FRICTION: 0.4,
    PARTICLE_SIZE: 5.0,
    MIN_DISTANCE: 6,
    MIN_DISTANCE_SQ: 36,
    MAX_DISTANCE: 30,
    MAX_DISTANCE_SQ: 900,
    MAX_PARTICLE_MULTIPLIER: 100,
    multiplier: is_mobile() ? 3 : 10,
    get_redraw_multiplier: () => DOM_elements.canvas.height <= header_info.HEADER_MIN_HEIGHT ? 1 : PARTICLE_WORLD_INFO.multiplier,
}

const ATTRACTION_MATRIX = 
[
    {
        color: [0.22, 0.45, 0.91, 1, "#3875ea"],
        count: 75,
        attraction: [
            0.32,
            -0.4,
            -0.4
        ]
    },
    {
        color: [1, 0, 1, 1, "#ff00ff"],
        count: 25,
        attraction: [
            0.4,
            0.1,
            -0.2
        ]
    },
    {
        color: [0.65, 0.13, 0.38, 1, "#a62161"],
        count: 150,
        attraction: [
            0.4,
            0,
            -0.15
        ]
    },
]


let particle_backend = null;
let current_update_frame = null;

const create_particles = (multiplier) => {
    const particles = [];

    for (const [key, value] of ATTRACTION_MATRIX.entries()) {
        const add_amount = value.count * multiplier;
        for (let i = 0; i < add_amount; i++) {
            const particle = {
                key: key, 
                position: [random(DOM_elements.canvas.width), random(DOM_elements.canvas.height)], 
                velocity: [0, 0],
                color: value.color, 
                bounds: value.bounds
            };
            particles.push(particle);
        }
    }

    particle_backend?.initialize(particles, ATTRACTION_MATRIX, PARTICLE_WORLD_INFO);
};

const draw_particles = () => {
    particle_backend?.render(
        ATTRACTION_MATRIX.particles,
        DOM_elements.canvas.width,
        DOM_elements.canvas.height,
        PARTICLE_WORLD_INFO
    );
};


const particles_render_loop = () => {
    particle_backend?.step(
        ATTRACTION_MATRIX.particles,
        ATTRACTION_MATRIX.info,
        PARTICLE_WORLD_INFO
    );

    draw_particles();
    current_update_frame = requestAnimationFrame(particles_render_loop);
}

const init = () => {
    register_header_events();
    window.dispatchEvent(new CustomEvent("resize"));
    particle_backend = get_particle_backend_factory(DOM_elements.canvas);
    create_particles(PARTICLE_WORLD_INFO.get_redraw_multiplier());
    particles_render_loop();
}

// EVENT LISTENERS

DOM_elements.plus_button.addEventListener("click", () => counter_button_container_on_click(1, PARTICLE_WORLD_INFO.multiplier, 1, PARTICLE_WORLD_INFO.MAX_PARTICLE_MULTIPLIER));
DOM_elements.minus_button.addEventListener("click", () => counter_button_container_on_click(-1, PARTICLE_WORLD_INFO.multiplier, 1, PARTICLE_WORLD_INFO.MAX_PARTICLE_MULTIPLIER));

addEventListener("counter-changed", (event) => {
    PARTICLE_WORLD_INFO.multiplier = event.detail.multiplier;
    create_particles(PARTICLE_WORLD_INFO.get_redraw_multiplier());
});

addEventListener("header-resized",  () => create_particles(PARTICLE_WORLD_INFO.get_redraw_multiplier()));
addEventListener("header-expanded", (event) => {
    cancelAnimationFrame(current_update_frame);
    animate_header(
        0.0, 
        event.detail.current_height, 
        event.detail.new_height,
        () => {
            create_particles(1);
            draw_particles();
        },
        () => {
            create_particles(PARTICLE_WORLD_INFO.get_redraw_multiplier());
            particles_render_loop();
        }
    );
});

addEventListener("load", init);