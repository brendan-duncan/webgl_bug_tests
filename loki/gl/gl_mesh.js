import { GLBuffer } from "./gl_buffer.js";
import { Log } from "../util/log.js";
import { ObjectUtil } from "../util/object_util.js";

/**
 * A GLMesh stores the vertex and index buffers necessary to render a mesh.
 * @category GL
 */
export class GLMesh {
    constructor(gl, vertexBuffers, indexBuffers, options) {
        this.gl = gl;

        this.vertexBuffers = {};
        this.indexBuffers = {};

        if (vertexBuffers || indexBuffers) {
            this.addBuffers(vertexBuffers, indexBuffers, options ? options.usage : null);
        }

        if (options) {
            for (const i in options) {
                this[i] = options[i];
            }
        }
    }

    /**
     * Static method to create a mesh from a list of common streams
     * @param {GLContext} gl 
     * @param {Object} buffers 
     * @param {Object?} options 
     * @return {GLMesh}
     */
    static load(gl, buffers, options) {
        options = options || {};
        const mesh = new GLMesh(gl, null, null, null);
        mesh.configure(buffers, options);
        return mesh;
    }

    /**
     * @property {number} numVertices The number of points to be drawn.
     */
    get numVertices() {
        const b = this.vertexBuffers["P"];
        if (!b) {
            return 0;
        }
        return b.data.length / b.itemSize;
    }

    /**
     * @property {number} numTriangles The number of triangles to be drawn.
     */
    get numTriangles() {
        const indicesBuffer = this.getIndexBuffer("triangles");
        if (!indicesBuffer) {
            return this.numVertices / 3;
        }
        return indicesBuffer.data.length / 3;
    }

    /**
     * Add a buffer to be used by the mesh.
     * @param {String} name 
     * @param {GLBuffer} buffer 
     */
    addBuffer(name, buffer) {
        if (buffer.target === this.gl.ARRAY_BUFFER) {
            this.vertexBuffers[name] = buffer;
        } else {
            this.indexBuffers[name] = buffer;
        }

        if (!buffer.attribute) {
            const info = GLMesh.CommonBuffers[name];
            if (info) {
                buffer.attribute = info.attribute;
            } else {
                buffer.attribute = name;
            }
        }
    }

    /**
     * Adds vertex and indices buffers to a mesh
     * @param {Object} vertexBuffers 
     * @param {Object} indexBuffers 
     * @param {number} usage STATIC_DRAW, DYNAMIC_DRAW, STREAM_DRAW
     */
    addBuffers(vertexBuffers, indexBuffers, usage) {
        let numVertices = 0;
        if (this.vertexBuffers["P"]) {
            numVertices = this.vertexBuffers["P"].itemCount;
        }

        for (const i in vertexBuffers) {
            let data = vertexBuffers[i];
            if (!data) {
                continue;
            }

            if (!GLMesh.CommonBuffers[i]) {
                continue;
            }

            // data could be a MeshBuffer or a GLBuffer
            const streamInfo = data.data !== undefined ? data : GLMesh.CommonBuffers[i];
            data = data.data !== undefined ? data.data : data;

            // cast to typed float32 if no type is specified
            if (data.constructor === Array) {
                let datatype = GLMesh.DefaultDataType;
                if (streamInfo && streamInfo.type) {
                    datatype = streamInfo.type;
                }
                data = new datatype(data);
            }

            // compute item size
            if (i === "P") {
                numVertices = data.length / 3;
            }
            
            const itemSize = streamInfo && streamInfo.itemSize ? streamInfo.itemSize :
                data.length / numVertices;

            // add and upload
            const attribute = streamInfo && streamInfo.attribute ? streamInfo.attribute : `a_${i}`;

            if (this.vertexBuffers[i]) {
                this.updateVertexBuffer(i, data, attribute, itemSize, usage);
            } else {
                this.createVertexBuffer(i, data, attribute, itemSize, usage);
            }
        }

        if (indexBuffers) {
            for (const i in indexBuffers) {
                let data = indexBuffers[i];
                if (!data) {
                    continue;
                }

                // data could be a MeshBuffer or GLBuffer
                if (data.data !== undefined) {
                    data = data.data;
                }

                // linearize
                if (data.length !== 0 && data[0].constructor !== Number) {
                    let newdata = [];
                    for (let i = 0, chunk = 10000; i < data.length; i += chunk) {
                        newdata = Array.prototype.concat.apply(newdata, data.slice(i, i + chunk));
                    }
                    data = newdata;
                }

                // cast to typed
                if (data.constructor === Array) {
                    let datatype = Uint16Array;
                    if (numVertices > 256 * 256) {
                        datatype = Uint32Array;
                    }
                    data = new datatype(data);
                }

                this.createIndexBuffer(i, data);
            }
        }
    }

