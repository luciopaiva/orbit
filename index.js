"use strict";


class OrbitApp {

    constructor () {
        /** @type {Vector} */
        this.auxiliaryVector = new Vector();
        /** @type {Vector} */
        this.orbitRadiusVector = new Vector();
        /** @type {Vector} */
        this.orbitCentripetalVector = new Vector();

        this.svg = document.getElementById("universe");
        this.metricsTable = document.getElementById("metrics");
        this.metricsCallbacks = [];
        this.addMetric("Elapsed", () => this.simulationElapsedTimeInSeconds.toFixed(1) + " months");
        this.addMetric("Earth speed", () => this.earth.velocity.length().toFixed(1) + " m/s");
        this.addMetric("Earth distance", () => this.orbitRadiusVector.set(
            this.earth.position).subtract(this.sun.position).scale(1e-6).length().toFixed(1) + " Mm");

        window.addEventListener("resize", () => this.resize());

        this.sun = new Body(0, 0, OrbitApp.SUN_RADIUS_IN_METERS * OrbitApp.SUN_RADIUS_MAGNIFICATION_FACTOR,
            OrbitApp.SUN_MASS_IN_KG);
        this.sunElement = this.makeBodyElement("star");

        this.earth = new Body(OrbitApp.EARTH_AVERAGE_SUN_DISTANCE_IN_METERS, 0,
            OrbitApp.EARTH_RADIUS_IN_METERS * OrbitApp.EARTH_RADIUS_MAGNIFICATION_FACTOR, OrbitApp.EARTH_MASS_IN_KG);
        this.startOrbiting(this.earth, [this.sun]);
        this.earthElement = this.makeBodyElement("planet");

        this.moon = new Body(OrbitApp.EARTH_AVERAGE_SUN_DISTANCE_IN_METERS + 20 * OrbitApp.MOON_AVERAGE_EARTH_DISTANCE_IN_METERS, 0,
            OrbitApp.MOON_RADIUS_IN_METERS * OrbitApp.MOON_RADIUS_MAGNIFICATION_FACTOR, OrbitApp.MOON_MASS_IN_KG);
        this.startOrbiting(this.moon, [this.sun, this.earth]);
        this.moonElement = this.makeBodyElement("moon");

        this.bodies = [];
        this.bodyElements = [];

        this.widthInMeters = OrbitApp.DISPLAY_WIDTH_IN_METERS;
        this.halfWidthInMeters = this.widthInMeters / 2;
        this.halfHeightInMeters = 1 * this.halfWidthInMeters;  // will be overwritten soon when we resize the screen

        this.resize();

        this.updateCallback = this.update.bind(this);
        this.simulationElapsedTimeInSeconds = 0;
        this.previousTimestamp = performance.now();
        this.nextTimeShouldUpdateMetrics = this.previousTimestamp;
        window.requestAnimationFrame(this.update.bind(this, this.previousTimestamp));
    }

    addMetric(title, callback) {
        const row = document.createElement("tr");
        const titleColumn = document.createElement("td");
        titleColumn.innerText = title + ":";
        const valueColumn = document.createElement("td");
        row.appendChild(titleColumn);
        row.appendChild(valueColumn);
        this.metricsTable.appendChild(row);
        this.metricsCallbacks.push(() => valueColumn.innerText = callback());
    }

    /**
     * Calculates the velocity vector necessary for the orbiter to keep a steady, circular orbit around the orbitee.
     * @param {Body} orbiter - the body that will rotate around orbitee
     * @param {Body[]} influences - the bodies that will be orbited by orbiter
     */
    startOrbiting(orbiter, influences) {
        orbiter.velocity.clear();
        for (const influence of influences) {
            const r = this.auxiliaryVector.set(orbiter.position).subtract(influence.position).length();
            // ToDo calculate perpendicular angle
            const vy = Math.sqrt(OrbitApp.GRAVITATIONAL_CONSTANT * influence.mass / r);
            this.auxiliaryVector.set(0, vy);
            orbiter.velocity.add(this.auxiliaryVector);
        }
    }

    makeBodyElement(className) {
        const element = document.createElementNS(OrbitApp.SVG_NS, "circle");
        element.classList.add(className);
        this.svg.appendChild(element);
        return element;
    }

    update(timestamp) {
        // each real second is equivalent to 1 month of simulation - avoid big gaps which can destabilize the simulation
        const dt = Math.min(OrbitApp.MAXIMUM_DT_ALLOWED_IN_MILLIS, timestamp - this.previousTimestamp);
        const dtInSecs = dt / 1000;
        const scaledTimeDelta = dtInSecs * OrbitApp.TIME_FACTOR;

        // earth
        this.updateOrbit(this.earth, [this.sun], scaledTimeDelta);
        this.drawBody(this.earth, this.earthElement);

        // moon
        this.updateOrbit(this.moon, [this.sun, this.earth], scaledTimeDelta);
        this.drawBody(this.moon, this.moonElement);

        // test bodies
        for (let i = 0; i < this.bodies.length; i++) {
            const body = this.bodies[i];
            this.updateOrbit(body, [this.sun, this.earth], scaledTimeDelta);
            this.drawBody(body, this.bodyElements[i]);
        }

        // metrics
        if (timestamp > this.nextTimeShouldUpdateMetrics) {
            this.metricsCallbacks.forEach(callback => callback());
            this.nextTimeShouldUpdateMetrics = timestamp + OrbitApp.METRICS_UPDATE_PERIOD_IN_MILLIS;
        }

        this.simulationElapsedTimeInSeconds += dtInSecs;
        this.previousTimestamp = timestamp;
        window.requestAnimationFrame(this.updateCallback);
    }

