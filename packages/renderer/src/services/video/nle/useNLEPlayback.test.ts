import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNLEPlayback } from './useNLEPlayback';
import type { IndiiVideoProject } from '@indii/shared';

describe('useNLEPlayback React Hook (Issue #413)', () => {
  const sampleProject: IndiiVideoProject = {
    id: 'proj_nle_test',
    name: 'NLE Playback Hook Test',
    fps: 30,
    durationInFrames: 300,
    width: 1920,
    height: 1080,
    tracks: [
      { id: 't_video', type: 'video', name: 'Main Video', isMuted: false, isLocked: false },
    ],
    clips: [
      {
        id: 'c_video',
        name: 'Clip 1',
        type: 'video',
        src: 'https://cdn.indii.music/test.mp4',
        trackId: 't_video',
        startFrame: 0,
        durationInFrames: 90,
      },
    ],
  };

  let mockCanvas: HTMLCanvasElement;
  let canvasRef: { current: HTMLCanvasElement | null };

  beforeEach(() => {
    mockCanvas = document.createElement('canvas');

    const mockGl = {
      canvas: mockCanvas,
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
      useProgram: vi.fn(),
      deleteProgram: vi.fn(),

      createVertexArray: vi.fn().mockReturnValue({}),
      bindVertexArray: vi.fn(),
      deleteVertexArray: vi.fn(),

      createBuffer: vi.fn().mockReturnValue({}),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),

      createTexture: vi.fn().mockReturnValue({}),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      deleteTexture: vi.fn(),
      activeTexture: vi.fn(),

      getUniformLocation: vi.fn().mockReturnValue({}),
      uniform1i: vi.fn(),
      uniform1f: vi.fn(),
      uniformMatrix3fv: vi.fn(),

      viewport: vi.fn(),
      clearColor: vi.fn(),
      clear: vi.fn(),
      enable: vi.fn(),
      blendFunc: vi.fn(),
      drawArrays: vi.fn(),
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) => {
      if (type === 'webgl2') return mockGl as unknown as RenderingContext;
      return null;
    }) as any);

    canvasRef = { current: mockCanvas };
  });

  it('initializes with default stopped state', () => {
    const { result } = renderHook(() =>
      useNLEPlayback({
        project: sampleProject,
        canvasRef,
      })
    );

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentFrame).toBe(0);
    expect(result.current.currentSeconds).toBe(0);
  });

  it('updates playhead on seekToFrame and seekToSeconds', () => {
    const onFrameUpdate = vi.fn();
    const { result } = renderHook(() =>
      useNLEPlayback({
        project: sampleProject,
        canvasRef,
        onFrameUpdate,
      })
    );

    act(() => {
      result.current.seekToFrame(60);
    });

    expect(result.current.currentFrame).toBe(60);
    expect(result.current.currentSeconds).toBe(2);
    expect(onFrameUpdate).toHaveBeenCalledWith(60);

    act(() => {
      result.current.seekToSeconds(3.5);
    });

    // 3.5s * 30fps = 105 frames
    expect(result.current.currentFrame).toBe(105);
    expect(result.current.currentSeconds).toBe(3.5);
    expect(onFrameUpdate).toHaveBeenCalledWith(105);
  });

  it('toggles isPlaying state on play and pause actions', () => {
    const { result } = renderHook(() =>
      useNLEPlayback({
        project: sampleProject,
        canvasRef,
      })
    );

    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.pause();
    });
    expect(result.current.isPlaying).toBe(false);
  });

  it('cleans up RAF and resources when unmounted', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const { result, unmount } = renderHook(() =>
      useNLEPlayback({
        project: sampleProject,
        canvasRef,
      })
    );

    act(() => {
      result.current.play();
    });

    unmount();
    expect(cancelSpy).toHaveBeenCalled();
  });
});
