import { GLRenderbuffer } from "./gl_render_buffer.js";
import { GL } from "./gl.js";
import { Log } from "../util/log.js";

/**
 * A Framebuffer is a target for rendering, which includes one ore more color buffers,
 * and an optional depth buffer. Color and depth buffers can be either a GLRenderbuffer,
 * or a GLTexture, in which case the texture can be used as a texture input for another rendering
 * pass.
 * @category GL
 */
export class GLFramebuffer {
    /**
     * Creates a new frame buffer object.
     * @param {GLContext} gl The GLContext to create the framebuffer with.
     * @param {*} colorTextures 
     * @param {*} depthTexture 
     * @param {bool?} stencil 
     */
    constructor(gl, colorTextures, depthTexture, stencil) {
        this.gl = gl;

        this.handle = null;
        this.width = -1;
        this.height = -1;
        this.colorTextures = [];
        this.depthTexture = null;
        this.stencil = !!stencil;

        this._stencilEnabled = false;
        this._numBoundTextures = 0;

        const numColorTextures = colorTextures && colorTextures.constructor === Array
            ? colorTextures.length
            : colorTextures ? 1 : 0;

        this._previousFramebuffer = null;
        this._previousViewport = new Float32Array(4);
        this.order = null;

        if (numColorTextures || depthTexture) {
            this.setTextures(colorTextures, depthTexture);
        }
    }

    /**
     * @property {GLTexture} colorTexture The first bound color texture, which is usually the
     * primary one.
     */
    get colorTexture() { return this.colorTextures[0]; }

    /**
     * Bind color and depth textures to the framebuffer.
     * 
     * @param {*} colorTextures 
     * @param {GLTexture?} depthTexture 
     * @param {bool?} skipDisable If true, the framebuffer won't be unbound after initialization,
     * allowing it to continue to be used without having to rebind it.
     */
    setTextures(colorTextures, depthTexture, skipDisable) {
        const numColorTextures = colorTextures && colorTextures.constructor === Array
            ? colorTextures.length
            : colorTextures ? 1 : 0;

        if (depthTexture && depthTexture.constructor.isGLTexture) {
            if (depthTexture.format !== GL.DEPTH_COMPONENT && 
                depthTexture.format !== GL.DEPTH_STENCIL && 
                depthTexture.format !== GL.DEPTH_COMPONENT16 && 
                depthTexture.format !== GL.DEPTH_COMPONENT24 &&
                depthTexture.format !== GL.DEPTH_COMPONENT32F) {
                throw "FBO Depth texture must be of format: gl.DEPTH_COMPONENT, gl.DEPTH_STENCIL " +
                "or gl.DEPTH_COMPONENT16/24/32F (only in webgl2)";
            }
    
            if (depthTexture.type !== GL.UNSIGNED_SHORT && 
                depthTexture.type !== GL.UNSIGNED_INT && 
                depthTexture.type !== GL.UNSIGNED_INT_24_8_WEBGL &&
                depthTexture.type !== GL.FLOAT) {
                throw "FBO Depth texture must be of type: gl.UNSIGNED_SHORT, gl.UNSIGNED_INT, " +
                    "gl.UNSIGNED_INT_24_8_WEBGL";
            }
        }

        let isSame = this.depthTexture === depthTexture;
        if (isSame && colorTextures) {
           if (numColorTextures === this.colorTextures.length) {
               if (colorTextures && colorTextures.constructor === Array) {
                    for (let i = 0; i < colorTextures.length; ++i) {
                        if (colorTextures[i] !== this.colorTextures[i]) {
                            isSame = false;
                            break;
                        }
                    }
                } else if (colorTextures && this.colorTextures[0] !== colorTextures) {
                    isSame = false;
                }
            } else {
                isSame = false;
            }
        }

        if (this._stencilEnabled !== this.stencil) {
            isSame = false;
        }

        if (isSame) {
            return;
        }

        this.colorTextures.length = numColorTextures;
        if (colorTextures) {
            if (colorTextures.constructor === Array) {
                for (let i = 0; i < colorTextures.length; ++i) {
                    this.colorTextures[i] = colorTextures[i];
                }
            } else {
                this.colorTextures[0] = colorTextures;
            }
        }

        this.depthTexture = depthTexture;

        this.update(skipDisable);
    }

