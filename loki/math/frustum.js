import { Plane } from "./plane.js";
import { ClipTest } from "./math.js";

/**
 * A Frustum defining the projection space of a camera. It can be used to determine visibility of
 * objects, by testing whether points or bounding objects are contained within the Frustum.
 * @category Math
 */
export class Frustum extends Float32Array {
    /**
     * Create a new Frustum.
     * @param {*} matrix Can be undefined, a Matrix, or a Frustum
     */
    constructor(matrix) {
        if (!matrix) {
            super(4 * 6);
        } else if (matrix.length == 16) {
            super(4 * 6);  // For initializing to a matrix
            this.setMatrix(matrix);
        } else if (matrix.length === 24) {
            super(matrix); // For copying a Frustum
        } else if (arguments.length === 3) {
            super(...arguments); // For views into the Float32Array
        } else {
            throw "Invalid arguments to Frustum constructor";
        }
    }

    /**
     * @property {Float32Array} right
     */
    get right() { return this.subarray(0, 4); }

    /**
     * @property {Float32Array} left
     */
    get left() { return this.subarray(4, 8); }

    /**
     * @property {Float32Array} bottom
     */
    get bottom() { return this.subarray(8, 12); }

    /**
     * @property {Float32Array} top
     */
    get top() { return this.subarray(12, 16); }

    /**
     * @property {Float32Array} far
     */
    get far() { return this.subarray(16, 20); }

    /**
     * @property {Float32Array} near
     */
    get near() { return this.subarray(20, 24); }

    /**
     * Set the frustum from a projection matrix.
     * @param {Matrix4} vp Projection matrix to set the frustum from.
     */
    setMatrix(vp) {
        // right
        this[0] = vp[3] - vp[0];
        this[1] = vp[7] - vp[4];
        this[2] = vp[11] - vp[8];
        this[3] = vp[15] - vp[12];
        _normalize(this, 0);

        // left
        this[4] = vp[3] + vp[0];
        this[5] = vp[7] + vp[4];
        this[6] = vp[11] + vp[8];
        this[7] = vp[15] + vp[12];
        _normalize(this, 4);

        // bottom
        this[8] = vp[3] + vp[1];
        this[9] = vp[7] + vp[5];
        this[10] = vp[11] + vp[9];
        this[11] = vp[15] + vp[13];
        _normalize(this, 8);

        // top
        this[12] = vp[3] - vp[1];
        this[13] = vp[7] - vp[5];
        this[14] = vp[11] - vp[9];
        this[15] = vp[15] - vp[13];
        _normalize(this, 12);

        // back
        this[16] = vp[3] - vp[2];
        this[17] = vp[7] - vp[6];
        this[18] = vp[11] - vp[10];
        this[19] = vp[15] - vp[14];
        _normalize(this, 16);

        // front
        this[20] = vp[3] + vp[2];
        this[21] = vp[7] + vp[6];
        this[22] = vp[11] + vp[10];
        this[23] = vp[15] + vp[14];
        _normalize(this, 20);
    }

    /**
     * Test a BoundingBox against the frustum.
     * @param {BoundingBox} box 
     * @return {number} Clip.Outside of the box is completely outside the frustum;
     * Clip.Inside if the box is completely inside the frustum;
     * Clip.Overlap if the box overlaps the frustum.
     */
    testBoundingBox(box) {
        let flag = 0;
        let o = 0;

        flag = Plane.testBoundingBox(this.left, box);
        if (flag === ClipTest.Outside) {
            return ClipTest.Outside;
        }
        o += flag;
        
        flag = Plane.testBoundingBox(this.right, box);
        if (flag === ClipTest.Outside) {
            return ClipTest.Outside;
        }
        o += flag;

        flag = Plane.testBoundingBox(this.top, box);
        if (flag === ClipTest.Outside) {
            return ClipTest.Outside;
        }
        o += flag;

        flag = Plane.testBoundingBox(this.bottom, box);
        if (flag === ClipTest.Outside) {
            return ClipTest.Outside;
         }
         o += flag;

        flag = Plane.testBoundingBox(this.near, box);
        if (flag === ClipTest.Outside) {
            return ClipTest.Outside;
        }
        o += flag;

        flag = Plane.testBoundingBox(this.far, box);
        if (flag === ClipTest.Outside) {
            return ClipTest.Outside;
        }
        o += flag;

        return o == 0 ? ClipTest.Inside : ClipTest.Overlap;
    }

    /**
     * Test a BoundingSphere against the frustum.
     * @param {BoundingSphere} sphere 
     * @return {number} Clip.Outside of the sphere is completely outside the frustum;
     * Clip.Inside if the sphere is completely inside the frustum;
     * Clip.Overlap if the sphere overlaps the frustum.
     */
    testBoundingSphere(sphere) {
        const center = sphere.center;
        const radius = sphere.radius;

        let flag = 0;
        let o = 0;

        flag = Plane.testSphere(this.left, center, radius);
        if (flag === ClipTest.Outside) {
            return ClipTest.Outside;
        }
        o += flag;
        
        flag = Plane.testSphere(this.right, center, radius);
        if (flag === ClipTest.Outside) {
            return ClipTest.Outside;
        }
        o += flag;

        flag = Plane.testSphere(this.top, center, radius);
        if (flag === ClipTest.Outside) {
            return ClipTest.Outside;
        }
        o += flag;

        flag = Plane.testSphere(this.bottom, center, radius);
        if (flag === ClipTest.Outside) {
            return ClipTest.Outside;
         }
         o += flag;

        flag = Plane.testSphere(this.near, center, radius);
        if (flag === ClipTest.Outside) {
            return ClipTest.Outside;
        }
        o += flag;

        flag = Plane.testSphere(this.far, center, radius);
        if (flag === ClipTest.Outside) {
            return ClipTest.Outside;
        }
        o += flag;

        return o == 0 ? ClipTest.Inside : ClipTest.Overlap;
    }
}

function _normalize(self, pos) {
    const x = self[pos];
    const y = self[pos + 1];
    const z = self[pos + 2];
    const l2 = x * x + y * y + z * z;
    if (l2 === 0) {
        return;
    }
    const l = 1.0 / Math.sqrt(l2);
    self[pos] *= l;
    self[pos + 1] *= l;
    self[pos + 2] *= l;
    self[pos + 3] *= l;
}
