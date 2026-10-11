import { describe, it, expect, vi } from 'vitest';
import {
  WebGL2Compositor,
  computeTransformMatrix,
} from './WebGL2Compositor';
import type { Transform2D } from '@indii/shared';

describe('WebGL2Compositor - GPU Layer Compositor', () => {
  it('computes 3x3 column-major transform matrix correctly', () => {
    const identityTransform: Transform2D = {
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      opacity: 1,
      origin: { x: 0.5, y: 0.5 },
    };

    const matrix = computeTransformMatrix(identityTransform);
    expect(matrix).toHaveLength(9);
    // Identity scaling on diagonal
    expect(matrix[0]).toBeCloseTo(1, 4);
    expect(matrix[4]).toBeCloseTo(1, 4);
    expect(matrix[8]).toBeCloseTo(1, 4);
  });

  it('compiles shaders, sets up pipeline, and executes renderTick with guaranteed frame disposal', () => {
    const mockGl = {
      canvas: { width: 1920, height: 1080 },
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      COMPILE_STATUS: 35713,
      LINK_STATUS: 35714,
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      FLOAT: 5126,
      TEXTURE_2D: 3553,
      TEXTURE0: 33984,
      RGBA: 6408,
      UNSIGNED_BYTE: 5121,
      BLEND: 3042,
      ONE: 1,
      ONE_MINUS_SRC_ALPHA: 771,
      COLOR_BUFFER_BIT: 16384,
      TRIANGLE_STRIP: 5,
      TEXTURE_WRAP_S: 10242,
      TEXTURE_WRAP_T: 10243,
      TEXTURE_MIN_FILTER: 10241,
      TEXTURE_MAG_FILTER: 10240,
      CLAMP_TO_EDGE: 33071,
      LINEAR: 9729,

      createShader: vi.fn().mockReturnValue({}),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn().mockReturnValue(true),
      deleteShader: vi.fn(),

      createProgram: vi.fn().mockReturnValue({}),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn().mockReturnValue(true),
      getUniformLocation: vi.fn().mockReturnValue({}),

      createVertexArray: vi.fn().mockReturnValue({}),
      bindVertexArray: vi.fn(),
      createBuffer: vi.fn().mockReturnValue({}),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),

      createTexture: vi.fn().mockReturnValue({}),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),

      viewport: vi.fn(),
      clearColor: vi.fn(),
      clear: vi.fn(),
      enable: vi.fn(),
      blendFunc: vi.fn(),
      useProgram: vi.fn(),
      activeTexture: vi.fn(),
      uniformMatrix3fv: vi.fn(),
      uniform1f: vi.fn(),
      uniform1i: vi.fn(),
      drawArrays: vi.fn(),

      deleteTexture: vi.fn(),
      deleteVertexArray: vi.fn(),
      deleteProgram: vi.fn(),
    } as unknown as WebGL2RenderingContext;

    const compositor = new WebGL2Compositor(mockGl);
    expect(mockGl.createProgram).toHaveBeenCalled();

    const mockFrame = {
      close: vi.fn(),
    };

    compositor.renderTick([
      {
        frame: mockFrame,
        transform: new Float32Array(9),
        opacity: 0.9,
      },
    ]);

    expect(mockGl.drawArrays).toHaveBeenCalledWith(5, 0, 4);
    // Crucial: VideoFrame.close() must be explicitly called to avoid GPU memory leaks
    expect(mockFrame.close).toHaveBeenCalled();

    compositor.dispose();
    expect(mockGl.deleteProgram).toHaveBeenCalled();
  });
});
