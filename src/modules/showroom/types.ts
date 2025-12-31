import { ProductType } from './components/AssetRack';

export interface DesignState {
    selectedAsset: string | null;
    productType: ProductType;
    scenePrompt: string;
    motionPrompt: string;
    mockupImage: string | null;
    placement: 'Front' | 'Back' | 'Sleeve';
    scale: number;
}

export interface HistoryState<T> {
    past: T[];
    present: T;
    future: T[];
}

export type DesignAction =
    | { type: 'UPDATE_FIELD'; field: keyof DesignState; value: any }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'RESET'; state: DesignState };
