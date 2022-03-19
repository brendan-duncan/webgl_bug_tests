import { Signal } from "./signal.js";
import { Log } from "./log.js";
import { Loki } from "../loki.js";

/* eslint-disable no-prototype-builtins */

/**
 * Utility functions related to Javascript Objects.
 * @category Util
 */
export class ObjectUtil {
    /**
     * Does the object have the given property?
     * @param {Object} object The object to check
     * @param {String} property The name of the property
     * @return {bool}
     */
    static hasProperty(object, property) {
        return Object.prototype.hasOwnProperty.call(object, property);
    }

    /**
     * Return the string name of the class.
     * @param {Object} object
     * @return {bool}
     */
    static getClassName(object) {
        if (object === undefined || object === null) {
            return "undefined";
        }

        if (object.constructor === Function && object.name) {
            return object.name;
        }

        return typeof(object);
    }

    /**
     * Return the name of the class the object was created from.
     * @param {Object} object 
     * @retrn {String?}
     */
    static getObjectClassName(object) {
        if (object === undefined || object === null) {
            return null;
        }

        if (object.constructor.fullname) {
            return object.constructor.fullname;
        }

        if (object.constructor.name) {
            return object.constructor.name;
        }

        const array = object.constructor.toString().match(/function\s*(\w+)/);
        if (array && array.length == 2) {
            return array[1];
        }

        return null;
    }

    /**
     * Checks if the object is empty, meaning it's null, an Object with no properties, or an
     * empty array or string.
     * @param {Object} object 
     * @return {bool}
     */
    static isEmpty(object) {
        // null and undefined are empty
        if (!object === null || object === undefined) return true;

        // Empty strings are empty
        if (object === "") return true;

        // Assume if it has a length property with a non-zero value
        // that that property is correct.
        if (object.length > 0) return false;
        if (object.length === 0)  return true;

        // If it isn't an object at this point, consider it "empty"
        if (object.constructor !== Object) return true;

        const _hasOwnProperty = Object.prototype.hasOwnProperty;

        // Otherwise, does it have any properties of its own?
        for (const key in object) {
            if (_hasOwnProperty.call(object, key)) return false;
        }

        return true;
    }

    /**
     * Defines a set of properties as being enumerable or not for a class. Enumberable properties
     * will show up when you do things like `for (const property in object)`
     * @param {class} classObject 
     * @param {*} properties String or Array of strings for the properties to set
     * @param {bool} enumerable Whether the properties should be considered enumerable or not
     */
    static setEnumerable(classObject, properties, enumerable = true) {
        if (properties.constructor === Array) {
            for (const property of properties) {
                Object.defineProperty(classObject.prototype, property, {enumerable: enumerable});
            }
        } else {
            Object.defineProperty(classObject.prototype, properties, {enumerable: enumerable});
        }
    }

    /**
     * This is a bit more robust than standard Javascript instanceof as it can handle 
     * constructor functions. For example, the following wouldn't work with instanceof:
     * import * as assets from "./assets/index.js",
     * for (let i in assets) { ObjectUtil.instanceOf(assets[i], Asset); }
     * @param {*} constructor 
     * @param {*} parentClass 
     * @return {bool}
     */
    static instanceOf(constructor, parentClass) {
        if (!constructor) {
            return false;
        }
        if (constructor instanceof parentClass) {
            return true;
        }
        while (constructor && constructor !== parentClass) {
            constructor = Object.getPrototypeOf(constructor);
        }
        return constructor === parentClass;
    }

    /**
     * Copy the methods from origin to taget.
     * @param {Object} target The class to extend
     * @param {Object} origin The mixin to copy from
     */
    static extendClass(target, origin, override) {
        // Copy class properties
        const classProperties = Object.getOwnPropertyNames(origin);
        for (const i of classProperties) {
            if (i === "constructor") { continue; }
            if ((target.hasOwnProperty(i) || target.__proto__[i]) && !override) {
                continue;
            }

            if (origin.__lookupGetter__(i)) {
                const enumerable = origin.propertyIsEnumerable(i);
                Object.defineProperty(target, i, {
                    enumerable: enumerable,
                    get: origin.__lookupGetter__(i),
                    set: origin.__lookupSetter__(i)
                });
                continue;
            }

            target[i] = origin[i];
        }

        // Copy prototype properties
        if (origin.prototype) {
            const prototypeProperties = Object.getOwnPropertyNames(origin.prototype);
            // only enumerable
            for (const i of prototypeProperties) {
                if (!origin.prototype.hasOwnProperty(i) || target.prototype.hasOwnProperty(i)) {
                    continue;
                }

                if (origin.prototype.__lookupGetter__(i)) {
                    const enumerable = origin.prototype.propertyIsEnumerable(i);
                    Object.defineProperty(target.prototype, i, {
                        enumerable: enumerable,
                        get: origin.prototype.__lookupGetter__(i),
                        set: origin.prototype.__lookupSetter__(i)
                    });
                    continue;
                }

                target.prototype[i] = origin.prototype[i];
            }
        }
    }

