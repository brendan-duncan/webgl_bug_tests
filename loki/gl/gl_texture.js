import { GL } from "./gl.js";
import { Signal } from "../util/signal.js";
import { Loki } from "../loki.js";
import { Guid } from "../util/guid.js";
import { GLFramebuffer } from "./gl_frame_buffer.js";

/**
 * A WebGL texture object.
 * @category GL
 */
export class GLTexture {
    /**
     * @param {GLContext} gl 
     * @param {Object?} options 
     */
    constructor(gl, options) {
        options = options || {};
        this.gl = gl;
        this.id = Guid.generate("GLTXT");
        this.handle = null;
        this.isVideo = false;
        this.src = "";
        this.width = 0;
        this.height = 0;
        this._hasMipmap = false;
        this._numLevels = 0;

        this.init(options);

        this.onLoad = new Signal();

        const source = options.source;
        const w = options.width || options.w || 0;
        const h = options.height || options.h || 0;

        if (source !== undefined) {
            this.configure(source, options);
        } else if (w && h) {
            const type = this.type;
            const format = this.format;
            const internalFormat = this.internalFormat;
            const target = this.target;
            const data = options.data || null;
            const level = options.level || 0;
            this.create(w, h, { type: type, internalFormat: internalFormat, format: format,
                target: target, data: data, level: level, generateMipmap: options.generateMipmap });
        }
    }

    /**
     * Initialize the texture with the given set of options.
     * @param {Object?} options 
     */
    init(options) {
        options = options || {};

        const gl = this.gl;
        if (!gl) {
            return;
        }

        this.minFilter = options.minFilter || options.filter || gl.LINEAR;
        this.magFilter = options.magFilter || options.filter || gl.LINEAR;
        this.wrapS = options.wrapS || options.wrap || gl.CLAMP_TO_EDGE;
        this.wrapT = options.wrapT || options.wrap || gl.CLAMP_TO_EDGE;

        this.format = options.format || gl.RGBA;
        this.internalFormat = options.internalFormat;
        this.type = options.type || gl.UNSIGNED_BYTE;
        this.anisotropy = !options.anisotropy ? 1 :
            options.anisotropy < 0 ? gl.maxAnisotropy :
            Math.min(options.anisotropy, gl.maxAnisotropy);
        this.flipY = options.flipY || false;
        this.target = options.target || gl.TEXTURE_2D;

        if (!this.internalFormat) {
            this._updateInternalFormat();
        }
    }

    /**
     * @property {bool} hasMipmap True if the texture has a mipmap.
     */
    get hasMipmap() { return this._hasMipmap; }

    /**
     * @property {number} numMipmapLevels The number of mipmap levels created for the texture.
     */
    get numMipmapLevels() { return this._numLevels; }

    _clearMipmap() {
        this._hasMipmap = false;
        this._numLevels = 0;
    }

    configure(source, options) {
        options = options || {};
        const level = options.level || 0;

        const gl = this.gl;
        if (!source) {
            return false;
        }

        this.flipY = true;

        if (source.constructor === String) {
            this.src = source;
            const self = this;
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onerror = function(e) {
                console.error("FAILED TO LOAD", source, e);
            };
            image.onload = function() {
                gl.activeTexture(gl.TEXTURE0 + gl.maxTextureUnits - 1);
                if (!self.handle) {
                    self.handle = gl.createTexture();
                }
                gl.bindTexture(gl.TEXTURE_2D, self.handle);

                self._applyTextureParameters();

                if (self.width !== image.width || self.height !== image.height ||
                    self.format !== gl.RGBA || self.type !== gl.UNSIGNED_BYTE) {
                    self.width = image.width;
                    self.height = image.height;
                    self.format = gl.RGBA;
                    self.type = gl.UNSIGNED_BYTE;

                    gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA, gl.RGBA, 
                        gl.UNSIGNED_BYTE, image);
                } else {
                    gl.texSubImage2D(gl.TEXTURE_2D, level, 0, 0, gl.RGBA,
                        gl.UNSIGNED_BYTE, image);
                }

                self._clearMipmap();
                if (options.generateMipmap) {
                    self.generateMipmap();
                }

                gl.bindTexture(gl.TEXTURE_2D, null);
                gl.activeTexture(gl.TEXTURE0);

                self.onLoad.emit(self);
                self.isLoaded = true;
            };

            image.src = source;
            if (options.generateMipmap) {
                this.generateMipmap();
            }
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.activeTexture(gl.TEXTURE0);
            return true;
        }

