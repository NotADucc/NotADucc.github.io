class Point { constructor(x, y) { this.x = x; this.y = y; } }

class Rectangle {
    constructor(x, y, w, h) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
    }
  
    contains(point) {
      return (point.x >= this.x - this.w &&
        point.x <= this.x + this.w &&
        point.y >= this.y - this.h &&
        point.y <= this.y + this.h);
    }
  
  
    intersects(range) {
      return !(range.x - range.w > this.x + this.w ||
        range.x + range.w < this.x - this.w ||
        range.y - range.h > this.y + this.h ||
        range.y + range.h < this.y - this.h);
    }
  }

class QuadTree {
    constructor(boundary) {
        this.boundary = boundary;
        this.capacity = 10;
        this.particles = [];
        this.divided = false;
    }

    insert(particle) {
        if (!this.boundary.contains(particle.points)) {
            return false;
        }

        if (!this.divided && this.particles.length < this.capacity) {
            this.particles.push(particle);
            return true;
        } 
        else {
            this.subdivide();

            return this.northeast.insert(particle) 
                || this.northwest.insert(particle)
                || this.southeast.insert(particle)
                || this.southwest.insert(particle);
        }
    }

    subdivide() {
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

    query(range, found) {
        if (!this.boundary.intersects(range)) {
            return found;
        }

        
        if (!range.intersects(this.boundary)) {
            return found;
          }
      
          for (let p of this.particles) {
            if (range.contains(p.points)) {
              found.push(p);
            }
          }

          if (this.divided) {
            this.northwest.query(range, found);
            this.northeast.query(range, found);
            this.southwest.query(range, found);
            this.southeast.query(range, found);
          }
      
          return found;
    }
}

const canvas = document.getElementById("noise");
const ctx = canvas.getContext("2d");
const button = document.getElementById("expand_button");
const FRICTION = 0.6; const PARTICLE_SIZE = 5; const MIN_DISTANCE = 5; const MAX_DISTANCE = 30;
let quadtree = new QuadTree(new Rectangle(canvas.width / 2, canvas.height / 2, canvas.width, canvas.height));
const particles = [];

const attraction_dct = 
{
    "b": { 
        "b": 0.32, 
        "m": 0.4, 
        "p": 0.4 
    },
    "m": { 
        "b": -0.4, 
        "m": 0.1, 
        "p": 0 
    },
    "p": { 
        "b": -0.4, 
        "m": -0.2, 
        "p": -0.15 
    },
};

const random = (size) => Math.random() * size;

const particle = (k, p, c, b) => {
    return { "key": k, "points": p, "velocity": new Point(0, 0), "color": c, "bounds": b };
}

const create = (k, amount, color, b) => {
    for (let i = 0; i < amount; i++) {
        particles.push(particle(k, new Point(random(canvas.width), random(canvas.height)), color, b));
    }
}

const redraw_tree = () => {
    quadtree = new QuadTree(new Rectangle(canvas.width / 2, canvas.height / 2, canvas.width, canvas.height));
    for (let i = 0; i  < particles.length; i++) {
        quadtree.insert(particles[i]);
    }
}

const create_particles = () => {
    create("b", 70, "#3875ea", true);
    create("m", 15, "magenta", true);
    create("p", 150, "#a62161", false);
    redraw_tree();
}

addEventListener("resize", (_) => {
    canvas.width = window.innerWidth;
    canvas.height = document.getElementsByClassName("fakeHeader")[0].offsetHeight;

    particles.length = 0;
    create_particles();
});
window.dispatchEvent(new CustomEvent("resize"));

button.addEventListener("click", (_) => {
    const main = document.getElementsByTagName("main")[0];
    const height = canvas.height == 300 ? 73 : 300;
    document.getElementsByTagName("header")[0].style.height = `${height}px`;
    document.getElementsByClassName("fakeHeader")[0].style.height = `${height}px`;
    document.getElementById("expand_button_text").classList.toggle("triangle_rotate");
    main.style.marginTop = `${height}px`;
    canvas.height = height;

    particles.length = 0;
    create_particles();
});

const calc_next_positions = () => {
    for (let i = 0; i < particles.length; i++) {
        let fx = 0.0;
        let fy = 0.0;
        
        const seeker = particles[i];
        const rect = new Rectangle(seeker.points.x, seeker.points.y, MAX_DISTANCE, MAX_DISTANCE);
        const targets = quadtree.query(rect, []);
        
        for (let j = 0; j < targets.length; j++) {
            const target = targets[j];
            const attraction = attraction_dct[seeker.key][target.key];
            if (attraction == 0) continue;
            if (seeker.bounds || target.bounds) {
                dx = seeker.points.x - target.points.x;
                dy = seeker.points.y - target.points.y;
            }
            else {
                dx = Math.abs(seeker.points.x - target.points.x);
                dy = Math.abs(seeker.points.y - target.points.y);
                if (dx > canvas.width >> 1) dx = canvas.width - dx;
                if (dy > canvas.height >> 1) dy = canvas.height - dy;
            }
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d == 0 || d > MAX_DISTANCE) continue;
            const F = (d <= MIN_DISTANCE ? 0.3 : -attraction) / d;
            fx += F * dx;
            fy += F * dy;
        }
        
        seeker.velocity.x = (seeker.velocity.x + fx) * FRICTION;
        seeker.velocity.y = (seeker.velocity.y + fy) * FRICTION;
        seeker.points.x = (seeker.points.x + seeker.velocity.x + canvas.width) % canvas.width;
        seeker.points.y = (seeker.points.y + seeker.velocity.y + canvas.height) % canvas.height;
    }
}

const draw = (x, y, c, w, h) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
}

const update = () => {
    calc_next_positions();
    redraw_tree();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        draw(particles[i].points.x, particles[i].points.y, particles[i].color, PARTICLE_SIZE, PARTICLE_SIZE);
    }
    requestAnimationFrame(update);
}

update();