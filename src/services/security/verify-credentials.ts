
import { credentialService } from './CredentialService.ts';
import { DistributorId } from '../distribution/types/distributor.ts';

async function verifyCredentials() {
    console.log('🔐 Verifying Credential Service (Keytar)...');

    const testId: DistributorId = 'distrokid';
    const mockCreds = { apiKey: 'test-key-12345', apiSecret: 'shhh-secret' };

    // 1. Save
    console.log('Saving credentials...');
    await credentialService.saveCredentials(testId, mockCreds);
    console.log('✅ Saved.');

    // 2. Get
    console.log('Retrieving credentials...');
    const retrieved = await credentialService.getCredentials(testId);
    console.log('Retrieved:', retrieved);

    if (retrieved?.apiKey === mockCreds.apiKey) {
        console.log('✅ Retrieval Match!');
    } else {
        console.error('❌ Retrieval Mismatch!');
        process.exit(1);
    }

    // 3. Delete
    console.log('Deleting credentials...');
    await credentialService.deleteCredentials(testId);

    // 4. Verify Delete
    const afterDelete = await credentialService.getCredentials(testId);
    if (afterDelete === null) {
        console.log('✅ Deletion Confirmed.');
    } else {
        console.error('❌ Deletion Failed, still exists.');
        process.exit(1);
    }

    console.log('✨ Credential Service Verification Complete (Keytar is working)');
}

verifyCredentials().catch(err => {
    console.error('❌ Fatal Error:', err);
    process.exit(1);
});
