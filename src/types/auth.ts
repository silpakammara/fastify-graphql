import { Type, Static } from '@sinclair/typebox';

export const GoogleAuthBody = Type.Object({
  idToken: Type.String({ minLength: 1 }),
});

export const AppleAuthBody = Type.Object({
  idToken: Type.String({ minLength: 1 }),
  authorizationCode: Type.Optional(Type.String()),
});

export type GoogleAuthRequest = Static<typeof GoogleAuthBody>;
export type AppleAuthRequest = Static<typeof AppleAuthBody>;

export interface TokenPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
    user: {
      id: string;
      email: string;
      name: string;
      avatar?: string;
    };
    isNewUser: boolean;
  };
}