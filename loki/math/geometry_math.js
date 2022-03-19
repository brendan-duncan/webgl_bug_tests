/** @module geom */
import { Vector3 } from "./vector3.js";
import { Epsilon } from "./math.js";

/**
 * Calculate the closest point between lines.
 *
 * @param {Vector3} a0 
 * @param {Vector3} a1 
 * @param {Vector3} b0 
 * @param {Vector3} b1 
 * @param {Vector3} p_a 
 * @param {Vector3} p_b 
 * @return {number} Closest distance
 * @category Math
 */
export function closestPointBetweenLines(a0, a1, b0, b1, p_a, p_b) {
    const u = Vector3.subtract(a1, a0, _temp1);
    const v = Vector3.subtract(b1, b0, _temp2);
    const w = Vector3.subtract(a0, b0, _temp3);

    const a = Vector3.dot(u, u); // always >= 0
    const b = Vector3.dot(u, v);
    const c = Vector3.dot(v, v); // always >= 0
    const d = Vector3.dot(u, w);
    const e = Vector3.dot(v, w);
    const D = a * c - b * b; // always >= 0

    let sc;
    let tc;

    // compute the line parameters of the two closest points
    if (D < Epsilon) { // the lines are almost parallel
        sc = 0.0;
        tc = (b > c ? d / b : e / c); // use the largest denominator
    } else {
        sc = (b * e - c * d) / D;
        tc = (a * e - b * d) / D;
    }

    // get the difference of the two closest points
    if (p_a) {
        Vector3.add(a0, Vector3.scale(u, sc, _temp4), p_a);
    }

    if (p_b) {
        Vector3.add(b0, Vector3.scale(v, tc, _temp4), p_b);
    }

    const dP = Vector3.add(w,
        Vector3.subtract(Vector3.scale(u, sc, _temp4), Vector3.scale(v, tc, _temp5), _temp6),
        _temp4);

    return Vector3.length(dP); // return the closest distance
}

/**
 * Test if a ray intersects a plane.
 *
 * @param {Vector3} start Origin of the ray
 * @param {Vector3} direction Direction of the ray
 * @param {Vector3} P Center of the plane
 * @param {Vector3} N Normal of the plane
 * @param {Vector3?} result Optional storage for the point of intersection.
 * @return {bool}
 */
export function intersectPlane(start, direction, P, N, result) {
    const D = Vector3.dot(P, N);

    const numerator = D - Vector3.dot(N, start);
    const denominator = Vector3.dot(N, direction);
    if (Math.abs(denominator) < Epsilon) {
        return false;
    }

    const t = (numerator / denominator);
    if (t < 0.0) {
        return false; // behind the ray
    }

    if (result) {
        Vector3.add(start, Vector3.scale(direction, t, result), result);
    }

    return true;
}

/**
 * Test if a ray intersects a sphere.
 *
 * @param {Vector3} origin Origin of the ray
 * @param {Vector3} direction Direction of the ray
 * @param {Vector3} center Center of the sphere
 * @param {number} radius Radius of the sphere
 * @param {Vector3?} result Optional storage for the point of intersection
 * @param {number?} maxDistance Optional maximum distance to test for an interesction.
 * @return {bool}
 */
export function intersectSphere(origin, direction, center, radius, result, maxDistance) {
    // sphere equation (centered at origin) x2+y2+z2=r2
    // ray equation x(t) = p0 + t*dir
    // substitute x(t) into sphere equation
    // solution below:

    // transform ray origin into sphere local coordinates
    const orig = Vector3.subtract(origin, center, _temp1);

    const a = direction[0] * direction[0] + direction[1] * direction[1] +
                direction[2] * direction[2];
    const b = 2 * orig[0] * direction[0] + 2 * orig[1] * direction[1] +
                2 * orig[2] * direction[2];
    const c = orig[0] * orig[0] + orig[1] * orig[1] + orig[2] * orig[2] - radius * radius;

    const q = b * b - 4 * a * c; 
    if (q < 0.0) {
        return false;
    }

    if (result) {
        const sq = Math.sqrt(q);
        const d = 1 / (2 * a);
        const r1 = (-b + sq) * d;
        const r2 = (-b - sq) * d;
        const t = r1 < r2 ? r1 : r2;
        if (maxDistance !== undefined && t > maxDistance) {
            return false;
        }
        Vector3.add(origin, Vector3.scale(direction, t, result), result);
    }

    return true;
}

/**
 * Test if a ray intersects a cylinder.
 *
 * @param {Vector3} origin 
 * @param {Vector3} direction 
 * @param {Vector3} center 
 * @param {number} height 
 * @param {number} radius 
 * @param {Vector3?} result Optional storage for the point of intersection
 * @return {bool}
 */