    /**
     * Updates the framebuffer with the textures and buffers.
     * 
     * @param {bool?} skipDisable If true, the framebuffer won't be unbound after updating, allowing
     * it to continue to be used without having to rebind it.
     */
    update(skipDisable) {
        const gl = this.gl;

        let w = -1;
        let h = -1;
        let type = null;
        let colorTextures = this.colorTextures;
        let depthTexture = this.depthTexture;

        // Make sure the width and height of all the textures is the same.
        if (colorTextures && colorTextures.length) {
            for (let i = 0; i < colorTextures.length; ++i) {
                const t = colorTextures[i];

                if (w === -1) {
                    w = t.width;
                } else if (w !== t.width) {
                    throw "FBO can only bind textures with the same dimensions";
                }

                if (h === -1) {
                    h = t.height;
                } else if (h !== t.height) {
                    throw "FBO can only bind textures with the same dimensions";
                }

                if (type === null) {
                    type = t.type;
                } else if (type !== t.type) {
                    throw "FBO can only bind textures with the same pixel format";
                }

                if (!t.constructor.isRenderbuffer && t.target !== gl.TEXTURE_2D) {
                    throw "Cannot bind a cubemap to an FBO";
                }
            }
        } else if (depthTexture) {
            w = depthTexture.width;
            h = depthTexture.height;
        }

        if (w === -1) {
            throw "FBO updated with no bound textures";
        }

        // draw_buffers allows frame buffers to have more than one color texture
        const ext = gl.extensions["WEBGL_draw_buffers"];
        if (gl.webglVersion == 1 && !ext && colorTextures && colorTextures.length > 1) {
            throw "Rendering to multiple textures is not supported by this browser";
        }

        this.width = w;
        this.height = h;

        this.bind();

        const target = gl.webglVersion == 1 ? gl.FRAMEBUFFER : gl.DRAW_FRAMEBUFFER;

        // Detach anything already bound
        gl.framebufferRenderbuffer(target, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, null);
        gl.framebufferRenderbuffer(target, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, null);

        // Bind the depth buffer
        if (depthTexture && depthTexture.constructor.isGLTexture) {
            if (gl.webglVersion == 1 && !gl.extensions["WEBGL_depth_texture"]) {
                throw("Rendering to depth texture not supported by your browser");
            }

            if (this.stencil && depthTexture.format !== gl.DEPTH_STENCIL) {
                Log.warning("Stencil cannot be enabled if there is a depth texture with a",
                    "DEPTH_STENCIL format");
            }

            if (depthTexture.format === gl.DEPTH_STENCIL) {
                gl.framebufferTexture2D(target, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D,
                    depthTexture.handle, 0);
            } else {
                gl.framebufferTexture2D(target, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D,
                    depthTexture.handle, 0);
            }
        } else {
            let depthRenderbuffer = null;
            if (depthTexture && depthTexture.constructor.isRenderbuffer &&
                depthTexture.width == w && depthTexture.height == h) {
                depthRenderbuffer = depthTexture;
            }

            if (depthRenderbuffer) {
                gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderbuffer.handle);

                if (this.stencil) {
                    gl.framebufferRenderbuffer(target, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER,
                        depthRenderbuffer.handle);
                } else {
                    gl.framebufferRenderbuffer(target, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER,
                        depthRenderbuffer.handle);
                }
            }
        }

        if (colorTextures && colorTextures.length) {
            this.order = [];
            for (let i = 0; i < colorTextures.length; ++i) {
                const t = colorTextures[i];
                if (t.constructor.isGLTexture) {
                    gl.framebufferTexture2D(target, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D,
                        t.handle, 0);
                } else {
                    gl.framebufferRenderbuffer(target, gl.COLOR_ATTACHMENT0 + i, gl.RENDERBUFFER,
                        t.handle);
                }
                this.order.push(gl.COLOR_ATTACHMENT0 + i);
            }
        } else {
            // Otherwise use a Renderbuffer to store color
            const colorRenderbuffer = this._colorRenderbuffer || new GLRenderbuffer(gl, w, h,
                gl.RGBA4);
            this._colorRenderbuffer = colorRenderbuffer;
            gl.framebufferRenderbuffer(target, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER,
                colorRenderbuffer.handle);
        }

        // Detach old textures
        const num = colorTextures ? colorTextures.length : 0;
        for (let i = num; i < this._numBoundTextures; ++i) {
            gl.framebufferRenderbuffer(target, gl.COLOR_ATTACHMENT0 + i, gl.RENDERBUFFER, null);
            gl.framebufferTexture2D(target, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, null, 0);
        }
        this._numBoundTextures = num;
        this._stencilEnabled = this.stencil;

        // When using more than one texture, you need to use the multidraw extension
        if (colorTextures && colorTextures.length > 1) {
            if (ext) {
                ext.drawBuffersWEBGL(this.order);
            } else {
                gl.drawBuffers(this.order);
            }
        }

