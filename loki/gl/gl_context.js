import { Signal } from "../util/signal.js";
import { GL } from "./gl.js";
import { Log } from "../util/log.js";
import { Time } from "../util/time.js";
import { Loki } from "../loki.js";
import { GLResourceManager } from "./gl_resource_manager.js";
import { GLState } from "./gl_state.js";

/* eslint-disable no-prototype-builtins */

/**
 * Creates a [WebGLRenderingContext]{@link https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext}
 * and augments it with extra methods and properties. All methods and properties of
 * [WebGLRenderingContext]{@link https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext}
 * can be directly accessed from this class.
 * @category GL
 */
export class GLContext {
    /**
     * @param {Object} [options] supported options:
     *    @param {Canvas} [options.canvas] The canvas to use.
     *    @param {Number} [options.width] The width of the canvas to be created.
     *    @param {Number} [options.height] The height of the canvas to be created.
     *    @param {Element|String} [options.container] The containing element for the created
     *      canvas.
     *    @param {Number} [options.version] The version of WebGL to use, either 1 or 2. 0 or
     *      undefined will use the greatest available version.
     */
    constructor(options) {
        options = options || {};
        let canvas = null;

        if (options.canvas) {
            if (options.canvas.constructor === String) {
                canvas = document.getElementById(options.canvas);
                if (!canvas) {
                    throw("Canvas element not found: " + options.canvas);
                }
            } else {
                canvas = options.canvas;
            }
        } else {
            let root = null;
            if (options.container) {
                root = options.container.constructor === String ?
                    document.querySelector(options.container) :
                    options.container;
            }

            if (root && !options.width) {
                const rect = root.getBoundingClientRect();
                options.width = rect.width;
                options.height = rect.height;
            }

            canvas = GLContext.createCanvas(options.width || 800, options.height || 600);
            if (root) {
                root.appendChild(canvas);
            }
        }

        const self = this;
        window.addEventListener("resize", function() {
            self.updateResolution();
        });

        if (options.alpha === undefined) {
            options.alpha = false;
        }

        this._refreshing = false;
        this.canvas = canvas;

        // Set the rendering resolution to the canvas size.
        this.updateResolution();

        // The underlying WebGLRenderingContextontext. It may be a WebGL1 or WebGL2 context.
        let gl = null;

        let contextTypes = null;
        if (options.version == 2) {
            contextTypes = ["webgl2", "experimental-webgl2"];
        } else if (options.version == 1) {
            contextTypes = ["webgl", "experimental-webgl"];
        } else if (!options.version) {
            contextTypes = ["webgl2", "experimental-webgl2", "webgl", "experimental-webgl"];
        }

        if (!contextTypes) {
            throw "Incorrect WebGL version, must be 1 or 2";
        }

        const contextOptions = {
            alpha: options.alpha === undefined ? true : options.alpha,
            depth: options.depth === undefined ? true : options.depth,
            stencil: options.stencil === undefined ? true : options.stencil,
            antialias: options.antialias === undefined ? true : options.antialias,
            premultipliedAlpha: options.premultipliedAlpha === undefined ?
                true : options.premultipliedAlpha,
            preserveDrawingBuffer: options.preserveDrawingBuffer === undefined ?
                false/*true*/ : options.preserveDrawingBuffer,
            xrCompatible: !!options.xrCompatible
        };

        // Try creating the various WebGL context types until one succeeds. Context types are listed
        // in descending order of capabilities.
        for (const contextType of contextTypes) {
            try {
                gl = canvas.getContext(contextType, contextOptions);
            } catch (e) {
                // ..
            }

            if (gl) {
                break;
            }
        }

        // If no WebGL context was able to be created, we're done, nothing more to do.
        if (!gl) {
            this._gl = null;
            if (canvas.getContext("webgl")) {
                throw "WebGL supported but not with the given parameters";
            }
            throw "WebGL not supported";
        }

        this._gl = gl;

        const getters = ["drawingBufferWidth", "drawingBufferHeight"];

        // Copy all of the functions and properties from gl
        for (const i in gl) {
            if (this[i] !== undefined) {
                continue;
            }
            const v = gl[i];
            if (Loki.isFunction(v)) {
                this[i] = v.bind(gl);
            } else {
                if (getters.includes(i)) {
                    Object.defineProperty(this, i, {
                        get: function() { return gl[i]; },
                        enumerable: true});
                } else {
                    this[i] = v;
                }
            }
        }

        // context globals

        /** 
         * @property {number} webglVersion The version of WebGL used by this context, either 2 or 1.
         */
        this.webglVersion = gl.constructor.name === "WebGL2RenderingContext" ? 2 : 1;
        /** @property {bool} webgl2 True if this context is WebGL 2. */
        this.webgl2 = this.webglVersion == 2;

        canvas.isWebgl = true;
        canvas.gl = this;

        /**
         * @property {GLState} state The GLState object managing pushing and popping of state values.
         */
        this.state = new GLState(this);

        /**
         * @property {number} id Unique ID for this GLContext.
         */
        this.id = GLContext._lastContextId++;

        // Signals

        /**
         * @property {Signal} onUpdate Emitted before rendering so listeners can do any updating
         * for the next frame.
         */
        this.onUpdate = new Signal();
        /**
         * @property {Signal} onDrawFrame Emitted so objects can draw into the current frame.
         */
        this.onDrawFrame = new Signal();
        /**
         * @property {Signal} onDestroy Emitted when the context is destroyed so objects can
         * free their resources.
         */
        this.onDestroy = new Signal();
        /**
         * @property {Signal} onLoseContext Emitted when the context has been lost so objects can
         * free their resources and prepare for a new context being created.
         */
        this.onLoseContext = new Signal();

        /**
         * @property {Object} extensions Stores common used extensions so they can be checked if
         * they are supported.
         */
        this.extensions = {};

        this.extensions["OES_standard_derivatives"] = gl.derivativesSupported =
            gl.getExtension("OES_standard_derivatives") || false;

        this.extensions["WEBGL_depth_texture"] = gl.getExtension("WEBGL_depth_texture") ||
            gl.getExtension("WEBKIT_WEBGL_depth_texture") ||
            gl.getExtension("MOZ_WEBGL_depth_texture");

        this.extensions["OES_element_index_uint"] = gl.getExtension("OES_element_index_uint");

        this.extensions["WEBGL_draw_buffers"] = gl.getExtension("WEBGL_draw_buffers");

        this.extensions["EXT_shader_texture_lod"] = gl.getExtension("EXT_shader_texture_lod");

        this.extensions["EXT_sRGB"] = gl.getExtension("EXT_sRGB");

        this.extensions["EXT_texture_filter_anisotropic"] =
                gl.getExtension("EXT_texture_filter_anisotropic") ||
                gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic") ||
                gl.getExtension("MOZ_EXT_texture_filter_anisotropic");

        this.extensions["EXT_frag_depth"] = gl.getExtension("EXT_frag_depth") ||
                gl.getExtension("WEBKIT_EXT_frag_depth") ||
                gl.getExtension("MOZ_EXT_frag_depth");

        this.extensions["WEBGL_lose_context"] = gl.getExtension("WEBGL_lose_context") ||
                gl.getExtension("WEBKIT_WEBGL_lose_context") ||
                gl.getExtension("MOZ_WEBGL_lose_context");

        this.extensions["ANGLE_instanced_arrays"] = gl.getExtension("ANGLE_instanced_arrays");

        this.extensions["disjoint_timer_query"] = gl.getExtension("EXT_disjoint_timer_query");

        // for float textures
        this.extensions["OES_texture_float_linear"] = gl.getExtension("OES_texture_float_linear");
        if (this.extensions["OES_texture_float_linear"]) {
            this.extensions["OES_texture_float"] = gl.getExtension("OES_texture_float");
        }
        this.extensions["EXT_color_buffer_float"] = gl.getExtension("EXT_color_buffer_float");

        this.extensions["EXT_texture_shared_exponent"] = gl.getExtension("EXT_texture_shared_exponent");

        // for half float textures in webgl 1 require extension
        this.extensions["OES_texture_half_float_linear"] =
            gl.getExtension("OES_texture_half_float_linear");
        if (this.extensions["OES_texture_half_float_linear"]) {
            this.extensions["OES_texture_half_float"] = gl.getExtension("OES_texture_half_float");
        }

        if (this.webglVersion === 1) {
            this.HIGH_PRECISION_FORMAT = this.extensions["OES_texture_half_float"] 
                ? GL.HALF_FLOAT_OES
                : (this.extensions["OES_texture_float"] ? GL.FLOAT : GL.UNSIGNED_BYTE);
        } else {
            this.HIGH_PRECISION_FORMAT = GL.HALF_FLOAT_OES;
        }

        /** @property {String} vendor */
        this.vendor = gl.getParameter(gl.VENDOR);
        /** @property {String} version */
        this.version = gl.getParameter(gl.VERSION);
        /** @property {number} maxTextureUnits */
        this.maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        /** @property {number} maxVertexTextures */
        this.maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
        /** @property {number} maxCombinedTextures */
        this.maxCombinedTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
        /** @property {number} maxTextureSize */
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        /** @property {number} maxCubeMapSize */
        this.maxCubeMapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
        /** @property {number} maxVertexAttribs */
        this.maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
        /** @property {number} maxVaryingVectors */
        this.maxVaryingVectors = gl.getParameter(gl.MAX_VARYING_VECTORS);
        /** @property {number} maxVertexUniformVectors */
        this.maxVertexUniformVectors = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
        /** @property {number} maxFragmentUniformVectors */
        this.maxFragmentUniformVectors = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
        /** @property {Int32Array} maxViewport */
        this.maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);

