import { Guid } from "../util/guid.js";
import { GL } from "./gl.js";

/**
 * A WebGL Sampler object stores texture sampling information, such as filtering and repeat
 * properties, so that different sampling properties can be applied to the same texture.
 * This object requires WebGL2.
 * @category GL
 */
export class GLSampler {
    /**
     * @param {GLContext} gl 
     * @param {Object} [options] Optional configuration for the sampler.
     * @param {number} [options.minFilter=GL.LINEAR]
     * @param {number} [options.magFilter=GL.LINEAR]
     * @param {number} [options.filter] Sets both minFilter and magFilter to the same value.
     * @param {number} [options.wrapS=GL.REPEAT]
     * @param {number} [options.wrapT=GL.REPEAT]
     * @param {number} [options.wrapR=GL.REPEAT]
     * @param {number} [options.wrap] Sets both wrapS and wrapT to the same value.
     */
    constructor(gl, options) {
        options = options || {};
        this.gl = gl;
        this.id = Guid.generate("GLSAMPLER");
        this._handle = null;

        this._minFilter = GL.LINEAR;
        this._magFilter = GL.LINEAR;
        this._wrapS = GL.CLAMP_TO_EDGE;
        this._wrapT = GL.CLAMP_TO_EDGE;
        this._wrapR = GL.CLAMP_TO_EDGE;

        this.create();
        this.configure(options);
    }

    /**
     * Set the properties of the sampler object.
     * @param {Object} options
     * @param {number} [options.minFilter=GL.LINEAR]
     * @param {number} [options.magFilter=GL.LINEAR]
     * @param {number} [options.filter] Sets both minFilter and magFilter to the same value.
     * @param {number} [options.wrapS=GL.REPEAT]
     * @param {number} [options.wrapT=GL.REPEAT]
     * @param {number} [options.wrapR=GL.REPEAT]
     * @param {number} [options.wrap] Sets wrapS, wrapT, and wrapR to the same value.
     */
    configure(options) {
        // If nothing is to change, bail out early to avoid updating the WebGL sampler.
        if (options.minFilter === this.minFilter &&
            options.magFilter === this.magFilter &&
            options.wrapS === this.wrapS &&
            options.wrapT === this.wrapT &&
            options.wrapR === this.wrapR) {
            return;
        }

        this.minFilter = options.minFilter || options.filter || this._minFilter;
        this.magFilter = options.magFilter || options.filter || this._magFilter;
        this.wrapS = options.wrapS || options.wrap || this._wrapS;
        this.wrapT = options.wrapT || options.wrap || this._wrapT;
        this.wrapR = options.wrapT || options.wrap || this._wrapR;
    }

    /**
     * @property {number} minFilter=GL.LINEAR The minification filter type. Can be:
     * GL.NEAREST, GL.LINEAR, GL.LINEAR_MIPMAP_LINEAR, GL.LINEAR_MIPMAP_NEAREST,
     * GL.NEAREST_MIPMAP_LINEAR, or GL.NEAREST_MIPMAP_NEAREST.
     */
    get minFilter() { return this._minFilter; }

    set minFilter(v) {
        if (this._minFilter == v) return;
        this._minFilter = v;
        this._dirty = true;
    }

    /**
     * @property {number} magFilter=GL.LINEAR The magnification filter type. Can be:
     * GL.NEAREST, or GL.LINEAR.
     */
    get magFilter() { return this._magFilter; }

    set magFilter(v) {
        if (this._magFilter == v) return;
        if (v === GL.LINEAR_MIPMAP_LINEAR || v === GL.LINEAR_MIPMAP_NEAREST) {
            this._magFilter = GL.LINEAR;
        } else if (v === GL.NEAREST_MIPMAP_LINEAR || v == GL.NEAREST_MIPMAP_NEAREST) {
            this._magFilter = GL.NEAREST;
        } else {
            this._magFilter = v;
        }
        this._dirty = true;
    }

    /**
     * @property {number} wrapS=GL.REPEAT The wrapS type. Can be:
     * GL.REPEAT, GL.CLAMP_TO_EDGE, or GL.MIRRORED_REPEAT
     */
    get wrapS() { return this._wrapS; }

    set wrapS(v) {
        if (v == this._wrapS) return;
        this._wrapS = v;
        this._dirty = true;
    }

