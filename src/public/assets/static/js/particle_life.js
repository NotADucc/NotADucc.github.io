import { DOM_elements, is_mobile, random } from './shared.js';
import { register_header_events, header_info, animate_header, setup_dashboard } from './header.js';
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

const PARTICLE_SPECIES_INFO = 
[
    {
        color: "#3875ea",
        count: 75,
        attraction: [
            0.07,
            0.20,
            -0.20,
            -0.05
        ]
    },
    {
        color: "#ff00ff",
        count: 40,
        attraction: [
            -0.07,
            -0.10,
            0.20,
            -0.30
        ]
    },
    {
        color: "#a62161",
        count: 150,
        attraction: [
            0.30,
            -0.30,
            0.10,
            0.40
        ]
    },
    {
        color: "#80ffff",
        count: 50,
        attraction: [
            0.15,
            -0.10,
            -0.20,
            -0.25
        ]
    }
];

const PARTICLE_SPECIES_INFO_ORIGINAL_DEEP_COPY = PARTICLE_SPECIES_INFO.map(species => ({
    ...species,
    attraction: [...species.attraction]
}));


let particle_backend = null;
let current_update_frame = null;

const create_particles = (multiplier) => {
    const particles = [];
    
    for (const [key, value] of PARTICLE_SPECIES_INFO.entries()) {
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

    particle_backend?.initialize(particles, PARTICLE_SPECIES_INFO, PARTICLE_WORLD_INFO);
};

const draw_particles = () => {
    particle_backend?.render();
};


const particles_render_loop = () => {
    particle_backend?.step();

    draw_particles();
    current_update_frame = requestAnimationFrame(particles_render_loop);
}

const generate_species_info = (len) => {
    return {
        // Source - https://stackoverflow.com/a/5365036
        color: "#" + ((1 << 24) * Math.random() | 0).toString(16).padStart(6, "0"),
        count: Math.floor(Math.random() * 176) + 25,
        attraction: Array.from(
            { length: len },
            () => Math.round((Math.random() * 1 - 0.5) * 100) / 100
        )
    };
}

const randomize_species = () => {
    for (const species of PARTICLE_SPECIES_INFO) {
        const new_info = generate_species_info(PARTICLE_SPECIES_INFO.length);
        species.color = new_info.color;
        species.count = new_info.count;
        species.attraction = new_info.attraction;
    }

    create_particles(PARTICLE_WORLD_INFO.get_redraw_multiplier());
    setup_dashboard(PARTICLE_WORLD_INFO, PARTICLE_SPECIES_INFO);
};

const reset_species = () => {
    PARTICLE_SPECIES_INFO.splice(
        0,
        PARTICLE_SPECIES_INFO.length,
        ...PARTICLE_SPECIES_INFO_ORIGINAL_DEEP_COPY.map(species => ({
            ...species,
            attraction: [...species.attraction]
        }))
    );

    create_particles(PARTICLE_WORLD_INFO.get_redraw_multiplier());
    setup_dashboard(PARTICLE_WORLD_INFO, PARTICLE_SPECIES_INFO);
};

// can replace 0 with a random value if u want it already generated
// with values instead of 0
const update_attraction_matrix = () => {
    const species_count = PARTICLE_SPECIES_INFO.length;

    PARTICLE_SPECIES_INFO.forEach(species => {
        while (species.attraction.length < species_count) {
            species.attraction.push(0);
        }

        while (species.attraction.length > species_count) {
            species.attraction.pop();
        }
    });
};

const remove_species = () => {
    if (PARTICLE_SPECIES_INFO.length <= 2) return;

    PARTICLE_SPECIES_INFO.pop();
    update_attraction_matrix();

    create_particles(PARTICLE_WORLD_INFO.get_redraw_multiplier());
    setup_dashboard(PARTICLE_WORLD_INFO, PARTICLE_SPECIES_INFO);
};

const add_species = () => {
    if (PARTICLE_SPECIES_INFO.length >= 15) return;

    const new_species = generate_species_info(PARTICLE_SPECIES_INFO.length);
    PARTICLE_SPECIES_INFO.push(new_species);
    update_attraction_matrix();

    create_particles(PARTICLE_WORLD_INFO.get_redraw_multiplier());
    setup_dashboard(PARTICLE_WORLD_INFO, PARTICLE_SPECIES_INFO);
};

const init = async () => {
    register_header_events();
    setup_dashboard(PARTICLE_WORLD_INFO, PARTICLE_SPECIES_INFO);
    window.dispatchEvent(new CustomEvent("resize"));
    particle_backend = await get_particle_backend_factory(DOM_elements.canvas);
    create_particles(PARTICLE_WORLD_INFO.get_redraw_multiplier());
    particles_render_loop();
}

// EVENT LISTENERS

addEventListener("particles:reset", reset_species);
addEventListener("particles:randomize", randomize_species);
addEventListener("particles:species:remove", remove_species);
addEventListener("particles:species:add", add_species);

addEventListener("dashboard:rerender",  
    () => create_particles(PARTICLE_WORLD_INFO.get_redraw_multiplier())
);
addEventListener("dashboard:update", 
    () => {
        particle_backend.set_species(PARTICLE_SPECIES_INFO)
        particle_backend.set_settings(PARTICLE_WORLD_INFO)
    }
);

addEventListener("header:resized",  () => create_particles(PARTICLE_WORLD_INFO.get_redraw_multiplier()));
addEventListener("header:expanded", (event) => {
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