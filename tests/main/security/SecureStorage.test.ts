import { beforeEach, describe, it, expect, vi } from 'vitest';

// Mock Electron's safeStorage at the top level
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(),
    encryptString: vi.fn(),
    decryptString: vi.fn()
  }
}));

// Mock logger
vi.mock('../../../src/main/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { SecureStorage } from '../../../src/main/security/SecureStorage.js';
import { safeStorage } from 'electron';

const mockSafeStorage = vi.mocked(safeStorage);

describe('SecureStorage', () => {
  let secureStorage: SecureStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton
    (SecureStorage as any).instance = undefined;
  });

  describe('Initialization', () => {
    it('should create singleton instance', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      
      const instance1 = SecureStorage.getInstance();
      const instance2 = SecureStorage.getInstance();
      
      expect(instance1).toBe(instance2);
      // Note: isEncryptionAvailable is called when isSecureStorageAvailable() is called, not on init
    });

    it('should check encryption availability', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      
      const instance = SecureStorage.getInstance();
      
      expect(instance.isSecureStorageAvailable()).toBe(true);
      expect(mockSafeStorage.isEncryptionAvailable).toHaveBeenCalled();
    });

    it('should handle encryption not available', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
      
      const instance = SecureStorage.getInstance();
      
      expect(instance.isSecureStorageAvailable()).toBe(false);
    });
  });

  describe('Encryption and Decryption', () => {
    beforeEach(() => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      secureStorage = SecureStorage.getInstance();
    });

    it('should encrypt string successfully', () => {
      const testData = 'secret-api-key';
      const mockEncryptedBuffer = Buffer.from('encrypted-data', 'base64');
      mockSafeStorage.encryptString.mockReturnValue(mockEncryptedBuffer);

      const result = secureStorage.encrypt(testData);

      expect(result).toBe('ENCRYPTED:' + mockEncryptedBuffer.toString('base64'));
      expect(mockSafeStorage.encryptString).toHaveBeenCalledWith(testData);
    });

    it('should decrypt string successfully', () => {
      const encryptedData = 'ENCRYPTED:ZW5jcnlwdGVkLWRhdGE='; // prefixed base64 encoded
      const decryptedData = 'secret-api-key';
      mockSafeStorage.decryptString.mockReturnValue(decryptedData);

      const result = secureStorage.decrypt(encryptedData);

      expect(result).toBe(decryptedData);
      expect(mockSafeStorage.decryptString).toHaveBeenCalledWith(Buffer.from('ZW5jcnlwdGVkLWRhdGE=', 'base64'));
    });

    it('should return plain text when encryption is not available', () => {
      // Reset singleton and create new instance with encryption disabled
      (SecureStorage as any).instance = undefined;
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
      secureStorage = SecureStorage.getInstance();

      const result = secureStorage.encrypt('test-data');

      expect(result).toBe('test-data'); // Returns plain text when encryption unavailable
    });

    it('should return plain text when decrypting non-encrypted data', () => {
      const result = secureStorage.decrypt('plain-text-data');

      expect(result).toBe('plain-text-data'); // Returns plain text if not encrypted
    });

    it('should handle encryption errors gracefully', () => {
      mockSafeStorage.encryptString.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      const result = secureStorage.encrypt('test-data');

      expect(result).toBeNull();
    });

    it('should handle decryption errors gracefully', () => {
      mockSafeStorage.decryptString.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = secureStorage.decrypt('ENCRYPTED:invalid-data');

      expect(result).toBeNull();
    });
  });

  describe('API Key Management Methods', () => {
    beforeEach(() => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      secureStorage = SecureStorage.getInstance();
    });

    it('should migrate plain text to encrypted format', () => {
      const mockEncryptedBuffer = Buffer.from('encrypted-migrated', 'base64');
      mockSafeStorage.encryptString.mockReturnValue(mockEncryptedBuffer);

      const result = secureStorage.migrateToEncrypted('provider-1', 'plain-key');

      expect(result).toBe(`ENCRYPTED:${mockEncryptedBuffer.toString('base64')}`);
    });

    it('should return original value if already encrypted', () => {
      const encryptedValue = 'ENCRYPTED:already-encrypted';

      const result = secureStorage.migrateToEncrypted('provider-1', encryptedValue);

      expect(result).toBe(encryptedValue);
    });

    it('should get plain text value from encrypted storage', () => {
      const encryptedValue = 'ENCRYPTED:ZW5jcnlwdGVkLWtleQ==';
      mockSafeStorage.decryptString.mockReturnValue('secret-key');

      const result = secureStorage.getPlainTextValue('provider-1', encryptedValue);

      expect(result).toBe('secret-key');
    });

    it('should return plain text value as-is', () => {
      const plainValue = 'plain-text-key';

      const result = secureStorage.getPlainTextValue('provider-1', plainValue);

      expect(result).toBe(plainValue);
    });

    it('should return empty string for empty input', () => {
      const result = secureStorage.getPlainTextValue('provider-1', '');

      expect(result).toBe('');
    });

    it('should detect encrypted values correctly', () => {
      expect(secureStorage.isEncrypted('ENCRYPTED:data')).toBe(true);
      expect(secureStorage.isEncrypted('plain-text')).toBe(false);
      expect(secureStorage.isEncrypted('')).toBe(false);
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      secureStorage = SecureStorage.getInstance();
    });

    it('should validate encryption successfully', () => {
      const mockEncryptedBuffer = Buffer.from('encrypted-test', 'base64');
      
      // Set up mocks to return consistent data
      mockSafeStorage.encryptString.mockReturnValue(mockEncryptedBuffer);
      mockSafeStorage.decryptString.mockReturnValue('test-encryption-validation');

      const result = secureStorage.validateEncryption();

      expect(result).toBe(true);
    });

    it('should fail validation when encryption is not available', () => {
      (SecureStorage as any).instance = undefined;
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
      secureStorage = SecureStorage.getInstance();

      const result = secureStorage.validateEncryption();

      expect(result).toBe(false);
    });

    it('should fail validation on encryption error', () => {
      mockSafeStorage.encryptString.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      const result = secureStorage.validateEncryption();

      expect(result).toBe(false);
    });

    it('should fail validation on data mismatch', () => {
      const mockEncryptedBuffer = Buffer.from('encrypted-test', 'base64');
      mockSafeStorage.encryptString.mockReturnValue(mockEncryptedBuffer);
      mockSafeStorage.decryptString.mockReturnValue('wrong-data');

      const result = secureStorage.validateEncryption();

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      secureStorage = SecureStorage.getInstance();
    });

    it('should handle empty strings in getPlainTextValue', () => {
      expect(secureStorage.getPlainTextValue('test', '')).toBe('');
    });

    it('should handle decryption failure gracefully in getPlainTextValue', () => {
      mockSafeStorage.decryptString.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = secureStorage.getPlainTextValue('test', 'ENCRYPTED:invalid');

      expect(result).toBe('');
    });

    it('should return plain text on failed encryption during migration', () => {
      mockSafeStorage.encryptString.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      const result = secureStorage.migrateToEncrypted('provider-1', 'plain-key');

      expect(result).toBe('plain-key'); // Fallback to plain text
    });
  });
});