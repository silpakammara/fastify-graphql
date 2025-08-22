import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { promisify } from 'util';
import type { TokenPayload } from '../types/auth';

const googleClient = jwksClient({
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

const appleClient = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

const getKey = (client: jwksClient.JwksClient) => {
  return promisify((header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
    client.getSigningKey(header.kid!, (err, key) => {
      if (err) {
        callback(err);
      } else {
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
      }
    });
  });
};

export async function verifyGoogleToken(idToken: string, clientId: string): Promise<TokenPayload> {
  const getGoogleKey = getKey(googleClient);
  
  try {
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || !decoded.header.kid) {
      throw new Error('Invalid token format');
    }

    const key = await getGoogleKey(decoded.header as jwt.JwtHeader);
    const verified = jwt.verify(idToken, key as string, {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: ['accounts.google.com', 'https://accounts.google.com'],
    }) as TokenPayload;

    if (!verified.email || !verified.email_verified) {
      throw new Error('Email not verified');
    }

    return verified;
  } catch (error) {
    throw new Error(`Google token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function verifyAppleToken(idToken: string, clientId: string): Promise<TokenPayload> {
  const getAppleKey = getKey(appleClient);
  
  try {
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || !decoded.header.kid) {
      throw new Error('Invalid token format');
    }

    const key = await getAppleKey(decoded.header as jwt.JwtHeader);
    const verified = jwt.verify(idToken, key as string, {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: 'https://appleid.apple.com',
    }) as TokenPayload;

    if (!verified.email) {
      throw new Error('Email not provided');
    }

    return verified;
  } catch (error) {
    throw new Error(`Apple token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}