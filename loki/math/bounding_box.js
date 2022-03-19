import { Loki } from "../loki.js";
import { Vector3 } from "./vector3.js";

/**
 * A three-dimensional axis-aligned bounding box.
 * @category Math
 */
export class BoundingBox {
    constructor() {
        if (arguments.length == 1) {
            // BoundingBox(copy)
            const other = arguments[0];
            this._min = new Vector3(other.min);
            this._max = new Vector3(other.max);
        } else if (arguments.length == 2) {
            // BoundingBox(min, max)
            this._min = new Vector3(arguments[0]);
            this._max = new Vector3(arguments[1]);
        } else if (arguments.length == 6) {
            // BoundingBox(min_x, min_y, min_z, max_x, max_y, max_z)
            this._min = new Vector3(arguments[0], arguments[1], arguments[2]);
            this._max = new Vector3(arguments[3], arguments[4], arguments[5]);
        } else {
            // BoundingBox()
            this._min = new Vector3();
            this._max = new Vector3();
        }
    }

    /** @property {Vector3} min The minimum extent of the bounding box. */
    get min() { return this._min; }

    set min(v) { this._min.set(v); }

    /** @property {Vector3} max The maximum extent of the bounding box. */
    get max() { return this._max; }

    set max(v) { this._max.set(v); }

    /**
     * @property {number} depth The length of the box (z-axis extent)
     */
    get depth() { return this._max[2] - this._min[2]; }

    /**
     * @property {number} width The width of the box (x-axis extent)
     */
    get width() { return this._max[0] - this._min[0]; }

    /**
     * @property {number} height The height of the box (y-axis extent)
     */
    get height() { return this._max[1] - this._min[1]; }

    /**
     * @property {number} dominantAxis The largest axis of the box.
     */
    get dominantAxis() {
        const w = this.width;
        const h = this.height;
        const d = this.depth;
        if (w > h && w > d) {
            return 0;
        }
        if (h > d) {
            return 1;
        }
        return 2;
    }

    /**
     * Create a bounding box around the given point.
     * @param {Vector3} point 
     * @return {BoundingBox} The new BoundingBox.
     */
    static fromPoint(point) {
        return new BoundingBox(point, point);
    }

    /**
     * Create a bounding box with the given extents.
     * @param {Vector3} min 
     * @param {Vector3} max 
     * @return {BoundingBox} The new BoundingBox.
     */
    static fromMinMax(min, max) {
        return new BoundingBox(min, max);
    }

    /**
     * Create a bounding box with a center and half-size.
     * @param {Vector3} center 
     * @param {Vector3} halfSize 
     * @return {BoundingBox} The new BoundingBox
     */
    static fromCenterHalfSize(center, halfSize) {
        return new BoundingBox(
            center[0] - halfSize[0],
            center[1] - halfSize[1],
            center[2] - halfSize[2],
            center[0] + halfSize[0],
            center[1] + halfSize[1],
            center[2] + halfSize[2]);
    }

    /**
     * Create a copy of this BoundingBox.
     * @return {BoundingBox} The cloned BoundingBox.
     */
    clone() {
        return new BoundingBox(this);
    }

    /**
     * Copy another BoundingBox.
     * @param {BoundingBox} other The BoundingBox to copy.
     * @return {BoundingBox} Returns self.
     */
    copy(other) {
        this._min.set(other._min);
        this._max.set(other._max);
        return this;
    }

    /**
     * Set the values of the bounding box from another bounding box, a point, or a list of points.
     * @param {*} box 
     * @return {BoundingBox} Returns self.
     */
    set(box) {
        if (!box) {
            return;
        }
        if (box.constructor === BoundingBox) {
            this._min.set(box._min);
            this._max.set(box._max);
            return;
        } else if (box.length > 0) { // a single point, or an array of points
            if (box.length == 3 && Loki.isNumber(box[0])) {
                this._min.set(box);
                this._max.set(box);
            } else if (box.length > 2) { // an array of points
                const points = box;
                const min = this._min;
                const max = this._max;
                min[0] = points[0];
                min[1] = points[1];
                min[2] = points[2];
                max[0] = points[0];
                max[1] = points[1];
                max[2] = points[2];
                for (let i = 3, l = points.length; i < l; i += 3) {
                    const x = points[i];
                    const y = points[i + 1];
                    const z = points[i + 2];
                    min[0] = Math.min(x, min[0]);
                    min[1] = Math.min(y, min[1]);
                    min[2] = Math.min(z, min[2]);
                    max[0] = Math.max(x, max[0]);
                    max[1] = Math.max(y, max[1]);
                    max[2] = Math.max(z, max[2]);
                }
            }
        }
        return this;
    }

