import QuadTree from "./internal/quadtree.js";
import Rectangle from "./internal/rectangle.js";

export default class Canvas2DBackend {
    constructor(canvas) {
        this.canvas = canvas;
        this.particles = null;
        this.species = null;
        this.container = null;
        this.settings = null;
        this.ctx = canvas.getContext("2d");
        if (!this.ctx) throw new Error("Canvas 2D context is unavailable.");
    }

    initialize(particles, species, settings) {
        this.particles = particles;
        this.species = species;
        this.settings = settings;
        this.container = new QuadTree(
            new Rectangle(this.canvas.width / 2, this.canvas.height / 2, this.canvas.width, this.canvas.height)
        );
        for(const particle of particles) this.container.insert(particle)
    }

    step() {
        const canvas_width = this.canvas.width;
        const canvas_height = this.canvas.height;
        for (let i = 0; i < this.particles.length; i++) {
            let fx = 0.0;
            let fy = 0.0;

            const seeker = this.particles[i];
            const seeker_x = seeker.position[0];
            const seeker_y = seeker.position[1];
            const rect_radius = this.settings.MAX_DISTANCE;

            const seeker_attractions = this.species[seeker.key].attraction;

            const rect = new Rectangle(seeker_x, seeker_y, rect_radius, rect_radius)

            const targets = this._query_particles(rect)

            // horizontal borders.
            if (seeker_x < rect_radius) {
                rect.update(
                    canvas_width - (rect_radius - seeker_x), seeker_y, rect_radius - seeker_x, rect_radius
                )
                for (const p of this.container.query(rect)) 
                    targets.push(p);
            } else if (canvas_width - seeker_x < rect_radius) {
                rect.update(
                    0, seeker_y, rect_radius - (canvas_width - seeker_x), rect_radius
                )
                for (const p of this.container.query(rect)) 
                    targets.push(p);
            }

            // vertical borders.
            if (seeker_y < rect_radius) {
                rect.update(
                    seeker_x, canvas_height - (rect_radius - seeker_y), rect_radius, rect_radius - seeker_y
                )
                for (const p of this.container.query(rect)) 
                    targets.push(p);
            } else if (canvas_height - seeker_y < rect_radius) {
                rect.update(
                    seeker_x, 0, rect_radius, rect_radius - (canvas_height - seeker_y)
                )
                for (const p of this.container.query(rect)) 
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
                if (d <= 0 || d > this.settings.MAX_DISTANCE_SQ) continue;
                
                const d_sqrt = Math.sqrt(d);
                // true path fixed repulsion
                const F = (d_sqrt <= this.settings.MIN_DISTANCE ? 0.3 : -attraction) / d_sqrt;

                fx += F * dx;
                fy += F * dy;
            }

            seeker.velocity[0] = (seeker.velocity[0] + fx) * this.settings.FRICTION;
            seeker.velocity[1] = (seeker.velocity[1] + fy) * this.settings.FRICTION;
            seeker.position[0] = (seeker.position[0] + seeker.velocity[0] + canvas_width) % canvas_width;
            seeker.position[1] = (seeker.position[1] + seeker.velocity[1] + canvas_height) % canvas_height;
        }
        // cleanup container
        this.container.update_positions();

    }

    render() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const p of this.particles) {
            ctx.fillStyle = p.color?.[4] ?? "#ffffff";
            ctx.fillRect(
                p.position[0],
                p.position[1],
                this.settings.PARTICLE_SIZE,
                this.settings.PARTICLE_SIZE
            );
        }
    }

    destroy() {}
}