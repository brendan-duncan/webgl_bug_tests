import { Vector3 } from "./vector3.js";

/**
 * A ray represented as an origin and a direction.
 * @category Math
 */
export class Ray {
    /**
     * @param {*} arguments Can be empty, a Ray, or an origin and direction.
     */
    constructor() {
        this.origin = new Vector3();
        this.direction = new Vector3(0, 0, -1);
        const numArgs = arguments.length;
        if (numArgs == 1 && arguments[0].constructor === Ray) {
            this.origin.set(arguments[0].origin);
            this.direction.set(arguments[0].direction);
        } else if (numArgs == 2) {
            this.origin.set(arguments[0]);
            this.direction.set(arguments[1]);
        }
    }

    /**
     * Find the point along the ray at the given distance.
     * @param {number} distance 
     * @param {Ray} [out]
     * @return {Ray}
     */
    pointAlongRay(distance, out) {
        out = out || new Vector3();
        out[0] = this.origin[0] + this.direction[0] * distance;
        out[1] = this.origin[1] + this.direction[1] * distance;
        out[2] = this.origin[2] + this.direction[2] * distance;
        return out;
    }

    /**
     * Reflect the ray against the given point and surface normal.
     * @param {Vector3} point 
     * @param {Vector3} normal 
     * @param {Ray} [out]
     * @return {Ray}
     */
    reflect(point, normal, out) {
        out = out || new Ray();
        out.origin[0] = point[0];
        out.origin[1] = point[1];
        out.origin[2] = point[2];
        const s = -2 * Vector3.dot(normal, this.direction);
        out.direction[0] = normal[0] * s + this.direction[0];
        out.direction[1] = normal[1] * s + this.direction[1];
        out.direction[2] = normal[2] * s + this.direction[2];
        return out;
    }

    /**
     * Transform the ray by the given matrix.
     * @param {Matrix4} matrix 
     * @param {Ray} [out]
     * @return {Ray}
     */
    transform(matrix, out) {
        out = out || this;
        matrix.transformVector3(this.origin, 1, out.origin);
        matrix.transformVector3(this.direction, 0, out.direction);
        return out;
    }
}
