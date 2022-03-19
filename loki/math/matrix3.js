import { Loki } from "../loki.js";
import { Vector2 } from "./vector2.js";
import { Vector3 } from "./vector3.js";

/**
 * 3x3 matrix.
 * @category Math
 */
export class Matrix3 extends Float32Array {
    /**
     * Creates a new matrix.
     * @param {...*} arguments Variable arguments for constructor overloading.
     * @example
     * new Matrix3() // Creates an identity matrix
     * 
     * new Matrix3(Matrix3) // Creates a clone of the given matrix.
     * 
     * new Matrix3(Array[9]) // Creates a Matrix4 from the given array.
     * 
     * new Matarix3(0) // Creates a zero matrix.
     * 
     * new Matrix3(m00, m01, m02,
     *             m10, m11, m12,
     *             m20, m21, m22) // Create a matrix from individual elements.
     */
    constructor() {
        if (arguments.length) {
            if (arguments.length == 1 && !arguments[0]) {
                super(9);
            } else if (arguments.length == 1 && Loki.isNumber(arguments[0])) {
                super(9);
                const x = arguments[0];
                this[0] = x;
                this[4] = x;
                this[8] = x;
            } else if (arguments.length == 9 && Loki.isNumber(arguments[0])) {
                super(9);
                this[0] = arguments[0];
                this[1] = arguments[1];
                this[2] = arguments[2];
                this[3] = arguments[3];
                this[4] = arguments[4];
                this[5] = arguments[5];
                this[6] = arguments[6];
                this[7] = arguments[7];
                this[8] = arguments[8];
            } else {
                super(...arguments);
            }
        } else {
            super(9);
            this[0] = 1;
            this[4] = 1;
            this[8] = 1;
        }
    }

    /**
     * Create a copy of this matrix.
     * @return {Matrix3}
     */
    clone() {
        return new Matrix3(this);
    }

    /**
     * setFrom(m00, m01, m02, m10, m11, m12, m20, m21, m22)
     * 
     * setFrom([m00, m01, m02, m10, m11, m12, m20, m21, m22])
     * 
     * setFrom(Matrix3)
     */
    setFrom() {
        const numArgs = arguments.length;
        const m = this;
        const x = numArgs == 1 ? arguments[0] : arguments;
        m[0] = x[0];
        m[1] = x[1];
        m[2] = x[2];
        m[3] = x[3];
        m[4] = x[4];
        m[5] = x[5];
        m[6] = x[6];
        m[7] = x[7];
        m[8] = x[8];
        return this;
    }

    /**
     * Convert the matrix to an Array.
     * @return {Array<number>}
     */
    toArray() {
        return [this[0], this[1], this[2],
                this[3], this[4], this[5],
                this[6], this[7], this[8]];
    }

    /**
     * Set the matrix as an identity matrix.
     * @return {Matrix3}
     */
    setIdentity() {
        const m = this;
        m[0] = 1;
        m[1] = 0;
        m[2] = 0;
        m[3] = 0;
        m[4] = 1;
        m[5] = 0;
        m[6] = 0;
        m[7] = 0;
        m[8] = 1;
        return this;
    }

    /**
     * Set the matrix as a translation matrix.
     * @param {Vector2} v 
     * @return {Matrix3}
     */
    setTranslate(v) {
        this[0] = 1;
        this[1] = 0;
        this[2] = 0;
        this[3] = 0;
        this[4] = 1;
        this[5] = 0;
        this[6] = v[0];
        this[7] = v[1];
        this[8] = 1;
        return this;
    }

    /**
     * Set the matrix as a rotation matrix.
     * @param {number} angle 
     * @return {Matrix3}
     */
    setRotate(angle) {
        const s = Math.sin(angle);
        const c = Math.cos(angle);

        this[0] = c;
        this[1] = s;
        this[2] = 0;

        this[3] = -s;
        this[4] = c;
        this[5] = 0;

        this[6] = 0;
        this[7] = 0;
        this[8] = 1;
        return this;
    }

    /**
     * Set the matrix as a scale matrix.
     * @param {Vector2} v 
     * @return {Matrix3}
     */
    setScale(v) {
        this[0] = v[0];
        this[1] = 0;
        this[2] = 0;

        this[3] = 0;
        this[4] = v[1];
        this[5] = 0;

        this[6] = 0;
        this[7] = 0;
        this[8] = 1;
        return this;
    }

