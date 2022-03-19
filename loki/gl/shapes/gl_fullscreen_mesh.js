import { GLMesh } from "../gl_mesh.js";

export class GLFullscreenMesh extends GLMesh {
    constructor(gl) {
        super(gl, {
            P: new Float32Array([
                -1, -1, 0,
                1, -1, 0,
                -1, 1, 0,
                1, 1, 0]),
            uv: new Float32Array([
                0, 0,
                1, 0,
                0, 1,
                1, 1])
        }, {
            triangles: new Uint16Array([1, 2, 0, 1, 3, 2])
        });
    }
}