    /**
     * Convert the string to a value, which can be a Number or Object,
     * @param {String} v 
     * @return {*}
     */
    static stringToValue(v) {
        let value = v;
        try {
            value = JSON.parse(v);
        } catch (err) {
            Log.error("Not a valid value:", v);
        }
        return value;
    }

    /**
     * Find a property descriptor of a property on an object, even if the property was defined
     * by an ancestor class.
     * @param {Object} object 
     * @param {*} property 
     */
    static getPropertyDescriptor(object, property) {
        if (!object) {
            return null;
        }
        let desc;
        do {
            desc = Object.getOwnPropertyDescriptor(object, property);
        } while (!desc && (object = Object.getPrototypeOf(object)));
        return desc;
    }

    /**
     * Copy a value from defaults to options if it is not defined in options.
     * @param {Object} options 
     * @param {Object} defaults 
     */
    static setDefaultOptions(options, defaults) {
        options = options || {};
        for (const i in defaults) {
            if (options[i] === undefined) {
                options[i] = defaults[i];
            }
        }
        return options;
    }

    /**
     * Clone an object, recursively. Only allows objects containing numbers, strings,
     * typed arrays, and other objects.
     * - It skips attributes starting with "_", "@", or "jQuery", and functions.
     * - It tries to see which is the best copy to perform
     * @param {Object} object The object to clone
     * @param {Object?} target the destination object. If null, a new object is
     * @param {bool?} recursive if you want to encode objects recursively.
     * @param {bool?} onlyExisting only assign to methods existing in the target
     * @param {bool?} encodeObjects if a special object is found, encode it as ["@ENC",node,object]
     * @return {Object?} Returns the cloned object.
     */
    static cloneObject(object, target, recursive, onlyExisting, encodeObjects) {
        if (object === undefined || object === null) {
            return object;
        }

        // base type
        switch (object.constructor) {
            case String:
            case Number:
            case Boolean:
                return object;
        }

        // Typed array
        if (object.constructor.BYTES_PER_ELEMENT) {
            if (!target) {
                return new object.constructor(object);
            }
            if (target.set) {
                target.set(object);
            } else if (target.construtor === Array) {
                for (let i = 0; i < object.length; ++i) {
                    target[i] = object[i];
                }
            } else {
                throw "cloneObject: target has no set method";
            }
            return target;
        }

        let o = target;
        if (o === undefined || o === null) {
            if (object.constructor === Array) {
                o = [];
            } else {
                o = {};
            }
        }

        // Copy every property of this object
        for (const i in object) {
            // Skip vars with _ (they are private) or '@' (they are definitions)
            if (i[0] === "@" || i[0] === "_" || i.substr(0,6) === "jQuery") {
                continue;
            }

            if (onlyExisting) {
                const propDesc = ObjectUtil.getPropertyDescriptor(target, i);
                if (!propDesc || (!propDesc.writable && !propDesc.set)) {
                    continue;
                }
            }

            const v = object[i];

            if (v === null || v === undefined) {
                o[i] = null;
            } else if (v.constructor === Signal) {
                continue;
            } else if (Loki.isFunction(v)) {
                continue;
            } else if (v.constructor === File) {
                o[i] = null;
            } else if (v.constructor === Number || v.constructor === String || 
                       v.constructor === Boolean) { 
                // elemental types
                o[i] = v;
            } else if (v.buffer && v.byteLength && v.buffer.constructor === ArrayBuffer) {
                // typed arrays are ugly when serialized
                if (o[i] && v && onlyExisting)  {
                    // typed arrays force to fit in the same container
                    if (o[i].length == v.length) {
                        o[i].set(v);
                    }
                } else {
                    o[i] = new v.constructor(v); // clone typed array
                }
            } else if (v.constructor === Array) {
                // Clone regular array (container and content)
                // Not safe to use concat or slice(0) because it doesnt clone content, only
                // the container.

                // Reuse old container
                if (o[i] && o[i].set && o[i].length >= v.length) {
                    o[i].set(v);
                    continue;
                }

                if (encodeObjects && target && v[0] == "@ENC") { 
                    // encoded object (component, node...)
                    let decodedObj = ObjectUtil.decodeObject(v);
                    o[i] = decodedObj;
                    if (!decodedObj) { 
                        // object not found
                        if (ObjectUtil._pendingEncodedObjects) {
                            ObjectUtil._pendingEncodedObjects.push([o, i, v]);
                        } else {
                            Log.warning("Object ID referencing object not found in the scene:",
                                v[2]);
                        }
                    }
                } else {
                    o[i] = ObjectUtil.cloneObject(v);
                }
            } else if (v.constructor.isAsset) {
                if (v.path) {
                    o[i] = v.path;
                } else {
                    o[i] = v.serialize();
                }
            } else {
                // Objects: 
                if (encodeObjects && !target) {
                    o[i] = ObjectUtil.encodeObject(v);
                    continue;
                }

                if (v.constructor !== Object && !target && !v.serialize) {
                    Log.warning("Cannot clone internal classes:", ObjectUtil.getObjectClassName(v),
                        "When serializing an object I found a var with a class that doesnt support",
                        "serialization. If this var shouldnt be serialized start the name with",
                        " underscore.");
                    continue;
                }

                if (v.serialize) {
                    o[i] = v.serialize();
                } else if (recursive) {
                    o[i] = ObjectUtil.cloneObject(v, null, true);
                } else {
                    if (v.constructor !== Object && Loki.classes[ObjectUtil.getObjectClassName(v)]) {
                        Log.warning("Cannot clone internal classes:", ObjectUtil.getObjectClassName(v),
                            "When serializing an object I found a var with a class that doesn't",
                            "support serialization. If this var shouldnt be serialized start the",
                            "name with underscore.");
                    }

                    if (Loki.catchExceptions) {
                        try {
                            // Prevent circular recursions. Slow but safe.
                            o[i] = JSON.parse(JSON.stringify(v));
                        } catch (err) {
                            Log.error(err);
                        }
                    } else {
                        // Slow but safe
                        o[i] = JSON.parse(JSON.stringify(v));
                    }
                }
            }
        }
        return o;
    }

