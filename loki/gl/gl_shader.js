import { GL } from "./gl.js";
import { Log } from "../util/log.js";
import { Loki } from "../loki.js";

/**
 * A GLShader is a WebGL program with a bound vertex and fragment shader.
 * @category GL
 */
export class GLShader {
    constructor(gl, vertexShader, fragmentShader, macros) {
        this.gl = gl;
        this.valid = false;
        this._bound = false;
        this.attributeInfo = {};
        this.uniformInfo = {};
        this.textures = {};
        if (vertexShader) {
            this.createFromSource(vertexShader, fragmentShader, macros);
        }
    }

    destroy() {
        if (this.isBound) {
            this.unbind();
        }

        if (this.program) {
            this.gl.deleteProgram(this.program);
            delete this.program;
            delete this.uniformInfo;
            delete this.attributeInfo;
        }

        this.valid = false;
    }

    createFromSource(vertexShaderSrc, fragmentShaderSrc, macros) {
        const gl = this.gl;
        if (this.program) {
            this.destroy();
        }

        macros = macros || {};
        macros["WEBGL"] = gl.webglVersion;

        const extraCode = GLShader._expandMacros(macros);
        vertexShaderSrc = GLShader.injectCode(extraCode, vertexShaderSrc);
        fragmentShaderSrc = GLShader.injectCode(extraCode, fragmentShaderSrc);

        this.valid = false;
        this.attributeInfo = {};
        this.uniformInfo = {};
        this.textures = {};
        this.errors = "";
        this.vertexShaderSource = vertexShaderSrc;
        this.fragmentShaderSrc = fragmentShaderSrc;

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (!vertexShader) {
            return false;
        }

        gl.shaderSource(vertexShader, vertexShaderSrc);
        gl.compileShader(vertexShader);
        let status = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);
        const vertexShaderValid = status;
        if (!status) {
            this.errors += gl.getShaderInfoLog(vertexShader);
            console.log("-----------------------------------------------");
            console.log(vertexShaderSrc);
            console.log("-----------------------------------------------");
            Log.warning('Vertex Shader', this.errors);
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (!fragmentShader) {
            return false;
        }
        gl.shaderSource(fragmentShader, fragmentShaderSrc);
        gl.compileShader(fragmentShader);
        status = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);
        const fragmentShaderValid = status;
        if (!status) {
            this.errors += gl.getShaderInfoLog(fragmentShader);
            console.log("-----------------------------------------------");
            console.log(fragmentShaderSrc);
            console.log("-----------------------------------------------");
            Log.warning('Fragment Shader', this.errors);
        }

        if (!vertexShaderValid || !fragmentShaderValid) {
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            return false;
        }

        if (!this.program) {
            this.program = gl.createProgram();
        }

        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        status = gl.getProgramParameter(this.program, gl.LINK_STATUS);
        if (!status) {
            this.errors += gl.getProgramInfoLog(this.program);
        }

        // The shader objects are bound to the program object and aren"t needed
        // anymore.
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        this.valid = status;
        if (!this.valid) {
            Log.warning(this.errors);
            Log.warning(fragmentShaderSrc);
            return false;
        }

