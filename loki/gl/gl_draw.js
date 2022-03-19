import { Loki } from "../loki.js";
import { Log } from "../util/log.js";
import { Vector3 } from "../math/vector3.js";
import { Vector4 } from "../math/vector4.js";
import { Matrix4 } from "../math/matrix4.js";
import { Quaternion } from "../math/quaternion.js";
import { GLMesh } from "./gl_mesh.js";
import { GLShader } from "./gl_shader.js";
import { GLTexture } from "./gl_texture.js";
import { DrawGrid } from "./draw/draw_grid.js";
import { GLSphereMesh } from "./shapes/gl_sphere_mesh.js";

/**
 * Allows for utility type of drawing with GL, for drawing points, lines, sprites, etc.
 * This maintains a drawing state of transforms and color, behaving more similarly to older
 * style Push/Pop GL.
 * @category GL
 */
export class GLDraw {
    constructor(gl) {
        this.gl = gl;
        gl.draw = this;

        this.initialized = false;
        this._drawCalls = 0;

        // TODO: these need to be global
        this.settings = {
            resetStackOnReset: true,
            drawGrid: true,
            gridScale: 1,
            gridAlpha: 0.5,
            gridPlane: "xz",
            drawNames: false,
            drawSkeletons: true,
            drawTree: false,
            drawComponents: true,
            drawNullObjects: true,
            drawAxis: false,
            drawColliders: true,
            drawPaths: true,
            drawColiders: false,
            drawHeight: true,
            drawIcons: true
        };

        this.initialize();
    }