    /**
     * @property {number} wrapT=GL.REPEAT The wrapT type. Can be:
     * GL.REPEAT, GL.CLAMP_TO_EDGE, or GL.MIRRORED_REPEAT
     */
    get wrapT() { return this._wrapT; }

    set wrapT(v) {
        if (v == this._wrapT) return;
        this._wrapT = v;
        this._dirty = true;
    }

    /**
     * @property {number} wrapR=GL.REPEAT The wrapR type. Can be:
     * GL.REPEAT, GL.CLAMP_TO_EDGE, or GL.MIRRORED_REPEAT
     */
    get wrapR() { return this._wrapR; }

    set wrapR(v) {
        if (v == this._wrapR) return;
        this._wrapR = v;
        this._dirty = true;
    }

    /**
     * @property {WebGLSampler?} handle The WebGL handle for the sampler object, null if it hasn't
     * been created.
     */
    get handle() { return this._handle; }

    /**
     * @property {bool} isValid True if the sampler object has been created.
     */
    get isValid() { return this._handle !== null; }

    /**
     * @property {bool} mipmap=false True if the filtering requires the texture to have a mipmap.
     * Setting this property will change the minFilter.
     */
    get mipmap() {
        const f = this._minFilter;
        return f === GL.LINEAR_MIPMAP_LINEAR ||  f === GL.LINEAR_MIPMAP_NEAREST ||
               f === GL.NEAREST_MIPMAP_LINEAR || f === GL.NEAREST_MIPMAP_NEAREST;
    }

    set mipmap(v) {
        const f = this._minFilter;
        if (!v) {
            if (f === GL.LINEAR_MIPMAP_LINEAR ||  f === GL.LINEAR_MIPMAP_NEAREST) {
                this.minFilter = GL.LINEAR;
                this.update();
            } else if (f === GL.NEAREST_MIPMAP_LINEAR || f === GL.NEAREST_MIPMAP_NEAREST) {
                this.minFilter = GL.NEAREST;
                this.update();
            }
        } else {
            if (f === GL.LINEAR) {
                this.minFilter = GL.LINEAR_MIPMAP_LINEAR;
                this.update();
            } else if (f === GL.NEAREST) {
                this.minFilter = GL.NEAREST_MIPMAP_NEAREST;
                this.update();
            }
        }
    }

    /**
     * Create the sampler object.
     */
    create() {
        if (this._handle) {
            return;
        }
        this._handle = this.gl.createSampler();
        this._dirty = true;
    }

    /**
     * Destroy the sampler object.
     */
    destroy() {
        if (!this._handle) {
            return;
        }
        this.gl.deleteSampler(this._handle);
        this._handle = null;
    }

    /**
     * Apply the properties to the sampler object.
     */
    update() {
        if (!this._handle) {
            return;
        }
        const gl = this.gl;
        gl.samplerParameteri(this._handle, gl.TEXTURE_MIN_FILTER, this._minFilter);
        gl.samplerParameteri(this._handle, gl.TEXTURE_MAG_FILTER, this._magFilter);
        gl.samplerParameteri(this._handle, gl.TEXTURE_WRAP_S, this._wrapS);
        gl.samplerParameteri(this._handle, gl.TEXTURE_WRAP_T, this._wrapT);
        gl.samplerParameteri(this._handle, gl.TEXTURE_WRAP_R, this._wrapR);
        this._dirty = false;
    }

    /**
     * Bind the sampler to the given texture unit.
     * @param {number} textureUnit The texture unit index, starting from 0.
     */
    bind(textureUnit, texture) {
        textureUnit = textureUnit ?? 0;

        const gl = this.gl;

        gl.activeTexture(gl.TEXTURE0 + textureUnit);

        if (texture) {
            texture.constructor.setBoundTexture(gl, textureUnit, texture);
            if (texture.target === gl.TEXTURE_2D) {
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
            } else {
                gl.bindTexture(gl.TEXTURE_2D, null);
            }
            gl.bindTexture(texture.target, texture.handle);
            if (this.mipmap && !texture.hasMipmap) {
                gl.texParameteri(texture.target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                texture.generateMipmap();
            }
        }

        if (this._dirty) {
            this.update();
        }

        gl.bindSampler(textureUnit, this._handle);
    }

    /**
     * Set the sampler object assigned to the texture unit to null.
     * @param {number} textureUnit The texture unit index, starting from 0.
     */
    unbind(textureUnit) {
        this.gl.bindSampler(textureUnit ?? 0, null);
    }
}

GLSampler.isGLSampler = true;
