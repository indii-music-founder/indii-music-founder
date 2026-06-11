/**
 * Ingestion Services - Main exports
 * Strategic "Black-Box" Ingestion IP implementation
 */

// Types
export * from './types';

// Parser
export { IngestionParser } from './IngestionParser';

// Services
export { IngestionNotificationService, ingestionNotificationService } from './IngestionNotificationService';
export { IngestionNotificationMapper } from './IngestionNotificationMapper';
export { EarningsReportService, earningsReportService } from './EarningsReportService';
export { IngestionValidator } from './IngestionValidator';
export { MediaAssetDataService, mediaAssetDataService } from './MediaAssetDataService';
export { RecordingInformationService, recordingInformationService } from './RecordingInformationService';
export { EarningsReportProcessor, earningsProcessor } from './EarningsProcessor';
export { IngestionIdentity } from './IngestionIdentity';
