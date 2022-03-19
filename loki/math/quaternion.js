import { Vector4 } from "./vector4.js";
import { Epsilon, RotationOrder, RadianToDegree, DegreeToRadian, clamp } from "./math.js";
import { Vector3 } from "./vector3.js";

/**
 * A Quaternion represents the orientation of a transformation.
 * @category Math
 */
export class Quaternion extends Vector4 {
    constructor() {
        super(...arguments);
        if (arguments.length == 0) {
            this[3] = 1;
        }
    }

    static fromAxisAngle(axis, angle, out) {
        out = out || new Quaternion();
        return out.setAxisAngle(axis, angle);
    }

    static fromMatrix3(m, out) {
        out = out || new Quaternion();

        const fTrace = m[0] + m[4] + m[8];
        if (fTrace > 0.0) {
            // |w| > 1/2, may as well choose w > 1/2
            let fRoot = Math.sqrt(fTrace + 1.0); // 2w
            out[3] = 0.5 * fRoot;
            fRoot = 0.5 / fRoot; // 1/(4w)
            out[0] = (m[5] - m[7]) * fRoot;
            out[1] = (m[6] - m[2]) * fRoot;
            out[2] = (m[1] - m[3]) * fRoot;
        } else {
            // |w| <= 1/2
            let i = 0;
            if (m[4] > m[0]) i = 1;
            if (m[8] > m[i * 3 + i]) i = 2;

            const j = (i + 1) % 3;
            const k = (i + 2) % 3;

            let fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1.0);
            out[i] = 0.5 * fRoot;
            fRoot = 0.5 / fRoot;
            out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot;
            out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
            out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
        }

