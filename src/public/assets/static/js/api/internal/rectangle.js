export default class Rectangle {
    constructor(x, y, w, h) {
        this.update(x, y, w, h)
    }

    update(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;

        this.minX = this.x - this.w;
        this.maxX = this.x + this.w;
        this.minY = this.y - this.h;
        this.maxY = this.y + this.h;
    }

    contains(x, y) {
        return x >= this.minX &&
            x <= this.maxX &&
            y >= this.minY &&
            y <= this.maxY;
    }


    intersects(range) {
        return this.maxX >= range.minX &&
            this.minX <= range.maxX &&
            this.maxY >= range.minY &&
            this.minY <= range.maxY;
    }
}