    initialize() {
        if (this.initialized) {
            return;
        }

        const gl = this.gl;

        this._drawGrid = new DrawGrid(gl);

        this.color = new Vector4(0, 0, 0, 1);

        this.mvpMatrix = new Matrix4();
        this.tempMatrix = new Matrix4();
        this.pointSize = 2;
        this.lineWidth = 1;

        this.stack = new Float32Array(16 * 32);
        this.modelMatrix = new Matrix4(this.stack.buffer, 0, 16);
        this.modelMatrix.setIdentity();

        // Matrices
        this.camera = null;
        this.cameraPosition = new Vector3();
        this.viewMatrix = new Matrix4();
        this.projectionMatrix = new Matrix4();
        this.viewProjectionMatrix = new Matrix4();

        this.sphereMesh = new GLSphereMesh(gl, { subdivisions: 16 });

        this.cameraStack = [];

        this.uniforms = {
            u_model: this.modelMatrix,
            u_vew: this.viewMatrix,
            u_projection: this.projectionMatrix,
            u_viewProjection: this.viewProjectionMatrix,
            u_mvp: this.mvpMatrix,
            u_color: this.color,
            u_cameraPosition: this.cameraPosition,
            u_pointSize: this.pointSize,
            u_pointPerspective: 0,
            u_perspective: 1,
            u_texture: 0
        };

        this._temp = new Vector3();

        this._rectangleVertices = new Float32Array(4 * 3);

        this._wireBoxVertices = new Float32Array(8 * 3);
        this._wireBoxIndices = new Uint16Array([0,1, 0,4, 0,3, 1,2, 1,5, 2,3, 2,6, 3,7,
            4,5, 4,7, 6,7, 5,6]);

        this._wireSphereVertices = new Float32Array(100 * 2 * 3 *3);

        this._circleVertices = new Float32Array(32 * 3);

        const vertices = [-1, 1, 0, 1, 1, 0, 1, -1, 0, -1, -1, 0];
        const coords = [0, 1, 1, 1, 1, 0, 0, 0];
        this.quadMesh = GLMesh.load(gl, { P: vertices, uv: coords });

        const vertexShader = GLDraw.vertexShaderCode;
        const fragmentShader = GLDraw.fragmentShaderCode;

        this.shader = new GLShader(gl, vertexShader, fragmentShader);
        this.shaderInstancing = new GLShader(gl, vertexShader, fragmentShader, {
            "USE_INSTANCING": ""
        });
        this.shaderColor = new GLShader(gl, vertexShader, fragmentShader, {
            "USE_COLOR": ""
        });
        this.shaderColor_instancing = new GLShader(gl, vertexShader, fragmentShader, {
            "USE_COLOR": "",
            "USE_INSTANCING": ""
        });
        this.shaderTexture = new GLShader(gl, vertexShader, fragmentShader,{
            "USE_TEXTURE": ""
        });
        this.shaderTextureInstancing = new GLShader(gl, vertexShader, fragmentShader, {
            "USE_TEXTURE": "",
            "USE_INSTANCING": ""
        });
        this.shaderPoints = new GLShader(gl, vertexShader, fragmentShader, {
            "USE_POINTS": ""
        });
        this.shaderPointsColor = new GLShader(gl, vertexShader, fragmentShader, {
            "USE_COLOR": "",
            "USE_POINTS": ""
        });
        this.shaderPointsColorSize = new GLShader(gl, vertexShader, fragmentShader, {
            "USE_COLOR": "",
            "USE_SIZE": "",
            "USE_POINTS": ""
        });

        this.shaderImage = new GLShader(gl, 
           `precision mediump float;
            attribute vec3 a_P;
            uniform mat4 u_mvp;
            uniform float u_pointSize;
            void main() {
                gl_PointSize = u_pointSize;
                gl_Position = u_mvp * vec4(a_P, 1.0);
            }`,
           `precision mediump float;
            uniform vec4 u_color;
            uniform sampler2D u_texture;
            void main() {
                vec4 tex = texture2D(u_texture, vec2(gl_PointCoord.x,1.0 - gl_PointCoord.y) );
                if (tex.a < 0.01) {
                    discard;
                }
                gl_FragColor = u_color * tex;
            }`);

        this.shaderPointsColorTextureSize = new GLShader(gl,
            `precision mediump float;
            attribute vec3 a_P;
            attribute vec4 a_Cd;
            attribute float a_size;
            uniform mat4 u_mvp;
            uniform float u_pointSize;
            varying vec4 v_color;
            void main() {
                v_color = a_Cd;
                gl_PointSize = u_pointSize * a_size;
                gl_Position = u_mvp * vec4(a_P, 1.0);
            }`,
            `precision mediump float;
            uniform vec4 u_color;
            varying vec4 v_color;
            uniform sampler2D u_texture;
            void main() {
                vec4 tex = texture2D(u_texture, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
                if (tex.a < 0.1) {
                    discard;
                }
                vec4 color = u_color * v_color * tex;
                gl_FragColor = color;
            }`);

        this.shaderTexture2D = new GLShader(gl, `
            precision mediump float;
            attribute vec3 a_P;
            uniform mat4 u_mvp;
            uniform float u_pointSize;
            void main() {
                gl_PointSize = u_pointSize;
                gl_Position = u_mvp * vec4(a_P, 1.0);
            }`, `
            precision mediump float;
            uniform vec4 u_color;
            uniform sampler2D u_texture;
            void main() {
                vec4 tex = texture2D(u_texture, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
                if (tex.a < 0.1) {
                    discard;
                }
                vec4 color = u_color * tex;
                gl_FragColor = color;
            }`);

        // create shaders
        const phongVertexCode = `
            precision mediump float;
            attribute vec3 a_P;
            attribute vec3 a_N;
            varying vec3 v_pos;
            varying vec3 v_N;
            #ifdef USE_INSTANCING
                attribute mat4 u_model;
            #else
                uniform mat4 u_model;
            #endif
            uniform mat4 u_viewprojection;
            void main() {
                v_pos = ( u_model * vec4( a_P, 1.0 )).xyz;
                v_N = (u_model * vec4(a_N,0.0)).xyz;
                gl_Position = u_viewprojection * vec4( v_pos, 1.0 );
            }`;
        
        const phongPixelShader = `
            precision mediump float;
            uniform vec3 u_ambientColor;
            uniform vec3 u_lightColor;
            uniform vec3 u_lightDir;
            uniform vec4 u_color;
            varying vec3 v_pos;
            varying vec3 v_N;
            void main() {
                vec3 N = normalize(v_N);
                float NdotL = max(0.0, dot(N, u_lightDir));
                gl_FragColor = u_color * vec4(u_ambientColor + u_lightColor * NdotL, 1.0);
            }`;

        this.shaderPhong = new GLShader(gl, phongVertexCode, phongPixelShader);
        this.shaderPhongInstanced = new GLShader(gl, phongVertexCode, phongPixelShader, {
            "USE_INSTANCING":""
        });
        
        const phongUniforms = {
            u_ambientColor:[0.1, 0.1, 0.1],
            u_lightColor:[0.8, 0.8, 0.8],
            u_lightDir: [0, 1, 0]
        };
        this.shaderPhong.setUniforms(phongUniforms);
        this.shaderPhongInstanced.setUniforms(phongUniforms);

        // create shaders
        this.shaderDepth = new GLShader(gl, `
            precision mediump float;
            attribute vec3 a_P;
            varying vec4 v_pos;
            uniform mat4 u_model;
            uniform mat4 u_mvp;
            void main() {
                v_pos = u_model * vec4(a_P, 1.0);
                gl_Position = u_mvp * vec4(a_P, 1.0);
            }`, `
            precision mediump float;
            varying vec4 v_pos;
            vec4 PackDepth32(float depth) {
                const vec4 bitSh  = vec4(256*256*256, 256*256, 256, 1);
                const vec4 bitMsk = vec4(0, 1.0/256.0, 1.0/256.0, 1.0/256.0);
                vec4 comp;
                comp = depth * bitSh;
                comp = fract(comp);
                comp -= comp.xxyz * bitMsk;
                return comp;
            }
            void main() {
                float depth = (v_pos.z / v_pos.w) * 0.5 + 0.5;
                gl_FragColor = PackDepth32(depth);
            }`);

        this.initialized = true;
    }