    /**
     * Set the min and max extents of the bounding box.
     * @param {*} arguments Either two vectors as min, max; or six floats as min, max.
     * @return {BoundingBox} Returns self.
     */
    setMinMax() {
        if (arguments.length == 2) {
            this._min.set(arguments[0]);
            this._max.set(arguments[1]);
        } else if (arguments.length == 6) {
            this._min[0] = arguments[0];
            this._min[1] = arguments[1];
            this._min[2] = arguments[2];
            this._max[0] = arguments[3];
            this._max[1] = arguments[4];
            this._max[2] = arguments[5];
        }
        return this;
    }

    /**
     * Reset the box to (0,0,0)x(0,0,0).
     * @return {BoundingBox} Returns self.
     */
    clear() {
        this._min.setZero();
        this._max.setZero();
        return this;
    }

    /**
     * Determines if this box overlaps the given box.
     * @param {BoundingBox} other The BoundingBox to test.
     * @return {bool} True if other overlaps.
     */
    overlaps(other) {
        if (this._min[0] > other._max[0] || this._max[0] < other._min[0]) {
            return false;
        }
        if (this._min[1] > other._max[1] || this._max[1] < other._min[1]) {
            return false;
        }
        if (this._min[2] > other._max[2] || this._max[2] < other._min[2]) {
            return false;
        }
        return true;
    }

    /**
     * Determines if the box contains a given point.
     * @param {Vector3} point 
     * @return {bool} True if the point is within the bounding box.
     */
    contains(point) {
        return ((point[0] >= this._min[0]) && (point[1] >= this._min[1]) &&
            (point[1] >= this._min[2]) && (point[0] <= this._max[0]) &&
            (point[2] <= this._max[1]) && (point[2] <= this._max[2]));
    }

    /**
     * Returns the volume encompassed by this box.
     * @return {number} The volume of the box.
     */
    volume() {
        return (this._max[0] - this._min[0]) *
               (this._max[1] - this._min[1]) *
               (this._max[2] - this._min[2]);
    }

    /**
     * Given a value [uvw] in the range [0, 1], return the interpolated point within the box.
     * @param {Vecotr3} uvw 
     * @param {Vector3?} _out 
     * @return {Vector3}
     */
    interpolate(uvw, _out) {
        _out = _out || new Vector3();
        _out[0] = uvw[0] * this._max[0] + (1.0 - uvw[0]) * this._min[0];
        _out[1] = uvw[1] * this._max[1] + (1.0 - uvw[1]) * this._min[1];
        _out[2] = uvw[2] * this._max[2] + (1.0 - uvw[2]) * this._min[2];
        return _out;
    }

    /**
     * Expands (or shrinks) the box by a given amount.
     * @param {Vector3} amount 
     * @return {BoundingBox} Returns this bounding box.
     */
    expand(amount) {
        this._min.subtract(amount);
        this._max.add(amount);
        return this;
    }

    /**
     * Expands this box to include the given point or BoundingBox.
     * @param {*} b_x 
     * @param {*} y 
     * @param {*} z 
     * @return {BoundingBox} Returns this bounding box.
     */
    include(b_x, y, z) {
        if (b_x === undefined) {
            return this;
        }
        if (y === undefined) {
            const b = b_x;
            if (b.constructor === BoundingBox) {
                this.include(b._min);
                this.include(b._max);
            } else {
                this._min[0] = Math.min(b[0], this._min[0]);
                this._min[1] = Math.min(b[1], this._min[1]);
                this._min[2] = Math.min(b[2], this._min[2]);
                this._max[0] = Math.max(b[0], this._max[0]);
                this._max[1] = Math.max(b[1], this._max[1]);
                this._max[2] = Math.max(b[2], this._max[2]);
            }
        } else {
            const x = b_x;
            this._min[0] = Math.min(x, this._min[0]);
            this._min[1] = Math.min(y, this._min[1]);
            this._min[2] = Math.min(z, this._min[2]);
            this._max[0] = Math.max(x, this._max[0]);
            this._max[1] = Math.max(y, this._max[1]);
            this._max[2] = Math.max(z, this._max[2]);
        }
        return this;
    }

    /**
     * Transforms the box with a 4x4 transformation matrix
     * @param {Matrix4} transform 
     * @return {BoundingBox} Returns this bounding box.
     */
    transform(transform) {
        let pi = 0;
        const min = this._min;
        const max = this._max;
        for (let cornerBitcodeIndex = 0; cornerBitcodeIndex < 8; ++cornerBitcodeIndex) {
            // Compute corner points via bit code (0 = min, 1 = max)
            _tmp[0] = (cornerBitcodeIndex & 1) == 0 ? min[0] : max[0];
            _tmp[1] = (cornerBitcodeIndex & 2) == 0 ? min[1] : max[1];
            _tmp[2] = (cornerBitcodeIndex & 4) == 0 ? min[2] : max[2];
            transform.transformVector3(_tmp, 1, _tmp);
            _points[pi] = _tmp[0];
            _points[pi + 1] = _tmp[1];
            _points[pi + 2] = _tmp[2];
            pi += 3;
        }
        return this.set(_points);
    }

