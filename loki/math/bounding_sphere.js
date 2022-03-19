import { Vector4 } from "./vector4.js";

/**
 * Bounding sphere. This is stored as a Vector4, where the first 3 components are the center
 * position, and the fourth element is the radius.
 * @category Math
 */
export class BoundingSphere extends Vector4 {
    constructor() {
        super(arguments);
    }

    /**
     * @property {Vector4} center The center of the sphere. The 4th element of the Vector4 is the
     * radius.
     */
    get center() { return this; }

    /**
     * Set the center of the bounding sphere.
     * @param {number|Vector3} x_v 
     * @param {number?} y 
     * @param {number?} z 
     */
    setCenter(x_v, y, z) {
        if (y === undefined) {
            this[0] = x_v[0];
            this[1] = x_v[1];
            this[2] = x_v[2];
        } else {
            this[0] = x_v;
            this[1] = y;
            this[2] = z;
        }
    }

    /**
     * @property {number} radius The radius of the bounding sphere.
     */
    get radius() { return this[3]; }

    set radius(r) { this[3] = r; }
}
