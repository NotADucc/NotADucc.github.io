import { DOM_elements, is_mobile, random } from './shared.js';
import { header_info, animate_header, counter_button_container_on_click } from './header.js';
import { Rectangle } from './rectangle.js';
import { QuadTree } from './quadtree.js';

const canvas_info = {
    FRICTION: 0.4,
    PARTICLE_SIZE: 5.0,
    MIN_DISTANCE: 6,
    MIN_DISTANCE_SQ: 36,
    MAX_DISTANCE: 30,
    MAX_DISTANCE_SQ: 900,
    MAX_PARTICLE_MULTIPLIER: 30,
    multiplier: is_mobile() ? 3 : 10,
    get_redraw_multiplier: () => DOM_elements.canvas.height <= header_info.HEADER_MIN_HEIGHT ? 1 : canvas_info.multiplier,
}

const particle_system = {
    particles: [],
    container: null,
    get length() {
        return this.particles.length;
    },
    create_particles(multiplier) {
        this.clear_particles();
        this.container = new QuadTree(
            new Rectangle(DOM_elements.canvas.width / 2, DOM_elements.canvas.height / 2, DOM_elements.canvas.width, DOM_elements.canvas.height)
        );
        for (const [key, value] of this.info.entries()) {
            const add_amount = value.count * multiplier;
            for (let i = 0; i < add_amount; i++) {
                const particle = {
                    key: key, 
                    position: [random(DOM_elements.canvas.width), random(DOM_elements.canvas.height)], 
                    velocity: [0, 0],
                    color: value.color, 
                    bounds: value.bounds
                };
                this.particles.push(particle);
                this.container.insert(particle);
            }
        }
    },
    clear_particles() {
        this.particles.length = 0;
        this.container = null;
    },
    update_positions() {
        const canvas_width = DOM_elements.canvas.width;
        const canvas_height = DOM_elements.canvas.height;
        for (let i = 0; i < particle_system.length; i++) {
            let fx = 0.0;
            let fy = 0.0;

            const seeker = particle_system.particles[i];
            const seeker_x = seeker.position[0];
            const seeker_y = seeker.position[1];
            const rect_radius = canvas_info.MAX_DISTANCE;

            const seeker_attractions = particle_system.info[seeker.key].attraction;

            const rect = new Rectangle(seeker_x, seeker_y, rect_radius, rect_radius)

            const targets = particle_system.query_particles(rect)

            // horizontal borders.
            if (seeker_x < rect_radius) {
                rect.update(
                    canvas_width - (rect_radius - seeker_x), seeker_y, rect_radius - seeker_x, rect_radius
                )
                for (const p of particle_system.query_particles(rect)) 
                    targets.push(p);
            } else if (canvas_width - seeker_x < rect_radius) {
                rect.update(
                    0, seeker_y, rect_radius - (canvas_width - seeker_x), rect_radius
                )
                for (const p of particle_system.query_particles(rect)) 
                    targets.push(p);
            }

            // vertical borders.
            if (seeker_y < rect_radius) {
                rect.update(
                    seeker_x, canvas_height - (rect_radius - seeker_y), rect_radius, rect_radius - seeker_y
                )
                for (const p of particle_system.query_particles(rect)) 
                    targets.push(p);
            } else if (canvas_height - seeker_y < rect_radius) {
                rect.update(
                    seeker_x, 0, rect_radius, rect_radius - (canvas_height - seeker_y)
                )
                for (const p of particle_system.query_particles(rect)) 
                    targets.push(p);
            }

            for (const target of targets) {
                const attraction = seeker_attractions[target.key];
                if (attraction == 0) continue;

                let dx = seeker_x - target.position[0];
                let dy = seeker_y - target.position[1];

                const half_width = canvas_width * 0.5;
                const half_height = canvas_height * 0.5;

                if (dx > half_width) dx -= canvas_width;
                else if (dx < -half_width) dx += canvas_width;

                if (dy > half_height) dy -= canvas_height;
                else if (dy < -half_height) dy += canvas_height;

                const d = dx * dx + dy * dy;
                if (d == 0 || d > canvas_info.MAX_DISTANCE_SQ) continue;
                
                const d_sqrt = Math.sqrt(d);
                // true path fixed repulsion
                const F = (d_sqrt <= canvas_info.MIN_DISTANCE ? 0.3 : -attraction) / d_sqrt;

                fx += F * dx;
                fy += F * dy;
            }

            seeker.velocity[0] = (seeker.velocity[0] + fx) * canvas_info.FRICTION;
            seeker.velocity[1] = (seeker.velocity[1] + fy) * canvas_info.FRICTION;
            seeker.position[0] = (seeker.position[0] + seeker.velocity[0] + canvas_width) % canvas_width;
            seeker.position[1] = (seeker.position[1] + seeker.velocity[1] + canvas_height) % canvas_height;
        }
        // cleanup container
        this.container.update_positions();
    },
    query_particles(rect) {
        return this.container.query(rect);
    },
    info: [
        {
            color: [0.22, 0.45, 0.91, 1, "#3875ea"],
            count: 75,
            bounds: true,
            attraction: [
                0.32,
                -0.4,
                -0.4
            ]
        },
        {
            color: [1, 0, 1, 1, "#ff00ff"],
            count: 25,
            bounds: true,
            attraction: [
                0.4,
                0.1,
                -0.2
            ]
        },
        {
            color: [0.65, 0.13, 0.38, 1, "#a62161"],
            count: 150,
            bounds: false,
            attraction: [
                0.4,
                0,
                -0.15
            ]
        },
    ]
}

const ctx = DOM_elements.canvas.getContext('2d');
let draw_particles = () => {
    const draw = (x, y, c, w, h) => {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, w, h);
    };

    ctx.clearRect(0, 0, DOM_elements.canvas.width, DOM_elements.canvas.height);
    for (let i = 0; i < particle_system.length; i++) {
        const particle = particle_system.particles[i];
        draw(particle.position[0], particle.position[1], particle.color[4], canvas_info.PARTICLE_SIZE, canvas_info.PARTICLE_SIZE);
    }
};

let current_update_frame;
const particles_render_loop = () => {
    particle_system.update_positions();
    draw_particles();
    current_update_frame = requestAnimationFrame(particles_render_loop);
}

const init = () => {
    window.dispatchEvent(new CustomEvent("resize"));
    particles_render_loop();
}


// EVENT LISTENERS

DOM_elements.plus_button.addEventListener("click", () => counter_button_container_on_click(1, canvas_info.multiplier, 1, canvas_info.MAX_PARTICLE_MULTIPLIER));
DOM_elements.minus_button.addEventListener("click", () => counter_button_container_on_click(-1, canvas_info.multiplier, 1, canvas_info.MAX_PARTICLE_MULTIPLIER));

addEventListener("counter-changed", (event) => {
    canvas_info.multiplier = event.detail.multiplier;
    particle_system.create_particles(canvas_info.get_redraw_multiplier());
});

addEventListener("header-resized",  () => particle_system.create_particles(canvas_info.get_redraw_multiplier()));
addEventListener("header-expanded", (event) => {
    cancelAnimationFrame(current_update_frame);
    animate_header(
        0.0, 
        event.detail.current_height, 
        event.detail.new_height,
        () => {
            particle_system.create_particles(1);
            draw_particles();
        },
        () => {
            particle_system.create_particles(canvas_info.get_redraw_multiplier());
            particles_render_loop();
        }
    );
});

addEventListener("events-loaded", init);