"use strict";


class Vector {

    /**
     * @param {Vector|number} x
     * @param {number} [y]
     */
    constructor (x = 0, y = 0) {
        this.set(...arguments);
    }

    /**
     * @param {Vector|number} x
     * @param {number} [y]
     * @return {Vector}
     */
    set(x, y) {
        if (x instanceof Vector) {
            const v = x;
            this.x = v.x;
            this.y = v.y;
        } else {
            this.x = x;
            this.y = y;
        }
        return this;
    }

    /**
     * @return {Vector}
     */
    clear() {
        return this.set(0, 0);
    }

    /**
     * @param {Vector} v
     * @return {Vector}
     */
    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    /**
     * @param {Vector} v
     * @return {Vector}
     */
    subtract(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    /**
     * @param {number} s
     * @return {Vector}
     */
    scale(s) {
        this.x *= s;
        this.y *= s;
        return this;
    }

    /**
     * @return {Vector}
     */
    invert() {
        this.x *= -1;
        this.y *= -1;
        return this;
    }

    /**
     * @return {Vector}
     */
    normalize() {
        const len = this.length();
        this.x /= len;
        this.y /= len;
        return this;
    }

    /**
     * @return {number}
     */
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    toString() {
        return `[${this.x}, ${this.y}]`;
    }

    /**
     * @param {Vector} u
     * @param {Vector} v
     * @return {number}
     */
    static dotProduct(u, v) {
        return u.x * v.x + u.y * v.y;
    }

    /**
     * @param {Vector} u
     * @param {Vector} v
     * @return {number}
     */
    static angle(u, v) {
        const cosine = Vector.dotProduct(u, v) / (u.length() * v.length());
        return Math.acos(cosine);
    }
}
