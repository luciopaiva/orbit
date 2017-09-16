"use strict";

class Body {

    /**
     * Creates a new celestial body,
     *
     * @param {number} x - horizontal distance from center, in km
     * @param {number} y - vertical distance from center, in km
     * @param {number} radius - in km
     * @param {number} mass - in kg
     */
    constructor (x, y, radius, mass) {
        this.radius = radius;
        this.mass = mass;
        this.position = new Vector(x, y);
        this.velocity = new Vector(0, 0);
        this.influences = [];
    }

    /**
     * @param {Body} otherBody
     */
    addInfluence(otherBody) {
        this.influences.push(otherBody);
    }

    /**
     * @return Body[]
     */
    getInfluences() {
        return this.influences;
    }
}
