import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables
config({ path: join(__dirname, '../.env') });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock axios globally
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

// Global test utilities
global.testUtils = {
  createMockResponse: (data: any, status = 200) => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {},
  }),
  
  createMockRequest: (body: any = {}, headers: any = {}) => ({
    body,
    headers,
    query: {},
    params: {},
  }),
};

// Global type declarations
declare global {
  var testUtils: {
    createMockResponse: (data: any, status?: number) => any;
    createMockRequest: (body?: any, headers?: any) => any;
  };
}

// Helper functions for tests
export const testHelpers = {
  isValidUUID: (uuid: string): boolean => {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },
  
  isValidDate: (date: any): boolean => {
    if (date === null || date === undefined || date === '') return false;
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  },
  
  createMockAxiosResponse: (data: any, status = 200) => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {},
  }),
};