        return out;
    }

    /**
     * Create a quaternion from an euler angle rotation. Angles are expected in degrees.
     * @param {*} x 
     * @param {*} y 
     * @param {*} z 
     * @param {*} order 
     */
    static fromEulerAngles(x, y, z, order) {
        const out = new Quaternion();
        out.setEulerAngles(x, y, z, order);
        return out;
    }

    clone() {
        return new Quaternion(this);
    }

    setIdentity() {
        this[0] = 0;
        this[1] = 0;
        this[2] = 0;
        this[3] = 1;
        return this;
    }

    setEulerAngles(x, y, z, order) {
        order = (order === undefined) ? RotationOrder.Default : order;
        x *= DegreeToRadian * 0.5;
        y *= DegreeToRadian * 0.5;
        z *= DegreeToRadian * 0.5;

        const cx = Math.cos(x);
        const cy = Math.cos(y);
        const cz = Math.cos(z);
        const sx = Math.sin(x);
        const sy = Math.sin(y);
        const sz = Math.sin(z);

        _qX.setFrom(sx, 0, 0, cx);
        _qY.setFrom(0, sy, 0, cy);
        _qZ.setFrom(0, 0, sz, cz);

        switch (order) {
            case RotationOrder.ZYX:
                Quaternion.multiply(_qX, _qY, this);
                Quaternion.multiply(this, _qZ, this);
                break;
            case RotationOrder.YZX:
                Quaternion.multiply(_qX, _qZ, this);
                Quaternion.multiply(this, _qY, this);
                break;
            case RotationOrder.XZY:
                Quaternion.multiply(_qY, _qZ, this);
                Quaternion.multiply(this, _qX, this);
                break;
            case RotationOrder.ZXY:
                Quaternion.multiply(_qY, _qX, this);
                Quaternion.multiply(this, _qZ, this);
                break;
            case RotationOrder.YXZ:
                Quaternion.multiply(_qZ, _qX, this);
                Quaternion.multiply(this, _qY, this);
                break;
            case RotationOrder.XYZ:
                Quaternion.multiply(_qZ, _qY, this);
                Quaternion.multiply(this, _qX, this);
                break;
            default:
                throw "Invalid rotation order";
        }
        return this;
    }

    getEulerAngles(order, out) {
        order = order === undefined || order === null ? RotationOrder.Default : order;
        out = out || new Vector3();

        const q = this;

        _d[0] = q[0] * q[0];
        _d[1] = q[0] * q[1];
        _d[2] = q[0] * q[2];
        _d[3] = q[0] * q[3];
        _d[4] = q[1] * q[1];
        _d[5] = q[1] * q[2];
        _d[6] = q[1] * q[3];
        _d[7] = q[2] * q[2];
        _d[8] = q[2] * q[3];
        _d[9] = q[3] * q[3];

        const _f = [_qFuncs[order][0], _qFuncs[order][1], _qFuncs[order][2]];

        const f = _f;
        const d = _d;
        const v = _v;

        const SINGULARITY_CUTOFF = 0.499999;

        switch (order) {
            case RotationOrder.ZYX:
                _v[_SingularityTest] = _d[_XZ] + _d[_YW];
                _v[_Z1] = 2.0 * (-_d[_XY] + _d[_ZW]);
                _v[_Z2] = _d[_XX] - _d[_ZZ] - _d[_YY] + _d[_WW];
                _v[_Y1] = 1.0;
                _v[_Y2] = 2.0 * _v[_SingularityTest];
                if (Math.abs(_v[_SingularityTest]) < SINGULARITY_CUTOFF) {
                    _v[_X1] = 2.0 * (-_d[_YZ] + _d[_XW]);
                    _v[_X2] = _d[_ZZ] - _d[_YY] - _d[_XX] + _d[_WW];
                } else {
                    const a = _d[_XZ] + _d[_YW];
                    const b = -_d[_XY] + _d[_ZW];
                    const c = _d[_XZ] - _d[_YW];
                    const e = _d[_XY] + _d[_ZW];
                    _v[_X1] = a * e + b * c;
                    _v[_X2] = b * e - a * c;
                    _f[2] = qNull;
                }
                break;
            case RotationOrder.XZY:
                v[_SingularityTest] = d[_XY] + d[_ZW];
                v[_X1] = 2.0 * (-d[_YZ] + d[_XW]);
                v[_X2] = d[_YY] - d[_ZZ] - d[_XX] + d[_WW];
                v[_Z1] = 1.0;
                v[_Z2] = 2.0 * v[_SingularityTest];
    
                if (Math.abs(v[_SingularityTest]) < SINGULARITY_CUTOFF) {
                    v[_Y1] = 2.0 * (-d[_XZ] + d[_YW]);
                    v[_Y2] = d[_XX] - d[_ZZ] - d[_YY] + d[_WW];
                } else {
                    const a = d[_XY] + d[_ZW];
                    const b = -d[_YZ] + d[_XW];
                    const c = d[_XY] - d[_ZW];
                    const e = d[_YZ] + d[_XW];
                    v[_Y1] = a * e + b * c;
                    v[_Y2] = b * e - a * c;
                    f[0] = qNull;
                }
                break;
            case RotationOrder.YZX:
                v[_SingularityTest] = d[_XY] - d[_ZW];
                v[_Y1] = 2.0 * (d[_XZ] + d[_YW]);
                v[_Y2] = d[_XX] - d[_ZZ] - d[_YY] + d[_WW];
                v[_Z1] = -1.0;
                v[_Z2] = 2.0 * v[_SingularityTest];
    
                if (Math.abs(v[_SingularityTest]) < SINGULARITY_CUTOFF) {
                    v[_X1] = 2.0 * (d[_YZ] + d[_XW]);
                    v[_X2] = d[_YY] - d[_XX] - d[_ZZ] + d[_WW];
                } else {
                    const a = d[_XY] - d[_ZW];
                    const b = d[_XZ] + d[_YW];
                    const c = d[_XY] + d[_ZW];
                    const e = -d[_XZ] + d[_YW];
                    v[_X1] = a * e + b * c;
                    v[_X2] = b * e - a * c;
                    f[1] = qNull;
                }
                break;
            case RotationOrder.ZXY:
                v[_SingularityTest] = d[_YZ] - d[_XW];
                v[_Z1] = 2.0 * (d[_XY] + d[_ZW]);
                v[_Z2] = d[_YY] - d[_ZZ] - d[_XX] + d[_WW];
                v[_X1] = -1.0;
                v[_X2] = 2.0 * v[_SingularityTest];
    
                if (Math.abs(v[_SingularityTest]) < SINGULARITY_CUTOFF) {
                    v[_Y1] = 2.0 * (d[_XZ] + d[_YW]);
                    v[_Y2] = d[_ZZ] - d[_XX] - d[_YY] + d[_WW];
                } else {
                    const a = d[_XY] + d[_ZW];
                    const b = -d[_YZ] + d[_XW];
                    const c = d[_XY] - d[_ZW];
                    const e = d[_YZ] + d[_XW];
                    v[_Y1] = a * e + b * c;
                    v[_Y2] = b * e - a * c;
                    f[2] = qNull;
                }
                break;
            case RotationOrder.YXZ:
                v[_SingularityTest] = d[_YZ] + d[_XW];
                v[_Y1] = 2.0 * (-d[_XZ] + d[_YW]);
                v[_Y2] = d[_ZZ] - d[_YY] - d[_XX] + d[_WW];
                v[_X1] = 1.0;
                v[_X2] = 2.0 * v[_SingularityTest];
    
                if (Math.Abs(v[_SingularityTest]) < SINGULARITY_CUTOFF) {
                    v[_Z1] = 2.0 * (-d[_XY] + d[_ZW]);
                    v[_Z2] = d[_YY] - d[_ZZ] - d[_XX] + d[_WW];
                } else {
                    const a = d[_YZ] + d[_XW];
                    const b = -d[_XZ] + d[_YW];
                    const c = d[_YZ] - d[_XW];
                    const e = d[_XZ] + d[_YW];
                    v[_Z1] = a * e + b * c;
                    v[_Z2] = b * e - a * c;
                    f[1] = qNull;
                }
                break;
            case RotationOrder.XYZ:
                v[_SingularityTest] = d[_XZ] - d[_YW];
                v[_X1] = 2.0 * (d[_YZ] + d[_XW]);
                v[_X2] = d[_ZZ] - d[_YY] - d[_XX] + d[_WW];
                v[_Y1] = -1.0;
                v[_Y2] = 2.0 * v[_SingularityTest];
    
                if (Math.abs(v[_SingularityTest]) < SINGULARITY_CUTOFF) {
                    v[_Z1] = 2.0 * (d[_XY] + d[_ZW]);
                    v[_Z2] = d[_XX] - d[_ZZ] - d[_YY] + d[_WW];
                } else {
                    const a = d[_XZ] - d[_YW];
                    const b = d[_YZ] + d[_XW];
                    const c = d[_XZ] + d[_YW];
                    const e = -d[_YZ] + d[_XW];
                    v[_Z1] = a * e + b * c;
                    v[_Z2] = b * e - a * c;
                    f[0] = qNull;
                }
                break;
        }

        out.setFrom(_f[0](_v[_X1], _v[_X2]) * RadianToDegree,
            _f[1](_v[_Y1], _v[_Y2]) * RadianToDegree,
            _f[2](_v[_Z1], _v[_Z2]) * RadianToDegree);

        return out;
    }

    setAxisAngle(axis, angle) {
        angle *= 0.5;
        const s = Math.sin(angle);
        this[0] = s * axis[0];
        this[1] = s * axis[1];
        this[2] = s * axis[2];
        this[3] = Math.cos(angle);
        return this;
    }

    getAxisAngle(outAxis) {
        const q = this;
        const rad = Math.acos(q[3]) * 2.0;
        const s = Math.sin(rad / 2.0);
        if (s > Epsilon) {
            outAxis[0] = q[0] / s;
            outAxis[1] = q[1] / s;
            outAxis[2] = q[2] / s;
        } else {
            outAxis[0] = 1;
            outAxis[1] = 0;
            outAxis[2] = 0;
        }
        return rad;
    }

    /**
     * Calculates the inverse of this quaternion
     * @param {Quaternion} [out]
     * @return {Quaternion}
     */
    invert(out) {
        out = out || this;
        const a0 = this[0];
        const a1 = this[1];
        const a2 = this[2];
        const a3 = this[3];
        const dot = a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
        if (dot == 0) {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            return out;
        }

        const invDot = dot ? 1.0 / dot : 0;

        out[0] = -a0 * invDot;
        out[1] = -a1 * invDot;
        out[2] = -a2 * invDot;
        out[3] = a3 * invDot;

        return out;
    }

    /**
     * Calculates the conjugate of this quaternion.
     * If the quaternion is normalized, this is faster than invert and produces the same result.
     * @param {Quaternion} [out]
     * @return Quaternion
     */
    conjugate(out) {
        out = out || this;
        out[0] = -this[0];
        out[1] = -this[1];
        out[2] = -this[2];
        out[3] = this[3];
        return out;
    }

    transformVector3(v, out) {
        out = out || new Vector3();
        const qx = this[0];
        const qy = this[1];
        const qz = this[2];
        const qw = this[3];
        const x = v[0];
        const y = v[1];
        const z = v[2];

        let uvx = qy * z - qz * y;
        let uvy = qz * x - qx * z;
        let uvz = qx * y - qy * x;

        let uuvx = qy * uvz - qz * uvy;
        let uuvy = qz * uvx - qx * uvz;
        let uuvz = qx * uvy - qy * uvx;

        const w2 = qw * 2;
        uvx *= w2;
        uvy *= w2;
        uvz *= w2;

        uuvx *= 2;
        uuvy *= 2;
        uuvz *= 2;

        out[0] = x + uvx + uuvx;
        out[1] = y + uvy + uuvy;
        out[2] = z + uvz + uuvz;

        return out;
    }

    transformVector4(v, out) {
        out = out || new Vector4();
        const qx = this[0];
        const qy = this[1];
        const qz = this[2];
        const qw = this[3];
        const x = v[0];
        const y = v[1];
        const z = v[2];

        const ix = qw * x + qy * z - qz * y;
        const iy = qw * y + qz * x - qx * z;
        const iz = qw * z + qx * y - qy * x;
        const iw = -qx * x - qy * y - qz * z;

        // calculate result * inverse quat
        out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
        out[3] = v[3];
        
        return out;
    }

    static getAngle(a, b) {
        const dotproduct = Quaternion.dot(a, b);
        return Math.acos(2 * dotproduct * dotproduct - 1);
    }

    static multiply(a, b, out) {
        out = out || new Quaternion();
        const ax = a[0];
        const ay = a[1];
        const az = a[2];
        const aw = a[3];
        const bx = b[0];
        const by = b[1];
        const bz = b[2];
        const bw = b[3];
        out[0] = ax * bw + aw * bx + ay * bz - az * by;
        out[1] = ay * bw + aw * by + az * bx - ax * bz;
        out[2] = az * bw + aw * bz + ax * by - ay * bx;
        out[3] = aw * bw - ax * bx - ay * by - az * bz;
        return out;
    }

    /**
     * Calculates the inverse of the quaternion
     * @param {*} q 
     * @param {*} out 
     */
    static inverse(q, out) {
        out = out || new Quaternion();
        return q.invert(out);
    }

    /**
     * Calculates the conjugate of the quaternion.
     * If the quaternion is normalized, this is faster than invert and produces the same result.
     * @param {*} q 
     * @param {*} out 
     */
    static conjugate(q, out) {
        out = out || new Quaternion();
        return q.conjugate(out);
    }

    static slerp(a, b, t, out) {
        out = out || new Quaternion();
        const ax = a[0];
        const ay = a[1];
        const az = a[2];
        const aw = a[3];
        let bx = b[0];
        let by = b[1];
        let bz = b[2];
        let bw = b[3];

        let scale0;
        let scale1;

        // calculate cosine
        let cosom = ax * bx + ay * by + az * bz + aw * bw;
        // adjust signs (if necessary)
        if (cosom < 0.0) {
            cosom = -cosom;
            bx = -bx;
            by = -by;
            bz = -bz;
            bw = -bw;
        }
        // calculate coefficients
        if (1.0 - cosom > Epsilon) {
            // standard case (slerp)
            const omega = Math.acos(cosom);
            const sinom = Math.sin(omega);
            scale0 = Math.sin((1.0 - t) * omega) / sinom;
            scale1 = Math.sin(t * omega) / sinom;
        } else {
            // "from" and "to" quaternions are very close
            //  ... so we can do a linear interpolation
            scale0 = 1.0 - t;
            scale1 = t;
        }

        // calculate final values
        out[0] = scale0 * ax + scale1 * bx;
        out[1] = scale0 * ay + scale1 * by;
        out[2] = scale0 * az + scale1 * bz;
        out[3] = scale0 * aw + scale1 * bw;

        return out;
    }
}