        const ext = this.extensions["EXT_texture_filter_anisotropic"];
        this.TEXTURE_MAX_ANISOTROPY_EXT = ext
            ? ext.TEXTURE_MAX_ANISOTROPY_EXT
            : -1;

        /** @property {number} maxAnisotropy */
        this.maxAnisotropy = ext ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;

        // Use a custom version of the gl.viewport function so that the viewport data is cached
        // and doesn't need to be queried through the WebGL context.
        this._viewportFunc = gl.viewport.bind(gl);

        /** @property {Float32Array} viewportData The current viewport dimensions */
        this.viewportData = new Float32Array([0, 0, gl.canvas.width, gl.canvas.height]);

        /** @property {GLShader} The currently bound shader. */
        this.currentShader = null;

        /** @property {GLResourceManager} resourceManager Manages a cache of GL objects. */
        this.resourceManager = new GLResourceManager(this);

        canvas.requestPointerLock = canvas.requestPointerLock ||
                                    canvas.mozRequestPointerLock;

        document.exitPointerLock = document.exitPointerLock ||
                                   document.mozExitPointerLock;

        // All GLContexts will be drawn if the global requestFrame event is emitted.
        Loki.onRequestFrame.addListener(this.requestFrame, this);

        this.canvas.addEventListener("webglcontextlost", function(e) {
            e.preventDefault();
            self.contextLost = true;
            if (self.loseContext) {
                gl.loseContext(e);
            }
            self.onLoseContext.emit(self, e);
        }, false);

