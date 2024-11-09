class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
  }
  
  class Rectangle {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }
  
    contains(x, y) {
        return (x >= this.x - this.w &&
            x <= this.x + this.w &&
            y >= this.y - this.h &&
            y <= this.y + this.h);
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
        this.capacity = 64;
        this.particles = [];
        this.divided = false;
        this.northeast = null;
        this.northwest = null;
        this.southeast = null;
        this.southwest = null;
    }
  
    insert(particle) {
        if (!this.boundary.contains(particle.position[0], particle.position[1])) {
            return false;
        }
  
        if (!this.divided && this.particles.length < this.capacity) {
            this.particles.push(particle);
            return true;
        } else {
            this.subdivide();
  
            return this.northeast.insert(particle) ||
                this.northwest.insert(particle) ||
                this.southeast.insert(particle) ||
                this.southwest.insert(particle);
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
  
        for (const p of this.particles) this.insert(p);
        this.particles = [];
    }
  
    query(range, found) {
        if (!this.boundary.intersects(range) || !range.intersects(this.boundary)) {
            return found;
        }
  
        for (const p of this.particles) {
            if (range.contains(p.position[0], p.position[1])) {
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