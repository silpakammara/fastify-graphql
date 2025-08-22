import { FastifyInstance } from 'fastify';

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRetry = () => {}
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = 
        error.message?.includes('Connection terminated') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ETIMEDOUT') ||
        error.code === 'ECONNRESET' ||
        error.code === '57P01' || // admin_shutdown
        error.code === '57P02' || // crash_shutdown
        error.code === '57P03' || // cannot_connect_now
        error.code === '08006' || // connection_failure
        error.code === '08001' || // sqlclient_unable_to_establish_sqlconnection
        error.code === '08004'; // sqlserver_rejected_establishment_of_sqlconnection
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      onRetry(error, attempt);
      
      // Exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Helper to wrap database operations
export function createDbOperation<T>(
  fastify: FastifyInstance,
  operation: () => Promise<T>
): Promise<T> {
  return withRetry(operation, {
    onRetry: (error, attempt) => {
      fastify.log.warn(`Database operation retry attempt ${attempt}:`, error.message);
    }
  });
}