import { Time } from "./time.js";

/**
 * Generates a guaranteed unique identifier.
 * @category Util
 */
export class Guid {
    /**
     * Generate a new unique identifier.
     * @param {String} [prefix] Optional prefix to prepend to the identifier.
     * @param {String} [suffix] Optional suffix to append to the identifier.
     * @return {String} The new Guid string.
     */
    static generate(prefix, suffix) {
        prefix = prefix || "";
        suffix = suffix || "";
        const hash = window.navigator.userAgent.hashCode() % 0x1000000;
        const time = (Math.ceil((Date.now() + Time.now())) % 0x1000000);
        const uid = Guid._lastId;
        Guid._lastId = (Guid._lastId + Date.now()) % 0x1000000;
        let str = Guid.guidPrefix + prefix + hash.toString(16) + "-"; // user agent
        str += time.toString(16) + "-"; // date
        str += Math.floor((1 + Math.random()) * 0x1000000).toString(16) + "-"; // rand
        str += uid.toString(16); // sequence
        str += suffix;
        return str;
    }
}

Guid._lastId = Date.now() % 0x1000000;
Guid.guidPrefix = "@";
