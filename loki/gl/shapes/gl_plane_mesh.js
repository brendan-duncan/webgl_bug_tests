import { GLMesh } from "../gl_mesh.js";
import { Vector3 } from "../../math/vector3.js";

export class GLPlaneMesh extends GLMesh {
    constructor(gl, options) {
        options = options || {};
        options.triangles = [];
        const detailX = options.detailX || options.detail || 1;
        const detailY = options.detailY || options.detail || 1;
        const width = (options.width || options.size || 1) * 0.5;
        const height = (options.height || options.size || 1) * 0.5;
        const xz = options.xz;
        
        const triangles = [];
        const vertices = [];
        const coords = [];
        const normals = [];

        const N = new Vector3(0, 0, 1);
        if (xz) {
            N.setFrom(0, 1, 0);
        }

        for (let y = 0; y <= detailY; y++) {
            const t = y / detailY;
            for (let x = 0; x <= detailX; x++) {
                const s = x / detailX;
                if (xz) {
                    vertices.push((2 * s - 1) * width, 0, -(2 * t - 1) * height);
                } else {
                    vertices.push((2 * s - 1) * width, (2 * t - 1) * height, 0);
                }

                coords.push(s, t);
                normals.push(N[0], N[1], N[2]);

                if (x < detailX && y < detailY) {
                    const i = x + y * (detailX + 1);
                    if (xz) { // horizontal
                        triangles.push(i + 1, i + detailX + 1, i);
                        triangles.push(i + 1, i + detailX + 2, i + detailX + 1);
                    } else { // vertical
                        triangles.push(i, i + 1, i + detailX + 1);
                        triangles.push(i + detailX + 1, i + 1, i + detailX + 2);
                    }
                }
            }
        }

        const vertexData = {
            P: vertices,
            N: normals,
            uv: coords
        };

        super(gl, vertexData, {triangles: triangles});
    }
}