    setCamera(camera) {
        this.camera = camera;
        if (!camera) {
            return;
        }

        camera.aspect = this.gl.viewportData[2] / this.gl.viewportData[3];
        camera.updateMatrices();

        camera.getWorldPosition(this.cameraPosition);

        this.viewMatrix.set(camera._worldToViewMatrix);
        this.projectionMatrix.set(camera._projectionMatrix);

        this.viewProjectionMatrix.set(camera.worldToProjectionMatrix);
        
        this.uniforms.u_perspective = this.gl.viewportData[3] * this.viewProjectionMatrix[5];

        this._drawGrid.setCamera(camera);
    }

    drawEditorHelpers(camera/*, scene*/) {
        camera = camera || Loki.activeCamera;

        this.setCamera(camera);

        const gl = this.gl;
        const settings = this.settings;

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.disable(gl.CULL_FACE);
        gl.depthFunc(gl.LEQUAL);

        if (settings.drawGrid && settings.gridAlpha > 0) {
            this.drawGrid();
        }

        /*let cullCamera = null;
        const cameras = [];
        scene.onGetRenderCameras.emit(cameras);
        if (cameras.length) {
            cullCamera = cameras[0];
        }

        if (cullCamera) {
            const frustum = cullCamera.frustum;

            const self = this;
            scene.recursiveAction(function(n) {
                if (!n.visibleInHierarchy) {
                    return;
                }

                if (n.updateBoundingBox) {
                    n.updateBoundingBox();
                }

                const bounds = n.worldBounds;
                if (bounds === undefined) {
                    return;
                }

                const clip = frustum.testBoundingBox(bounds);

                if (clip == Clip.Outside) {
                    self.setColor([1, 0, 0, 1]);
                } else {
                    self.setColor([0, 1, 0, 1]);
                }
                self.drawWireBox(bounds.min, bounds.max);
            });
        }*/

        gl.enable(gl.CULL_FACE);
        gl.depthFunc(gl.LESS);
    }

    drawGrid() {
        this._drawGrid.draw();
    }

    /**
     * A helper to create shaders when you only want to specify some basic shading.
     * @param {String} surfaceFunction 
     * @param {*} uniforms 
     * @param {*} macros 
     */
    createSurfaceShader(surfaceFunction, uniforms, macros) {
        if (surfaceFunction.indexOf("surfaceFunction") == -1) {
            surfaceFunction = 
                `vec4 surfaceFunction(vec3 pos, vec3 normal, vec2 coord) { ${surfaceFunction} }`;
        }

        if (uniforms) {
            if (uniforms.constructor === String) {
                surfaceFunction = `${uniforms};\n${surfaceFunction}`;
            } else {
                for (const i in uniforms) {
                    surfaceFunction += `uniform ${uniforms[i]} $i;\n`;
                }
            }
        }

        const vertexShader = `
            precision mediump float;
            attribute vec3 a_P;
            attribute vec3 a_N;
            attribute vec2 a_uv;
            varying vec2 v_uv;
            varying vec3 v_pos;
            varying vec3 v_N;
            uniform mat4 u_mvp;
            uniform mat4 u_model;
            void main() {
                v_uv = a_uv;
                v_pos = (u_model * vec4(a_P, 1.0)).xyz;
                v_N = (u_model * vec4(a_N, 0.0)).xyz;
                gl_Position = u_mvp * vec4(a_P, 1.0);
            }`;

        const fragmentShader = `
            precision mediump float;
            varying vec2 v_uv;
            varying vec3 v_pos;
            varying vec3 v_N;
            uniform vec4 u_color;
            uniform vec3 u_cameraPosition;
            uniform sampler2D u_texture;
            ${surfaceFunction}
            void main() {
                gl_FragColor = surface_function(v_pos, v_N, v_uv);
            }`;

        return new GLShader(this.gl, vertexShader, fragmentShader, macros);
    }

    /**
     * Reset the stack
     * @param {bool} resetMemory 
     */
    reset(resetMemory) {
        this.color.setFrom(1, 1, 1, 1);
        this.pointSize = 2;
        this.lineWidth = 1;

        if (resetMemory) {
            this.images = {};
        }

        if (this.resetStackOnReset) {
            this.modelMatrix = new Matrix4(this.stack.buffer, 0, 16);
            this.uniforms.u_model = this.modelMatrix;
            this.modelMatrix.setIdentity();
        }
    }

    /**
     * Set the color used to draw primitives
     * @param {Array} color 
     */
    setColor(color) {
        if (arguments.length >= 3) {
            this.color[0] = arguments[0];
            this.color[1] = arguments[1];
            this.color[2] = arguments[2];
            if (arguments.length == 4) {
                this.color[3] = arguments[3];
            }
        } else {
            for (let i = 0; i < color.length; i++) {
                this.color[i] = color[i];
            }
        }
    }

    /**
     * Sets the alpha used to draw primitives
     * @param {number} alpha 
     */
    setAlpha(alpha) {
        this.color[3] = alpha;
    }

    /**
     * Set the point size
     * @param {number} v 
     * @param {bool} perspective 
     */
    setPointSize(v, perspective) {
        this.pointSize = v;
        this.uniforms.u_pointSize = v;
        this.uniforms.u_pointPerspective = perspective ? 1 : 0;
    }