        let isVideo = false;
        let width = 1;
        let height = 1;
        if (source instanceof HTMLCanvasElement) {
            width = source.width;
            height = source.height;
        } else if (source instanceof HTMLVideoElement) {
            isVideo = true;
            width = source.videoWidth;
            height = source.videoHeight;
        } else if (source instanceof HTMLImageElement) {
            width = source.width;
            height = source.height;
        } else if (source instanceof ImageBitmap) {
            width = source.width;
            height = source.height;
        } else if (source instanceof ImageData) {
            width = source.width;
            height = source.height;
        } else {
            return;
        }

        if (!width || !height) {
            return false;
        }

        this.isVideo = true;

        gl.activeTexture(gl.TEXTURE0 + gl.maxTextureUnits - 1);
        if (!this.handle) {
            this.handle = gl.createTexture();
        }

        gl.bindTexture(gl.TEXTURE_2D, this.handle);

        this._clearMipmap();
        this._applyTextureParameters();

        if (isVideo || this.width != width || this.height != height ||
            this.format !== gl.RGBA || this.type !== gl.UNSIGNED_BYTE) {

            this.width = width;
            this.height = height;
            this.type = gl.UNSIGNED_BYTE;
            this.format = gl.RGBA;

            gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        } else {
            gl.texSubImage2D(gl.TEXTURE_2D, level, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
        }

        if (options.generateMipmap) {
            this.generateMipmap();
        }

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        this.isLoaded = true;

        return true;
    }

    loadVideo(source, level) {
        level = level || 0;

        const gl = this.gl;
        if (!source) {
            return false;
        }

        this.flipY = true;

        const width = source.videoWidth;
        const height = source.videoHeight;

        if (width == 0 || height == 0) {
            return false;
        }

        gl.activeTexture(gl.TEXTURE0 + gl.maxTextureUnits - 1);
        if (!this.handle) {
            this.handle = gl.createTexture();
        }

        gl.bindTexture(gl.TEXTURE_2D, this.handle);
        this._clearMipmap();
        this._applyTextureParameters();

        // VideoElement seems to be very slow with texSubImage2D
        this.width = width;
        this.height = height;
        this.type = gl.UNSIGNED_BYTE;
        this.format = gl.RGBA;
        this.isVideo = true;
        gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);