export function intersectCylinder(origin, direction, center, height, radius, result) {
    const sa = _temp1;
    sa.set(origin);
    const sb = Vector3.add(origin, Vector3.scale(direction, 100000, _temp2), _temp3);
    let t = 0;
    const d = Vector3.subtract(height, center, _temp4);
    const m = Vector3.subtract(sa, center, _temp5);
    const n = Vector3.subtract(sb, sa, _temp6);

    const md = Vector3.dot(m, d);
    const nd = Vector3.dot(n, d);
    const dd = Vector3.dot(d, d);

    // Test if segment fully outside either endcap of cylinder
    if (md < 0.0 && md + nd < 0.0) {
        return false; // Segment outside of cylinder
    }

    if (md > dd && md + nd > dd) {
        return false; // Segment outside of cylinder
    }

    const nn = Vector3.dot(n, n);
    const mn = Vector3.dot(m, n);
    const a = dd * nn - nd * nd; 
    const k = Vector3.dot(m, m) - radius * radius;
    const c = dd * k - md * md;

    if (Math.abs(a) < Epsilon)  {
        // Segment runs parallel to cylinder axis
        if (c > 0.0) {
            return false;
        }
        // and thus the segment lie outside cylinder
        // Now known that segment intersects cylinder; figure out how it intersects
        if (md < 0.0) {
            t = -mn / nn;
        } else if (md > dd) {
            // Intersect segment against endcap
            t = (nd - mn) / nn;
        } else {
            // Intersect segment against endcap
            t = 0.0;
        }
        // lies inside cylinder
        if (result) {
            Vector3.add(sa, Vector3.scale(n, t, result), result);
        }
        return true;
    }

    const b = dd * mn - nd * md;
    const discr = b * b - a * c;

    if (discr < 0.0) {
        return false;
    }

    // No real roots; no intersection
    t = (-b - Math.sqrt(discr)) / a;
    if (t < 0.0 || t > 1.0) {
        return false;
    }

    // Intersection lies outside segment
    if (md + t * nd < 0.0) {
        // Intersection outside cylinder on side
        if (nd <= 0.0) {
            return false;
        }
        // Segment pointing away from endcap
        t = -md / nd;
        // Keep intersection if Dot(S(t) - p, S(t) - p) <= r^2
        if (result) {
            Vector3.add(sa, Vector3.scale(n, t, result), result);
        }

        return k + 2 * t * (mn + t * nn) <= 0.0;
    } else if (md + t * nd > dd) {
        // Intersection outside cylinder on side
        if (nd >= 0.0) {
            return false; // Segment pointing away from endcap
        }
        t = (dd - md) / nd;
        // Keep intersection if Dot(S(t) - q, S(t) - q) <= r^2
        if (result) {
            Vector3.add(sa, Vector3.scale(n, t, result), result);
        }

        return k + dd - 2 * md + t * (2 * (mn - nd) + t * nn) <= 0.0;
    }
    // Segment intersects cylinder between the endcaps; t is correct
    if (result) {
        Vector3.add(sa, Vector3.scale(n, t, result), result);
    }
    return true;
}

/**
 * Test if a ray intersects a circle.
 * @param {Ray} ray 
 * @param {Vector3} axis 
 * @param {Vector3} center 
 * @param {number} radius 
 * @param {Vector3} result 
 * @param {number?} tolerance 
 */
export function intersectCircle(ray, axis, center, radius, result, tolerance) {
    tolerance = tolerance || 0.1;
    if (intersectPlane(ray.origin, ray.direction, center, axis, result)) {
        const dist = Vector3.distance(result, center);
        const diff = Vector3.subtract(result, center, _temp1);
        diff.scale(1 / dist);
        if (Math.abs(radius - dist) < radius * tolerance &&
            Vector3.dot(diff, ray.direction) < 0) {
            result.set(diff);
            result.scale(radius);
            return true;
        }
    }
    return false;
}

/**
 * Project a point onto a plane.
 *
 * @param {Vector3} point The point to project.
 * @param {Vector3} P The center of the plane.
 * @param {Vector3} N The normal of the plane.
 * @param {Vector3?} result Optional storage for the resulting projected point.
 * @return {Vector3}
 */
export function projectPointOnPlane(point, P, N, result) {
    result = result || new Vector3();
    const v = Vector3.subtract(point, P, _temp1);
    const dist = Vector3.dot(v, N);
    return Vector3.subtract(point, Vector3.scale(N, dist, _temp2), result);
}


const _temp1 = new Vector3();
const _temp2 = new Vector3();
const _temp3 = new Vector3();
const _temp4 = new Vector3();
const _temp5 = new Vector3();
const _temp6 = new Vector3();
