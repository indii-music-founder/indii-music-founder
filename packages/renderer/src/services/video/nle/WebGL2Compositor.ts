/**
 * WebGL2 Real-Time Compositor Pipeline (Issue #413).
 *
 * Implements GPU-accelerated multi-track layer composition, 2D affine matrix
 * transforms, premultiplied alpha blending, and deterministic VideoFrame disposal.
 */

import type { Transform2D } from '@indii/shared';

export interface RenderLayer {
  frame: { close: () => void } | TexImageSource;
  transform: Float32Array;
  opacity: number;
}

export const VERTEX_SHADER_SOURCE = `#version 300 es
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_texCoord;

uniform mat3 u_transformMatrix;

out vec2 v_texCoord;

void main() {
    vec3 transformed = u_transformMatrix * vec3(a_position, 1.0);
    gl_Position = vec4(transformed.xy, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_opacity;

out vec4 fragColor;

void main() {
    vec4 texColor = texture(u_texture, v_texCoord);
    fragColor = vec4(texColor.rgb, texColor.a * u_opacity);
}
`;

/**
 * Generates a 3x3 column-major affine transform matrix as Float32Array
 * applying origin translation, rotation, scale, and position offset.
 */
export function computeTransformMatrix(transform: Transform2D): Float32Array {
  const { position, scale, rotation, origin } = transform;

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  // M = T(pos) * T(origin) * R(rot) * S(scale) * T(-origin)
  const sx = scale.x;
  const sy = scale.y;
  const ox = origin.x - 0.5; // Centered
  const oy = origin.y - 0.5;

  // 3x3 column-major order:
  // [ m00, m10, 0 ]
  // [ m01, m11, 0 ]
  // [ m02, m12, 1 ]
  const m00 = cos * sx;
  const m10 = sin * sx;
  const m01 = -sin * sy;
  const m11 = cos * sy;

  const m02 = position.x + (ox - (ox * m00 + oy * m01));
  const m12 = position.y + (oy - (ox * m10 + oy * m11));

  return new Float32Array([
    m00, m10, 0,
    m01, m11, 0,
    m02, m12, 1,
  ]);
}

export class WebGL2Compositor {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private texture: WebGLTexture | null = null;

  private uTransformMatrixLoc: WebGLUniformLocation | null = null;
  private uOpacityLoc: WebGLUniformLocation | null = null;
  private uTextureLoc: WebGLUniformLocation | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.initPipeline();
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Failed to create WebGL shader');
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compilation error: ${info}`);
    }
    return shader;
  }

  private initPipeline(): void {
    const gl = this.gl;

    const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create WebGL program');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link error: ${info}`);
    }

    this.program = program;
    this.uTransformMatrixLoc = gl.getUniformLocation(program, 'u_transformMatrix');
    this.uOpacityLoc = gl.getUniformLocation(program, 'u_opacity');
    this.uTextureLoc = gl.getUniformLocation(program, 'u_texture');

    // Quad geometry: positions [-1, 1] and texCoords [0, 1]
    // Normalized device coords triangle strip
    const quadVertices = new Float32Array([
      // X,     Y,   U,   V
      -1.0, -1.0, 0.0, 1.0,
       1.0, -1.0, 1.0, 1.0,
      -1.0,  1.0, 0.0, 0.0,
       1.0,  1.0, 1.0, 0.0,
    ]);

    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    // a_position (location = 0)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);

    // a_texCoord (location = 1)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

    gl.bindVertexArray(null);

    // Shared reusable texture
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * Renders a frame tick with layered tracks, uploading frames to GPU textures
   * and immediately disposing VideoFrame handles to enforce the zero-leak memory policy.
   */
  public renderTick(layers: RenderLayer[]): void {
    const gl = this.gl;
    if (!this.program || !this.quadVao || !this.texture) return;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    // Premultiplied alpha blending
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.quadVao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    if (this.uTextureLoc) gl.uniform1i(this.uTextureLoc, 0);

    for (const layer of layers) {
      try {
        // Upload TexImageSource or VideoFrame directly to texture memory
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          layer.frame as TexImageSource
        );

        if (this.uTransformMatrixLoc) {
          gl.uniformMatrix3fv(this.uTransformMatrixLoc, false, layer.transform);
        }
        if (this.uOpacityLoc) {
          gl.uniform1f(this.uOpacityLoc, layer.opacity);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } finally {
        // Explicitly dispose VideoFrame to prevent GPU allocation exhaustion
        if (layer.frame && typeof (layer.frame as { close?: () => void }).close === 'function') {
          (layer.frame as { close: () => void }).close();
        }
      }
    }

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * Disposes all WebGL2 pipeline objects.
   */
  public dispose(): void {
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.quadVao) gl.deleteVertexArray(this.quadVao);
    if (this.program) gl.deleteProgram(this.program);
    this.texture = null;
    this.quadVao = null;
    this.program = null;
  }
}
