
import keytar from 'keytar';

const SERVICE_NAME = 'IndiiOS';
const ACCOUNT_NAME = 'GoogleRefreshToken';

export const authStorage = {
    saveToken: async (token: string) => {
        await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
    },
    getToken: async () => {
        return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    },
    deleteToken: async () => {
        await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    }
};