    /**
     * Set the line width
     * @param {number} v 
     */
    setLineWidth(v) {
        if (this.gl.setLineWidth) {
            this.gl.setLineWidth(v);
        } else {
            this.gl.lineWidth(v);
        }
        this.lineWidth = v;
    }

    setCameraPosition(position) {
        this.cameraPosition.set(position);
    }

    pushCamera() {
        this.cameraStack.push(new Matrix4(this.viewProjectionMatrix));
    }

    popCamera() {
        if (this.cameraStack.length == 0) {
            throw "Too many calls to popCamera";
        }
        this.viewProjectionMatrix.set(this.cameraStack.pop());
    }

    setViewProjectionMatrix(view, projection, vp) {
        this.viewMatrix.set(view);
        this.projectionMatrix.set(projection);
        if (vp) {
            this.viewProjectionMatrix.set(vp);
        } else {
            Matrix4.multiply(this.projectionMatrix, this.viewMatrix, this.viewProjectionMatrix);
        }
    }

    setMatrix(matrix) {
        this.modelMatrix.set(matrix);
    }

    multMatrix(matrix) {
        Matrix4.multiply(matrix, this.modelMatrix, this.modelMatrix);
    }

    push() {
        if (this.modelMatrix.byteOffset >= (this.stack.byteLength - 16*4)) {
            throw "Matrix stack overflow";
        }

        const old = this.modelMatrix;
        this.modelMatrix = new Matrix4(this.stack.buffer, this.modelMatrix.byteOffset + 16*4, 16);
        this.uniforms.u_model = this.modelMatrix;
        this.modelMatrix.set(old);
    }

    pop() {
        if (this.modelMatrix.byteOffset == 0) {
            throw "Matrix stack underflow";
        }
        this.modelMatrix = new Matrix4(this.stack.buffer, this.modelMatrix.byteOffset - 16*4, 16);
        this.uniforms.u_model = this.modelMatrix;
    }

    identity() {
        this.modelMatrix.setIdentity();
    }

    scale(x, y, z) {
        if (arguments.length == 3) {
            const temp = this._temp;
            temp[0] = x;
            temp[1] = y;
            temp[2] = z;
            this.modelMatrix.scale(temp);
        } else if (x.length) {
            this.modelMatrix.scale(x);
        } else {
            const temp = this._temp;
            temp[0] = x;
            temp[1] = x;
            temp[2] = x;
            this.modelMatrix.scale(temp);
        }
    }

    translate(x, y, z) {
        if (arguments.length == 3) {
            const temp = this._temp;
            temp[0] = x;
            temp[1] = y;
            temp[2] = z;
            this.modelMatrix.translate(temp);
        } else {
            this.modelMatrix.translate(x);
        }
    }

    rotate(angle, x, y, z) {
        if (arguments.length === 4) {
            const temp = this._temp;
            temp[0] = x;
            temp[1] = y;
            temp[2] = z;
            this.modelMatrix.rotateAxisAngle(angle, temp);
        } else {
            this.modelMatrix.rotateAxisAngle(angle, x);
        }
    }

    lookAt(position, target, up) {
        this.modelMatrix.setLookAt(position, target, up);
        this.modelMatrix.invert();
    }

    billboard(position) {
        Matrix4.invert(this.viewMatrix, this.modelMatrix);
        this.modelMatrix.translate(position);
    }

    /**
     * Draw lines given a set of points.
     * @param {*} lines 
     * @param {*} colors 
     * @param {*} strip 
     * @param {*} loop 
     */
    drawLines(lines, colors, strip, loop) {
        if (!lines || !lines.length) {
            return;
        }

        const vertices = lines.constructor == Float32Array ? lines : this.linearize(lines);

        if (colors) {
            colors = colors.constructor == Float32Array ? colors : this.linearize(colors);
        }

        if (colors && (colors.length / 4) != (vertices.length / 3)) {
            colors = null;
        }

        const gl = this.gl;

        const type = loop ? gl.LINE_LOOP : strip ? gl.LINE_STRIP : gl.LINES;

        const mesh = this.toGlobalMesh({ P: vertices, Cd: colors });

        return this.drawMesh(mesh, type, colors ? this.shaderSolor : this.shader,
            undefined, 0, vertices.length / 3);
    }

    /**
     * Draw points given a set of positions
     * @param {*} points 
     * @param {*} colors 
     * @param {*} shader 
     */
    drawPoints(points, colors, shader) {
        if (!points || !points.length) {
            return;
        }

        let vertices = null;
        if (points.constructor == Float32Array) {
            vertices = points;
        } else if (points[0].length) { // array of arrays
            vertices = this.linearize(points);
        } else {
            vertices = new Float32Array(points);
        }

        if (colors && colors.constructor != Float32Array) {
            if (colors.constructor === Array && colors[0].constructor === Number) {
                colors = new Float32Array( colors );
            } else {
                colors = this.linearize(colors);
            }
        }

        const mesh = this.toGlobalMesh({ P: vertices, Cd: colors });
        if (!shader) {
            shader = colors ? this.shader_color : this.shader;
        }

        return this.drawMesh(mesh, this.gl.POINTS, shader, undefined, 0, vertices.length / 3);
    }