Quaternion.Identity = new Quaternion();

const _qX = new Quaternion();
const _qY = new Quaternion();
const _qZ = new Quaternion();

function qAsin(a, b) {
    return a * Math.asin(clamp(b, -1, 1));
}

function qAtan2(a, b) {
    return Math.atan2(a, b);
}

function qNull() {
    return 0;
}

const _X1 = 0;
const _X2 = 1;
const _Y1 = 2;
const _Y2 = 3;
const _Z1 = 4;
const _Z2 = 5;
const _SingularityTest = 6;

const _XX = 0;
const _XY = 1;
const _XZ = 2;
const _XW = 3;
const _YY = 4;
const _YZ = 5;
const _YW = 6;
const _ZZ = 7;
const _ZW = 8;
const _WW = 9;
const _QuatIndexCount = 10;

const _d = new Float32Array(_QuatIndexCount);
const _v = new Float32Array(_QuatIndexCount);
const _qFuncs = [
    [qAtan2, qAsin, qAtan2], // XYZ
    [qAtan2, qAtan2, qAsin], // XZY
    [qAtan2, qAtan2, qAsin], // YZX
    [qAsin, qAtan2, qAtan2], // YXZ
    [qAsin, qAtan2, qAtan2], // ZXY
    [qAtan2, qAsin, qAtan2] // ZYX
];
