/**
 * Type extensions for Fabric.js objects used in the Merch Designer.
 * These types extend the base fabric.Object with custom properties
 * used throughout the DesignCanvas and LayersPanel components.
 */
import type * as fabric from 'fabric';

/**
 * Extended Fabric object with custom metadata properties
 * used for layer identification and thumbnail caching.
 */
export interface FabricObjectWithMeta extends fabric.Object {
    /** Unique identifier for the object, used as layer ID */
    name?: string;
    /** Base64 data URL of a low-res thumbnail for layer preview */
    thumbnail?: string;
}

/**
 * Text-specific properties extracted from fabric.IText
 */
export interface TextObjectProperties {
    fontSize?: number;
    fill?: string | fabric.TFiller | null;
    fontFamily?: string;
    fontWeight?: string | number;
}

/**
 * Extended Fabric canvas with clipboard state for copy/paste operations
 */
export interface FabricCanvasWithClipboard extends fabric.Canvas {
    _clipboard?: fabric.Object;
}

/**
 * Extended ActiveSelection with forEachObject iterator
 * Matches Fabric.js v6 signature
 */
export interface FabricActiveSelectionWithIterator extends fabric.ActiveSelection {
    forEachObject(
        callback: (
            object: fabric.Object,
            index: number,
            array: fabric.Object[]
        ) => void
    ): void;
}

/**
 * Type guard to check if a Fabric object has metadata properties
 */
export function hasFabricMeta(obj: fabric.Object): obj is FabricObjectWithMeta {
    return obj !== null && typeof obj === 'object';
}

/**
 * Type guard to check if a Fabric object is a text type
 */
export function isFabricTextType(obj: fabric.Object): boolean {
    return obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox';
}

/**
 * Property value type for layer property updates
 */
export type LayerPropertyValue = string | number | boolean | GlobalCompositeOperation;

/**
 * Helper type for Fabric text object (use with type assertion after isFabricTextType guard)
 */
export type FabricTextObject = fabric.Object & TextObjectProperties;

