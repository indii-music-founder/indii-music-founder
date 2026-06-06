export class PinataService {
    async uploadFile(file: Buffer, filename: string): Promise<{ success: boolean; hash?: string; error?: string }> {
        return { success: false, error: 'Pinata upload is currently unsupported.' };
    }
}

export const pinataService = new PinataService();
