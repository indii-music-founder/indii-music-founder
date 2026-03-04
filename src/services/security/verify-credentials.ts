import { logger } from '@/utils/logger';

import { credentialService } from './CredentialService.ts';
import { DistributorId } from '../distribution/types/distributor.ts';

async function verifyCredentials() {
    logger.debug('🔐 Verifying Credential Service (Keytar)...');

    const testId: DistributorId = 'distrokid';
    const mockCreds = { apiKey: 'test-key-12345', apiSecret: 'shhh-secret' };

    // 1. Save
    logger.debug('Saving credentials...');
    await credentialService.saveCredentials(testId, mockCreds);
    logger.debug('✅ Saved.');

    // 2. Get
    logger.debug('Retrieving credentials...');
    const retrieved = await credentialService.getCredentials(testId);
    logger.debug('Retrieved:', retrieved);

    if (retrieved?.apiKey === mockCreds.apiKey) {
        logger.debug('✅ Retrieval Match!');
    } else {
        logger.error('❌ Retrieval Mismatch!');
        process.exit(1);
    }

    // 3. Delete
    logger.debug('Deleting credentials...');
    await credentialService.deleteCredentials(testId);

    // 4. Verify Delete
    const afterDelete = await credentialService.getCredentials(testId);
    if (afterDelete === null) {
        logger.debug('✅ Deletion Confirmed.');
    } else {
        logger.error('❌ Deletion Failed, still exists.');
        process.exit(1);
    }

    logger.debug('✨ Credential Service Verification Complete (Keytar is working)');
}

verifyCredentials().catch(err => {
    logger.error('❌ Fatal Error:', err);
    process.exit(1);
});
