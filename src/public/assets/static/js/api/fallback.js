import { Rectangle } from '../rectangle.js';
import { QuadTree } from '../quadtree.js';


const particle_system = {
    particles: [],
    container: null,
    get length() {
        return this.particles.length;
    },
    create_particles(canvas, multiplier) {
        this.clear_particles();
        this.container = new QuadTree(
            new Rectangle(canvas.width / 2, canvas.height / 2, canvas.width, canvas.height)
        );
        for (const [key, value] of this.info.entries()) {
            const add_amount = value.count * multiplier;
            for (let i = 0; i < add_amount; i++) {
                const particle = {
                    key: key, 
                    position: [random(canvas.width), random(canvas.height)], 
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
    update_positions(canvas, world_info) {
        const canvas_width = canvas.width;
        const canvas_height = canvas.height;
        for (let i = 0; i < particle_system.length; i++) {
            let fx = 0.0;
            let fy = 0.0;

            const seeker = particle_system.particles[i];
            const seeker_x = seeker.position[0];
            const seeker_y = seeker.position[1];
            const rect_radius = world_info.MAX_DISTANCE;

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
                if (d == 0 || d > world_info.MAX_DISTANCE_SQ) continue;
                
                const d_sqrt = Math.sqrt(d);
                // true path fixed repulsion
                const F = (d_sqrt <= world_info.MIN_DISTANCE ? 0.3 : -attraction) / d_sqrt;

                fx += F * dx;
                fy += F * dy;
            }

            seeker.velocity[0] = (seeker.velocity[0] + fx) * world_info.FRICTION;
            seeker.velocity[1] = (seeker.velocity[1] + fy) * world_info.FRICTION;
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

export const init_ctx = (canvas) => {
    return canvas.getContext('2d');
}

export const draw_particles_cpu = (canvas, world_info) => {
    const draw = (x, y, c, w, h) => {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, w, h);
    }

    return draw_particles = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particle_system.length; i++) {
            const particle = particle_system.particles[i];
            draw(particle.position[0], particle.position[1], particle.color[4], world_info.PARTICLE_SIZE, world_info.PARTICLE_SIZE);
        }
    }
}