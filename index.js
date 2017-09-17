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

        this.scaleXCallback = this.scaleX.bind(this);
        this.scaleYCallback = this.scaleY.bind(this);

        this.instructions = document.getElementById("instructions");
        this.svg = document.getElementById("universe");
        this.metricsTable = document.getElementById("metrics");
        this.metricsCallbacks = [];
        this.addMetric("Elapsed", () => {
            // each second is equivalent to 1 month
            const elapsedInMonths = this.simulationElapsedTimeInSeconds / OrbitApp.ONE_SIMULATION_MONTH;
            if (elapsedInMonths < 11) {
                return elapsedInMonths.toFixed(1) + " months";
            } else {
                const elapsedInYears = elapsedInMonths / 12;
                return elapsedInYears.toFixed(1) + " years";
            }
        });
        this.addMetric("Time scale", () => OrbitApp.TIME_SCALE_DESC[this.timeScaleIndex] + " per second");

        this.arePathsVisible = true;

        // ToDo bring back these metrics
        // this.addMetric("Earth orbit speed", () => this.earth.velocity.length().toFixed(1) + " m/s");
        // this.addMetric("Earth-Sun distance", () => this.orbitRadiusVector.set(
        //     this.earth.position).subtract(this.sun.position).scale(1e-6).length().toFixed(1) + " Mm");
        // this.addMetric("Moon orbit speed", () => this.moon.velocity.length().toFixed(1) + " m/s");
        // this.addMetric("Moon-Earth distance", () => this.orbitRadiusVector.set(
        //     this.moon.position).subtract(this.earth.position).scale(1e-6).length().toFixed(1) + " Mm");

        this.adjustSpaceWidth();
        document.addEventListener("wheel", this.onMouseWheel.bind(this));

        this.timeScaleIndex = 1;
        document.addEventListener("keyup", this.onKeyUp.bind(this));

        /** @type {Body[]} */
        this.bodies = [];
        /** @type {BodyRepresentation[]} */
        this.bodyRepresentations = [];

        window.addEventListener("resize", () => this.resize());
        this.resize();

        // the sun
        this.sun = new Body(0, 0, star.radiusInMeters * star.radiusMagnificationFactor, star.massInKg);
        this.sunRepresentation = this.makeBodyRepresentation(star.color, this.sun);
        this.drawBody(this.sun, this.sunRepresentation);

        // all planets
        this.processSatellites(new Vector(0, 0), star.satellites, this.sun);

        // the phantom body
        this.phantom = new Body(0, 0, star.radiusInMeters * star.radiusMagnificationFactor, star.massInKg / 10);
        this.phantomRepresentation = this.makeBodyRepresentation('fuchsia', this.phantom);
        this.phantomRepresentation.setVisibility(false);
        this.latestMousePosition = new Vector();
        document.addEventListener("mousemove", this.onMouseMove.bind(this));

        this.updateCallback = this.updateSimulation.bind(this);
        this.simulationElapsedTimeInSeconds = 0;
        this.previousTimestamp = performance.now();
        this.nextTimeShouldUpdateMetrics = this.previousTimestamp;
        window.requestAnimationFrame(this.updateSimulation.bind(this, this.previousTimestamp));
    }

    onMouseMove(e) {
        this.latestMousePosition.set(e.clientX, e.clientY);
        if (this.phantomRepresentation.isVisible) {
            this.updatePhantomBody();
        }
    }

    onMouseWheel(e) {
        if (e.deltaY === 0) {
            return;
        }
        const zoomDirection = e.deltaY / Math.abs(e.deltaY);
        const zoomFactor = zoomDirection * OrbitApp.ZOOM_CONSTANT_IN_METERS;
        this.adjustSpaceWidth(zoomFactor);
        this.resize();
    }

    onKeyUp(e) {
        const key = e.key;

        switch (key) {
            case ",":
                // slow down
                this.timeScaleIndex = this.timeScaleIndex > 0 ? this.timeScaleIndex - 1 : this.timeScaleIndex;
                break;
            case ".":
                // speed up
                this.timeScaleIndex = this.timeScaleIndex === OrbitApp.TIME_SCALE.length - 1 ?
                    this.timeScaleIndex : this.timeScaleIndex + 1;
                break;
            case "x":
                // toggles the phantom body
                this.phantomRepresentation.setVisibility(!this.phantomRepresentation.isVisible);
                this.updatePhantomBody();
                break;
            case "p":
                this.arePathsVisible = !this.arePathsVisible;
                for (const representation of this.bodyRepresentations) {
                    representation.setPathVisibility(this.arePathsVisible);
                }
                break;
            case "r":
                for (const representation of this.bodyRepresentations) {
                    representation.resetPath();
                }
                break;
            case "h":
                if (this.instructions.classList.contains("hidden")) {
                    this.instructions.classList.remove("hidden");
                } else {
                    this.instructions.classList.add("hidden");
                }
                break;
        }
    }

    updatePhantomBody() {
        if (this.phantomRepresentation.isVisible) {
            this.phantom.position.x = this.invertedScaleX(this.latestMousePosition.x);
            this.phantom.position.y = this.invertedScaleY(this.latestMousePosition.y);
            this.drawBody(this.phantom, this.phantomRepresentation);
        }
    }

    adjustSpaceWidth(delta = 0) {
        if (!this.widthInMeters) {
            this.widthInMeters = OrbitApp.DISPLAY_WIDTH_IN_METERS;
        } else {
            this.widthInMeters += delta;
            if (this.widthInMeters < OrbitApp.ZOOM_CONSTANT_IN_METERS) {
                this.widthInMeters = OrbitApp.ZOOM_CONSTANT_IN_METERS;
            }
        }
        this.halfWidthInMeters = this.widthInMeters / 2;
        this.halfHeightInMeters = 1 * this.halfWidthInMeters;  // will be overwritten soon when we resize the screen
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
        bodyRepresentation.addPointToPath(body.position.x, body.position.y);
        return bodyRepresentation;
    }

    updateSimulation(timestamp) {
        // each real second is equivalent to 1 month of simulation - avoid big gaps which can destabilize the simulation
        const dt = Math.min(OrbitApp.MAXIMUM_DT_ALLOWED_IN_MILLIS, timestamp - this.previousTimestamp);
        const dtInSecs = dt / 1000;
        const totalScaledTimeDelta = dtInSecs * OrbitApp.TIME_SCALE[this.timeScaleIndex];
        let remainingScaledTimeDelta = totalScaledTimeDelta;

        // break elapsed time into manageable steps, otherwise simulation can become unstable
        for (; remainingScaledTimeDelta > 0; remainingScaledTimeDelta -= OrbitApp.ONE_SIMULATION_DAY) {
            const scaledTimeDelta = remainingScaledTimeDelta > OrbitApp.ONE_SIMULATION_DAY ?
                OrbitApp.ONE_SIMULATION_DAY : remainingScaledTimeDelta;

            for (let i = 0; i < this.bodies.length; i++) {
                const body = this.bodies[i];
                const representation = this.bodyRepresentations[i];
                const distanceTraveledInMeters = this.updateOrbit(body, scaledTimeDelta);

                representation.accruePositionDeltaInMeters(distanceTraveledInMeters);
                if (this.lengthX(representation.getAccruedPositionDeltaInMeters()) > OrbitApp.SIGNIFICANT_PATH_DELTA_IN_PIXELS) {
                    representation.addPointToPath(body.position.x, body.position.y);
                    representation.resetPositionDeltaInMeters();
                    representation.clearLatestPoint();
                } else {
                    representation.setLatestPoint(body.position.x, body.position.y);
                }
            }
        }

        for (let i = 0; i < this.bodies.length; i++) {
            this.drawBody(this.bodies[i], this.bodyRepresentations[i]);
        }

        // metrics
        if (timestamp > this.nextTimeShouldUpdateMetrics) {
            this.metricsCallbacks.forEach(callback => callback());
            this.nextTimeShouldUpdateMetrics = timestamp + OrbitApp.METRICS_UPDATE_PERIOD_IN_MILLIS;
        }

        this.simulationElapsedTimeInSeconds += totalScaledTimeDelta;
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
            this.updateVelocityBasedOnGravityPull(body, influence, scaledTimeDelta);
        }

        if (this.phantomRepresentation.isVisible) {
            this.updateVelocityBasedOnGravityPull(body, this.phantom, scaledTimeDelta);
        }

        // update position based on calculated velocity over time
        this.auxiliaryVector.set(body.velocity).scale(scaledTimeDelta);
        body.position.add(this.auxiliaryVector);

        return this.auxiliaryVector.length();
    }

    updateVelocityBasedOnGravityPull(body, influence, scaledTimeDelta) {
        const orbitRadius = Math.max(influence.radius,  // draw minimum radius allowed to prevent overshooting
            this.orbitRadiusVector.set(body.position).subtract(influence.position).length());
        const gravityPullAcceleration = OrbitApp.GRAVITATIONAL_CONSTANT * influence.mass /
            (orbitRadius * orbitRadius);
        this.orbitCentripetalVector.set(this.orbitRadiusVector).invert().normalize()
            .scale(gravityPullAcceleration * scaledTimeDelta);
        // update body's velocity vector
        body.velocity.add(this.orbitCentripetalVector);
    }

    /**
     * @param {Body} body
     * @param {BodyRepresentation} bodyRepresentation
     */
    drawBody(body, bodyRepresentation) {
        bodyRepresentation.getBodyElement().setAttribute("cx", this.scaleX(body.position.x).toString());
        bodyRepresentation.getBodyElement().setAttribute("cy", this.scaleY(body.position.y).toString());
        bodyRepresentation.getBodyElement().setAttribute("r", this.lengthX(body.radius).toString());
        if (this.arePathsVisible) {
            bodyRepresentation.getPathElement().setAttribute("d", bodyRepresentation.getPath(this.scaleXCallback, this.scaleYCallback));
        }
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
     * Convert horizontal screen coordinates to position in meters.
     * @param {number} x
     * @return {number}
     */
    invertedScaleX(x) {
        return (this.halfWidthInMeters / this.screenHalfWidth) * (x - this.screenHalfWidth);
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

    /**
     * Convert vertical screen coordinates to position in meters.
     * @param {number} y
     * @return {number}
     */
    invertedScaleY(y) {
        return (this.halfHeightInMeters / this.screenHalfHeight) * (y - this.screenHalfHeight);
    }
}

OrbitApp.SVG_NS = "http://www.w3.org/2000/svg";
OrbitApp.DISPLAY_WIDTH_IN_METERS = 1600e9;
OrbitApp.ZOOM_CONSTANT_IN_METERS = 400e9;
OrbitApp.SIGNIFICANT_PATH_DELTA_IN_PIXELS = 4;
OrbitApp.PATH_LENGTH_IN_STEPS = 1024;  // must be power of two
OrbitApp.ONE_SIMULATION_DAY = 24 * 60 * 60;
OrbitApp.ONE_SIMULATION_MONTH = 30 * OrbitApp.ONE_SIMULATION_DAY;
OrbitApp.ONE_SIMULATION_YEAR = 12 * OrbitApp.ONE_SIMULATION_MONTH;
OrbitApp.TIME_SCALE = [OrbitApp.ONE_SIMULATION_DAY, OrbitApp.ONE_SIMULATION_MONTH, 6 * OrbitApp.ONE_SIMULATION_MONTH,
    OrbitApp.ONE_SIMULATION_YEAR, 10 * OrbitApp.ONE_SIMULATION_YEAR];
OrbitApp.TIME_SCALE_DESC = ["One day", "One month", "Six months", "One year", "Ten years"];
OrbitApp.TIME_FACTOR = 30 * OrbitApp.ONE_SIMULATION_DAY;  // 1 month in milliseconds
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
    ajax.open("GET", "solar-system.json", true);
    ajax.send();
});
