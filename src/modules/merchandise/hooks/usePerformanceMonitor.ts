import { useState, useEffect } from 'react';
import { fabric } from 'fabric';

export interface PerformanceMetrics {
    fps: number;
    renderTime: number;
    objectCount: number;
}

export const usePerformanceMonitor = (canvas: fabric.Canvas | null): PerformanceMetrics => {
    const [fps, setFps] = useState(60);
    const [renderTime, setRenderTime] = useState(0);
    const [objectCount, setObjectCount] = useState(0);

    useEffect(() => {
        if (!canvas) return;

        let frameCount = 0;
        let lastTime = performance.now();
        let animationFrameId: number;
        let renderStartTime = 0;

        // FPS calculation
        const calculateFps = () => {
            const now = performance.now();
            frameCount++;

            if (now >= lastTime + 1000) {
                setFps(Math.round((frameCount * 1000) / (now - lastTime)));
                frameCount = 0;
                lastTime = now;
            }

            animationFrameId = requestAnimationFrame(calculateFps);
        };

        // Start FPS monitoring
        calculateFps();

        // Render time tracking
        const handleBeforeRender = () => {
            renderStartTime = performance.now();
        };

        const handleAfterRender = () => {
            const time = performance.now() - renderStartTime;
            setRenderTime(time);
        };

        // Object count tracking
        const updateObjectCount = () => {
            setObjectCount(canvas.getObjects().length);
        };

        // Attach event listeners
        canvas.on('before:render', handleBeforeRender);
        canvas.on('after:render', handleAfterRender);
        canvas.on('object:added', updateObjectCount);
        canvas.on('object:removed', updateObjectCount);

        // Initial count
        updateObjectCount();

        return () => {
            cancelAnimationFrame(animationFrameId);
            canvas.off('before:render', handleBeforeRender);
            canvas.off('after:render', handleAfterRender);
            canvas.off('object:added', updateObjectCount);
            canvas.off('object:removed', updateObjectCount);
        };
    }, [canvas]);

    return { fps, renderTime, objectCount };
};