    /**
     * Draw round points given a set of positions
     * @param {*} points 
     * @param {*} colors 
     * @param {*} shader 
     */
    drawRoundPoints(points, colors, shader) {
        if (!points || !points.length) {
            return;
        }

        let vertices = null;
        if (points.constructor == Float32Array) {
            vertices = points;
        } else if (points[0].length) { // array of arrays
            vertices = this.linearize(points);
        } else {
            vertices = new Float32Array(points);
        }

        if (colors) {
            colors = colors.constructor == Float32Array ? colors : this.linearize(colors);
        }

        const mesh = this.toGlobalMesh({ P: vertices, Cd: colors });
        if (!shader) {
            shader = colors ? this.shaderPointsColor : this.shaderPoints;
        }

        return this.drawMesh(mesh, this.gl.POINTS, shader, undefined, 0, vertices.length / 3);
    }

    /**
     * Draw points with color, size, and texture
     * @param {*} points 
     * @param {*} colors 
     * @param {*} sizes 
     * @param {*} texture 
     * @param {*} shader 
     */
    drawPointsWithSize(points, colors, sizes, texture, shader) {
        if (!points || !points.length) {
            return;
        }

        if (!colors || !sizes) {
            return;
        }

        let vertices = null;
        if (points.constructor === Float32Array) {
            vertices = points;
        } else if (points[0].length) {
            vertices = this.linearize(points);
        } else {
            vertices = new Float32Array(points);
        }

        colors = colors.constructor === Float32Array ? colors : this.linearize(colors);

        sizes = sizes.constructor === Float32Array ? sizes : this.linearize(sizes);

        const mesh = this.toGlobalMesh({ P: vertices, Cd: colors, size: sizes });
        shader = shader || (texture ? this.shaderPointsColorTextureSize :
            this.shaderPointsColorSize);

        return this.drawMesh(mesh, this.gl.POINTS, shader, undefined, 0, vertices.length / 3);
    }

    createRectangleMesh(width, height, inZ, useGlobal) {
        const vertices = this._rectangleVertices;

        if (inZ) {
            vertices.set([-width * 0.5, 0, height * 0.5,
                width * 0.5, 0, height * 0.5,
                width * 0.5, 0, -height * 0.5,
                -width * 0.5, 0, -height * 0.5]);
        } else {
            vertices.set([-width * 0.5, height * 0.5, 0, 
                width * 0.5, height * 0.5, 0,
                width * 0.5, -height * 0.5, 0,
                -width * 0.5, -height * 0.5, 0]);
        }

        if (useGlobal) {
            return this.toGlobalMesh({ P: vertices });
        }

        return GLMesh.load(this.gl, { P: vertices });
    }

    drawRectangle(width, height, inZ, fill) {
        const mesh = this.createRectangleMesh(width, height, inZ, true);
        return this.drawMesh(mesh, fill ? this.gl.TRIANGLE_FAN : this.gl.LINE_LOOP,
            undefined, undefined, 0, this._globalMeshLastSize);
    }

    createCircleMesh(radius, segments, inZ, useGlobal) {
        segments = segments || 32;
        const temp = this._temp;
        const vertices = segments == 32 ? this._circleVertices : new Float32Array(segments * 3);
        const offset = 2 * Math.PI / segments;

        for (let i = 0; i < segments; ++i) {
            temp[0] = Math.sin(offset * i) * radius;
            if (inZ) {
                temp[1] = 0;
                temp[2] = Math.cos(offset * i) * radius;
            } else {
                temp[2] = 0;
                temp[1] = Math.cos(offset * i) * radius;
            }

            vertices.set(temp, i * 3);
        }

        if (useGlobal) {
            return this.toGlobalMesh({ P: vertices });
        }

        return GLMesh.load(this.gl, { P: vertices });
    }

    drawCircle(radius, segments, inZ, filled) {
        const mesh = this.createCircleMesh(radius, segments, inZ, true);
        return this.drawMesh(mesh, filled ? this.gl.TRIANGLE_FAN : this.gl.LINE_LOOP,
            undefined, undefined, 0, this._globalMeshLastSize);
    }

    drawSolidCircle(radius, segments, inZ) {
        this.drawCircle(radius, segments, inZ, true);
    }

    createWireBoxMesh(min, max, useGlobal) {
        const vertices = this._wireBoxVertices;
        vertices.set([min[0], max[1], max[2],
            min[0], max[1], min[2],
            max[0], max[1], min[2],
            max[0], max[1], max[2],
            min[0], min[1], max[2],
            min[0], min[1], min[2],
            max[0], min[1], min[2],
            max[0], min[1], max[2]]);

        if (useGlobal) {
            return this.toGlobalMesh({ P: vertices}, this._wireBoxIndices);
        }

        return GLMesh.load(this.gl, { P: vertices });
    }

    drawWireBox(min, max) {
        const mesh = this.createWireBoxMesh(min, max, true);
        return this.drawMesh(mesh, this.gl.LINES, undefined, "indices", 0,
            this._globalMeshLastSize);
    }