    /**
     * Creates a new empty buffer and attachs it to this mesh
     * @param {String} name Name of the buffer
     * @param {ArrayBufferView} data the data in typed array format [optional, if ommited
     * it created an empty array of getNumVertices() * itemSize]
     * @param {String} attribute name of the stream in the shader "a_P","a_N",...
     * [optional, if omitted is used the common_buffers]
     * @param {number} itemSize itemSize components per vertex [optional, if ommited is used the
     * commonBuffers, if not found then uses 3]
     * @param {number?} usage STATIC_DRAW (default), DYNAMIC_DRAW, STREAM_DRAW
     * @return {GLBuffer}
     */
    createVertexBuffer(name, data, attribute, itemSize, usage) {
        const common = GLMesh.CommonBuffers[name];

        if (!attribute && common) {
            attribute = common.attribute;
        }

        if (!attribute) {
            throw("Buffer added to mesh without attribute name");
        }

        if (!itemSize && common) {
            if (common && common.itemSize) {
                itemSize = common.itemSize;
            } else {
                itemSize = 3;
            }
        }

        if (!data) {
            const num = this.getNumVertices();
            if (!num) {
                throw("Cannot create an empty buffer in a mesh without vertices (vertices are needed to know the size)");
            }
            data = new (GLMesh.DefaultDataType)(num * itemSize);
        }

        if (!data.buffer) {
            throw("Buffer data MUST be typed array");
        }

        // used to ensure the buffers are held in the same gl context as the mesh
        const buffer = GLBuffer.vertexBuffer(this.gl, itemSize, data, usage);
        buffer.name = name;
        buffer.attribute = attribute;
        this.vertexBuffers[name] = buffer;

        return buffer;
    }

    /**
     * Updates a vertex buffer
     * @param {String} name 
     * @param {*} data 
     * @param {String} attribute 
     * @param {number} itemSize 
     * @param {number} usage 
     */
    updateVertexBuffer(name, data, attribute, itemSize, usage) {
        const buffer = this.vertexBuffers[name];
        if (!buffer) {
            Log.warning("buffer not found: ", name);
            return;
        }

        if (!data.length) {
            return;
        }

        if (attribute !== undefined) {
            buffer.attribute = attribute;
        }

        if (itemSize !== undefined) {
            buffer.itemSize = itemSize;
        }

        //buffer.data = data;
        buffer.upload(data, usage);
    }

    /**
     * Removes a vertex buffer from the mesh
     * @param {String} name Name of the buffer
     * @param {bool} free if you want to remove the data from the GPU
     */
    removeVertexBuffer(name, free) {
        const buffer = this.vertexBuffers[name];
        if (!buffer) {
            return;
        }
        if (free) {
            buffer.delete();
        }
        delete this.vertexBuffers[name];
    }

    /**
     * Returns a vertex buffer with the given name.
     * @param {String} name 
     * @return {GLBuffer}
     */
    getVertexBuffer(name) {
        return this.vertexBuffers[name];
    }

    /**
     * Returns an index buffer with the given name.
     * @param {String} name 
     * @return {GLBuffer}
     */
    getIndexBuffer(name) {
        return this.indexBuffers[name];
    }

    /**
     * Creates a new empty index buffer and attachs it to this mesh
     * @param {String} name 
     * @param {*} data 
     * @param {number} usage 
     * @return {GLBuffer}
     */
    createIndexBuffer(name, data, usage) {
        // cast to typed
        if (data.constructor === Array) {
            let dataType = Uint16Array;
            const vertices = this.vertexBuffers["P"];
            if (vertices) {
                const numVertices = vertices.itemCount;
                if (numVertices > 256*256) {
                    dataType = Uint32Array;
                }
                data = new dataType(data);
            }
        }

        const buffer = GLBuffer.indexBuffer(this.gl, data, usage);
        this.indexBuffers[name] = buffer;

        return buffer;
    }

    /**
     * Removes an index buffer from the mesh
     * @param {String} name The name of the buffer
     * @param {bool} free if you want to remove the data from the GPU
     */
    removeIndexBuffer(name, free) {
        const buffer = this.indexBuffers[name];
        if (!buffer) {
            return;
        }
        if (free) {
            buffer.delete();
        }
        delete this.indexBuffers[name];
    }

    /**
     * Uploads data inside buffers to the GPU
     * @param {number} usage 
     */
    upload(usage) {
        for (const attribute in this.vertexBuffers) {
            const buffer = this.vertexBuffers[attribute];
            buffer.upload(buffer.data, usage);
        }

        for (const name in this.indexBuffers) {
            const buffer = this.indexBuffers[name];
            buffer.upload(buffer.data, usage);
        }
    }

    /**
     * Delete all buffers used by the mesh
     */
    deleteBuffers() {
        for (const i in this.vertexBuffers) {
            const buffer = this.vertexBuffers[i];
            buffer.destroy();
        }
        this.vertexBuffers = {};

        for (const i in this.indexBuffers) {
            const buffer = this.indexBuffers[i];
            buffer.destroy();
        }
        this.indexBuffers = {};
    }

