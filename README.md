# webgl_bug_tests
Various tests for WebGL bugs.

## msaa_depth_buffer.html
MacOS Safari renders incorrectly if the depth buffer has MSAA multiple samples, and you draw with DEPTH_TEST disabled.
[msaa_depth_buffer.html](https://brendan-duncan.github.io/webgl_bug_tests/msaa_depth_buffer.html)

## metal_shader_error.html
The Angle **Metal** backend fails to use this shader containing a uniform buffer for gpu instances because the
array size is too large. It produces the error ```
[8089:259:0328/212557.998500:ERROR:gl_utils.cc(315)] [.WebGL-0x70004f7000] GL_INVALID_OPERATION: Metal backend encountered an error: Vertex function exceeds available temporary registers```

[metal_shader_error.html](https://brendan-duncan.github.io/webgl_bug_tests/metal_shader_error.html)
