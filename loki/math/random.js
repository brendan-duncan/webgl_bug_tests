
/**
 * Psuedo Random Number Generator using the Xorshift128 algorithm
 * (https://en.wikipedia.org/wiki/Xorshift).
 * @category Math
 */
export class Random extends Uint32Array {
    constructor(seed) {
        super(6);
        this._seed = 0;
        this.seed = seed || new Date().getTime();
    }

    /**
     * @property {number} seed The random number seed.
     */
    get seed() { return this[0]; }

    set seed(seed) {
        this._seed = seed;
        this[0] = seed;
        this[1] = this[0] * 1812433253 + 1;
        this[2] = this[1] * 1812433253 + 1;
        this[3] = this[2] * 1812433253 + 1;
    }

    /**
     * Reset the random number generator to its initial state.
     */
    reset() {
        this.seed = this._seed;
    }

    /**
     * Generates a random number between [0,0xffffffff]
     * @return {number}
     */
    randomUint32() {
        // Xorwow scrambling
        let t = this[3];
        const s = this[0];
        this[3] = this[2];
        this[2] = this[1];
        this[1] = s;
        t ^= t >> 2;
        t ^= t << 1;
        t ^= s ^ (s << 4);
        this[0] = t;
        this[4] += 362437;
        this[5] = (t + this[4])|0;
        return this[5];
    }

    /**
     * Generates a random number between [0,1]
     * @param {number} [min] 
     * @param {number} [max] 
     * @return {number}
     */
    randomFloat(min, max) {
        let value = this.randomUint32();
        value = (value & 0x007fffff) * (1.0 / 8388607.0);
        if (min == undefined) {
            return value;
        }
        max = max == undefined ? 1 : max;
        return value * (max - min) + min;
    }

    /**
     * Generates a random number between [0,1) with 53-bit resolution
     * @param {number} [min] 
     * @param {number} [max] 
     * @return {number}
     */
    randomDouble(min, max) {
        const a = this.randomUint32() >>> 5;
        const b = this.randomUint32() >>> 6;
        const value = (a * 67108864 + b) * (1.0 / 9007199254740992.0);
        if (min == undefined) {
            return value;
        }
        max = max == undefined ? 1 : max;
        return value * (max - min) + min;
    }
}
