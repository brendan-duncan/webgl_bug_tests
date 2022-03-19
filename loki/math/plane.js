import { Matrix4 } from "./matrix4.js";
import { Vector3 } from "./vector3.js";
import { Epsilon, ClipTest } from "./math.js";

/**
 * An infinite directed plane, representing the formula:
 * a x + b y + c z + d = 0
 * Where [a, b, c] = N represents the plane's normal, and d is the distance from the plane to the
 * origin, measured along the normal.
 * The plane is stored in a Vector4 as [a, b, c, d].
 * @category Math
 */
export class Plane extends Float32Array {
    constructor() {
        if (arguments.length === 0) {
            // default constructor, initialized to 0
            super(4);
        } else if (arguments.length === 2 && arguments[0].length >= 3) {
            // ([normalx, normaly, normalz], d)
            super(4);
            this[0] = arguments[0][0];
            this[1] = arguments[0][1];
            this[2] = arguments[0][2];
            this[3] = arguments[1];
        } else if (arguments.length == 4) {
            // (normalx, normaly, normalz, d)
            super(4);
            this[0] = arguments[0];
            this[1] = arguments[1];
            this[2] = arguments[2];
            this[3] = arguments[3];
        } else {
            // copy, subarray
            super(...arguments);
        }
    }

    static fromPoints(point1, point2, point3) {
        const out = new Plane();
        return out.setFromPoints(point1, point2, point3);
    }

    setFromPoints(point1, point2, point3) {
        const x1 = point2[0] - point1[0];
        const y1 = point2[1] - point1[1];
        const z1 = point2[2] - point1[2];
        const x2 = point3[0] - point1[0];
        const y2 = point3[1] - point1[1];
        const z2 = point3[2] - point1[2];
        const yz = (y1 * z2) - (z1 * y2);
        const xz = (z1 * x2) - (x1 * z2);
        const xy = (x1 * y2) - (y1 * x2);

        const distanceSquared = (yz * yz) + (xz * xz) + (xy * xy);
        const distance = distanceSquared ? 1.0 / Math.sqrt(distanceSquared) : 0.0;

        this[0] = yz * distance;
        this[1] = xz * distance;
        this[2] = xy * distance;
        this[3] = -((this[0] * point1[0]) + (this[1] * point1[1]) + (this[2] * point1[2]));

        return this;
    }

    normalize() {
        const norm = this[0] * this[0] + this[1] * this[1] + this[2] * this[2];
        const magnitude = norm ? 1.0 / Math.sqrt(norm) : 0;
        this[0] *= magnitude;
        this[1] *= magnitude;
        this[2] *= magnitude;
        this[3] *= magnitude;
        return this;
    }

    transform(transformation) {
        const transposedMatrix = _tmpMatrix;
        Matrix4.transpose(transformation, transposedMatrix);
        const m = transposedMatrix;
        const x = this[0];
        const y = this[1];
        const z = this[2];
        const d = this[3];

        const normalX = x * m[0] + y * m[1] + z * m[2] + d * m[3];
        const normalY = x * m[4] + y * m[5] + z * m[6] + d * m[7];
        const normalZ = x * m[8] + y * m[9] + z * m[10] + d * m[11];
        const finalD = x * m[12] + y * m[13] + z * m[14] + d * m[15];

        return new Plane(normalX, normalY, normalZ, finalD);
    }

    /**
     * Calculate the dot product of the given vector with the plane's normal.
     * @param {Vector3} v 
     * @return {number}
     */
    dotNormal(v) {
        return this[0] * v[0] + this[1] * v[1] + this[2] * v[2];
    }

    /**
     * Calcualte the distance from the given point to the plane.
     * @param {Vector3} pt The point to check
     * @return {number} The distance from pt to the plane.
     */
    distanceToPoint(pt) {
        return this.dotNormal(pt) + this[3];
    }

    /**
     * Intersect a ray with the plane.
     * @param {Vector3} rayOrigin The origin of the ray.
     * @param {Vector3} rayDirection The direction of the ray.
     * @param {Vector3} [out] Optional storage for the calculated intersection point.
     * @return {Vector3} The point of the intersection, or null if the ray doesn"t intersect.
     */
    rayIntersect(rayOrigin, rayDirection, out) {
        const d0 = this.dotNormal(rayOrigin) + this[3];
        const d1 = this.dotNormal(rayDirection);
        if (d1 == 0) {
            return null;
        }
        out = out || new Vector3();
        const t = -d0 / d1;
        out[0] = rayOrigin[0] + rayDirection[0] * t;
        out[1] = rayOrigin[1] + rayDirection[1] * t;
        out[2] = rayOrigin[2] + rayDirection[2] * t;
        return out;
    }

    static distanceToPoint(plane, point) {
        return Vector3.dot(plane, point) + plane[3];
    }

    /**
     * Tests a point against the plane.
     * @param {*} plane 
     * @param {*} point 
     * @return {number} Clip.Outside if the point is behind the plane; Clip.Overlap if the point
     * is on the plane; Clip.Inside if the point is in front of the plane.
     */
    static testPoint(plane, point) {
        const distance = Plane.distanceToPoint(plane, point);
        return distance > Epsilon ? ClipTest.Inside :
               distance < -Epsilon ? ClipTest.Outside :
               ClipTest.Overlap;
    }

    /**
     * Tests a bounding box against the plane.
     * @param {Plane} plane 
     * @param {BoundingBox} box 
     * @return {Enum} Clip.Outside if the box is completely behind the plane;
     * Clip.Inside if the box is completely in front of the plane;
     * Clip.Overlap if the box overlaps the plane.
     */
    static testBoundingBox(plane, box) {
        const n = plane;
        const d = plane[3];
        const center = box.getCenter(_tmpCenter);
        const halfSize = Vector3.subtract(box.max, center, _tmpHalfSize);

        const radius = Math.abs(halfSize[0] * n[0]) +
            Math.abs(halfSize[1] * n[1]) +
            Math.abs(halfSize[2] * n[2]);

        const distance = Vector3.dot(n, center) + d;

        if (distance < -radius) {
            return ClipTest.Outside;
        }
        if (distance <= radius) {
            return ClipTest.Overlap;
        }
        return ClipTest.Inside;
    }

    /**
     * Tests a bounding sphere against the plane.
     * @param {Plane} plane The plane to test.
     * @param {Vector3} center Center of the sphere.
     * @param {number} radius Radius of the sphere.
     * @return {Enum} Clip.Outside if the sphere is completely behind the plane;
     * Clip.Inside if the sphere is completely in front of the plane;
     * Clip.Overlap if the sphere overlaps the plane.
     */
    static testSphere(plane, center, radius) {
        const d = plane[0] * center[0] + plane[1] * center[1] + plane[2] * center[2] + plane[3];
        if (d <= -radius) {
            return ClipTest.Outside;
        } else if (d <= radius) {
            return ClipTest.Overlap;
        }
        return ClipTest.Inside;
    }
}

const _tmpMatrix = new Matrix4();
const _tmpCenter = new Vector3();
const _tmpHalfSize = new Vector3();
