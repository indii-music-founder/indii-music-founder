import React from 'react';

import type { IndiiVideoProject } from '@indii/shared';

interface CompiledPreviewState {
    html: string | null;
    error: string | null;
    isCompiling: boolean;
}

const EMPTY: CompiledPreviewState = { html: null, error: null, isCompiling: false };

/** Compile through main so preview and final render use the exact same compiler. */
export const useCompiledVideoPreview = (project: IndiiVideoProject): CompiledPreviewState => {
    const [state, setState] = React.useState<CompiledPreviewState>(EMPTY);

    React.useEffect(() => {
        if (project.clips.length === 0) {
            setState(EMPTY);
            return;
        }

        const compile = window.electronAPI?.video?.compilePreview;
        if (!compile) {
            setState({
                html: null,
                error: 'Live timeline preview is available in the desktop app.',
                isCompiling: false,
            });
            return;
        }

        let cancelled = false;
        setState(current => ({ ...current, error: null, isCompiling: true }));
        void compile(project).then((html) => {
            if (!cancelled) setState({ html, error: null, isCompiling: false });
        }).catch((error: unknown) => {
            if (!cancelled) {
                setState({
                    html: null,
                    error: error instanceof Error ? error.message : String(error),
                    isCompiling: false,
                });
            }
        });

        return () => { cancelled = true; };
    }, [project]);

    return state;
};
