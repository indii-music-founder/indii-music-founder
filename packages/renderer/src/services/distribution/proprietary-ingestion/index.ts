/**
 * Ingestion Services - Main exports
 * Strategic "Black-Box" Ingestion IP implementation
 */

// Types
export * from '@/services/distribution/proprietary-ingestion/types';

// Parser
export { IngestionParser } from '@/services/distribution/proprietary-ingestion/IngestionParser';

// Services
export { IngestionNotificationService, ingestionNotificationService } from '@/services/distribution/proprietary-ingestion/IngestionNotificationService';
export { IngestionNotificationMapper } from '@/services/distribution/proprietary-ingestion/IngestionNotificationMapper';
export { EarningsReportService, earningsReportService } from '@/services/distribution/proprietary-ingestion/EarningsReportService';
export { IngestionValidator } from '@/services/distribution/proprietary-ingestion/IngestionValidator';
export { MediaAssetDataService, mediaAssetDataService } from '@/services/distribution/proprietary-ingestion/MediaAssetDataService';
export { RecordingInformationService, recordingInformationService } from '@/services/distribution/proprietary-ingestion/RecordingInformationService';
export { EarningsReportProcessor, earningsProcessor } from '@/services/distribution/proprietary-ingestion/EarningsProcessor';
export { IngestionIdentity } from '@/services/distribution/proprietary-ingestion/IngestionIdentity';
