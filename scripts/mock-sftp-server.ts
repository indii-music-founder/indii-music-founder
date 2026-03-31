import { Server } from 'ssh2';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

// Usage: npx tsx scripts/mock-sftp-server.ts

const PORT = 2222;
const HOST = '127.0.0.1';

const allowedUser = Buffer.from('distrokid-test');
const allowedPassword = Buffer.from('test-pass');

const server = new Server({
    hostKeys: [
        fs.readFileSync('/tmp/test_rsa.key')
    ]
}, (client) => {
    console.log('[MockSFTP] Client connected!');

    client.on('authentication', (ctx) => {
        if (
            ctx.method === 'password' &&
            crypto.timingSafeEqual(Buffer.from(ctx.username), allowedUser) &&
            crypto.timingSafeEqual(Buffer.from(ctx.password), allowedPassword)
        ) {
            ctx.accept();
            console.log('[MockSFTP] Client authenticated');
        } else {
            ctx.reject();
            console.log('[MockSFTP] Authentication failed');
        }
    })
        .on('ready', () => {
            console.log('[MockSFTP] Client ready');

            client.on('session', (accept, reject) => {
                const session = accept();

                session.on('sftp', (accept, reject) => {
                    console.log('[MockSFTP] SFTP session started');
                    const sftpStream = accept();

                    sftpStream.on('OPEN', (reqid, filename, flags, attrs) => {
                        console.log(`[MockSFTP] OPEN requested for ${filename}`);
                        // Simply accept and give a fake handle
                        const handle = Buffer.alloc(4);
                        handle.writeUInt32BE(Math.floor(Math.random() * 1000), 0);
                        sftpStream.handle(reqid, handle);
                    });

                    sftpStream.on('WRITE', (reqid, handle, offset, data) => {
                        console.log(`[MockSFTP] Received ${data.length} bytes for upload.`);
                        sftpStream.status(reqid, 0); // 0 = OK
                    });

                    sftpStream.on('CLOSE', (reqid, handle) => {
                        console.log(`[MockSFTP] Upload complete (file closed).`);
                        sftpStream.status(reqid, 0); // 0 = OK
                    });

                    sftpStream.on('REALPATH', (reqid, inPath) => {
                        const fakePath = inPath === '.' ? '/incoming' : inPath;
                        sftpStream.name(reqid, [{
                            filename: fakePath,
                            longname: fakePath,
                            attrs: {} as any
                        }]);
                    });

                    sftpStream.on('STAT', (reqid, path) => {
                        sftpStream.attrs(reqid, {
                            mode: 33188,
                            uid: 0,
                            gid: 0,
                            size: 1024,
                            atime: 0,
                            mtime: 0
                        });
                    });
                });
            });
        })
        .on('end', () => {
            console.log('[MockSFTP] Client disconnected');
        });
});

console.log('[MockSFTP] Generating generic RSA key for the server...');
crypto.generateKeyPair('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
}, (err, publicKey, privateKey) => {
    if (err) {
        console.error('[MockSFTP] Error generating keys', err);
        return;
    }
    fs.writeFileSync('/tmp/test_rsa.key', privateKey);
    server.listen(PORT, HOST, () => {
        console.log(`[MockSFTP] SFTP Delivery Test Server listening on port ${PORT}`);
        console.log(`[MockSFTP] Use credentials: distrokid-test / test-pass`);
    });
});
