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
        this.addMetric("Elapsed", () => {
            const elapsedMillis = this.previousTimestamp - this.timeSimulationStarted;
            const simulationMonths = elapsedMillis / 1000;
            return simulationMonths.toFixed(1) + " months"
        });
        this.addMetric("Earth speed", () => this.earth.velocity.length().toFixed(1) + " m/s");
        this.addMetric("Earth distance", () => this.orbitRadiusVector.set(
            this.earth.position).subtract(this.sun.position).scale(1e-6).length().toFixed(1) + " Mm");

        window.addEventListener("resize", () => this.resize());

        this.sun = new Body(0, 0, OrbitApp.SUN_RADIUS_IN_METERS * OrbitApp.SUN_RADIUS_MAGNIFICATION_FACTOR,
            OrbitApp.SUN_MASS_IN_KG);
        this.sunElement = this.makeBodyElement("star");

        this.earth = new Body(OrbitApp.EARTH_AVERAGE_SUN_DISTANCE_IN_METERS, 0,
            OrbitApp.EARTH_RADIUS_IN_METERS * OrbitApp.EARTH_RADIUS_MAGNIFICATION_FACTOR, OrbitApp.EARTH_MASS_IN_KG);
        this.orbitAround(this.earth, this.sun);
        this.earthElement = this.makeBodyElement("planet");

        this.bodies = [];
        this.bodyElements = [];

        this.widthInMeters = OrbitApp.DISPLAY_WIDTH_IN_METERS;
        this.halfWidthInMeters = this.widthInMeters / 2;
        this.halfHeightInMeters = 1 * this.halfWidthInMeters;  // will be overwritten soon when we resize the screen

        this.resize();

        this.updateCallback = this.update.bind(this);
        this.timeSimulationStarted = performance.now();
        this.previousTimestamp = this.timeSimulationStarted;
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
     * @param {Body} orbitee - the body that will be orbited by orbiter
     */
    orbitAround(orbiter, orbitee) {
        const r = this.auxiliaryVector.set(orbiter.position).subtract(orbitee.position).length();
        const vy = Math.sqrt(OrbitApp.GRAVITATIONAL_CONSTANT * orbitee.mass / r);
        const v = new Vector(0, vy);
        orbiter.velocity.set(v);
    }

    makeBodyElement(className) {
        const element = document.createElementNS(OrbitApp.SVG_NS, "circle");
        element.classList.add(className);
        this.svg.appendChild(element);
        return element;
    }

    update(timestamp) {
        // each real second is equivalent to 1 month of simulation
        const dt = timestamp - this.previousTimestamp;
        const dtInSecs = dt / 1000;
        const scaledTimeDelta = dtInSecs * OrbitApp.TIME_FACTOR;

        // earth
        const orbitRadius = Math.max(this.sun.radius,
            this.orbitRadiusVector.set(this.earth.position).subtract(this.sun.position).length());
        const sunGravityPullAcceleration = OrbitApp.GRAVITATIONAL_CONSTANT * this.sun.mass / (orbitRadius * orbitRadius);
        this.orbitCentripetalVector.set(this.orbitRadiusVector).invert().normalize()
            .scale(sunGravityPullAcceleration * scaledTimeDelta);
        this.earth.velocity.add(this.orbitCentripetalVector);
        this.auxiliaryVector.set(this.earth.velocity).scale(scaledTimeDelta);
        this.earth.position.add(this.auxiliaryVector);
        this.drawBody(this.earth, this.earthElement);

        // test bodies
        for (let i = 0; i < this.bodies.length; i++) {
            this.drawBody(this.bodies[i], this.bodyElements[i]);
        }

        // metrics
        if (timestamp > this.nextTimeShouldUpdateMetrics) {
            this.metricsCallbacks.forEach(callback => callback());
            this.nextTimeShouldUpdateMetrics = timestamp + 200;
        }

        this.previousTimestamp = timestamp;
        window.requestAnimationFrame(this.updateCallback);
    }

    drawBody(body, element) {
        element.setAttribute("cx", this.scaleX(body.position.x));
        element.setAttribute("cy", this.scaleY(body.position.y));
        element.setAttribute("r", this.widthX(body.radius));
    }

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

    scaleX(x) {
        return this.screenHalfWidth + (x / this.halfWidthInMeters) * this.screenHalfWidth;
    }

    widthX(w) {
        return this.scaleX(w) - this.scaleX(0);
    }

    scaleY(y) {
        return this.screenHalfHeight + (y / this.halfHeightInMeters) * this.screenHalfHeight;
    }
}

OrbitApp.SVG_NS = "http://www.w3.org/2000/svg";
OrbitApp.DISPLAY_WIDTH_IN_METERS = 800e9;
OrbitApp.TIME_FACTOR = 30 * 24 * 60 * 60;  // 1 month in seconds
OrbitApp.EARTH_RADIUS_MAGNIFICATION_FACTOR = 600;
OrbitApp.EARTH_AVERAGE_SUN_DISTANCE_IN_METERS = 149.6e9;
OrbitApp.EARTH_MASS_IN_KG = 5.972e24;
OrbitApp.EARTH_RADIUS_IN_METERS = 6371e3;
OrbitApp.SUN_RADIUS_MAGNIFICATION_FACTOR = 15;
OrbitApp.SUN_MASS_IN_KG = 1988500e24;
OrbitApp.SUN_RADIUS_IN_METERS = 695700e3;
OrbitApp.GRAVITATIONAL_CONSTANT = 6.67408e-11;

new OrbitApp();