    /**
     * Set the matrix as a rotation matrix.
     * @param {Quaternion} q 
     * @return {Matrix3}
     */
    setQuaternion(q) {
        const x = q[0];
        const y = q[1];
        const z = q[2];
        const w = q[3];
        const x2 = x + x;
        const y2 = y + y;
        const z2 = z + z;

        const xx = x * x2;
        const yx = y * x2;
        const yy = y * y2;
        const zx = z * x2;
        const zy = z * y2;
        const zz = z * z2;
        const wx = w * x2;
        const wy = w * y2;
        const wz = w * z2;

        this[0] = 1 - yy - zz;
        this[3] = yx - wz;
        this[6] = zx + wy;

        this[1] = yx + wz;
        this[4] = 1 - xx - zz;
        this[7] = zy - wx;

        this[2] = zx - wy;
        this[5] = zy + wx;
        this[8] = 1 - xx - yy;

        return this;
    }

    /**
     * Transpose this matrix.
     * @return {Matrix3}
     */
    transpose() {
        const out = this;
        const a01 = this[1];
        const a02 = this[2];
        const a12 = this[5];
        out[1] = this[3];
        out[2] = this[6];
        out[3] = a01;
        out[5] = this[7];
        out[6] = a02;
        out[7] = a12;
        return out;
    }

    /**
     * Calculate the determinant of the matrix.
     * @return {number}
     */
    determinant() {
        const a = this;

        const a00 = a[0];
        const a01 = a[1];
        const a02 = a[2];
        const a10 = a[3];
        const a11 = a[4];
        const a12 = a[5];
        const a20 = a[6];
        const a21 = a[7];
        const a22 = a[8];

        const b01 = a22 * a11 - a12 * a21;
        const b11 = -a22 * a10 + a12 * a20;
        const b21 = a21 * a10 - a11 * a20;

        return a00 * b01 + a01 * b11 + a02 * b21;
    }

    /**
     * Invert this matrix.
     * @return {Matrix3}
     */
    invert() {
        const a = this;
        const out = this;

        const a00 = a[0];
        const a01 = a[1];
        const a02 = a[2];
        const a10 = a[3];
        const a11 = a[4];
        const a12 = a[5];
        const a20 = a[6];
        const a21 = a[7];
        const a22 = a[8];

        const b01 = a22 * a11 - a12 * a21;
        const b11 = -a22 * a10 + a12 * a20;
        const b21 = a21 * a10 - a11 * a20;

        // Calculate the determinant
        let det = a00 * b01 + a01 * b11 + a02 * b21;
        if (!det) {
            return out;
        }
        det = 1.0 / det;

        out[0] = b01 * det;
        out[1] = (-a22 * a01 + a02 * a21) * det;
        out[2] = (a12 * a01 - a02 * a11) * det;
        out[3] = b11 * det;
        out[4] = (a22 * a00 - a02 * a20) * det;
        out[5] = (-a12 * a00 + a02 * a10) * det;
        out[6] = b21 * det;
        out[7] = (-a21 * a00 + a01 * a20) * det;
        out[8] = (a11 * a00 - a01 * a10) * det;
        return out;
    }

    /**
     * Translate the matrix by the given vector.
     * @param {Vector2} v 
     * @return {Matrix3}
     */
    translate(v) {
        const a = this;
        const a00 = a[0];
        const a01 = a[1];
        const a02 = a[2];
        const a10 = a[3];
        const a11 = a[4];
        const a12 = a[5];
        const a20 = a[6];
        const a21 = a[7];
        const a22 = a[8];
        const x = v[0];
        const y = v[1];

        const out = this;
        out[0] = a00;
        out[1] = a01;
        out[2] = a02;

        out[3] = a10;
        out[4] = a11;
        out[5] = a12;

        out[6] = x * a00 + y * a10 + a20;
        out[7] = x * a01 + y * a11 + a21;
        out[8] = x * a02 + y * a12 + a22;
        return out;
    }

    /**
     * Rotate the matrix by a given angle
     * @param {number} angle 
     * @return {Matrix3}
     */
    rotate(angle) {
        const a = this;
        const a00 = a[0];
        const a01 = a[1];
        const a02 = a[2];
        const a10 = a[3];
        const a11 = a[4];
        const a12 = a[5];
        const a20 = a[6];
        const a21 = a[7];
        const a22 = a[8];
        const s = Math.sin(angle);
        const c = Math.cos(angle);

        const out = this;
        out[0] = c * a00 + s * a10;
        out[1] = c * a01 + s * a11;
        out[2] = c * a02 + s * a12;

        out[3] = c * a10 - s * a00;
        out[4] = c * a11 - s * a01;
        out[5] = c * a12 - s * a02;

        out[6] = a20;
        out[7] = a21;
        out[8] = a22;
        return out;
    }