    createSolidBoxMesh(sizex, sizey, sizez, useGlobal) {
        sizex *= 0.5;
        sizey *= 0.5;
        sizez *= 0.5;
        const vertices = [-sizex, sizey, -sizez,
            -sizex, -sizey, sizez,
            -sizex, sizey, sizez,
            -sizex, sizey, -sizez,
            -sizex, -sizey, -sizez,
            -sizex, -sizey, sizez,
            sizex, sizey, -sizez,
            sizex, sizey, sizez,
            sizex, -sizey, sizez,
            sizex, sizey, -sizez,
            sizex, -sizey, sizez,
            sizex, -sizey, -sizez,
            -sizex, sizey, sizez,
            sizex, -sizey, sizez,
            sizex, sizey, sizez,
            -sizex, sizey, sizez,
            -sizex, -sizey, sizez,
            sizex, -sizey, sizez,
            -sizex, sizey, -sizez,
            sizex, sizey, -sizez,
            sizex, -sizey, -sizez,
            -sizex, sizey, -sizez,
            sizex, -sizey, -sizez,
            -sizex, -sizey, -sizez,
            -sizex, sizey, -sizez,
            sizex, sizey, sizez,
            sizex, sizey, -sizez,
            -sizex, sizey, -sizez,
            -sizex, sizey, sizez,
            sizex, sizey, sizez,
            -sizex, -sizey, -sizez,
            sizex, -sizey, -sizez,
            sizex, -sizey, sizez,
            -sizex, -sizey, -sizez,
            sizex, -sizey, sizez,
            -sizex, -sizey, sizez];

        if (useGlobal) {
            return this.toGlobalMesh({ P: vertices });
        }

        return GLMesh.load(this.gl, { P: vertices });
    }

    drawSolidBox(sizex, sizey, sizez) {
        const mesh = this.createSolidBoxMesh(sizex, sizey, sizez, true);
        const gl = this.gl;
        return this.drawMesh(mesh, gl.TRIANGLES, undefined, undefined, 0, this._globalMeshLastSize);
    }

    createWireSphereMesh(radius, segments, useGlobal) {
        segments = segments || 100;

        const vertices = segments == 100 ? this._wireSphereVertices :
            new Float32Array(segments * 2 * 3 * 3);
        const temp = this._temp;

        const delta = 1.0 / segments * Math.PI * 2;

        for (let i = 0; i < segments; ++i) {
            temp.setFrom(Math.sin(i * delta) * radius, Math.cos(i * delta) * radius, 0);
            vertices.set(temp, i * 18);
            temp.setFrom(Math.sin((i + 1) * delta) * radius, Math.cos((i + 1) * delta) * radius, 0);
            vertices.set(temp, i * 18 + 3);

            temp.setFrom(Math.sin(i * delta) * radius, 0, Math.cos(i * delta) * radius);
            vertices.set(temp, i * 18 + 6);
            temp.setFrom(Math.sin((i + 1) * delta) * radius, 0, Math.cos((i + 1) * delta) * radius);
            vertices.set(temp, i * 18 + 9);

            temp.setFrom(0, Math.sin(i * delta) * radius, Math.cos(i * delta) * radius);
            vertices.set(temp, i * 18 + 12);
            temp.setFrom(0, Math.sin((i + 1) * delta) * radius, Math.cos((i + 1) * delta) * radius);
            vertices.set(temp, i * 18 + 15);
        }

        if (useGlobal) {
            return this.toGlobalMesh({ P: vertices });
        }

        return GLMesh.load(this.gl, { P: vertices });
    }

    drawWireSphere(radius, segments) {
        const gl = this.gl;
        const mesh = this.createWireSphereMesh(radius, segments, true);
        return this.drawMesh(mesh, gl.LINES, undefined, undefined, 0, this._globalMeshLastSize);
    }

    createConeMesh(radius, height, segments, inZ, useGlobal) {
        const axis = [0, 1, 0];
        segments = segments || 100;
        const R = new Quaternion();
        const temp = this._temp;
        const vertices = new Float32Array((segments + 2) * 3);
        vertices.set(inZ ? [0, 0, height] : [0, height, 0], 0);

        for (let i = 0; i <= segments; i++) {
            R.setAxisAngle(axis, 2 * Math.PI * (i / segments));
            R.transformVector3([0, 0, radius], temp);

            if (inZ) {
                temp.setFrom(temp[0], temp[2], temp[1]);
            }
            vertices.set(temp, i * 3 + 3);
        }

        if (useGlobal) {
            return this.toGlobalMesh({ P: vertices });
        }

        return GLMesh.load(this.gl, { P: vertices });
    }

    drawCone(radius, height, segments, inZ) {
        const mesh = this.createConeMesh(radius, height, segments, inZ, true);
        return this.drawMesh(mesh, this.gl.TRIANGLE_FAN, undefined, undefined, 0,
            this._globalMeshLastSize);
    }