    /**
     * Calculate influence forces acting upon body and update its position.
     *
     * @param {Body} body - the body to be updated
     * @param {Body[]} influences - bodies that exert influence over body
     * @param {number} scaledTimeDelta - how much time has elapsed since last update
     */
    updateOrbit(body, influences, scaledTimeDelta) {
        // take each influence into account
        for (const influence of influences) {
            const orbitRadius = Math.max(influence.radius,  // draw minimum radius allowed to prevent overshooting
                this.orbitRadiusVector.set(body.position).subtract(influence.position).length());
            const gravityPullAcceleration = OrbitApp.GRAVITATIONAL_CONSTANT * influence.mass /
                (orbitRadius * orbitRadius);
            this.orbitCentripetalVector.set(this.orbitRadiusVector).invert().normalize()
                .scale(gravityPullAcceleration * scaledTimeDelta);
            // update body's velocity vector
            body.velocity.add(this.orbitCentripetalVector);
        }

        // update position based on calculated velocity over time
        this.auxiliaryVector.set(body.velocity).scale(scaledTimeDelta);
        body.position.add(this.auxiliaryVector);
    }

    /**
     * @param {Body} body
     * @param {Element} element
     */
    drawBody(body, element) {
        element.setAttribute("cx", this.scaleX(body.position.x));
        element.setAttribute("cy", this.scaleY(body.position.y));
        element.setAttribute("r", this.widthX(body.radius));
    }

    /**
     * Respond to screen size changes and reposition static bodies accordingly.
     */
    resize() {
        this.screenWidth = window.innerWidth;
        this.screenHalfWidth = this.screenWidth / 2;
        this.screenHeight = window.innerHeight;
        this.screenHalfHeight = this.screenHeight / 2;
        const screenRatio = this.screenHeight / this.screenWidth;
        this.halfHeightInMeters = screenRatio * this.halfWidthInMeters;

        this.svg.setAttribute("width", window.innerWidth.toString());
        this.svg.setAttribute("height", window.innerHeight.toString());

        // sun will be static
        this.drawBody(this.sun, this.sunElement);
    }

    /**
     * Convert horizontal position in meters to pixels.
     *
     * @param {number} x - horizontal position in meters
     * @return {number} horizontal position in pixels
     */
    scaleX(x) {
        return this.screenHalfWidth + (x / this.halfWidthInMeters) * this.screenHalfWidth;
    }

    /**
     * Convert a width in meters to a width in pixels.
     *
     * @param {number} w - width in meters
     * @return {number} width in pixels
     */
    widthX(w) {
        return this.scaleX(w) - this.scaleX(0);
    }

    /**
     * Convert vertical position in meters to pixels.
     *
     * @param {number} y - vertical position in meters
     * @return {number} vertica position in pixels
     */
    scaleY(y) {
        return this.screenHalfHeight + (y / this.halfHeightInMeters) * this.screenHalfHeight;
    }
}

OrbitApp.SVG_NS = "http://www.w3.org/2000/svg";
OrbitApp.DISPLAY_WIDTH_IN_METERS = 800e9;
OrbitApp.TIME_FACTOR = 30 * 24 * 60 * 60;  // 1 month in milliseconds
OrbitApp.MAXIMUM_DT_ALLOWED_IN_MILLIS = 1000;
OrbitApp.METRICS_UPDATE_PERIOD_IN_MILLIS = 200;

OrbitApp.MOON_RADIUS_MAGNIFICATION_FACTOR = 600;
OrbitApp.MOON_AVERAGE_EARTH_DISTANCE_IN_METERS = 0.3844e9;
OrbitApp.MOON_MASS_IN_KG = 0.07346e24;
OrbitApp.MOON_RADIUS_IN_METERS = 1738.1e3;

OrbitApp.EARTH_RADIUS_MAGNIFICATION_FACTOR = 600;
OrbitApp.EARTH_AVERAGE_SUN_DISTANCE_IN_METERS = 149.6e9;
OrbitApp.EARTH_MASS_IN_KG = 5.972e24;
OrbitApp.EARTH_RADIUS_IN_METERS = 6371e3;

OrbitApp.SUN_RADIUS_MAGNIFICATION_FACTOR = 15;
OrbitApp.SUN_MASS_IN_KG = 1988500e24;
OrbitApp.SUN_RADIUS_IN_METERS = 695700e3;

OrbitApp.GRAVITATIONAL_CONSTANT = 6.67408e-11;

new OrbitApp();