        return true;
    }

    /**
     * Generate mipmaps for the texture. The texture should currently be bound to the active
     * texture.
     */
    generateMipmap() {
        this._hasMipmap = true;
        this._numLevels = 1 + Math.floor(Math.log2(Math.max(this.width, this.height)));
        const gl = this.gl;
        gl.generateMipmap(this.target);
    }

    resize(width, height) {
        if (!this.handle) {
            return false;
        }
        const gl = this.gl;
        if (this.target === gl.TEXTURE_2D) {
            this._clearMipmap();
            gl.bindTexture(gl.TEXTURE_2D, this.handle);
            gl.texImage2D(gl.TEXTURE_2D, 0, this.internalFormat, width, height, 0, this.format,
                this.type, null);
            this.width = width;
            this.height = height;
        }
    }

    create(width, height, options) {
        options = options || {};

        const gl = this.gl;
        let format = options.format || gl.RGBA;
        const type = options.type || gl.UNSIGNED_BYTE;
        const target = options.target || gl.TEXTURE_2D;
        const level = options.level || 0;
        let data = options.data || null;

        gl.activeTexture(gl.TEXTURE0 + gl.maxTextureUnits - 1);
        if (!this.handle) {
            this.handle = gl.createTexture();
        }

        if (target == gl.TEXTURE_2D) {
            this.target = gl.TEXTURE_2D;

            gl.bindTexture(gl.TEXTURE_2D, this.handle);
            this._clearMipmap();
            this._applyTextureParameters();

            this.width = width;
            this.height = height;
            this.format = format;
            this.type = type;

            this._updateInternalFormat();

            const internalFormat = options.internalFormat || this.internalFormat;

            const typedData = GLTexture._toTypedArray(data);
            gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, 0, format, type,
                typedData);

            if (options.generateMipmap) {
                this.generateMipmap();
            }

            gl.bindTexture(gl.TEXTURE_2D, null);
        } else if (target == gl.TEXTURE_CUBE_MAP) {
            this.target = target;
            this.width = width;
            this.height = height;
            this.type = type;
            this.format = format;

            let typedData = undefined;
            if (data) {
                if (data.buffer && data.buffer instanceof ArrayBuffer) {
                    typedData = [data, data, data, data, data, data];
                } else if (Loki.isArray(data) && data[0].constructor === Number) {
                    data = GLTexture._toTypedArray(data);
                    typedData = [data, data, data, data, data, data];
                } else {
                    typedData = [GLTexture._toTypedArray(data[0]), GLTexture._toTypedArray(data[1]), 
                                GLTexture._toTypedArray(data[2]), GLTexture._toTypedArray(data[3]), 
                                GLTexture._toTypedArray(data[4]), GLTexture._toTypedArray(data[5])];
                }
            }

            gl.bindTexture(target, this.handle);
            this._clearMipmap();
            this._applyTextureParameters();

            this._updateInternalFormat();

            const internalFormat = options.internalFormat || this.internalFormat;

            gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, level, internalFormat, width, height, 0,
                format, type, !typedData ? null : typedData[0]);

            gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, level, internalFormat, width, height, 0,
                format, type, !typedData ? null : typedData[1]);

            gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, level, internalFormat, width, height, 0,
                format, type, !typedData ? null : typedData[2]);

            gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, level, internalFormat, width, height, 0,
                format, type, !typedData ? null : typedData[3]);

            gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, level, internalFormat, width, height, 0,
                format, type, !typedData ? null : typedData[4]);

            gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, level, internalFormat, width, height, 0,
                format, type, !typedData ? null : typedData[5]);

            if (options.generateMipmap) {
                this.generateMipmap();
            }

            gl.bindTexture(target, null);
        }
    }

    destroy() {
        if (this.handle) {
            this.gl.deleteTexture(this.handle);
            this.handle = null;
            this._clearMipmap();
        }
    }

    bind(textureUnit, sampler) {
        GLTexture.setBoundTexture(this.gl, textureUnit, this);
        textureUnit = textureUnit || 0;
        const gl = this.gl;
        if (textureUnit >= gl.maxTextureUnits) {
            textureUnit = gl.maxTextureUnits - 1;
        }

        gl.activeTexture(gl.TEXTURE0 + textureUnit);
        if (this.target === gl.TEXTURE_2D) {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
        gl.bindTexture(this.target, this.handle);

        if (sampler) {
            sampler.bind(textureUnit);
        } else {
            gl.bindSampler(textureUnit, null);
        }
    }

    unbind(textureUnit) {
        const gl = this.gl;

        if (textureUnit === undefined) {
            GLTexture.unbindTexture(gl, this);
            return;
        }

        GLTexture.unbindTexture(gl, textureUnit, this);
    }


    _applyTextureParameters(sampler) {
        const gl = this.gl;
        sampler = sampler || this;

        if (sampler.minFilter !== undefined) {
            gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, sampler.minFilter);
        }

        // MAG_FILTER can only be NEAREST or LINEAR
        if (sampler.magFilter !== undefined) {
            gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, sampler.magFilter);
        }

        if (sampler.wrapS !== undefined) {
            gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, sampler.wrapS);
        }

        if (sampler.wrapT !== undefined) {
            gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, sampler.wrapT);
        }

        // Can't set texture anistropy for point filtered textures
        if (sampler.anisotropy !== undefined) {
            if (this.minFilter !== gl.NEAREST || this.magFilter !== gl.NEAREST) {
                gl.texParameteri(this.target, gl.TEXTURE_MAX_ANISOTROPY_EXT, sampler.anisotropy);
            }
        }

        // UNPACK_FLIP_Y_WEBGL is only supported for DOM element textures
        if (sampler.flipY !== undefined) {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, sampler.flipY);
        }
    }

    /**
     * Download pixels from the texture to a local buffer.
     * @param {Uint8Array} [pixels] Optional storage for the pixels. The size should be
     * `width * height * 4`.
     * @return {Uint8Array}
     */
    readPixels(pixels) {
        const gl = this.gl;
        if (!this._readFramebuffer) {
            this._readFramebuffer = new GLFramebuffer(gl, this);
        }
        this._readFramebuffer.bind();
        const bufferSize = this.width * this.height * 4;
        if (!pixels || pixels.length != bufferSize) {
            pixels = new Uint8Array(bufferSize);
        }
        gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        this._readFramebuffer.unbind();
        return pixels;
    }

    /**
     * Copy the contents of this texture to the given texture, optionally applying a shader.
     * @param {GLTexture?} targetTexture Texture to copy to. If null, it will draw to the screen
     * or active framebuffer.
     * @param {GLShader?} shader Optional shader to apply while copying
     * @param {Object?} uniforms Optional uniforms for the shader
     */
    blit(targetTexture, shader, uniforms) {
        const gl = this.gl;

        let fbo;
        if (targetTexture) {
            fbo = gl.resourceManager.getResource(":TextureCopyFBO");
            if (!fbo) {
                fbo = new GLFramebuffer(gl);
                gl.resourceManager.setResource(":TextureCopyFBO", fbo);
            }

            fbo.bind();
            gl.state.push();

            gl.state.set('viewport', [0, 0, targetTexture.width, targetTexture.height]);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,
                targetTexture.handle, 0);
        } else {
            gl.state.push();
        }

        gl.state.disable(gl.BLEND);
        gl.state.disable(gl.DEPTH_TEST);
        gl.state.set('depthMask', false);

        this.bind(0);

        if (shader) {
            if (uniforms) {
                shader.setUniforms(uniforms);
            }
        } else {
            shader = gl.resourceManager.getBlitShader();
            shader.setUniforms({ baseColor: 0 });
        }

        if (uniforms) {
            shader.setUniforms(uniforms);
        }

        shader.drawMesh(gl.resourceManager.getFullscreenMesh());

        this.unbind(0);
        gl.state.pop();

        if (fbo) {
            fbo.unbind();
        }
    }

    _getFormat(format) {
        const gl = this.gl;
        if (this.type === gl.FLOAT) {
            if (format === gl.RGB) {
                return gl.RGB32F;
            }
            if (format === gl.RGBA) {
                return gl.RGBA32F;
            }
        }
        return format;
    }

     _updateInternalFormat() {
        this.internalFormat = this.format;
        const gl = this.gl;
        if (this.format === gl.DEPTH_COMPONENT) {
            this.minFilter = gl.NEAREST;
            if (gl.webgl2) {
                if (this.type === gl.UNSIGNED_SHORT) {
                    this.internalFormat = gl.DEPTH_COMPONENT16;
                } else if (this.type === gl.UNSIGNED_INT) {
                    this.internalFormat = gl.DEPTH_COMPONENT24;
                } else if (this.type === gl.FLOAT) {
                    this.internalFormat = gl.DEPTH_COMPONENT32F;
                } else {
                    throw "Unsupported type for a depth texture";
                }
            } else {
                if (this.type === gl.FLOAT) {
                    throw "WebGL 1.0 does not support float depth textures";
                }
            }
        } else if (this.format === gl.RGBA) {
            if (gl.webgl2) {
                if (this.type === gl.FLOAT) {
                    this.internalFormat = gl.RGBA32F;
                } else if (this.type === gl.HALF_FLOAT) {
                    this.internalFormat = gl.RGBA16F;
                } else if (this.type === gl.HALF_FLOAT_OES) {
                    this.type = gl.HALF_FLOAT;
                    this.internalFormat = gl.RGBA16F;
                }
            } else {
                if (this.type === gl.HALF_FLOAT) {
                    this.type = gl.HALF_FLOAT_OES;
                }
            }
        } else if (this.format === gl.RGB) {
            if (gl.webgl2) {
                if (this.type === gl.FLOAT) {
                    this.internalFormat = gl.RGB32F;
                } else if (this.type === gl.HALF_FLOAT) {
                    this.internalFormat = gl.RGB16F;
                } else if (this.type === gl.HALF_FLOAT_OES) {
                    this.type = gl.HALF_FLOAT;
                    this.internalFormat = gl.RGB16F;
                }
            } else {
                if (this.type === gl.HALF_FLOAT) {
                    this.type = gl.HALF_FLOAT_OES;
                }
            }
        }
    }

    static _toTypedArray(data, type) {
        if (!data || data.constructor !== Array) {
            return data;
        }
        if (type === GL.FLOAT) {
            return new Float32Array(data);
        }
        if (type === GL.HALF_FLOAT_OES || type === GL.HALF_FLOAT) {
            return new Uint16Array(data);
        }
        return new Uint8Array(data);
    }

    static setBoundTexture(gl, textureUnit, texture) {
        if (!GLTexture.boundTextures.has(gl.id)) {
            if (texture === null) {
                return;
            }
            GLTexture.boundTextures.set(gl.id, new Array(32));
        }
        const boundTextures = GLTexture.boundTextures.get(gl.id);
        /*if (boundTextures[textureUnit]) {
            console.log("!!!!");
        }*/
        boundTextures[textureUnit] = texture;
    }

    static unbindTexture(gl, textureUnit, texture) {
        const boundTextures = GLTexture.boundTextures.get(gl.id);
        if (!boundTextures) {
            return;
        }

        if (textureUnit.constructor === GLTexture) {
            for (let i = 0; i < 32; ++i) {
                if (boundTextures[i] === textureUnit) {
                    boundTextures[i] = null;
                    gl.activeTexture(gl.TEXTURE0 + i);
                    gl.bindTexture(textureUnit.target, null);
                }
            }
            return;
        }

        if (boundTextures[textureUnit]) {
            const t = boundTextures[textureUnit];
            if (t !== texture) {
                //console.log("!!!!");
            }
            boundTextures[textureUnit] = null;
            gl.activeTexture(gl.TEXTURE0 + textureUnit);
            gl.bindTexture(texture.target, null);
        }
    }
}

GLTexture.isGLTexture = true;
GL.Texture = GLTexture;

GLTexture.boundTextures = new Map();
