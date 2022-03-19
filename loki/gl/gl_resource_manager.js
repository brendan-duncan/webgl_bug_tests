import { GLFramebuffer } from "./gl_frame_buffer.js";
import { GLFullscreenMesh } from "./shapes/gl_fullscreen_mesh.js";
import { GLTexture } from "./gl_texture.js";
import { GLShader } from "./gl_shader.js";

/**
 * Manages Framebuffers and other resources for a GLContext so that the objects can be re-used.
 * @category GL
 */
export class GLResourceManager {
    /**
     * @param {GLContext} gl 
     */
    constructor(gl) {
        this.gl = gl;
        this._availableFramebuffers = [];
        this._usedFramebuffers = [];
        this._availableTextures = [];
        this._usedTextures = [];
        this._fullscreenMesh = null;
        this._resources = new Map();
    }

    destroy() {
        for (const o of this._availableFramebuffers) {
            o.destroy();
        }

        for (const o of this._usedFramebuffers) {
            o.destroy();
        }

        for (const o of this._availableTextures) {
            o.destroy();
        }

        for (const o of this._usedTextures) {
            o.destroy();
        }

        for (const o of this._resources.values()) {
            o.destroy();
        }

        if (this._fullscreenMesh) {
            this._fullscreenMesh.destroy();
            this._fullscreenMesh = null;
        }

        this._availableFramebuffers.length = 0;
        this._usedFramebuffers.length = 0;
        this._availableTextures.length = 0;
        this._usedTextures.length = 0;
        this._resources.clear();
    }

    getResource(name) {
        return this._resources.get(name);
    }

    hasResource(name) {
        return this._resources.has(name);
    }

    setResource(name, object) {
        if (object === null) {
            this._resources.delete(name);
        } else {
            this._resources.set(name, object);
        }
    }

    removeResource(name) {
        this._resources.delete(name);
    }

    requestTexture(width, height) {
        for (let i = 0, l = this._availableTextures.length; i < l; ++i) {
            const texture = this._availableTextures[i];
            if (texture.width == width && texture.height == height) {
                this._availableTextures.splice(i, 1);
                this._usedTextures.push(texture);
                return texture;
            }
        }

        const texture = new GLTexture(this.gl, { width: width, height: height });
        this._usedTextures.push(texture);

        return texture;
    }

    releaseTexture(texture) {
        for (let i = 0, l = this._usedTextures.length; i < l; ++i) {
            const t = this._usedTextures[i];
            if (t === texture) {
                this._availableTextures.push(texture);
                this._usedTextures.splice(i, 1);
                break;
            }
        }
    }

    /**
     * Request a framebuffer object with the given dimensions.
     * If a FBO had been previously created and released with the same
     * dimensions, then it will be re-used.
     * 
     * @param {number} width The width of the requested framebuffer
     * @param {number} height The height of the requested framebuffer
     * @return {GLFramebuffer}
     */
    requestFramebuffer(width, height) {
        let framebuffer;
        for (let i = 0, l = this._availableFramebuffers.length; i < l; ++i) {
            const fb = this._availableFramebuffers[i];
            if (fb.width == width && fb.height == height) {
                framebuffer = fb;
                this._availableFramebuffers.splice(i, 1);
                break;
            }
        }

        if (!framebuffer) {
            const colorTexture = new GLTexture(this.gl, { width: width, height: height });
            framebuffer = new GLFramebuffer(this.gl, colorTexture);
        }

        this._usedFramebuffers.push(framebuffer);

        return framebuffer;
    }

    /**
     * Release a framebuffer object so that it can be re-used.
     * 
     * @param {GLFramebuffer} frameBuffer
     */
    releaseFramebuffer(frameBuffer) {
        if (!frameBuffer) {
            return;
        }
        for (let i = 0, l = this._usedFramebuffers.length; i < l; ++i) {
            const fb = this._usedFramebuffers[i];
            if (fb === frameBuffer) {
                this._availableFramebuffers.push(fb);
                this._usedFramebuffers.splice(i, 1);
                break;
            }
        }
    }

    /**
     * Release the Framebuffer object that uses the given texture as its
     * colorBuffer.
     * 
     * @param {GLTexture} texture
     */
    releaseFramebufferTexture(texture) {
        for (let i = 0; i < this._usedFramebuffers.length; ++i) {
            const fb = this._usedFramebuffers[i];
            const colorTexture = fb.colorTextures[0];
            if (colorTexture.handle === texture.handle) {
                this._availableFramebuffers.push(fb);
                this._usedFramebuffers.splice(i, 1);
                break;
            }
        }
    }

    /**
     * Returns a GLMesh to render a fullscreen quad.
     * 
     * @return {GLMesh}
     */
    getFullscreenMesh() {
        if (!this._fullscreenMesh) {
            this._fullscreenMesh = new GLFullscreenMesh(this.gl);
        }
        return this._fullscreenMesh;
    }

    /**
     * Shader used for drawing a framebuffer to the screen.
     */
    getBlitShader() {
        if (!this._blitShader) {
            this._blitShader = new GLShader(this.gl,
                `attribute vec3 a_P;
                 attribute vec2 a_uv;
                 varying vec2 v_uv;
                 void main(void) {
                     gl_Position = vec4(a_P, 1.0);
                     v_uv = a_uv;
                 }`,
                 `precision mediump float;
                 uniform sampler2D baseColor;
                 varying vec2 v_uv;
                 void main(void) {
                     gl_FragColor = texture2D(baseColor, v_uv);
                 }`);
        }
        return this._blitShader;
    }
}
