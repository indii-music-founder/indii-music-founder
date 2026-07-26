/**
 * GENERATED FILE — DO NOT EDIT BY HAND
 *
 * Regen command: node scripts/sync-fine-tuned-endpoints.mjs
 * Source: Vertex AI tuningJobs REST API (latest succeeded endpoint per agent).
 *
 * Browser requests may name a capability, but only these Vertex base models
 * and reviewed endpoints may consume shared project quota. Endpoint resource
 * names are identifiers, not credentials; accepting any valid-shaped resource
 * would let a modified browser select unreviewed capacity.
 */

export const APPROVED_TEXT_STREAM_BASE_MODELS = new Set([
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-pro-preview',
]);

export const APPROVED_TEXT_STREAM_FINE_TUNED_ENDPOINTS = new Set([
    'projects/148015878263/locations/us/endpoints/1067634586663518208',
    'projects/148015878263/locations/us/endpoints/1211749774739374080',
    'projects/148015878263/locations/us/endpoints/126382264543084544',
    'projects/148015878263/locations/us/endpoints/1720656532632240128',
    'projects/148015878263/locations/us/endpoints/1824239324061761536',
    'projects/148015878263/locations/us/endpoints/2004383309156581376',
    'projects/148015878263/locations/us/endpoints/3103261618234982400',
    'projects/148015878263/locations/us/endpoints/3647352748216680448',
    'projects/148015878263/locations/us/endpoints/3679722370538405888',
    'projects/148015878263/locations/us/endpoints/3931923949671153664',
    'projects/148015878263/locations/us/endpoints/4178777504246398976',
    'projects/148015878263/locations/us/endpoints/4220154325822865408',
    'projects/148015878263/locations/us/endpoints/4400298310917685248',
    'projects/148015878263/locations/us/endpoints/4544413498993541120',
    'projects/148015878263/locations/us/endpoints/4670514288559915008',
    'projects/148015878263/locations/us/endpoints/5283003837882302464',
    'projects/148015878263/locations/us/endpoints/5931522184223653888',
    'projects/148015878263/locations/us/endpoints/617274623926468608',
    'projects/148015878263/locations/us/endpoints/7097954487712612352',
    'projects/148015878263/locations/us/endpoints/7413206461628547072',
    'projects/148015878263/locations/us/endpoints/7588846847095996416',
    'projects/148015878263/locations/us/endpoints/8849854742759735296',
]);

export function isApprovedFineTunedTextEndpoint(model: unknown): model is string {
    return typeof model === 'string' && APPROVED_TEXT_STREAM_FINE_TUNED_ENDPOINTS.has(model);
}

export function isApprovedTextStreamModel(model: unknown): model is string {
    return typeof model === 'string'
        && (APPROVED_TEXT_STREAM_BASE_MODELS.has(model) || isApprovedFineTunedTextEndpoint(model));
}