        this.reset();
    }

    /**
     * @property {number} width The canvas width, in pixels.
     */
    get width() { return this.canvas.width; }

    /**
     * @property {number} height The canvas height, in pixels.
     */
    get height() { return this.canvas.height; }

    /**
     * Call this when the size of the canvas has changed to update the resolution of the 
     * canvas to match.
     */
    updateResolution() {
        const canvas = this.canvas;
        // Need to do a timeout here to give the browser time to update its layout
        setTimeout(function() {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
        }, 1);
    }

    /**
     * Create a canvas element.
     * @param {number} width The width of the created canvas.
     * @param {number} height The height of the created canvas.
     * @return {Canvas} The created canvas.
     */
    static createCanvas(width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    /**
     * Clone a canvas element.
     * @param {Canvas} canvas The canvas to clone.
     * @return {Canvas} The created canvas.
     */
    static cloneCanvas(canvas) {
        const newCanvas = document.createElement("canvas");
        newCanvas.width = canvas.width;
        newCanvas.height = canvas.height;
        const ctx = newCanvas.getContext("2d");
        ctx.drawImage(canvas, 0, 0);
        return canvas;
    }

    /**
     * Set the dimensions of the viewport.
     * @param {number} a 
     * @param {number} b 
     * @param {number} c 
     * @param {number} d 
     */
    viewport(a, b, c, d) {
        const v = this.viewportData;
        v[0] = a|0;
        v[1] = b|0;
        v[2] = c|0;
        v[3] = d|0;
        this._viewportFunc(a, b, c, d);
    }

    /**
     * Get the dimensions of the viewport
     * @param {Array<number>} [v] Optional storage for the results.
     */
    getViewport(v) {
        if (v) {
            v[0] = this.viewportData[0];
            v[1] = this.viewportData[1];
            v[2] = this.viewportData[2];
            v[3] = this.viewportData[3];
            return v;
        }
        return new Float32Array(this.viewportData);
    }

    /**
     * Set the dimensions of the viewport.
     * @param {array<number>} v Dimensions of the viewport
     * @param {bool} flipY If true, flip the y coordinate of the viewport so the origin is the
     * bottom-left corner of the viewport.
     */
    setViewport(v, flipY) {
        this.viewportData.set(v);
        if (flipY) {
            this.viewportData[1] = this.drawingBufferHeight - v[1] - v[3];
        }
        this._viewportFunc(v[0], this.viewportData[1], v[2], v[3]);
    }

    /**
     * Get the setter function to use for a uniform given a
     * [WebGLActiveInfo]{@link https://developer.mozilla.org/en-US/docs/Web/API/WebGLActiveInfo}.
     * @param {WebGLActiveInfo} data Info about the active uniform.
     * @return {Function} The uniform setter function, bound to the GL context, such as uniform1f.
     */
    getUniformFunction(data) {
        const gl = this._gl;
        let func = null;
        switch (data.type) {
            case GL.FLOAT:
                if (data.size == 1) {
                    func = gl.uniform1f.bind(gl);
                } else {
                    func = gl.uniform1fv.bind(gl);
                }
                break;
            case GL.FLOAT_MAT2:
                func = gl.uniformMatrix2fv.bind(gl); 
                break;
            case GL.FLOAT_MAT3:
                func = gl.uniformMatrix3fv.bind(gl); 
                break;
            case GL.FLOAT_MAT4:
                func = gl.uniformMatrix4fv.bind(gl); 
                break;
            case GL.FLOAT_VEC2: 
                func = gl.uniform2fv.bind(gl); 
                break;
            case GL.FLOAT_VEC3: 
                func = gl.uniform3fv.bind(gl); 
                break;
            case GL.FLOAT_VEC4: 
                func = gl.uniform4fv.bind(gl); 
                break;
    
            case GL.UNSIGNED_INT:
            case GL.INT:
                if (data.size == 1) {
                    func = gl.uniform1i.bind(gl);
                } else {
                    func = gl.uniform1iv.bind(gl);
                }
                break;
            case GL.INT_VEC2: 
                func = gl.uniform2iv.bind(gl); 
                break;
            case GL.INT_VEC3: 
                func = gl.uniform3iv.bind(gl); 
                break;
            case GL.INT_VEC4: 
                func = gl.uniform4iv.bind(gl); 
                break;
    
            case GL.SAMPLER_2D:
            case GL.SAMPLER_3D:
            case GL.SAMPLER_CUBE:
                func = gl.uniform1i.bind(gl); 
                break;
            default: 
                func = gl.uniform1f.bind(gl); 
                break;
        }
        return func;
    }

    /**
     * Request pointer lock for the canvas. This needs to be done from a user event, such as
     * mousedown or touchdown.
     */
    requestPointerLock() {
        this.canvas.requestPointerLock();
    }

    /**
     * Release the pointer lock from the canvas.
     */
    exitPointerLock() {
        document.exitPointerLock();
    }

    /**
     * Get the aspect ratio of the canvas.
     * @return {number} The aspect ratio, width / height.
     */
    getAspectRatio() {
        return this.canvas.width / this.canvas.height;
    }

    /**
     * Launch animation loop (calls gl.onUpdate and gl.onDrawFrame every frame)
     * example: gl.onDrawFrame.addListener(function(){ ... }) or
     * gl.onUpdate.addListener(function(dt) { ... })
     */
    animate(v) {
        if (v === false) {
            if (this._requestFrameId) {
                cancelAnimationFrame(this._requestFrameId);
            }
            this._requestFrameId = null;
            return;
        }

        let time = Time.seconds;
        const self = this;
        const gl = this._gl;

        // requestAnimationFrame loop.
        function animationLoop() {
            // If the gl context was destroyed, don't render to it.
            if (gl.destroyed) {
                return;
            }
            self._requestFrameId = requestAnimationFrame(animationLoop);

            const now = Time.seconds;
            const dt = now - time;

            if (Loki.catchExceptions) {
                try {
                    self.onUpdate.emit(dt);
                } catch (error) {
                    Log.error(error);
                }
            } else {
                self.onUpdate.emit(dt);
            }

            self.drawFrame();

            time = now;
        }

        // launch the main loop
        this._requestFrameId = requestAnimationFrame(animationLoop);
    }

    /**
     * Request all objects listening to onDrawFrame to draw.
     */
    drawFrame() {
        if (Loki.catchExceptions) {
            try {
                this.onDrawFrame.emit();
            } catch (error) {
                Log.error(error);
            }
        } else {
            this.onDrawFrame.emit();
        }
    }

    /**
     * Request a frame to be drawn. This is done asynchrounously, and multiple calls to requestFrame
     * called before the frame is drawn will be consolidated.
     */
    requestFrame() {
        if (this._refreshing) {
            return;
        }
        this._refreshing = true;
        const self = this;
        const refreshDelay = 16;
        setTimeout(function() {
            self.drawFrame();
            self._refreshing = false;
        }, refreshDelay);
    }

    /**
     * Destroy this WebGL context and removes the Canvas from the DOM.
     */
    destroy() {
        Loki.onRequestFrame.disconnect(this);

        // unbind global events
        this.onDestroy.emit(this);

        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }

        this.resourceManager.destroy();

        this.destroyed = true;

        this._gl = null;
    }

    /**
     * Launches the canvas in fullscreen mode
     */
    fullscreen() {
        const canvas = this.canvas;
        if (canvas.requestFullScreen) {
            canvas.requestFullScreen();
        } else if (canvas.webkitRequestFullScreen) {
            canvas.webkitRequestFullScreen();
        } else if (canvas.mozRequestFullScreen) {
            canvas.mozRequestFullScreen();
        } else {
            Log.error("Fullscreen not supported");
        }
    }

    /**
     * Returns a canvas with a snapshot of an area.
     * This is safer than using the canvas itself due to internals of WebGL.
     * @param {number} startx Viewport x coordinate
     * @param {number} starty Viewport y coordinate, from bottom of the canvas.
     * @param {number} areax Viewport area width.
     * @param {number} areay Viewport area height.
     * @param {bool?} skipReverse If false, the canvas image will be flipped vertically.
     * @return { Canvas } canvas
     */
    snapshot(startx, starty, areax, areay, skipReverse) {
        const canvas = GLContext.createCanvas(areax, areay);
        let ctx = canvas.getContext("2d");
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const gl = this._gl;
        const buffer = new Uint8Array(areax * areay * 4);
        gl.readPixels(startx, starty, canvas.width, canvas.height,
            gl.RGBA, gl.UNSIGNED_BYTE, buffer);

        pixels.data.set(buffer);
        ctx.putImageData(pixels, 0, 0);

        if (skipReverse) {
            return canvas;
        }

        // flip image
        const finalCanvas = GLContext.createCanvas(areax, areay);
        ctx = finalCanvas.getContext("2d");
        ctx.translate(0, areay);
        ctx.scale(1, -1);
        ctx.drawImage(canvas, 0, 0);

        return finalCanvas;
    }

    /**
     * Reset the the initial gl state
     */
    reset() {
        const gl = this._gl;
        // viewport
        gl.viewport(0,0, this.canvas.width, this.canvas.height);

        // flags
        gl.disable(gl.BLEND);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);
        gl.frontFace(gl.CCW);
    }

    dump() {
        const gl = this._gl;
        Log.write("userAgent: ", navigator.userAgent);
        Log.write("Supported extensions:");
        const extensions = gl.getSupportedExtensions();
        for (const x of extensions) {
            Log.write(" * " + x);
        }
        const info = [
            "VENDOR", "VERSION", "MAX_VERTEX_ATTRIBS", "MAX_VARYING_VECTORS",
            "MAX_VERTEX_UNIFORM_VECTORS", "MAX_VERTEX_TEXTURE_IMAGE_UNITS",
            "MAX_FRAGMENT_UNIFORM_VECTORS", "MAX_TEXTURE_SIZE",
            "MAX_TEXTURE_IMAGE_UNITS"];
        Log.write("WebGL info:");
        for (const i in info) {
            Log.write(" * " + info[i] + ": " + gl.getParameter(gl[info[i]]));
        }
        Log.write("*************************************************");
    }
}

GLContext._lastContextId = 0;