    createCylinderMesh(radius, height, segments, useGlobal) {
        const axis = [0, 1, 0];
        segments = segments || 100;
        const R = new Quaternion();
        const temp = this._temp;
        const vertices = new Float32Array((segments + 1) * 3 * 2);

        for (let i = 0; i <= segments; i++) {
            R.setAxisAngle(axis, 2 * Math.PI * (i/segments));
            R.transformVector3([0, 0, radius], temp);
            vertices.set(temp, i * 3 * 2 + 3);
            temp[1] = height;
            vertices.set(temp, i * 3 * 2);
        }

        if (useGlobal) {
            return this.toGlobalMesh({ P: vertices });
        }

        return GLMesh.load(this.gl, { P: vertices });
    }

    /**
     * Draws a cylinder
     * @param {*} radius 
     * @param {*} height 
     * @param {*} segments 
     */
    drawCylinder(radius, height, segments) {
        const mesh = this.createCylinderMesh(radius, height, segments, true);
        return this.drawMesh(mesh, this.gl.TRIANGLE_STRIP, undefined, undefined, 0,
            this._globalMeshLastSize);
    }

    drawPlane(position, size, texture, shader) {
        if (!position || !size) {
            return;
        }

        this.push();
        this.translate(position);
        this.scale(size[0], size[1], 1);
        if (texture) {
            texture.bind(0);
        }

        if (!shader && texture) {
            shader = this.shaderTexture2D;
        }

        this.drawMesh(this.quadMesh, this.gl.TRIANGLE_FAN, shader);

        if (texture) {
            texture.unbind(0);
        }

        this.pop();
    }

    // Draw an image as a 2D billboard
    drawImage(position, image, size, fixedSize) {
        if (!position || !image) {
            throw "Draw.drawImage param missing";
        }

        size = size || 10;

        const gl = this.gl;
        let texture = null;
        if (image.constructor === String) {
            const asset = Loki.assetManager.load(image, function(asset, loaded) {
                if (loaded) {
                    gl.requestFrame();
                }
            });
            if (!asset || !asset.isLoaded) {
                return;
            }
            asset.minFilter = gl.LINEAR;
            texture = asset.getRenderAsset(gl).glObject;
        } else if (image.constructor === GLTexture) {
            texture = image;
        }

        if (!texture) {
            return;
        }

        if (fixedSize) {
            this.setPointSize(size);
            texture.bind(0);
            gl.bindSampler(0, null);
            this.drawPoints(position, null, this.shaderImage);
            texture.unbind();
        } else {
            this.push();
            this.billboard(position);
            this.scale(size, size, size);
            texture.bind(0);
            gl.bindSampler(0, null);
            this.drawMesh(this.quadMesh, gl.TRIANGLE_FAN, this.shaderTexture);
            texture.unbind();
            this.pop();
        }
    }

    /**
     * Draw the given mesh, applying the stack transformations
     * @param {*} mesh 
     * @param {*} primitive 
     * @param {*} shader 
     * @param {*} indices 
     * @param {*} rangeStart 
     * @param {*} rangeLength 
     */
    drawMesh(mesh, primitive, shader, indices, rangeStart, rangeLength) {
        if (!mesh) {
            throw "ImmediateRender.drawMesh mesh cannot be null";
        }

        if (!shader) {
            if (mesh === this._globalMesh && this._globalMeshIgnoreColors) {
                shader = this.shader;
            } else {
                shader = mesh.vertexBuffers["Cd"] ? this.shaderColor : this.shader;
            }
        }

        Matrix4.multiply(this.viewProjectionMatrix, this.modelMatrix,
            this.mvpMatrix);

        shader.setUniforms(this.uniforms);

        if (rangeStart === undefined) {
            shader.drawMesh(mesh, primitive === undefined ? this.gl.TRIANGLES : primitive,
                indices);
        } else {
            shader.drawRange(mesh, primitive === undefined ? this.gl.TRIANGLES : primitive,
                rangeStart, rangeLength, indices);
        }

        // used for repeating draws 
        this._lastMesh = mesh;
        this._lastPrimitive = primitive;
        this._lastShader = shader;
        this._lastIndices = indices;
        this._lastRangeStart = rangeStart;
        this._lastRangeLength = rangeLength;
        this._drawCalls++;

        this.lastMesh = mesh;

        return mesh;
    }

    // Repeat the last mesh render
    drawLastMesh() {
        this.drawMesh(this._lastMesh,
            this._lastPrimitive,
            this._lastShader,
            this._lastIndices,
            this._lastRangeStart,
            this._lastRangeLength);
    }

    linearize(array) {
        if (!array.length) {
            return [];
        }
        if (array[0].constructor === Number) { // array of numbers
            return array.constructor === Float32Array ? array : new Float32Array(array);
        }

        // linearize
        const n = array[0].length; //assuming all values have the same size!
        const result = new Float32Array(array.length * n);
        const l = array.length;
        for (let i = 0; i < l; ++i) {
            result.set(array[i], i * n);
        }
        return result;
    }

