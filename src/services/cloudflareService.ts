import { FastifyInstance } from 'fastify';

export interface CloudflareUploadResponse {
  result: {
    id: string;
    filename: string;
    uploaded: string;
    requireSignedURLs: boolean;
    variants: string[];
  };
  success: boolean;
  errors: any[];
  messages: any[];
}

export interface CloudflareImageDetails {
  result: {
    id: string;
    filename: string;
    uploaded: string;
    requireSignedURLs: boolean;
    variants: Record<string, string>;
    meta?: Record<string, any>;
  };
  success: boolean;
}

export class CloudflareImagesService {
  private accountId: string;
  private apiToken: string;
  private accountHash: string;
  private baseUrl: string;

  constructor(fastify: FastifyInstance) {
    this.accountId = process.env['CLOUDFLARE_ACCOUNT_ID']!;
    this.apiToken = process.env['CLOUDFLARE_IMAGES_API_TOKEN']!;
    this.accountHash = process.env['CLOUDFLARE_IMAGES_ACCOUNT_HASH']!;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`;
  }

  /**
   * Upload an image to Cloudflare Images
   */
  async uploadImage(
    file: Buffer,
    filename: string,
    metadata?: Record<string, string>
  ): Promise<CloudflareUploadResponse> {
    try {
      // Use native FormData (Node.js 18+)
    const form = new FormData();
      
      // Create a Blob from the buffer with proper MIME type
      const mimeType = this.getMimeTypeFromFilename(filename);
      const blob = new Blob([new Uint8Array(file)], { type: mimeType });
      form.append('file', blob, filename);
      
      // Add metadata as a single JSON string (Cloudflare expects this format)
      if (metadata && Object.keys(metadata).length > 0) {
        // Combine with app metadata
        const allMetadata = {
      app: 'sarvail',
      uploadedAt: new Date().toISOString(),
      ...metadata
    };
    
        // Add as individual metadata fields (correct Cloudflare format)
    Object.entries(allMetadata).forEach(([key, value]) => {
      form.append(`metadata.${key}`, String(value));
    });
      }
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          // Don't set Content-Type - let the browser/Node.js set it with boundary
        },
        body: form,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cloudflare API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          url: this.baseUrl,
          accountId: this.accountId
        });
        throw new Error(`Cloudflare upload failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('Cloudflare upload success:', result);
      return result;
    } catch (error) {
      console.error('Cloudflare upload error:', error);
      throw error;
    }
  }
  async uploadImageSimple(
    file: Buffer,
    filename: string
  ): Promise<CloudflareUploadResponse> {
    try {
      const form = new FormData();
      
      // Create a Blob from the buffer
      const mimeType = this.getMimeTypeFromFilename(filename);
      const blob = new Blob([new Uint8Array(file)], { type: mimeType });
      form.append('file', blob, filename);

     console.log('Simple upload to Cloudflare:', filename);
      
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
      },
      body: form,
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare upload failed: ${error}`);
    }

      const result = await response.json();
      console.log('Cloudflare simple upload success:', result);
      return result;
    } catch (error) {
      console.error('Cloudflare simple upload error:', error);
      throw error;
    }
  }

  /**
   * Get MIME type from filename
   */
  private getMimeTypeFromFilename(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'svg':
        return 'image/svg+xml';
      default:
        return 'image/jpeg'; // Default fallback
    }
  }

  /**
   * Upload image from URL
   */
  async uploadFromUrl(
    url: string,
    metadata?: Record<string, string>
  ): Promise<CloudflareUploadResponse> {
    const form = new FormData();
    form.append('url', url);
    
    if (metadata && Object.keys(metadata).length > 0) {
    const allMetadata = {
      app: 'sarvail',
      uploadedAt: new Date().toISOString(),
      ...metadata
    };
    
    Object.entries(allMetadata).forEach(([key, value]) => {
      form.append(`metadata.${key}`, String(value));
    });
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
      },
      body: form,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare upload from URL failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Get image details
   */
  async getImageDetails(imageId: string): Promise<CloudflareImageDetails> {
    const response = await fetch(`${this.baseUrl}/${imageId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get image details: ${error}`);
    }

    return response.json();
  }

  /**
   * Delete an image
   */
  async deleteImage(imageId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/${imageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete image: ${error}`);
    }

    const result = await response.json();
    return result.success;
  }

  /**
   * List images with pagination
   */
  async listImages(page = 1, perPage = 100): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}?page=${page}&per_page=${perPage}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list images: ${error}`);
    }

    return response.json();
  }

  /**
   * Get the delivery URL for an image
   */
  getDeliveryUrl(imageId: string, variant = 'public'): string {
    return `https://imagedelivery.net/${this.accountHash}/${imageId}/${variant}`;
  }

  /**
   * Get all variant URLs for an image
   */
  async getVariantUrls(imageId: string): Promise<Record<string, string>> {
    const details = await this.getImageDetails(imageId);
    const variants: Record<string, string> = {};
    
    if (details.result.variants) {
      Object.keys(details.result.variants).forEach(variant => {
        variants[variant] = this.getDeliveryUrl(imageId, variant);
      });
    }
    
    return variants;
  }
}