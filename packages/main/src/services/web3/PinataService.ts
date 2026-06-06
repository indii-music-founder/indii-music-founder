export class PinataService {
    async uploadFile(file: Buffer, filename: string): Promise<{ success: boolean; hash?: string; error?: string }> {
        try {
            const jwt = process.env.VITE_PINATA_JWT || process.env.PINATA_JWT || process.env.VITE_PINATA_API_KEY;
            if (!jwt || jwt === 'MOCK_KEY_DO_NOT_USE') {
                return { success: false, error: 'Pinata API key/JWT not configured in environment.' };
            }

            const formData = new FormData();
            formData.append('file', new Blob([file]), filename);
            formData.append('pinataMetadata', JSON.stringify({ name: filename }));

            const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${jwt}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                return { success: false, error: `Pinata API Error: ${response.status} - ${errorText}` };
            }

            const data = await response.json();
            return { success: true, hash: data.IpfsHash };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }
}

export const pinataService = new PinataService();
