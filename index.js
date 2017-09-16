"use strict";

/**
 * @typedef {Object} BodyFacts
 * @property {string} name
 * @property {string} color
 * @property {number} massInKg
 * @property {number} orbitRadiusInMeters
 * @property {number} orbitRadiusMagnificationFactor
 * @property {number} radiusInMeters
 * @property {number} radiusMagnificationFactor
 * @property {BodyFacts[]} satellites
 */

class OrbitApp {

    /**
     * @param {BodyFacts} star
     */
    constructor (star) {
        /** @type {Vector} */
        this.auxiliaryVector = new Vector();
        /** @type {Vector} */
        this.orbitRadiusVector = new Vector();
        /** @type {Vector} */
        this.orbitCentripetalVector = new Vector();

        this.svg = document.getElementById("universe");
        this.metricsTable = document.getElementById("metrics");
        this.metricsCallbacks = [];
        this.addMetric("Elapsed", () => {
            // each second is equivalent to 1 month
            const elapsedInMonths = this.simulationElapsedTimeInSeconds;
            if (elapsedInMonths < 11) {
                return elapsedInMonths.toFixed(1) + " months";
            } else {
                const elapsedInYears = elapsedInMonths / 12;
                return elapsedInYears.toFixed(1) + " years";
            }
        });

        // ToDo bring back these metrics
        // this.addMetric("Earth orbit speed", () => this.earth.velocity.length().toFixed(1) + " m/s");
        // this.addMetric("Earth-Sun distance", () => this.orbitRadiusVector.set(
        //     this.earth.position).subtract(this.sun.position).scale(1e-6).length().toFixed(1) + " Mm");
        // this.addMetric("Moon orbit speed", () => this.moon.velocity.length().toFixed(1) + " m/s");
        // this.addMetric("Moon-Earth distance", () => this.orbitRadiusVector.set(
        //     this.moon.position).subtract(this.earth.position).scale(1e-6).length().toFixed(1) + " Mm");

        this.widthInMeters = OrbitApp.DISPLAY_WIDTH_IN_METERS;
        this.halfWidthInMeters = this.widthInMeters / 2;
        this.halfHeightInMeters = 1 * this.halfWidthInMeters;  // will be overwritten soon when we resize the screen

        /** @type {Body[]} */
        this.bodies = [];
        /** @type {BodyRepresentation[]} */
        this.bodyRepresentations = [];

        window.addEventListener("resize", () => this.resize());
        this.resize();

        this.sun = new Body(0, 0, star.radiusInMeters * star.radiusMagnificationFactor, star.massInKg);
        this.sunRepresentation = this.makeBodyRepresentation(star.color, this.sun);
        this.drawBody(this.sun, this.sunRepresentation);

        this.processSatellites(new Vector(0, 0), star.satellites, this.sun);

        this.updateCallback = this.update.bind(this);
        this.simulationElapsedTimeInSeconds = 0;
        this.previousTimestamp = performance.now();
        this.nextTimeShouldUpdateMetrics = this.previousTimestamp;
        window.requestAnimationFrame(this.update.bind(this, this.previousTimestamp));
    }