        const complete = gl.checkFramebufferStatus(target);
        if (complete !== gl.FRAMEBUFFER_COMPLETE) {
            this.unbind();
            throw "FBO not complete: " + this._framebufferErrorString(complete);
        }

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);

        // Restore the previous bound FBO
        if (!skipDisable) {
            this.unbind();
        }
    }

    /**
     * Free up GL memory used by the framebuffer.
     */
    destroy() {
        if (GLFramebuffer.active === this) {
            this.unbind();
        }
        GLFramebuffer.framebufferCount--;
        if (this.handle !== null) {
            this.gl.deleteFramebuffer(this.handle);
        }
        this.handle = null;
        this.width = -1;
        this.height = -1;
        this.colorTextures.length = 0;
        this.depthTexture = null;
        this.stencil = false;
    }

    /**
     * Make the framebuffer active so all rendering will render to it.
     */
    bind() {
        if (GLFramebuffer.active === this) {
            return;
        }

        this._previousViewport.set(this.gl.viewportData);
        this._previousFramebuffer = GLFramebuffer.active;

        if (!this.handle) {
            this.handle = this.gl.createFramebuffer();
            GLFramebuffer.framebufferCount++;
        }

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.handle);

        for (let i = 0; i < this.colorTextures.length; ++i) {
            this.colorTextures[i]._inCurrentFramebuffer = true;
        }
        if (this.depthTexture) {
            this.depthTexture._inCurrentFramebuffer = true;
        }

        GLFramebuffer.active = this;
    }

    /**
     * Unbind the framebuffer, switching back to the previous active framebuffer.
     */
    unbind() {
        if (!GLFramebuffer.active) {
            return;
        }

        const gl = this.gl;

        GLFramebuffer.active = this._previousFramebuffer;
        if (this._previousFramebuffer) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this._previousFramebuffer.handle);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        for (let i = 0; i < this.colorTextures.length; ++i) {
            this.colorTextures[i]._inCurrentFramebuffer = false;
        }
        if (this.depthTexture) {
            this.depthTexture._inCurrentFramebuffer = false;
        }
    }

    attach(texture, attachment) {
        if (GLFramebuffer.active !== this) {
            this.bind();
        }

        const gl = this.gl;
        const target = gl.webglVersion == 1 ? gl.FRAMEBUFFER : gl.DRAW_FRAMEBUFFER;

        attachment = attachment || gl.COLOR_ATTACHMENT0;

        if (texture.constructor.isRenderbuffer) {
            this.gl.framebufferRenderbuffer(target, attachment, gl.RENDERBUFFER, 
                texture.handle);
        } else if (texture.constructor.isGLTexture) {
            const textureTarget = texture.target;
            const level = 0;

            this.gl.framebufferTexture2D(target, attachment, textureTarget, texture.handle,
                level);
        }

        const lastColorAttachment = gl.COLOR_ATTACHMENT0 + 16;

        if (attachment === gl.DEPTH_ATTACHMENT || attachment === gl.DEPTH_STENCIL_ATTACHMENT) {
            this.depthTexture = texture;
        } else if ((attachment >= gl.COLOR_ATTACHMENT0) && (attachment <= lastColorAttachment)) {
            const index = attachment - gl.COLOR_ATTACHMENT0;
            if (index >= this.colorTextures.length) {
                this.colorTextures.length = index + 1;
            }
            this.colorTextures[index] = texture;
        }

        if (this._width === -1) {
            this._width = texture.width;
            this._height = texture.height;
        }
    }

    toSingle() {
        if (this.colorTextures.length < 2) {
            return;
        }

        const ext = this.gl.extensions.WEBGL_draw_buffers;
        if (ext) {
            ext.drawBuffersWEBGL([this.order[0]]);
        } else {
            this.gl.drawBuffers([this.order[0]]);
        }
    }

    toMulti() {
        if (this.colorTextures.length < 2) {
            return;
        }

        const ext = this.gl.extensions.WEBGL_draw_buffers;
        if (ext) {
            ext.drawBuffersWEBGL(this.order[0]);
        } else {
            this.gl.drawBuffers(this.order[0]);
        }
    }

    /**
     * Clears only secondary buffers, not the main one.
     */
    clearSecondary(color) {
        if (!this.order || this.order.length < 2) {
            return;
        }

        const gl = this.gl;
        const ext = gl.extensions.WEBGL_draw_buffers;
        const newOrder = [gl.NONE];

        for (let i = 1; i < this.order.length; ++i) {
            newOrder.push(this.order[i]);
        }

        if (ext) {
            ext.drawBuffersWEBGL(newOrder);
        } else {
            gl.drawBuffers(newOrder);
        }

        gl.clearColor(color[0], color[1], color[2], color[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (ext) {
            ext.drawBuffersWEBGL(this.order);
        } else {
            gl.drawBuffers(this.order);
        }
    }

    /**
     * Draw the framebuffer color texture to the screen (or current framebuffer)
     * 
     * @param {int?} colorIndex The color texture to draw, 0 by default
     * @param {GLTexture?} targetTexture Optional texture to draw to, otherwise it will draw to the
     * screen or active framebuffer.
     * @param {GLShader?} shader Optional shader to use.
     * @param {Object?} uniforms Optional uniforms for the shader. 
     */
    blit(colorIndex, targetTexture, shader, uniforms) {
        colorIndex = colorIndex || 0;
        if (colorIndex >= this.colorTextures.length) {
            return;
        }
        this.colorTextures[colorIndex].blit(targetTexture, shader, uniforms);
    }

    _framebufferErrorString(code) {
        switch (code) {
            case this.gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                return "Incomplete Attachment";
            case this.gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                return "Incomplete Dimensions";
            case this.gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                return "Incomplete Missing Attachment";
            case this.gl.FRAMEBUFFER_UNSUPPORTED:
                return "Incomplete Unsupported";
            case this.gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE:
                return "Incomplete Multisample";
        }
        return code;
    }
}

/**
 * The GLFramebuffer currently bound to the active GLContext
 */
GLFramebuffer.active = null;

GLFramebuffer.framebufferCount = 0;