    /**
     * Scale the matrix by the given vector.
     * @param {Vector2} v 
     * @return {Matrix3}
     */
    scale(v) {
        const a = this;
        const out = this;
        const x = v[0];
        const y = v[1];
        
        out[0] = x * a[0];
        out[1] = x * a[1];
        out[2] = x * a[2];
        
        out[3] = y * a[3];
        out[4] = y * a[4];
        out[5] = y * a[5];
        
        out[6] = a[6];
        out[7] = a[7];
        out[8] = a[8];
        return out;
    }

    /**
     * Transform a Vector2 by this matrix.
     * @param {Vector2} v 
     * @param {number} z 
     * @param {Vector2?} out 
     * @return {Vector2}
     */
    transformVector2(v, z = 1, out) {
        const x = v[0];
        const y = v[1];
        const m = this;
        out = out || new Vector2();
        out[0] = m[0] * x + m[3] * y + m[6] * z;
        out[1] = m[1] * x + m[4] * y + m[7] * z;
        return out;
    }

    /**
     * Transofrm a Vector3 by this matrix.
     * @param {Vector3} v
     * @param {Vector3?} out
     * @return {Vector3}
     */
    transformVector3(v, out) {
        const x = v[0];
        const y = v[1];
        const z = v[2];
        const m = this;
        out = out || new Vector3();
        out[0] = m[0] * x + m[3] * y + m[6] * z;
        out[1] = m[1] * x + m[4] * y + m[7] * z;
        out[2] = m[2] * x + m[5] * y + m[8] * z;
        return out;
    }

    /**
     * Transpose a matrix
     * @param {Matrix3} m 
     * @param {Matrix3?} out 
     * @return {Matrix3}
     */
    static transpose(m, out) {
        out = out || new Matrix3();
        out[0] = m[0];
        out[1] = m[3];
        out[2] = m[6];
        out[3] = m[1];
        out[4] = m[4];
        out[5] = m[7];
        out[6] = m[2];
        out[7] = m[5];
        out[8] = m[8];
        return out;
    }

    /**
     * Invert a matrix.
     * @param {Matrix3} m 
     * @param {Matrix3?} out 
     * @return {Matrix3}
     */
    static invert(m, out) {
        out = out || new Matrix3();
        out.copy(m);
        return out.invert();
    }

    /**
     * Translate the matrix by the given vector. Returns a new matrix.
     * @param {Matrix3} m 
     * @param {Vector2} v 
     * @param {Matrix3?} out 
     * @return {Matrix3}
     */
    static translate(m, v, out) {
        out = out || Matrix3();
        out.copy(m);
        out.translate(v);
        return out;
    }

    /**
     * Rotate a matrix by the given angle.
     * @param {Matrix3} m 
     * @param {number} angle 
     * @param {Matrix3} out 
     */
    static rotate(m, angle, out) {
        out = out || new Matrix3();
        out.copy(m);
        out.rotate(angle);
        return out;
    }

    /**
     * Scale a matrix.
     * @param {Matrix3} m 
     * @param {Vector2} v 
     * @param {Matrix3?} out 
     */
    static scale(m, v, out) {
        out = out || new Matrix3();
        out.copy(m);
        out.scale(v);
        return out;
    }

    /**
     * Multiply two matrices together.
     * @param {Matrix3} a 
     * @param {Matrix3} b 
     * @param {Matrix3?} out 
     */
    static multiply(a, b, out) {
        out = out || new Matrix3();
        const a00 = a[0];
        const a01 = a[1];
        const a02 = a[2];
        const a10 = a[3];
        const a11 = a[4];
        const a12 = a[5];
        const a20 = a[6];
        const a21 = a[7];
        const a22 = a[8];

        const b00 = b[0];
        const b01 = b[1];
        const b02 = b[2];
        const b10 = b[3];
        const b11 = b[4];
        const b12 = b[5];
        const b20 = b[6];
        const b21 = b[7];
        const b22 = b[8];

        out[0] = b00 * a00 + b01 * a10 + b02 * a20;
        out[1] = b00 * a01 + b01 * a11 + b02 * a21;
        out[2] = b00 * a02 + b01 * a12 + b02 * a22;

        out[3] = b10 * a00 + b11 * a10 + b12 * a20;
        out[4] = b10 * a01 + b11 * a11 + b12 * a21;
        out[5] = b10 * a02 + b11 * a12 + b12 * a22;

        out[6] = b20 * a00 + b21 * a10 + b22 * a20;
        out[7] = b20 * a01 + b21 * a11 + b22 * a21;
        out[8] = b20 * a02 + b21 * a12 + b22 * a22;
        return out;
    }
}

/**
 * @property {Matrix3} Zero A Matrix3 filled with zeros.
 */
Matrix3.Zero = new Matrix3(0);
/**
 * @property {Matrix3} Identity An identity Matrix3.
 */
Matrix3.Identity = new Matrix3();
