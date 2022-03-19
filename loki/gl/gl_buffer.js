import { Log } from "../util/log.js";

/**
 * WebGL buffer, used for Vertex and Index buffers.
 * @category GL
 */
export class GLBuffer {
    constructor(gl, target, itemSize, data, usage) {
        this.gl = gl;
        this.buffer = null; // WebGL buffer
        this.target = target; // ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER
        this.attribute = null; // name of the attribute in the shader
        this.itemSize = itemSize || (target === gl.ELEMENT_ARRAY_BUFFER ? 1 : 3);
        if (data) {
            this.upload(data, usage);
        }
    }

    static vertexBuffer(gl, itemSize, data, usage) {
        return new GLBuffer(gl, gl.ARRAY_BUFFER, itemSize, data, usage);
    }

    static indexBuffer(gl, data, usage) {
        return new GLBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, 1, data, usage);
    }

    /**
     * Binds the buffer to an attribute location.
     * @param {*} location 
     */
    bind(location) {
        const gl = this.gl;
        gl.bindBuffer(this.target, this.buffer);
        if (location !== undefined) {
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, this.itemSize, this.buffer.glType, false, 0, 0);
        }
    }

    /**
     * Unbinds the buffer from an attribute location.
     * @param {*} location 
     */
    unbind(location) {
        if (location !== undefined) {
            this.gl.disableVertexAttribArray(location);
        }
    }

    /**
     * Uploads the buffer data (stored in this.data) to the GPU.
     * @param {TypedArray} data
     * @param {number} usage default gl.STATIC_DRAW (other: gl.DYNAMIC_DRAW, gl.STREAM_DRAW)
     */
    upload(data, usage) {
        const gl = this.gl;
        usage = usage || gl.STATIC_DRAW;
        const itemSize = this.itemSize;

        this.buffer = this.buffer || gl.createBuffer();
        if (!this.buffer) {
            return;
        }

        this.buffer.length = data.length;
        this.buffer.itemSize = itemSize;
    
        // store the data format
        switch (data.constructor) {
            case Int8Array: this.buffer.glType = gl.BYTE; break;
            case Uint8ClampedArray: 
            case Uint8Array: this.buffer.glType = gl.UNSIGNED_BYTE; break;
            case Int16Array: this.buffer.glType = gl.SHORT; break;
            case Uint16Array: this.buffer.glType = gl.UNSIGNED_SHORT; break;
            case Int32Array: this.buffer.glType = gl.INT; break;
            case Uint32Array: this.buffer.glType = gl.UNSIGNED_INT; break;
            case Float32Array: this.buffer.glType = gl.FLOAT; break;
            default: throw "unsupported buffer type";
        }
    
        if (this.target == gl.ARRAY_BUFFER && 
            (this.buffer.glType == gl.INT || this.buffer.glType == gl.UNSIGNED_INT)) {
            Log.warning("WebGL does not support UINT32 or INT32 as vertex buffer types,",
                "converting to FLOAT");
            this.buffer.glType = gl.FLOAT;
            data = new Float32Array(data);
        }

        gl.bindBuffer(this.target, this.buffer);
        gl.bufferData(this.target, data, usage || this.usage || gl.STATIC_DRAW);
    }

    /**
     * Uploads part of the buffer data (stored in this.data) to the GPU
     * @param {number} start offset in bytes
     * @param {number} size sizes in bytes
     */
    uploadRange(data, start, size) {
        if (!data) {
            throw "No data stored in this buffer";
        }

        if (!data.buffer) {
            throw "Buffers must be typed arrays";
        }

        // Cut fragment to upload (no way to avoid GC here, no function to specify the size in
        // WebGL 1.0, but there is one in WebGL 2.0)
        const view = new Uint8Array(data.buffer, start, size);

        const gl = this.gl;
        gl.bindBuffer(this.target, this.buffer);
        gl.bufferSubData(this.target, start, view);
    }

    /**
     * Delete the WebGL data for the buffer.
     */
    destroy() {
        const gl = this.gl;
        gl.deleteBuffer(this.buffer);
        this.buffer = null;
    }
}
