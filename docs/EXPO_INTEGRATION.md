# Expo Integration Guide

This guide explains how to integrate Google and Apple authentication in your Expo React Native app with the Fastify Auth API.

## Prerequisites

Install required packages:

```bash
expo install expo-auth-session expo-crypto expo-web-browser expo-secure-store
expo install expo-apple-authentication
```

## Environment Setup

Create a configuration file for your API:

```typescript
// config/api.ts
const ENV = {
  dev: {
    apiUrl: 'http://localhost:3000/api',
  },
  prod: {
    apiUrl: 'https://api.yourdomain.com/api',
  },
};

const getEnvVars = () => {
  if (__DEV__) {
    return ENV.dev;
  }
  return ENV.prod;
};

export default getEnvVars();
```

## Secure Token Storage

```typescript
// utils/secureStore.ts
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

export const saveToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const getToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(TOKEN_KEY);
};

export const removeToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};
```

## API Client

Create an API client with automatic token injection:

```typescript
// services/api.ts
import { getToken } from '../utils/secureStore';
import config from '../config/api';

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = config.apiUrl;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const token = await getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Request failed');
    }

    return result;
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: await this.getHeaders(),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Request failed');
    }

    return result;
  }
}

export default new ApiClient();
```

## Google Authentication

```typescript
// hooks/useGoogleAuth.ts
import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { saveToken } from '../utils/secureStore';
import apiClient from '../services/api';

WebBrowser.maybeCompleteAuthSession();

export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    redirectUri: makeRedirectUri({
      scheme: 'your.app.scheme',
    }),
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleLogin(id_token);
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string) => {
    try {
      const result = await apiClient.post<{
        success: boolean;
        data: { token: string; user: any };
      }>('/auth/google', { idToken });

      if (result.success) {
        await saveToken(result.data.token);
        // Navigate to authenticated screen
        console.log('Login successful:', result.data.user);
      }
    } catch (error) {
      console.error('Google login error:', error);
    }
  };

  return {
    signInWithGoogle: () => promptAsync(),
    googleAuthLoading: !request,
  };
};
```

## Apple Authentication

```typescript
// hooks/useAppleAuth.ts
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { saveToken } from '../utils/secureStore';
import apiClient from '../services/api';

export const useAppleAuth = () => {
  const isAvailable = Platform.OS === 'ios';

  const signInWithApple = async () => {
    if (!isAvailable) {
      throw new Error('Apple authentication is only available on iOS');
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const result = await apiClient.post<{
        success: boolean;
        data: { token: string; user: any };
      }>('/auth/apple', {
        idToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
      });

      if (result.success) {
        await saveToken(result.data.token);
        // Navigate to authenticated screen
        console.log('Login successful:', result.data.user);
      }
    } catch (error) {
      console.error('Apple login error:', error);
    }
  };

  return {
    signInWithApple,
    appleAuthAvailable: isAvailable,
  };
};
```

## Auth Context

Create an authentication context for your app:

```typescript
// contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getToken, removeToken } from '../utils/secureStore';
import apiClient from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const result = await apiClient.get<{
        success: boolean;
        data: { user: User };
      }>('/me');

      if (result.success) {
        setUser(result.data.user);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      await removeToken();
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await removeToken();
      setUser(null);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        refreshUser: loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

## Login Screen Example

```typescript
// screens/LoginScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useAppleAuth } from '../hooks/useAppleAuth';
import { useAuth } from '../contexts/AuthContext';

export const LoginScreen = () => {
  const { signInWithGoogle, googleAuthLoading } = useGoogleAuth();
  const { signInWithApple, appleAuthAvailable } = useAppleAuth();
  const { refreshUser } = useAuth();

  const handleGoogleLogin = async () => {
    await signInWithGoogle();
    await refreshUser();
  };

  const handleAppleLogin = async () => {
    await signInWithApple();
    await refreshUser();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      
      <TouchableOpacity
        style={styles.button}
        onPress={handleGoogleLogin}
        disabled={googleAuthLoading}
      >
        <Text style={styles.buttonText}>Continue with Google</Text>
      </TouchableOpacity>

      {appleAuthAvailable && (
        <TouchableOpacity
          style={[styles.button, styles.appleButton]}
          onPress={handleAppleLogin}
        >
          <Text style={styles.buttonText}>Continue with Apple</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  appleButton: {
    backgroundColor: '#000',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

## Protected Route Example

```typescript
// navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoadingScreen } from '../screens/LoadingScreen';

const Stack = createStackNavigator();

export const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

## Token Refresh Strategy

For better UX, implement automatic token refresh before expiry:

```typescript
// utils/tokenManager.ts
import { getToken, saveToken } from './secureStore';
import jwt_decode from 'jwt-decode';

interface JWTPayload {
  exp: number;
  userId: string;
  email: string;
}

export const isTokenExpiringSoon = async (): Promise<boolean> => {
  const token = await getToken();
  if (!token) return true;

  try {
    const decoded = jwt_decode<JWTPayload>(token);
    const expiryTime = decoded.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const timeUntilExpiry = expiryTime - currentTime;
    
    // Consider token expiring if less than 1 hour remaining
    return timeUntilExpiry < 3600000;
  } catch {
    return true;
  }
};

// Call this function periodically or before making API requests
export const checkAndRefreshToken = async () => {
  if (await isTokenExpiringSoon()) {
    // Implement token refresh logic here
    // For now, user will need to re-authenticate
    console.log('Token expiring soon, please re-authenticate');
  }
};
```

## Error Handling

Implement proper error handling for auth failures:

```typescript
// utils/errorHandler.ts
export const handleAuthError = (error: any) => {
  if (error.message.includes('401') || error.message.includes('Unauthorized')) {
    // Token is invalid or expired
    removeToken();
    // Navigate to login screen
    return 'Please sign in again';
  }
  
  if (error.message.includes('Network')) {
    return 'Network error. Please check your connection';
  }
  
  return error.message || 'An unexpected error occurred';
};
```

## Best Practices

1. **Always use HTTPS in production** - Never send authentication tokens over unencrypted connections
2. **Store tokens securely** - Use expo-secure-store for token storage
3. **Handle token expiration** - Implement proper logout flow when tokens expire
4. **Validate deep links** - Ensure redirect URIs are properly configured
5. **Test on real devices** - Apple Sign In requires testing on real iOS devices
6. **Handle network errors** - Implement retry logic and offline handling
7. **Clear tokens on logout** - Always clear stored tokens when users log out

## Troubleshooting

### Google Sign-In Issues
- Ensure the client ID matches your Google Cloud Console configuration
- Verify redirect URI is properly configured
- Check that the ID token (not access token) is being sent to the backend

### Apple Sign-In Issues
- Apple Sign-In only works on real iOS devices
- Ensure your Apple Developer account is properly configured
- Bundle ID must match your Apple app configuration

### Token Verification Failures
- Check that environment variables are correctly set on the backend
- Ensure tokens haven't expired before sending to backend
- Verify the correct audience/client ID is configured