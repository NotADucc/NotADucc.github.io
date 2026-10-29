import Rectangle from './rectangle.js';

export default class QuadTree {
    constructor(boundary) {
        this.boundary = boundary;
        this.capacity = 64;
        this.particles = [];
        this.divided = false;
        this.northeast = null;
        this.northwest = null;
        this.southeast = null;
        this.southwest = null;
    }

    update_positions() {
        this._update_tree(this);
        this._remove_nodes();
    }

    insert(particle) {
        if (!this.boundary.contains(particle.position[0], particle.position[1])) {
            return false;
        }

        if (!this.divided && this.particles.length < this.capacity) {
            this.particles.push(particle);
            return true;
        } else {
            this._subdivide();

            return this.northeast.insert(particle) ||
                this.northwest.insert(particle) ||
                this.southeast.insert(particle) ||
                this.southwest.insert(particle);
        }
    }

    query(range) {
        return this._fetch_particles(range, []);
    }

    _update_tree(main_tree) {
        if (!this.divided) {
            let new_len = this.particles.length;
            for (let i = 0; i < new_len;) {
                if (!this.boundary.contains(this.particles[i].position[0], this.particles[i].position[1])) {
                    main_tree.insert(this.particles[i]);
                    this.particles[i] = this.particles[new_len - 1];
                    new_len--;
                } else {
                    i++;
                }
            }

            this.particles.length = new_len;
        } else {
            this.northeast._update_tree(main_tree);
            this.northwest._update_tree(main_tree);
            this.southeast._update_tree(main_tree);
            this.southwest._update_tree(main_tree);
        }
    }

    _remove_nodes() {
        if (this.divided) {
            if (!(this.northeast.divided || this.northwest.divided || this.southeast.divided || this.southwest.divided)) {
                const len = this.northeast.particles.length +
                    this.northwest.particles.length +
                    this.southeast.particles.length +
                    this.southwest.particles.length;
                if (len <= this.capacity) {
                    this.particles.push(
                        ...this.northeast.particles,
                        ...this.northwest.particles,
                        ...this.southeast.particles,
                        ...this.southwest.particles
                    );
                    this.divided = false;
                    this.northeast = null;
                    this.northwest = null;
                    this.southeast = null;
                    this.southwest = null;
                }
            }
        } else {
            this.northeast._remove_nodes();
            this.northwest._remove_nodes();
            this.southeast._remove_nodes();
            this.southwest._remove_nodes();
        }
    }

    _subdivide() {
        if (this.divided) return;

        let x = this.boundary.x;
        let y = this.boundary.y;
        let w = this.boundary.w / 2;
        let h = this.boundary.h / 2;

        let ne = new Rectangle(x + w, y - h, w, h);
        this.northeast = new QuadTree(ne);
        let nw = new Rectangle(x - w, y - h, w, h);
        this.northwest = new QuadTree(nw);
        let se = new Rectangle(x + w, y + h, w, h);
        this.southeast = new QuadTree(se);
        let sw = new Rectangle(x - w, y + h, w, h);
        this.southwest = new QuadTree(sw);


        this.divided = true;

        for (let p of this.particles) this.insert(p);
        this.particles = [];
    }

    _fetch_particles(range, found) {
        if (!this.boundary.intersects(range)) {
            return found;
        }

        for (let p of this.particles) {
            if (range.contains(p.position[0], p.position[1])) {
                found.push(p);
            }
        }

        if (this.divided) {
            this.northwest._fetch_particles(range, found);
            this.northeast._fetch_particles(range, found);
            this.southwest._fetch_particles(range, found);
            this.southeast._fetch_particles(range, found);
        }

        return found;
    }
}