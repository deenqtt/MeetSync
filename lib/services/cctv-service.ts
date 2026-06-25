// File: lib/services/cctv-service.ts

export interface CctvCamera {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  channel?: string;
  rtspUrl?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  group?: string;
  resolution?: string;
  framerate?: number;
  bitrate?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCctvRequest {
  name: string;
  ipAddress: string;
  port: number;
  channel?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  group?: string;
  resolution?: string;
  framerate?: number;
  bitrate?: number;
  isActive?: boolean;
}

export interface UpdateCctvRequest {
  name?: string;
  ipAddress?: string;
  port?: number;
  channel?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  group?: string;
  resolution?: string;
  framerate?: number;
  bitrate?: number;
  isActive?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface MonitorData {
  camera: CctvCamera;
  data: any[];
}

class CctvService {
  private baseUrl = '/api/cctv';

  /**
   * Get all CCTV cameras
   */
  async getCameras(): Promise<ApiResponse<CctvCamera[]>> {
    try {
      const response = await fetch(this.baseUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || `HTTP error! status: ${response.status}`
        };
      }

      const cameras = await response.json();
      return {
        success: true,
        data: cameras
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch cameras'
      };
    }
  }

  /**
   * Get single CCTV camera by ID
   */
  async getCamera(id: string): Promise<ApiResponse<CctvCamera>> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || `HTTP error! status: ${response.status}`
        };
      }

      const camera = await response.json();
      return {
        success: true,
        data: camera
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch camera'
      };
    }
  }

  /**
   * Create new CCTV camera
   */
  async createCamera(data: CreateCctvRequest): Promise<ApiResponse<CctvCamera>> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || `HTTP error! status: ${response.status}`
        };
      }

      const camera = await response.json();
      return {
        success: true,
        data: camera
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to create camera'
      };
    }
  }

  /**
   * Update CCTV camera
   */
  async updateCamera(id: string, data: UpdateCctvRequest): Promise<ApiResponse<CctvCamera>> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || `HTTP error! status: ${response.status}`
        };
      }

      const camera = await response.json();
      return {
        success: true,
        data: camera
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to update camera'
      };
    }
  }

  /**
   * Delete CCTV camera
   */
  async deleteCamera(id: string): Promise<ApiResponse<null>> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || `HTTP error! status: ${response.status}`
        };
      }

      return {
        success: true,
        data: null
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to delete camera'
      };
    }
  }

  /**
   * Test camera connection
   */
  async testConnection(camera: CctvCamera): Promise<ApiResponse<boolean>> {
    try {
      const testUrl = `http://${camera.ipAddress}:${camera.port}`;

      // Simple ping test
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return {
        success: true,
        data: response.ok,
        message: response.ok ? 'Connection successful' : 'Connection failed'
      };
    } catch (error: any) {
      return {
        success: false,
        data: false,
        message: error.name === 'AbortError' ? 'Connection timeout' : error.message
      };
    }
  }

  /**
   * Get active cameras for monitoring
   */
  async getActiveCameras(): Promise<ApiResponse<CctvCamera[]>> {
    const result = await this.getCameras();

    if (!result.success || !result.data) {
      return result;
    }

    const activeCameras = result.data.filter(camera => camera.isActive);

    return {
      success: true,
      data: activeCameras
    };
  }

  /**
   * Bulk enable/disable cameras
   */
  async bulkUpdateStatus(cameraIds: string[], isActive: boolean): Promise<ApiResponse<null>> {
    try {
      const updatePromises = cameraIds.map(id =>
        this.updateCamera(id, { isActive })
      );

      const results = await Promise.all(updatePromises);
      const failedUpdates = results.filter(result => !result.success);

      if (failedUpdates.length > 0) {
        return {
          success: false,
          message: `Failed to update ${failedUpdates.length} cameras`
        };
      }

      return {
        success: true,
        data: null,
        message: `Successfully updated ${cameraIds.length} cameras`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to bulk update cameras'
      };
    }
  }
}

// Export singleton instance
export const cctvService = new CctvService();

// Legacy exports for backward compatibility
export const cameraConfig = cctvService;

// Type exports
export type {
  CctvCamera as CameraConfig,
  CreateCctvRequest as CreateCameraConfigRequest,
  UpdateCctvRequest as UpdateCameraConfigRequest,
};