    /**
     * Return a new BoundingBox that is this box transformed by [mat].
     * @param {Matrix4} mat 
     * @param {BoundingBox?} out 
     * @return {BoundingBox}
     */
    transformed(mat, out) {
        out = out || new BoundingBox(this);
        return out.transform(mat);
    }

    /**
     * Translate the bounding box.
     * @param {*} t_x 
     * @param {*} y 
     */
    translate(t_x, y) {
        if (y === undefined) {
            this._min.add(t_x);
            this._max.add(t_x);
        } else {
            this._min[0] += t_x;
            this._min[1] += y;
            this._max[0] += t_x;
            this._max[1] += y;
        }
        return this;
    }

    /**
     * Get the dimensions of the box.
     * @param {Vector3?} _out 
     */
    getSize(_out) {
        _out = _out || new Vector3();
        _out[0] = this._max[0] - this._min[0];
        _out[1] = this._max[1] - this._min[1];
        _out[2] = this._max[2] - this._min[2];
        return _out;
    }

    /**
     * Returns the centroid of the box
     * @param {Vector3?} _out 
     */
    getCenter(_out) {
        _out = _out || new Vector3();
        _out[0] = (this._max[0] + this._min[0]) * 0.5;
        _out[1] = (this._max[1] + this._min[1]) * 0.5;
        _out[2] = (this._max[2] + this._min[2]) * 0.5;
        return _out;
    }

    /**
     * Get the dimensions of the box.
     * @param {Vector3?} _out 
     * @return {Vector3}
     */
    getExtents(_out) {
        _out = _out || new Vector3();
        _out[0] = this._max[0] - this._min[0];
        _out[1] = this._max[1] - this._min[1];
        _out[2] = this._max[2] - this._min[2];
        return _out;
    }

    /**
     * Returns the coordinates of a particular corner of the box.
     * @param {number} index 
     * @param {Vector3?} _out 
     */
    getCorner(index, _out) {
        if (index < 0 || index > 7) return null;

        const min = this._min;
        const max = this._max;

        _out = _out || new Vector3();
        _out[0] = (index & 1) == 0 ? min[0] : max[0];
        _out[1] = (index & 2) == 0 ? min[1] : max[1];
        _out[2] = (index & 4) == 0 ? min[8] : max[2];

        return _out;
    }

    /**
     * Test if a sphere intersects this bounding box.
     * @param {Vector3} center The center of the sphere
     * @param {number} radius The radius of the sphere.
     * @return {bool}
     */
    testSphere(center, radius) {
        let s;
        let d = 0;
        // find the square of the distance
        // from the sphere to the box
        const vmin = this._min;
        const vmax = this._max;
        for (let i = 0; i < 3; ++i) { 
            if (center[i] < vmin[i]) {
                s = center[i] - vmin[i];
                d += s * s;
            } else if (center[i] > vmax[i]) { 
                s = center[i] - vmax[i];
                d += s * s; 
            }
        }

        const radiusSquared = radius * radius;
        if (d <= radiusSquared) {
            return true;
        }

        return false; // Outside
    }

    /**
     * Determine if the ray intersects this box.
     * @param {Ray} ray 
     * @return {Array} Returns [minDistance, maxDistance].
     */
    rayIntersect(ray) {
        const res = [-Math.MAX_VALUE, Math.MAX_VALUE];

        if (!BoundingBox._intersectPlane(this._min[0], this._max[0], ray.origin[0], ray.direction[0], res)) {
            return null;
        }

        if (!BoundingBox._intersectPlane(this._min[1], this._max[1], ray.origin[1], ray.direction[1], res)) {
            return null;
        }

        if (!BoundingBox._intersectPlane(this._min[2], this._max[2], ray.origin[2], ray.direction[2], res)) {
            return null;
        }

        if (res[0] < 0.0) {
            res[0] = 0.0;
        }

        return res;
    }

    static _intersectPlane(l, r, o, d, res) {
        if (!d) {
            if ((o < l) || (o > r)) {
                return false;
            }
        } else {
            let t1 = (l - o) / d;
            let t2 = (r - o) / d;

            if (t1 > t2) {
                const t = t1;
                t1 = t2;
                t2 = t;
            }

            if (t1 > res[0]) {
                res[0] = t1;
            }

            if (t2 < res[1]) {
                res[1] = t2;
            }

            if (res[0] > res[1]) {
                return false;
            }

            if (res[1] < 0.0) {
                return false;
            }
        }

        return true;
    }
}

/**
 * @property {BoundingBox} Empty An empty BoundingBox.
 */
BoundingBox.Empty = new BoundingBox();

const _tmp = new Vector3();
const _points = new Float32Array(8 * 3);
