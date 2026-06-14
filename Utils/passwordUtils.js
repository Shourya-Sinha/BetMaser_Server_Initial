import argon2 from 'argon2';

class PasswordUtils {
  // Argon2 configuration for high security
  static options = {
    type: argon2.argon2id, // Hybrid mode (best security)
    memoryCost: 65536, // 64 MB memory usage
    timeCost: 3, // 3 iterations
    parallelism: 4, // 4 parallel threads
    hashLength: 32, // 32 bytes output
    saltLength: 16 // 16 bytes salt
  };

  /**
   * Hash password using Argon2id
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  static async hashPassword(password) {
    try {
      const hash = await argon2.hash(password, this.options);
      return hash;
    } catch (error) {
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   * @param {string} hash - Stored hash
   * @param {string} password - Plain text password to verify
   * @returns {Promise<boolean>} - True if password matches
   */
  static async verifyPassword(hash, password) {
    try {
      if (!hash || !password) return false;
      
      const isValid = await argon2.verify(hash, password, {
        type: argon2.argon2id
      });
      
      // If password is valid but needs rehash (due to updated options)
      if (isValid && argon2.needsRehash(hash, this.options)) {
        return { isValid: true, needsRehash: true };
      }
      
      return { isValid, needsRehash: false };
    } catch (error) {
      return { isValid: false, needsRehash: false };
    }
  }

  /**
   * Check if hash needs to be upgraded
   * @param {string} hash - Stored hash
   * @returns {boolean} - True if hash needs rehashing
   */
  static needsRehash(hash) {
    return argon2.needsRehash(hash, this.options);
  }
}

export default PasswordUtils;