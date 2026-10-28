class Chunk {
    constructor(x, y) {
        this.x = x
        this.y = y
        this.particles = [];
    }

    push(particle) {
        this.particles.push(particle);
    }

    remove(particle) {
        const idx = this.particles.indexOf(particle);
        if (idx !== -1) {
            this.particles[idx] = this.particles[this.particles.length - 1];
            this.particles.pop();
        }
    }
}

export class Grid {
    constructor(width, height) {
        this.tile_size = 100;
        this.chunks = [];

        const h = height / this.tile_size;
        const w = width / this.tile_size;
        for (let i = 0; i <= h; i++) {
            const temp_tile = [];
            this.chunks.push(temp_tile);
            for (let j = 0; j <= w; j++) {
                temp_tile.push(new Chunk(this.tile_size * j, this.tile_size * i));
            }
        }

        console.log(this.chunks)
    }

    update_positions() {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const chunk = this.chunks[y][x];

                for (let i = 0; i < chunk.particles.length;) {
                    const particle = chunk.particles[i];

                    const new_x = particle.position[0] / this.tile_size;
                    const new_y = particle.position[1] / this.tile_size

                    const cx = Math.max(0, Math.min(this.cols - 1, new_x));
                    const cy = Math.max(0, Math.min(this.rows - 1, new_y));

                    if (cx !== x || cy !== y) {
                        chunk.remove(particle);

                        this.chunks[cy][cx].push(particle);
                        particle.chunk_x = cx;
                        particle.chunk_y = cy;
                    } else {
                        i++;
                    }
                }
            }
        }
    }

    insert(particle) {
        const x = parseInt(parseInt(particle.position[0]) / this.tile_size);
        const y = parseInt(parseInt(particle.position[1]) / this.tile_size);
        this.chunks[y][x].push(particle);
    }

    query(range) {
        const found = [];
        const x = parseInt(parseInt(range.x) / this.tile_size);
        const y = parseInt(parseInt(range.y) / this.tile_size);

        const x_r = parseInt((x + range.w) / this.tile_size) + 1;
        const y_r = parseInt((y + range.h) / this.tile_size) + 1;

        const min_y = Math.max(0, y - y_r);
        const max_y = Math.min(this.chunks.length, x + y_r);
        
        const min_x = Math.max(0, x - x_r);
        const max_x = Math.min(this.chunks[y].length, x + x_r);

        for (let yy = min_y; yy < max_y; yy++) {
            for (let xx = min_x; xx < max_x; xx++) {
                found.push(...this.chunks[yy][xx].particles);
            }
        }
  
        return found;
    }
}