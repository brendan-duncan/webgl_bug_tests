import { Guid } from "./guid.js";
import { ObjectUtil } from "./object_util.js";
import { Signal } from "./signal.js";

/**
 * Base class providing common methods and properties for objects.
 * @category Util
 */
export class LokiObject {
    /**
     * @param {Object} [o] Optional configuration for the opbject
     */
    constructor(o) {
        const idPrefix = this.constructor._idPrefix || "";
        this._id = Guid.generate(idPrefix);
        this._name = "";

        this._onNameChanged = new Signal(); // (newName, oldName)
        this._onModified = new Signal(); // (node)

        if (o) {
            this.configure(o);
        }
    }

    /**
     * @property {Signal} onNameChanged Fired when the object's name changes.
     */
    get onNameChanged() { return this._onNameChanged; }

    /**
     * @property {Signal} onModified Fired when the object has been modified.
     */
    get onModified() { return this._onModified; }

    /**
     * @property {String} id The unique identifier of the object.
     */
    get id() { return this._id; }

    set id(v) { this._id = v; }

    /**
     * @property {String} name The name of the object.
     */ 
    get name() { return this._name; }

    set name(v) {
        if (this._name === v) {
            return;
        }
        const oldName = this._name;
        this._name = v;
        this.onNameChanged.emit(v, oldName);
    }

    /**
     * Fires the objects onModified signal.
     */
    setModified() {
        this.onModified.emit(this);
    }

    /**
     * Set the properties of the object from a JSON structure.
     * @param {Object} o Serialized data to configure the object with
     */
    configure(o) {
        ObjectUtil.cloneObject(o, this, false, true, false);
    }

    /**
     * Serialize the object to a JSON structure.
     * @return {Object} The serialized version of the object.
    */
    serialize() {
        const o = ObjectUtil.cloneObject(this, null, false, false, true);
        if (!o.class) {
            o.class = ObjectUtil.getObjectClassName(this);
        }
        if (!o.id) {
            o.id = this.id;
        }
        if (!o.name) {
            o.name = this.name;
        }
        return o;
    }

    /**
     * Serialize the object to a JSON structure
     * @return {Object} The serialized version of the object.
     */
    toJSON() {
        return this.serialize();
    }

    /**
     * Creates a clone of this object.
     * @param {{keepId: bool}?} options Options for the clone method.
     * @return {Object}
     */
    clone(options) {
        Signal.disable();
        const data = this.serialize();
        if (options && options.keepId) {
            delete data.id;
        }
        const newObject = new this.constructor(data);
        Signal.enable();
        return newObject;
    }

    /**
     * Get information about a particular property of this object.
     * @param {String} path 
     * @return {Object}
     */
    getPropertyInfo(path) {
        const parts = path.split("/");
        let obj = this;
        let value = null;
        let name = null;
        let o = this;

        for (let i = 0, l = parts.length; i < l; ++i) {
            name = parts[i];
            value = o[parts[i]];
            if (value === undefined) {
                return null;
            }
            obj = o;
            o = value;
        }

        if (value === null || value === undefined) {
            return null;
        }

        let type = null;
        const extraInfo = obj[`@${parts[parts.length - 1]}`];
        if (extraInfo) {
            type = extraInfo.type;
        }

        if (!type && value !== null && value !== undefined) {
            if (value.constructor === String) {
                type = "string";
            } else if (value.constructor === Boolean) {
                type = "boolean";
            } else if (value.length) {
                type = "vec" + value.length;
            } else if (value.constructor === Number) {
                type = "number";
            }
        }

        return {
            object: this,
            path: path,
            name: name,
            type: type,
            value: value
        };
    }

    static set enumerable(v) {
        ObjectUtil.setEnumerable(this, v);
    }
}

LokiObject.enumerable = ["id", "name"];
