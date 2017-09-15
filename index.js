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
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.mass = mass;
    }
}

class LagrangePoints {

    constructor () {
        this.svg = document.getElementById('universe');
        window.addEventListener('resize', () => this.resize());

        this.sun = new Body(0, 0, 695700 * LagrangePoints.SUN_RADIUS_MAGNIFICATION_FACTOR, 1.98e30);
        this.earth = new Body(149.6e6, 0, 6371 * LagrangePoints.EARTH_RADIUS_MAGNIFICATION_FACTOR, 5.972e24);
        this.sunElement = document.getElementById('sun');
        this.earthElement = document.getElementById('earth');

        this.bodies = [];
        this.bodyElements = [];

        this.widthInKm = 800e6;
        this.halfWidthInKm = this.widthInKm / 2;
        this.halfHeightInKm = 1 * this.halfWidthInKm;  // will be overwritten soon when we resize the screen

        this.resize();

        // sun will be static
        this.drawBody(this.sun, this.sunElement);

        this.drawCallback = this.draw.bind(this);
        this.previousTimestamp = performance.now();
        window.requestAnimationFrame(this.draw.bind(this, this.previousTimestamp));
    }

    draw(timestamp) {
        const dt = timestamp - this.previousTimestamp;

        // earth
        this.drawBody(this.earth, this.earthElement);

        // test bodies
        for (let i = 0; i < this.bodies.length; i++) {
            this.drawBody(this.bodies[i], this.bodyElements[i]);
        }

        this.previousTimestamp = timestamp;
        window.requestAnimationFrame(this.drawCallback);
    }

    drawBody(body, element) {
        element.setAttribute('cx', this.scaleX(body.x));
        element.setAttribute('cy', this.scaleY(body.y));
        element.setAttribute('r', this.widthX(body.radius));
    }

    resize() {
        this.screenWidth = window.innerWidth;
        this.screenHalfWidth = this.screenWidth / 2;
        this.screenHeight = window.innerHeight;
        this.screenHalfHeight = this.screenHeight / 2;
        const screenRatio = this.screenHeight / this.screenWidth;
        this.halfHeightInKm = screenRatio * this.halfWidthInKm;

        this.svg.setAttribute('width', window.innerWidth.toString());
        this.svg.setAttribute('height', window.innerHeight.toString());
    }

    scaleX(x) {
        return this.screenHalfWidth + (x / this.halfWidthInKm) * this.screenHalfWidth;
    }

    widthX(w) {
        return this.scaleX(w) - this.scaleX(0);
    }

    scaleY(y) {
        return this.screenHalfHeight + (y / this.halfHeightInKm) * this.screenHalfHeight;
    }
}

LagrangePoints.EARTH_RADIUS_MAGNIFICATION_FACTOR = 600;
LagrangePoints.SUN_RADIUS_MAGNIFICATION_FACTOR = 15;

new LagrangePoints();
