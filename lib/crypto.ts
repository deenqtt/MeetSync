import crypto from 'crypto';

// CM6-F1: Resolve encryption key with a fail-closed posture. Pre-fix this
// fell through to the literal "default-insecure-secret-key-change-me",
// meaning a misconfigured production deploy would AES-encrypt every
// sensitive field with a publicly-known key (i.e. trivially decryptable
// by anyone with this source). Now: production refuses to boot the
// crypto module unless a real key is set; dev/test gets a loud warning
// and a per-process random key so crashes are obvious if it leaks.
function resolveEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (key) return key;

    // Detect if we are in Next.js build phase or CI environment
    // This allows the build to pass without real secrets
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || process.env.CI === 'true';

    if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
        throw new Error(
            '[crypto] CM6-F1: neither ENCRYPTION_KEY nor JWT_SECRET set in ' +
            'production. Refusing to use insecure default. Set one of them ' +
            'in .env before starting the app.'
        );
    }
    // Dev / Build phase fallback: random per-process key. This intentionally breaks
    // any decrypt() call that crosses a restart, so devs notice immediately
    // instead of relying on a shared insecure default.
    const devKey = crypto.randomBytes(32).toString('hex');
    
    // Only warn if not in build phase to keep CI logs clean
    if (!isBuildPhase) {
        console.warn(
            '[crypto] WARNING: ENCRYPTION_KEY/JWT_SECRET unset; using a random ' +
            'per-process dev key. encrypted values will not decrypt across restarts.'
        );
    }
    return devKey;
}

const ENCRYPTION_KEY = resolveEncryptionKey();
const IV_LENGTH = 16; // For AES, this is always 16

function getCipherKey(key: string) {
    // Ensure key is 32 bytes for aes-256-cbc
    return crypto.createHash('sha256').update(String(key)).digest();
}

export function encrypt(text: string): string {
    if (!text) return text;

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getCipherKey(ENCRYPTION_KEY);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
    if (!text) return text;

    const textParts = text.split(':');
    if (textParts.length < 2) return text; // Not encrypted or invalid format

    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const key = getCipherKey(ENCRYPTION_KEY);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
}
