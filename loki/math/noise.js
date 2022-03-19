import { equals } from "./math.js";

/**
 * Utility functions related to noise.
 * @category Math
 */
export class Noise {
     /**
      * 2D perlin noise function.
      * @param {*} x 
      * @param {*} y 
      */
    static perlinNoise2(x, y) {
        x = Math.abs(x);
        y = Math.abs(y);

        // Find the unit cube that contains the point.
        const xi = Math.floor(x);
        const yi = Math.floor(y);

        const X = xi & 0xff;
        const Y = yi & 0xff;

        x -= xi;
        y -= yi;

        // Compute fade curves for each x,y
        const u = _fade(Math.min(x, 1));
        const v = _fade(Math.min(y, 1));

        // Hash coordinates of the 8 cube corners.
        const A = _perm[X] + Y;
        const AA = _perm[A];
        const AB = _perm[A + 1];
        const B = _perm[X + 1] + Y;
        const BA = _perm[B];
        const BB = _perm[B + 1];

        const result = _lerp(v, _lerp(u, _grad2(_perm[AA], x, y),
                                      _grad2(_perm[BA], x - 1, y)),
                             _lerp(u, _grad2(_perm[AB], x, y - 1),
                                      _grad2(_perm[BB], x - 1, y - 1)));

        // normalize the results to [0,1]
        return (result + 0.69) / (0.793 + 0.69);
    }

    /**
     * 3D perlin noise function
     * @param {*} x 
     * @param {*} y 
     * @param {*} z 
     */
    static perlinNoise3(x, y, z) {
        x = Math.abs(x);
        y = Math.abs(y);
        z = Math.abs(z);

        // Find the unit cube that contains the point.
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const zi = Math.floor(z);
        const X = xi & 255;
        const Y = yi & 255;
        const Z = zi & 255;
        // Find relative x,y,z of point in cube.
        x -= xi;
        y -= yi;
        z -= zi;
        // Compute fade curves for each x,y,z
        const u = _fade(x);
        const v = _fade(y);
        const w = _fade(z);

        // Hash coordinates of the 8 cube corners.
        const A = _perm[X] + Y;
        const AA = _perm[A] + Z;
        const AB = _perm[A + 1] + Z;
        const B = _perm[X + 1] + Y;
        const BA = _perm[B] + Z;
        const BB = _perm[B + 1] + Z;

        const x1 = x - 1;
        const y1 = y - 1;
        const z1 = z - 1;

        // And add blended results from 8 corners of the cube.
        let result = _lerp(w,
                            _lerp(v, _lerp(u, _grad(_perm[AA], x, y, z),
                                            _grad(_perm[BA], x1, y, z)),
                                    _lerp(u, _grad(_perm[AB], x, y1, z),
                                            _grad(_perm[BB], x1, y1, z))),
                            _lerp(v, _lerp(u, _grad(_perm[AA + 1], x, y, z1),
                                            _grad(_perm[BA + 1], x1, y, z1)),
                                    _lerp(u, _grad(_perm[AB + 1], x, y1, z1),
                                            _grad(_perm[BB + 1], x1, y1, z1))));

        // normalize the results to [0,1]
        result = (result + 0.69) / (0.793 + 0.69);
        return result;
    }

    /**
     * A simple turbulence model, accumulating noise over the given number of frequencies.
     * @param {*} x 
     * @param {*} y 
     * @param {*} z 
     * @param {*} frequency 
     */
    static turbulence(x, y, z, frequency) {
        let t = 0;
        for (; frequency >= 1; frequency *= 0.5) {
            t += Noise.perlinNoise3(x * frequency, y * frequency, z * frequency);
        }
        return t;
    }

    /**
     * 2D perlin noise function
     * @param {*} x 
     * @param {*} y 
     */
    perlinNoise2(x, y) {
        return Noise.perlinNoise2(x, y);
    }

    /**
     * 3D perlin noise function
     * @param {*} x 
     * @param {*} y 
     * @param {*} z 
     */
    perlinNoise3(x, y, z) {
        return Noise.perlinNoise3(x, y, z);
    }

    /**
     * A simple turbulence model, accumulating noise over the given number of frequencies.
     * @param {*} x 
     * @param {*} y 
     * @param {*} z 
     * @param {*} frequency 
     */
    turbulence(x, y, z, frequency) {
        return Noise.turbulence(x, y, z, frequency);
    }

    /**
     * fractal brownian motion noise.
     * @param {*} x 
     * @param {*} y 
     * @param {*} z 
     * @param {*} octaves 
     * @param {*} H 
     * @param {*} lacunarity 
     */
    fbm(x, y, z, octaves, H, lacunarity) {
        this._cache.update(octaves, H, lacunarity);
        let value = 0;
        const exponentArray = this._cache.exponentArray;
        const levels = this._cache.levels;
        for (let i = 0; i < levels; ++i) {
            value += Noise.perlinNoise3(x, y, z) * exponentArray[i];
            x *= lacunarity;
            y *= lacunarity;
            z *= lacunarity;
        }

        const remainder = octaves -levels;
        if (!equals(remainder, 0)) {
            value += remainder * Noise.perlinNoise3(x, y, z) * exponentArray[levels];
        }

        return value;
    }
}

function _lerp(t, a, b) {
    return a + t * (b - a);
}

function _fade(t) {
    return (t * t * t) * ((t * ((t * 6) - 15)) + 10);
}

function _grad2(hash, x, y) {
    let h = hash & 0xf;
    let u = h < 8 ? x : y;
    let v = h < 4 ? y : (h == 12 || h == 14) ? x : 0;
    return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? v : -v);
}

function _grad(hash, x, y, z) {
    let h = hash & 15;
    let u = h < 8 ? x : y;
    let v = h < 4 ? y : h == 12 || h == 14 ? x : z;
    return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? v : -v);
}

const _perm = new Uint8Array([
    151,160,137,91,90,15,
    131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
    190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
    88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
    77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
    102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
    135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
    5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
    223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
    129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
    251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
    49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
    138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,
    151,160,137,91,90,15,
    131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
    190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
    88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
    77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
    102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
    135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
    5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
    223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
    129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
    251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
    49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
    138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180]);
