class Chunk {
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.particles = [];
    }
    push(particle) {
        this.particles.push(particle);
    }
    remove(particle) {
        const idx = this.particles.indexOf(particle);
        this.particles.splice(idx, 1);
    }
  }
  
  class Grid {
    constructor(width, height) {
        this.size = 16;
        this.chunks = [];

        const h = height / this.size;
        const w = width / this.size;
        for (let i = 0; i <= h; i++) {
            const temp = [];
            this.chunks.push(temp);
            for (let j = 0; j <= w; j++) {
                temp.push(new Chunk(this.size * j, this.size * i, this.size));
            }
        }
    }

    add(particle) {
        const x = parseInt(parseInt(particle.position[0]) / this.size);
        const y = parseInt(parseInt(particle.position[1]) / this.size);
        this.chunks[y][x].push(particle);
    }
    remove(particle) {
        const x = parseInt(parseInt(particle.position[0]) / this.size);
        const y = parseInt(parseInt(particle.position[1]) / this.size);
        this.chunks[y][x].remove(particle);
    }
    query(point, radius) {
        const found = [];
        const x = parseInt(parseInt(point.x) / this.size);
        const y = parseInt(parseInt(point.y) / this.size);
        const r = parseInt(radius / this.size) + 1;

        const min_y = Math.max(0, y - r);
        const max_y = Math.min(this.chunks.length, x + r);

        const min_x = Math.max(0, x - r);
        const max_x = Math.min(this.chunks[y].length, x + r);

        for (let yy = min_y; yy < max_y; yy++) {
            for (let xx = min_x; xx < max_x; xx++) {
                found.push(...this.chunks[yy][xx].particles);
            }
        }
  
        return found;
    }
  }