    /**
     * Bind all vertex buffers to the shader by attribute name
     * @param {GLShader} shader 
     */
    bindBuffers(shader) {
        // enable attributes as necessary.
        for (const name in this.vertexBuffers) {
            const buffer = this.vertexBuffers[name];
            const attribute = buffer.attribute || name;
            const location = shader.attributeLocation(attribute);
            if (location === null || !buffer.buffer) {
                continue; 
            }
            buffer.bind(location);
        }
    }

    /**
     * Unbind all vertex buffers from the shader
     * @param {GLShader} shader 
     */
    unbindBuffers(shader) {
        // disable attributes
        for (const name in this.vertexBuffers) {
            const buffer = this.vertexBuffers[name];
            const attribute = buffer.attribute || name;
            const location = shader.attributeLocation(attribute);
            if (location === null || !buffer.buffer) {
                continue; // ignore this buffer
            }
            this.gl.disableVertexAttribArray(location);
        }
    }

    /**
     * Creates a clone of the mesh, duplicating the data arrays.
     * @param {GLContext} gl 
     * @return {GLMesh}
     */
    clone(gl) {
        const vbs = {};
        const ibs = {};

        for (const i in this.vertexBuffers) {
            const b = this.vertexBuffers[i];
            vbs[i] = new b.data.constructor(b.data);
        }

        for (const i in this.indexBuffers) {
            const b = this.indexBuffers[i];
            ibs[i] = new b.data.constructor(b.data);
        }

        return new GLMesh(gl, vbs, ibs);
    }

    /**
     * Creates a clone of the mesh, but the data arrays are shared between both meshes.
     * @param {GLContext} gl 
     * @return {GLMesh}
     */
    cloneShared(gl) {
        return new GLMesh(gl, this.vertexBuffers, this.indexBuffers);
    }

    serialize() {
        const r = {
            vertexBuffers: {},
            indexBuffer: {},
            info: this.info ? ObjectUtil.cloneObject(this.info) : null,
        };

        for (const i in this.vertexBuffers) {
            r.vertexBuffers[i] = this.vertexBuffers[i].serialize();
        }

        for (const i in this.indexBuffers) {
            r.indexBuffers[i] = this.indexBuffers[i].serialize();
        }

        return r;
    }

    configure(o) {
        const vertexBuffers = {};
        const indexBuffers = {};
        const options = {};

        for (const j in o) {
            if (!o[j]) {
                continue;
            }

            if (j === "indexBuffers") {
                for (const i in o[j]) {
                    indexBuffers[i] = o[j][i];
                }
                continue;
            } else if (j === "vertexBuffers") {
                for (const i in o[j]) {
                    vertexBuffers[i] = o[j][i];
                }
            } else if (GLMesh.CommonIndexBuffers.includes(j)) {
                indexBuffers[j] = o[j];
            } else if (GLMesh.CommonBuffers[j]) {
                vertexBuffers[j] = o[j];
            } else if (j === "info") {
                this.info = ObjectUtil.cloneObject(o.info);
            } else {
                options[j] = o[j];
            }
        }

        this.addBuffers(vertexBuffers, indexBuffers, options.usage);

        for (const i in options) {
            this[i] = options[i];
        }
    }

    /**
     * Remove all local memory from the streams (leaving it only in the VRAM) to save RAM
     */
    freeData() {
        for (const attribute in this.vertexBuffers) {
            this.vertexBuffers[attribute].data = null;
            delete this[this.vertexBuffers[attribute].name]; // delete from the mesh itself
        }
        for (const name in this.indexBuffers) {
            this.indexBuffers[name].data = null;
            delete this[this.indexBuffers[name].name]; // delete from the mesh itself
        }
    }

    /**
     * Returns a vertex buffer
     * @param {String} name 
     * @return {GLBuffer}
     */
    getBuffer(name) {
        return this.vertexBuffers[name];
    }

    /**
     * Returns the amount of memory used by this mesh in bytes (sum of all buffers)
     * @return {number}
     */
    totalMemory() {
        let size = 0|0;
        for (const name in this.vertexBuffers) {
            size += this.vertexBuffers[name].data.buffer.byteLength;
        }
        for (const name in this.indexBuffers) {
            size += this.indexBuffers[name].data.buffer.byteLength;
        }
        return size;
    }
}

GLMesh.DefaultDataType = Float32Array;

GLMesh.CommonBuffers = {
    "P": { itemSize: 3, attribute: "a_P" },
    "N": { itemSize: 3, attribute: "a_N" },
    "uv": { itemSize: 2, attribute: "a_uv" },
    "uv2": { itemSize: 2, attribute: "a_uv2" },
    "Cd": { itemSize: 4, attribute: "a_Cd" }, 
    "T": { itemSize: 3, attribute: "a_T" },
    "size": { itemSize: 1, attribute: "a_size" },
    "boneIndices": { itemSize: 4, attribute: "a_boneIndices", type: Uint8Array },
    "weights": { itemSize: 4, attribute: "a_weights" }
};

GLMesh.CommonIndexBuffers = [
    "indices",
    "lines",
    "triangles"
];