    /**
     * Reuses a global mesh to avoid fragmenting the VRAM
     * @param {*} buffers 
     * @param {*} indices 
     */
    toGlobalMesh(buffers, indices) {
        if (!this._globalMesh) {
            // global mesh: to reuse memory and save fragmentation
            this._globalMeshMaxVertices = 1024;
            this._globalMesh = new GLMesh(this.gl, {
                P: new Float32Array(this._globalMeshMaxVertices * 3),
                N: new Float32Array(this._globalMeshMaxVertices * 3),
                uv: new Float32Array(this._globalMeshMaxVertices * 2),
                Cd: new Float32Array(this._globalMeshMaxVertices * 4),
                size: new Float32Array(this._globalMeshMaxVertices * 1)
            }, {
                indices: new Uint16Array(this._globalMeshMaxVertices * 3)
            }, { streamType: this.gl.DYNAMIC_STREAM });
        }

        // take every stream and store it inside the mesh buffers
        for (const i in buffers) {
            let meshBuffer = this._globalMesh.getBuffer(i);
            if (!meshBuffer) {
                Log.warning("Draw: global mesh lacks one buffer:", i);
                continue;
            }

            let bufferData = buffers[i];
            if (!bufferData) {
                continue;
            }

            if (!bufferData.buffer) {
                bufferData = new Float32Array(bufferData); // force typed arrays
            }

            // some data would be lost here
            if (bufferData.length > (this._globalMeshMaxVertices * meshBuffer.itemSize)) {
                Log.warning("Draw: data is too big, resizing" );
                this.resizeGlobalMesh();
                meshBuffer = this._globalMesh.getBuffer(i);
                bufferData = bufferData.subarray(0, meshBuffer.data.length);
            }

            meshBuffer.upload(bufferData); // set and upload
        }

        this._globalMeshIgnoreColors = !(buffers.Cd);

        if (indices) {
            const meshBuffer = this._globalMesh.getIndexBuffer("indices");
            meshBuffer.setData(indices);
            this._globalMeshLastSize = indices.length;
        } else {
            this._globalMeshLastSize = buffers["P"].length / 3;
        }

        return this._globalMesh;
    }

    resizeGlobalMesh() {
        if (!this._globalMesh) {
            throw "No global mesh to resize";
        }

        // global mesh: to reuse memory and save fragmentation
        this._globalMeshMaxVertices = this._globalMeshMaxVertices * 2;
        this._globalMesh.deleteBuffers();

        this._globalMesh = new GLMesh(this.gl, {
            P: new Float32Array(this._globalMeshMaxVertices * 3),
            N: new Float32Array(this._globalMeshMaxVertices * 3),
            uv: new Float32Array(this._globalMeshMaxVertices * 2),
            Cd: new Float32Array(this._globalMeshMaxVertices * 4),
            size: new Float32Array(this._globalMeshMaxVertices * 1)
        }, {
            indices: new Uint16Array(this._globalMeshMaxVertices * 3)
        }, { streamType: this.gl.DYNAMIC_STREAM });
    }
}

GLDraw.vertexShaderCode = `
precision mediump float;
attribute vec3 a_P;
varying vec3 v_vertex;
attribute vec3 a_N;
varying vec3 v_N;
#ifdef USE_COLOR
    attribute vec4 a_Cd;
    varying vec4 v_color;
#endif
#ifdef USE_TEXTURE
    attribute vec2 a_uv;
    varying vec2 v_uv;
#endif
#ifdef USE_INSTANCING
    attribute mat4 u_model;
#else
    uniform mat4 u_model;
#endif
#ifdef USE_SIZE
    attribute float a_size;
#else
    uniform float u_pointSize;
#endif
uniform mat4 u_viewProjection;
uniform float u_perspective;
uniform float u_pointPerspective;
float computePointSize(float radius, float w) {
    if (radius < 0.0) {
        return -radius;
    }
    return u_perspective * radius / w;
}
void main() {
    #ifdef USE_TEXTURE
        v_uv = a_uv;
    #endif
    #ifdef USE_COLOR
        v_color = a_Cd;
    #endif
    v_vertex = (u_model * vec4(a_P, 1.0)).xyz;
    v_N = (u_model * vec4(a_N, 0.0)).xyz;
    gl_Position = u_viewProjection * vec4(v_vertex, 1.0);
    #ifdef USE_SIZE
        gl_PointSize = a_size;
    #else
        gl_PointSize = u_pointSize;
    #endif
    if (u_pointPerspective != 0.0) {
        gl_PointSize = computePointSize(gl_PointSize, gl_Position.w);
    }
}`;

GLDraw.fragmentShaderCode = `
precision mediump float;
uniform vec4 u_color;
#ifdef USE_COLOR
    varying vec4 v_color;
#endif
#ifdef USE_TEXTURE
    varying vec2 v_uv;
    uniform sampler2D u_texture;
#endif
void main() {
    vec4 color = u_color;
    #ifdef USE_TEXTURE
        color *= texture2D(u_texture, v_uv);
        if (color.a < 0.1) {
            discard;
        }
    #endif
    #ifdef USE_POINTS
        float dist = length(gl_PointCoord.xy - vec2(0.5));
        if (dist > 0.45) {
            discard;
        }
    #endif
    #ifdef USE_COLOR
        color *= v_color;
    #endif
    gl_FragColor = color;
}`;
