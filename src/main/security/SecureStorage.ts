import { safeStorage } from 'electron';
import { logger } from '../utils/logger.js';

/**
 * Singleton class for secure API key storage using Electron's safeStorage API
 * Provides encryption/decryption functionality with OS-level security
 */
export class SecureStorage {
  private static instance: SecureStorage;
  private readonly ENCRYPTED_PREFIX = 'ENCRYPTED:';

  /**
   * Get singleton instance
   */
  public static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  /**
   * Check if safeStorage is available on this platform
   */
  public isSecureStorageAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch (error) {
      logger.warn('SecureStorage: Failed to check safeStorage availability:', error);
      return false;
    }
  }

  /**
   * Check if a string is encrypted (has our prefix)
   */
  public isEncrypted(value: string): boolean {
    return typeof value === 'string' && value.startsWith(this.ENCRYPTED_PREFIX);
  }

  /**
   * Encrypt a plain text value
   */
  public encrypt(plainText: string): string | null {
    if (!this.isSecureStorageAvailable()) {
      logger.warn('SecureStorage: Encryption not available, storing as plain text');
      return plainText;
    }

    try {
      const buffer = safeStorage.encryptString(plainText);
      const encrypted = buffer.toString('base64');
      return `${this.ENCRYPTED_PREFIX}${encrypted}`;
    } catch (error) {
      logger.error('SecureStorage: Failed to encrypt value:', error);
      return null;
    }
  }

  /**
   * Decrypt an encrypted value
   */
  public decrypt(encryptedValue: string): string | null {
    if (!this.isEncrypted(encryptedValue)) {
      // Already plain text
      return encryptedValue;
    }

    if (!this.isSecureStorageAvailable()) {
      logger.warn('SecureStorage: Decryption not available');
      return null;
    }

    try {
      const base64Data = encryptedValue.slice(this.ENCRYPTED_PREFIX.length);
      const buffer = Buffer.from(base64Data, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      logger.error('SecureStorage: Failed to decrypt value:', error);
      return null;
    }
  }

  /**
   * Migrate a plain text value to encrypted storage
   */
  public migrateToEncrypted(keyName: string, plainTextValue: string): string {
    if (this.isEncrypted(plainTextValue)) {
      // Already encrypted
      return plainTextValue;
    }

    const encrypted = this.encrypt(plainTextValue);
    if (encrypted) {
      logger.info(`SecureStorage: Successfully encrypted ${keyName}`);
      return encrypted;
    } else {
      logger.warn(`SecureStorage: Failed to encrypt ${keyName}, keeping as plain text`);
      return plainTextValue;
    }
  }

  /**
   * Get the plain text value from either encrypted or plain text storage
   */
  public getPlainTextValue(keyName: string, storedValue: string): string {
    if (!storedValue) {
      return '';
    }

    if (this.isEncrypted(storedValue)) {
      const decrypted = this.decrypt(storedValue);
      if (decrypted !== null) {
        return decrypted;
      } else {
        logger.error(`SecureStorage: Failed to decrypt ${keyName}`);
        return '';
      }
    }

    // Already plain text
    return storedValue;
  }

  /**
   * Validate that encryption/decryption is working correctly
   */
  public validateEncryption(): boolean {
    if (!this.isSecureStorageAvailable()) {
      return false;
    }

    try {
      const testData = 'test-encryption-validation';
      const encrypted = this.encrypt(testData);
      
      if (!encrypted || !this.isEncrypted(encrypted)) {
        return false;
      }

      const decrypted = this.decrypt(encrypted);
      return decrypted === testData;
    } catch (error) {
      logger.error('SecureStorage: Encryption validation failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const secureStorage = SecureStorage.getInstance();