    /**
     * 
     * @param {Object} obj 
     */
    static encodeObject(obj) {
        // regular objects
        if (!obj || obj.constructor === Number || obj.constructor === String || 
            obj.constructor === Boolean || obj.constructor === Object) {
            return obj;
        }

        // in case the value of this property is a component in the scene
        if (obj.constructor.isComponentClass && obj._object) {
            return ["@ENC", Loki.Types.Component, obj.id];
        }

        // in case the value of this property is a node in the scene
        if (obj.constructor.isSceneObject && obj.scene) {
            return ["@ENC", Loki.Types.SceneObject, obj.id];
        }

        if (obj.constructor.isScene) {
            return ["@ENC", Loki.Types.Scene, obj.id];
        }

        if (obj.serialize) {
            return ["@ENC", Loki.Types.Object, obj.serialize(),
                ObjectUtil.getObjectClassName(obj)];
        }

        Log.warning("Cannot clone internal classes:",
            ObjectUtil.getObjectClassName(obj),
            "when serializing an object I found a property with a class that doesn't support",
            "serialization. If this property shouldn't be serialized start the name with",
            "underscore.");

        return null;
    }

    /**
     * 
     * @param {Object} data 
     */
    static decodeObject(data) {
        if (!data || data.constructor !== Array || data[0] != "@ENC") {
            return null;
        }

        switch (data[1]) {
            case Loki.Types.Component:
            case Loki.Types.SceneObject:
                return null;
            case Loki.Types.Scene:
                return null;
            case Loki.Types.Object:
            default: {
                let objectClass = data[3];
                if (!data[2] || !objectClass) {
                    return null;
                }
                if (data[2].class) {
                    objectClass = data[2].class;
                }
                const ctor = Loki.classes[objectClass];
                if (!ctor) {
                    return null;
                }
                const v = new ctor();
                if (v.configure) {
                    v.configure(data[2]);
                } else {
                    ObjectUtil.cloneObject(data[2], v, false, true, false);
                }
                return v;
            }
        }
    }
}