    /**
     * @param {Vector} orbitBasePoint
     * @param {BodyFacts[]} satellites
     * @param {Body} influences
     */
    processSatellites(orbitBasePoint, satellites, ...influences) {
        if (!Array.isArray(satellites)) {
            return;
        }

        for (const planetDefinition of satellites) {
            console.info(`Processing ${planetDefinition.name}...`);
            const startingPointX = orbitBasePoint.x +
                planetDefinition.orbitRadiusInMeters * planetDefinition.orbitRadiusMagnificationFactor;
            const startingPointY = orbitBasePoint.y;
            const planet = new Body(startingPointX, startingPointY,
                planetDefinition.radiusInMeters * planetDefinition.radiusMagnificationFactor,
                planetDefinition.massInKg);
            for (const influence of influences) {
                planet.addInfluence(influence);
            }
            this.startOrbiting(planet);
            this.bodies.push(planet);
            this.bodyRepresentations.push(this.makeBodyRepresentation(planetDefinition.color, planet));
            const newOrbitBasePoint = new Vector();
            this.processSatellites(newOrbitBasePoint.add(orbitBasePoint).add(planet.position),
                planetDefinition.satellites, ...influences, planet);
        }
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
     */
    startOrbiting(orbiter) {
        orbiter.velocity.clear();
        for (const influence of orbiter.getInfluences()) {
            const r = this.auxiliaryVector.set(orbiter.position).subtract(influence.position).length();
            // ToDo calculate perpendicular angle
            const vy = Math.sqrt(OrbitApp.GRAVITATIONAL_CONSTANT * influence.mass / r);
            this.auxiliaryVector.set(0, vy);
            orbiter.velocity.add(this.auxiliaryVector);
        }
    }

    /**
     * @param {string} color
     * @param {Body} body
     * @return {BodyRepresentation}
     */
    makeBodyRepresentation(color, body) {
        const pathElement = document.createElementNS(OrbitApp.SVG_NS, "path");
        this.svg.appendChild(pathElement);

        const bodyElement = document.createElementNS(OrbitApp.SVG_NS, "circle");
        bodyElement.style.fill = color;
        this.svg.appendChild(bodyElement);

        const bodyRepresentation = new BodyRepresentation(bodyElement, pathElement, OrbitApp.PATH_LENGTH_IN_STEPS);
        bodyRepresentation.addPointToPath(this.scaleX(body.position.x), this.scaleY(body.position.y));
        return bodyRepresentation;
    }

    update(timestamp) {
        // each real second is equivalent to 1 month of simulation - avoid big gaps which can destabilize the simulation
        const dt = Math.min(OrbitApp.MAXIMUM_DT_ALLOWED_IN_MILLIS, timestamp - this.previousTimestamp);
        const dtInSecs = dt / 1000;
        const scaledTimeDelta = dtInSecs * OrbitApp.TIME_FACTOR;

        // test bodies
        for (let i = 0; i < this.bodies.length; i++) {
            const body = this.bodies[i];
            const representation = this.bodyRepresentations[i];
            const distanceTraveledInMeters = this.updateOrbit(body, scaledTimeDelta);

            representation.accruePositionDeltaInMeters(distanceTraveledInMeters);
            if (this.lengthX(representation.getAccruedPositionDeltaInMeters()) > OrbitApp.SIGNIFICANT_PATH_DELTA_IN_PIXELS) {
                representation.addPointToPath(this.scaleX(body.position.x), this.scaleY(body.position.y));
                representation.resetPositionDeltaInMeters();
                representation.clearLatestPoint();
            } else {
                representation.setLatestPoint(this.scaleX(body.position.x), this.scaleY(body.position.y));
            }
            this.drawBody(body, representation);
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
     * @param {number} scaledTimeDelta - how much time has elapsed since last update
     * @return {number} distance traveled on this update
     */
    updateOrbit(body, scaledTimeDelta) {
        // take each influence into account
        for (const influence of body.getInfluences()) {
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

        return this.auxiliaryVector.length();
    }

    /**
     * @param {Body} body
     * @param {BodyRepresentation} bodyRepresentation
     */
    drawBody(body, bodyRepresentation) {
        bodyRepresentation.getBodyElement().setAttribute("cx", this.scaleX(body.position.x).toString());
        bodyRepresentation.getBodyElement().setAttribute("cy", this.scaleY(body.position.y).toString());
        bodyRepresentation.getBodyElement().setAttribute("r", this.lengthX(body.radius).toString());
        bodyRepresentation.getPathElement().setAttribute("d", bodyRepresentation.getPath());
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

        for (const representation of this.bodyRepresentations) {
            representation.resetPath();
        }

        // sun will be static
        if (this.sun) {
            this.drawBody(this.sun, this.sunRepresentation);
        }
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
     * Convert a length in meters to a length in pixels.
     *
     * @param {number} w - length in meters
     * @return {number} length in pixels
     */
    lengthX(w) {
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
OrbitApp.DISPLAY_WIDTH_IN_METERS = 1600e9;
OrbitApp.SIGNIFICANT_PATH_DELTA_IN_PIXELS = 4;
OrbitApp.PATH_LENGTH_IN_STEPS = 1024;  // must be power of two
OrbitApp.TIME_FACTOR = 30 * 24 * 60 * 60;  // 1 month in milliseconds
OrbitApp.MINIMUM_FPS = 20;
OrbitApp.MAXIMUM_DT_ALLOWED_IN_MILLIS = 1/OrbitApp.MINIMUM_FPS * 1000;
OrbitApp.METRICS_UPDATE_PERIOD_IN_MILLIS = 200;
OrbitApp.GRAVITATIONAL_CONSTANT = 6.67408e-11;

window.addEventListener("load", () => {
    const ajax = new XMLHttpRequest();
    ajax.addEventListener("readystatechange", function () {
        if (this.readyState === 4 && this.status === 200) {
            new OrbitApp(JSON.parse(this.responseText));
        }
    });
    ajax.open("GET", "system.json", true);
    ajax.send();
});
