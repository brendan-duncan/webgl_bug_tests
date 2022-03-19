import { Signal } from "./util/signal.js";

/* eslint-disable no-prototype-builtins */

/**
 * Singleton class stores helper functions and holds on to other singleton classes like the
 * AssetManager.
 */
export class Loki {
    /**
     * Returns true if the object is null or undefined.
     * @param {*} obj 
     */
    static isNullOrUndefined(obj) {
        return obj === null || obj === undefined;
    }

    /**
     * Checks if the given string is valid to use as an object name.
     * It must start with a letter, and can only contain letters, numbers or "_".
     * @param {String} v The string to check.
     * @return {bool} true if the string is valid, false otherwise.
     */
    static validateName(v) {
        if (!v || v.constructor !== String) return false;
        const exp = /^[a-z\s0-9\-_.]+$/i; // letters digits and dashes
        return v.match(exp);
    }

    /**
     * Returns true if the object is a function.
     * @param {*} obj 
     * @return {bool}
     */
    static isFunction(obj) {
        return !!(obj && obj.constructor && obj.call && obj.apply);
    }

    /**
     * Returns true if the object is an array.
     * @param {*} obj 
     * @return {bool}
     */
    static isArray(obj) {
        return obj && obj.constructor === Array;
    }

    /**
     * Returns true if the object is a typed array, such as Float32Array.
     * @param {*} obj 
     * @return {bool}
     */
    static isTypedArray(obj) {
        return obj && obj.buffer && obj.buffer.constructor === ArrayBuffer;
    }

    /**
     * Returns true if the object is either an Array or a TypedArray
     * @param {*} obj 
     * @return {bool}
     */
    static isArrayOrTypedArray(obj) {
        return Loki.isArray(obj) || Loki.isTypedArray(obj);
    }

    /**
     * Returns true if the object is a number.
     * @param {*} obj 
     * @return {bool}
     */
    static isNumber(obj) {
        return obj != null && obj.constructor === Number;
    }

    /**
     * Returns true if the object is a string.
     * @param {*} obj 
     * @return {bool}
     */
    static isString(obj) {
        return obj != null && obj.constructor === String;
    }

    /**
     * Returns true if the object is null, undefined, an object, map, array,
     * or string with no contents.
     * @param {*} obj 
     * @return {bool}
     */
    static isEmpty(obj) {
        if (obj === undefined || obj === null) { return true; }
        // If it's an object
        if (obj.constructor === Object) {
            return Object.entries(obj).length === 0;
        }
        // If it's an Array, Map, Set, or TypedArray
        if (obj.length !== undefined) {
            return obj.length === 0;
        }
        return false;
    }

