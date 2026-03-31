import { Server, type FileEntry } from 'ssh2';
import * as fs from 'fs';
import * as crypto from 'crypto';

// Usage: npx tsx scripts/mock-sftp-server.ts

const PORT = 2222;
const HOST = '127.0.0.1';

const allowedUser = Buffer.from('distrokid-test');
const allowedPassword = Buffer.from('test-pass');

function startServer(privateKey: string) {
    const server = new Server({
        hostKeys: [privateKey]
    }, (client) => {
        console.log('[MockSFTP] Client connected!');

        client.on('authentication', (ctx) => {
            const usernameBuffer = Buffer.from(ctx.username);
            const passwordBuffer = Buffer.from(ctx.password ?? '');

            // Guard timingSafeEqual — it throws on length mismatch
            const usernameMatch = usernameBuffer.length === allowedUser.length &&
                crypto.timingSafeEqual(usernameBuffer, allowedUser);
            const passwordMatch = passwordBuffer.length === allowedPassword.length &&
                crypto.timingSafeEqual(passwordBuffer, allowedPassword);

            if (ctx.method === 'password' && usernameMatch && passwordMatch) {
                ctx.accept();
                console.log('[MockSFTP] Client authenticated');
            } else {
                ctx.reject();
                console.log('[MockSFTP] Authentication failed');
            }
        })
            .on('ready', () => {
                console.log('[MockSFTP] Client ready');

                client.on('session', (accept) => {
                    const session = accept();

                    session.on('sftp', (accept) => {
                        console.log('[MockSFTP] SFTP session started');
                        const sftpStream = accept();

                        sftpStream.on('OPEN', (reqid, filename) => {
                            console.log(`[MockSFTP] OPEN requested for ${filename}`);
                            // Simply accept and give a fake handle
                            const handle = Buffer.alloc(4);
                            handle.writeUInt32BE(Math.floor(Math.random() * 1000), 0);
                            sftpStream.handle(reqid, handle);
                        });

                        sftpStream.on('WRITE', (reqid, _handle, _offset, data) => {
                            console.log(`[MockSFTP] Received ${data.length} bytes for upload.`);
                            sftpStream.status(reqid, 0); // 0 = OK
                        });

                        sftpStream.on('CLOSE', (reqid) => {
                            console.log(`[MockSFTP] Upload complete (file closed).`);
                            sftpStream.status(reqid, 0); // 0 = OK
                        });

                        sftpStream.on('REALPATH', (reqid, inPath) => {
                            const fakePath = inPath === '.' ? '/incoming' : inPath;
                            const entry: FileEntry = {
                                filename: fakePath,
                                longname: fakePath,
                                attrs: { mode: 0o40755, uid: 0, gid: 0, size: 0, atime: 0, mtime: 0 }
                            };
                            sftpStream.name(reqid, [entry]);
                        });

                        sftpStream.on('STAT', (reqid) => {
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

    server.listen(PORT, HOST, () => {
        console.log(`[MockSFTP] SFTP Delivery Test Server listening on port ${PORT}`);
        console.log(`[MockSFTP] Use credentials: distrokid-test / test-pass`);
    });
}

// Generate key FIRST, then start server with it
console.log('[MockSFTP] Generating generic RSA key for the server...');
crypto.generateKeyPair('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
}, (err, _publicKey, privateKey) => {
    if (err) {
        console.error('[MockSFTP] Error generating keys', err);
        return;
    }
    fs.writeFileSync('/tmp/test_rsa.key', privateKey);
    startServer(privateKey);
});
