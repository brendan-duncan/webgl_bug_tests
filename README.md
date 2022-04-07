# webgl_bug_tests
Various tests for WebGL bugs.

## metal_max_uniforms.html
Garrett Johnson's ThreeJS path tracer, https://github.com/gkjohnson/three-gpu-pathtracer, fails on MacOS/iOS with the Angle Metal backend, with the error that the shader exceeds the max number of uniforms. This is a minimal test
that attempts to compile the failing shader.
[metal_max_uniforms.html](https://brendan-duncan.github.io/webgl_bug_tests/metal_max_uniforms.html)

## msaa_depth_buffer.html
MacOS Safari renders incorrectly if the depth buffer has MSAA multiple samples, and you draw with DEPTH_TEST disabled.
[msaa_depth_buffer.html](https://brendan-duncan.github.io/webgl_bug_tests/msaa_depth_buffer.html)

## metal_shader_error.html
The Angle **Metal** backend fails to use this shader containing a uniform buffer for gpu instances because the
array size is too large. It produces the error ```
[8089:259:0328/212557.998500:ERROR:gl_utils.cc(315)] [.WebGL-0x70004f7000] GL_INVALID_OPERATION: Metal backend encountered an error: Vertex function exceeds available temporary registers```

[metal_shader_error.html](https://brendan-duncan.github.io/webgl_bug_tests/metal_shader_error.html)
