"use strict";


class BodyRepresentation {

    constructor (bodyElement, pathElement, pathLength) {
        this.bodyElement = bodyElement;
        this.pathElement = pathElement;
        this.resetPath(pathLength);
        /** @type {number} stores distance traveled since last point added to path */
        this.accruedPositionDeltaInMeters = 0;
    }

    accruePositionDeltaInMeters(metersToAdd) {
        this.accruedPositionDeltaInMeters += metersToAdd;
    }

    resetPositionDeltaInMeters() {
        this.accruedPositionDeltaInMeters = 0;
    }

    resetPath(pathLength = 0) {
        this.pathCap = pathLength === 0 ? this.pathCap > 0 ? this.pathCap: 0 : pathLength;
        this.pathMask = this.pathCap - 1;
        /** @type {Vector[]} */
        this.path = Array.from(new Array(this.pathCap), () => new Vector());
        this.pathSize = 0;
        this.pathTail = 0;
        this.latestPoint = new Vector();
    }

    /**
     * @param {number} x
     * @param {number} y
     */
    addPointToPath(x, y) {
        this.setLatestPoint(x, y);
        if (!BodyRepresentation.isPointValid(this.latestPoint)) {
            throw new Error("Invalid point " + this.latestPoint);
        }

        this.path[this.pathTail].set(x, y);
        this.pathTail = (this.pathTail + 1) & this.pathMask;
        if (this.pathSize < this.pathCap) {
            this.pathSize++;
        }
    }

    getBodyElement() {
        return this.bodyElement;
    }

    getPathElement() {
        return this.pathElement;
    }

    setLatestPoint(x, y) {
        this.latestPoint.x = x;
        this.latestPoint.y = y;
        if (!BodyRepresentation.isPointValid(this.latestPoint)) {
            throw new Error("Invalid point " + this.latestPoint);
        }
    }

    clearLatestPoint() {
        this.latestPoint.x = 0;
        this.latestPoint.y = 0;
    }

    getPath() {
        let pathStr = "";
        const startIndex = this.pathSize === this.pathCap ? (this.pathTail + 1) & this.pathMask : 0;
        let pointsLeft = this.pathSize;
        for (let i = startIndex; --pointsLeft > 0; i = (i + 1) & this.pathMask) {
            pathStr += BodyRepresentation.makePathCommand(this.path[i], pathStr.length === 0);
        }
        if (!BodyRepresentation.isPointZero(this.latestPoint)) {
            pathStr += BodyRepresentation.makePathCommand(this.latestPoint, pathStr.length === 0);
        }
        return pathStr;
    }

    /**
     * @private
     * @param {Vector} point
     * @param {boolean} isFirst
     */
    static makePathCommand(point, isFirst) {
        const command = isFirst ? "M" : "L";
        return `${command}${point.x},${point.y} `;
    }

    /**
     * @param {Vector} point
     * @return {boolean}
     */
    static isPointZero(point) {
        return point.x === 0 && point.y === 0;
    }

    /**
     * @private
     * @param {Vector} point
     */
    static isPointValid(point) {
        return !isNaN(point.x) && !isNaN(point.y) && isFinite(point.x) && isFinite(point.y) && point.x !== 0 && point.y !== 0;
    }

    getAccruedPositionDeltaInMeters() {
        return this.accruedPositionDeltaInMeters;
    }
}