        // Get the uniforms from the shader.
        const numUniforms = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; ++i) {
            const u = gl.getActiveUniform(this.program, i);
            const location = gl.getUniformLocation(this.program, u.name);
            let name = u.name;
            const f = gl.getUniformFunction(u);

            // arrays have uniformName[0], strip the [] (also data.size tells you if it is an array)
            const pos = name.indexOf("[");
            if (pos != -1) {
                const pos2 = name.indexOf("]."); // leave array of structs though
                if (pos2 == -1) {
                    name = name.substr(0, pos);
                }
            }

            // store textures
            if (u.type == gl.SAMPLER_2D || u.type == gl.SAMPLER_CUBE || u.type == GL.SAMPLER_3D) {
                this.textures[name] = u.type;
            }

            let isMatrix = false;
            if (u.type == gl.FLOAT_MAT2 || u.type == gl.FLOAT_MAT3 || u.type == gl.FLOAT_MAT4) {
                isMatrix = true;
            }
            const typeLength = GL.TYPE_LENGTH[u.type] || 1;

            this.uniformInfo[name] = {
                type: u.type,
                size: u.size,
                location: location,
                function: f,
                typeLength: typeLength,
                isMatrix: isMatrix,
                data: null
            };
        }

        // Get the attributes from the shader.
        const na = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < na; ++i) {
            const a = gl.getActiveAttrib(this.program, i);
            const l = gl.getAttribLocation(this.program, a.name);
            this.attributeInfo[a.name] = {
                size: a.size,
                type: a.type,
                location: l
            };
        }

        return true;
    }

    /**
     * @property {bool} isBound Is the shader currently the active bound shader?
     */
    get isBound() {
        return this.gl.currentShader === this;
    }

    /**
     * Bind the shader as active for the context.
     */
    bind() {
        if (!this.valid) {
            return false;
        }
        if (this.gl.currentShader !== this) {
            if (this.gl.currentShader) {
                this.gl.currentShader.unbind();
            }
            this.gl.useProgram(this.program);
            this.gl.currentShader = this;
        }
        return true;
    }

    /**
     * Unbind the shader from the context.
     */
    unbind() {
        if (!this.valid) {
            return false;
        }

        if (this.gl.currentShader === this)  {
            for (const i in this.attributeInfo) {
                const a = this.attributeInfo[i];
                this.gl.disableVertexAttribArray(a.location);
            }
            this.gl.useProgram(null);
            this.gl.currentShader = null;
        }
        return true;
    }

    /**
     * Get the location of an attribute with the given name.
     * @param {String} name The name of the attribute.
     * @return {number} An int number indicating the location of the attribute name if found.
     * Returns -1 if the attribute wasn't found.
     */
    attributeLocation(name) {
        const a = this.attributeInfo[name];
        return a === undefined ? null : a.location;
    }

    /**
     * Get the location of a uniform with the given name.
     * @param {String} name The name of the uniform.
     * @return {WebGLUniformLocation} The location of the uniform.
     */
    uniformLocation(name) {
        const u = this.uniformInfo[name];
        return u === undefined ? null : u.location;
    }

    /**
     * Set multiple uniform values.
     * @param {*} uniformValues Can be a map, or an array of maps.
     * @example
     * setUniforms({ color: [1,1,1,1] });
     * setUniforms([{ color: [1,1,1,1] }, { worldToCamera: new Matrix4() }]);
     * @return {GLShader} Returns self.
     */
    setUniforms(uniformValues) {
        if (!uniformValues) {
            return this;
        }

        if (uniformValues.constructor === Array) {
            for (let i = 0, l = uniformValues.length; i < l; ++i) {
                this.setUniforms(uniformValues[i]);
            }
            return this;
        }

        const gl = this.gl;
        if (gl.currentShader !== this) {
            gl.useProgram(this.program);
            gl.currentShader = this;
        }

        if (Loki.isArray(uniformValues)) {
            for (const u of uniformValues) {
                for (const n in u) {
                    this.setUniform(n, u[n]);
                }
            }
            return this;
        }
    
        for (const name in uniformValues) {
            const info = this.uniformInfo[name];
            if (!info) {
                continue;
            }
            this.setUniform(info, uniformValues[name]);
        }
        return this;
    }

    /**
     * Set a uniform value given it's name.
     * 
     * The uniform locations will already have been cached when the shader was loaded. Attempting
     * to set a uniform value that doesn't exist in the shader will return without doing anything.
     * @param {String} name The name of the uniform.
     * @param {*} value The value to set it as.
     * @return {GLShader} Returns self.
     */
    setUniform(name, value) {
        const gl = this.gl;
        if (gl.currentShader !== this) {
            gl.useProgram(this.program);
            gl.currentShader = this;
        }

        const info = name.constructor === String ? this.uniformInfo[name] : name;
        if (!info) {
            return this;
        }

        if (info.location === null) {
            return this;
        }

        if (value === null || value === undefined) {
            return this;
        }

        if (value.constructor === Array) {
            if (!info.data) {
                info.data = new Float32Array(info.typeLength * info.size);
            }
            info.data.set(value);
            value = info.data;
        }

        if (info.isMatrix) {
            info.function.call(this.gl._gl, info.location, false, value);
        } else {
            info.function.call(this.gl._gl, info.location, value);
        }

        return this;
    }

    /**
     * Renders a mesh using this shader.
     * @param {GLMesh} mesh The mesh to draw
     * @param {number} mode The GL draw mode, could be gl.LINES, gl.POINTS, gl.TRIANGLES, 
     * gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN
     * @param {String} [indexBufferName] The name of the index buffer, if not provided "lines" 
     * will be assumed if mode is gl.LINES, otherwise "triangles".
     * @return {GLShader} Returns self.
     */
    drawMesh(mesh, mode, indexBufferName) {
        const gl = this.gl;
        indexBufferName = indexBufferName === undefined ? 
            (mode === gl.LINES ? "lines" : "triangles") : 
            indexBufferName;

        this.drawBuffers(mesh.vertexBuffers,
            indexBufferName ? mesh.indexBuffers[indexBufferName] : null,
            arguments.length < 2 ? gl.TRIANGLES : mode);

        return this;
    }

    /**
     * Draw a given sub-range from the given mesh.
     * @param {GLMesh} mesh The mesh to draw.
     * @param {number} mode 
     * @param {number} start 
     * @param {number} length 
     * @param {String} [indexBufferName]
     * @return {GLShader} Returns self.
     */
    drawRange(mesh, mode, start, length, indexBufferName) {
        const gl = this.gl;
        indexBufferName = indexBufferName === undefined ? 
            (mode === gl.LINES ? "lines" : "triangles") : 
            indexBufferName;

        this.drawBuffers(mesh.vertexBuffers, 
            indexBufferName ? mesh.indexBuffers[indexBufferName] : null,
            mode, start, length);

        return this;
    }

    /**
     * Draw the geometry defined by the given buffers using this shader.
     * @param {Object} vertexBuffers The vertex buffers to draw.
     * @param {GLBuffer} [indexBuffer] Optional index buffer to draw with
     * @param {number} mode The GL element mode to draw with
     * @param {number} [rangeStart]
     * @param {number} [rangeLength]
     * @return {GLShader} Returns self.
     */
    drawBuffers(vertexBuffers, indexBuffer, mode, rangeStart, rangeLength) {
        if (rangeLength === 0) {
            return this;
        }

        const gl = this.gl;

        if (gl.currentShader !== this) {
            gl.useProgram(this.program);
            gl.currentShader = this;
        }

        // enable attributes as necessary.
        let length = 0;
        // Use pre-allocated objects to avoid garbage collection
        const attribsInUse = GLShader._tempAttribsArray;
        attribsInUse.set(GLShader._tempAttribsArrayZero); // reset

        for (const name in vertexBuffers) {
            const buffer = vertexBuffers[name];
            if (!buffer) {
                continue;
            }
            const attribute = buffer.attribute || name;
            const a = this.attributeInfo[attribute];
            if (!a || !buffer.buffer) {
                continue;
            }
            // precompute attribute locations in shader
            const location = a.location;
            if (location === null) {
                continue;
            }

            attribsInUse[location] = 1; // mark it as used

            gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, buffer.buffer.itemSize, buffer.buffer.glType,
                false, 0, 0);

            length = buffer.buffer.length / buffer.buffer.itemSize;
        }

        // range rendering
        let offset = 0; // in bytes
        if (rangeStart > 0) { // render a polygon range
            offset = rangeStart; // in bytes (Uint16 == 2 bytes)
        }

        if (indexBuffer) {
            length = indexBuffer.buffer.length - offset;
        }

        if (rangeLength > 0 && rangeLength < length) {
            length = rangeLength;
        }

        const bytesPerElement = (indexBuffer && indexBuffer.data) ?
            indexBuffer.data.constructor.BYTES_PER_ELEMENT :
            1;
        offset *= bytesPerElement;

        // Force to disable buffers in this shader that are not in this mesh
        for (const attribute in this.attributeInfo) {
            const location = this.attributeInfo[attribute].location;
            if (!(attribsInUse[location])) {
                gl.disableVertexAttribArray(location);
            }
        }

        // Draw the geometry.
        if (length && (!indexBuffer || indexBuffer.buffer)) {
            if (indexBuffer) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer.buffer);
                gl.drawElements(mode, length, indexBuffer.buffer.glType, offset);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            } else {
                gl.drawArrays(mode, offset, length);
            }
        }

        return this;
    }

    static _expandMacros(macros) {
        let extraCode = "";
        if (macros) {
            for (const i in macros) {
                extraCode += `#define ${i} ${macros[i] ? macros[i] : ""}\n`;
            }
        }
        return extraCode;
    }

    /**
     * Injects macro code into the shader, but only after the #version line, which must be first.
     * @param {String} injectCode The code to inject.
     * @param {String} code The code to inject into.
     * @return {String} The resulting code.
     */
    static injectCode(injectCode, code) {
        const index = code.indexOf("\n");
        const firstLine = code.substr(0, index).trim();
        if (firstLine.indexOf("#version") === -1) {
            return injectCode + code;
        }
        return firstLine + "\n" + injectCode + code.substr(index);
    }
}

/**
 * @property {String} precision The default precision to use for shaders that don't explicitely
 * define it.
 */
GLShader.precision = "precision highp float;";

GLShader._tempAttribsArray = new Uint8Array(16);
GLShader._tempAttribsArrayZero = new Uint8Array(16);
