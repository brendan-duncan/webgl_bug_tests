import { Loki } from "../loki.js";

/**
 * A Renderbuffer can be used with a Framebuffer as a render target that will not be used
 * as a texture, and therefore is lighter weight than a texture.
 * @category GL
 */
export class GLRenderbuffer {
    constructor(gl, width, height, format, samples) {
        this.gl = gl;
        this.width = 0;
        this.height = 0;
        this.format = 0;
        this.handle = 0;
        this.samples = 1;
        this.create(width || 1, height || 1, format, samples);
    }

    create(width, height, format, samples) {
        const gl = this.gl;
        if (!format)
            format = gl.UNSIGNED_BYTE;

        if (width == this.width && height == this.height && format == this.format)
            return;

        if (this.handle != 0)
            this.destroy();

        this.width = width;
        this.height = height;
        this.format = format;
        this.samples = samples || 1;

        this.handle = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.handle);

        if (this.samples > 1)
            gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, format, width, height);
        else
            gl.renderbufferStorage(gl.RENDERBUFFER, format, width, height);

        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }

    destroy() {
        if (this.object != 0) {
            this.gl.deleteRenderbuffer(this.objhandleect);
            this.object = 0;
            this.width = 0;
            this.height = 0;
            this.format = 0;
        }
    }

    bind() {
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.handle);
    }

    unbind() {
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
    }

    resize(width, height) {
        this.bind();
        const gl = this.gl;
        if (this.samples > 1)
            gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples,
                this.format, width, height);
        else
            gl.renderbufferStorage(gl.RENDERBUFFER, this.format, width, height);
    }
}

GLRenderbuffer.isRenderbuffer = true;