    /**
     * Test if two values are equal.
     * @param {*} a 
     * @param {*} b 
     */
    static isEqual(a, b) {
        if (a === b) {
            return true;
        }
        if ((a === null || a === undefined) && ((b !== null) && (b !== undefined))) {
            return false;
        }
        if ((b === null || b === undefined) && ((a !== null) && (a !== undefined))) {
            return false;
        }
        if ((a === null && b === undefined) || (a === undefined && b === null)) {
            return true;
        }
        if (a.constructor !== b.constructor) {
            return false;
        }
        if (a.constructor === Number) {
            return false;
        }
        if (a.constructor === Array) {
            if (a.length !== b.length) {
                return false;
            }
            for (let i = 0, l = a.length; i < l; ++i) {
                if (!Loki.isEqual(a[i], b[i])) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    /**
     * Prepare a string to be used in a JSON strcture or be sent over a web request.
     * @param {String} s 
     * @return String
     */
    static escapeString(s) {
        const r = s
            .replace(/[\n]/g, "\\n")
            .replace(/[\r]/g, "\\r")
            .replace(/[\t]/g, "\\t")
            .replace(/[\b]/g, "\\b")
            .replace(/[\f]/g, "\\f")
            .replace(/[']/g, "\\'")
            .replace(/["]/g, '\\"')
            .replace(/[&]/g, "\\&");
        return r;
    }

    /**
     * Request all active GLContexts to draw.
     */
    static requestFrame() {
        if (Loki.skipDraws) return;
        Loki.onRequestFrame.emit();
    }

    /**
     * Request an update for the acive scene.
     */
    static requestUpdate() {
        if (Loki.scene) {
            Loki.scene.requestUpdate();
        }
    }

    /**
     * Set a variable value, used by variable nodes in a graph.
     * @param {String} name 
     * @param {*} value 
     */
    static setVariable(name, value) {
        const prevValue = Loki._variables.get(name);
        Loki._variables.set(name, value);
        if (prevValue != value) {
            Loki.onVariableChange.emit(name);
        }
    }

    /**
     * Check to see if a variable has been defined.
     * @param {String} name 
     * @return {bool}
     */
    static hasVariable(name) {
        return Loki._variables.has(name);
    }

    /**
     * Get a variable value, used by variable nodes in a graph.
     * @param {String} name 
     * @return {*}
     */
    static getVariable(name) {
        return Loki._variables.get(name);
    }
}

/**
 * @property {number} version The current version of the Loki engine
 */
Loki.version = 0.1;

/**
 * @property {Signal} onException Fired when an exception was caught.
 */
Loki.onException = new Signal();
/**
 * @property {Signal} onRefreshGraph Fired when the editor graph should be refreshed.
 */
Loki.onRefreshGraph = new Signal();
/**
 * @property {Signal} onXRSupportChanged Fired when the status of XR support has changed.
 */
Loki.onXRSupportChanged = new Signal();
/**
 * @property {Signal} onUserInteraction Fired when the user has interacted with the page,
 * allowing audio players to resume or unmute themselves.
 */
Loki.onUserInteraction = new Signal();
/**
 * @property {Signal} onRequestFrame Fired when a request has been made to redraw all of the
 * canvases.
 */
Loki.onRequestFrame = new Signal();
/**
 * @property {Signal} onVariableChange Fired when a variables value has changed.
 */
Loki.onVariableChange = new Signal();
/**
 * @property {Signal} onUpdateAsset Notify the Edtiro to update an asset.
 */
Loki.onUpdateAsset = new Signal();

/**
 * @property {bool} hasUserInteraction True when the user has interacted with the page,
 * allowing audio to be played.
 */
Loki.hasUserInteraction = false;

/**
 * @property {String} webPath The path to the web server.
 */
Loki.webPath = "";

/**
 * @property {bool} debug If true, extra debugging info will be logged.
 */
Loki.debug = true;

/**
 * @property {bool} catchExceptions If true, exception catching will be done in inner engine loops,
 * otherwise it won't use exception catching to improve performance.
 */

Loki.catchExceptions = true;

/**
 * @property {bool} allowScripts If false, user scripts won't be loaded.
 */
Loki.allowScripts = true;

/**
 * @property {bool} allowXR If false, WebXR will not be enabled.
 */
Loki.allowXR = false;

/**
 * @property {number} skipDraws When not 0, drawing will be disabled, to reduce draw calls during
 * scene loads.
 */
Loki.skipDraws = 0;

Loki._variables = new Map();

Loki.Types = {
    Boolean: "boolean",
    Integer: "int",
    Number: "number",
    String: "string",
    Enum: "enum",
    Vector2: "vec2",
    Vector3: "vec3",
    Vector4: "vec4",
    Color3: "color3",
    Color4: "color4",
    Matrix3: "mat3",
    Matrix4: "mat4",
    Event: "event",
    Asset: "asset",
    Image: "image",
    Texture: "texture",
    Cubemap: "cubemap",
    Mesh: "mesh",
    Object: "object",
    Model: "model",
    Scene: "scene",
    Node: "node",
    SceneObject: "node",
    SceneObjectId: "node_id",
    Component: "component",
    ComponentId: "component_id",
    Material: "material",
    Animation: "animation",
    Array: "array",
    Quaternion: "quaternion",
    Position: "position"
};

Loki.TypesIndex = {};
let index = 0;
for (const i in Loki.Types) {
    Loki.TypesIndex[Loki.Types[i]] = index;
    Loki.TypesIndex[Loki.Types[i].toUpperCase()] = index;
    index++;
}

/**
 * @property {bool} initialized Whether initializeLoki has been called.
 */
Loki.initialized = false;

/**
 * @property {Object} classes Maps classes name like "Prefab" or "Animation" to its namespace
 * "Loki.Prefab". Used in AssetLoader and AssetManager when reading classnames from JSONs.
 */
Loki.classes = {};

/**
 * @property {Object} components Contains all of the registered components.
 */
Loki.components = {};

/**
 * @property {Object} loaderClasses Classes that load assets
 */
Loki.loaderClasses = {};

/**
 * @property {Object} loaderExtensions File extensions registered to {@link AssetLoader}
 */
Loki.loaderExtensions = {};

/**
 * @property {Scene?} scene The current active scene
 */
Loki.scene = null;

if (typeof(Image) != "undefined") {
    Image.prototype.getPixels = function() {
        let canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        let ctx = canvas.getContext("2d");
        ctx.drawImage(this, 0, 0);
        return ctx.getImageData(0, 0, this.width, this.height).data;
    };
}

if (!String.prototype.hasOwnProperty("hashCode")) {
    Object.defineProperty(String.prototype, "hashCode", {
        value: function() {
            let hash = 0;
            if (this.length == 0) return hash;
            for (let i = 0, l = this.length; i < l; ++i) {
                const c  = this.charCodeAt(i);
                hash = ((hash << 5) - hash) + c;
                hash |= 0; // Convert to 32bit integer
            }
            return hash;
        },
        enumerable: false
    });
}

const _typedArrays = [Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array,
    Float32Array, Float64Array];

function _typedToArray() {
    return Array.from(this);
}

_typedArrays.forEach(function(v) { 
    if (!v.prototype.serialize) {
        Object.defineProperty(v.prototype, "toJSON", {
            value: _typedToArray,
            enumerable: false
        });
        Object.defineProperty(v.prototype, "serialize", {
            value: _typedToArray,
            enumerable: false
        });
    }
});
