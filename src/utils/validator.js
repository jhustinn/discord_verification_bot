// ─── Input Validation ─────────────────────────────────────────────────────────
const SECURITY = {
  maxFileSize:5*1024*1024, //5MB
  allowedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
  maxNameLength:50,
  minNameLength:2,
  validLevelRange: { min:1, max:100 }
};

function validateFile(attachment) {
  const errors = [];

  if (attachment.size > SECURITY.maxFileSize) {
    errors.push(`File too large. Maximum size is ${SECURITY.maxFileSize / (1024*1024)}MB.`);
  }

  if (!SECURITY.allowedTypes.includes(attachment.contentType)) {
    errors.push('Invalid file type. Allowed: PNG, JPG, GIF, WEBP.');
  }

  return {
    valid: errors.length ===0,
    errors
  };
}

function validatePlayerName(name) {
  if (!name || typeof name !== 'string') return { valid: false, error: 'Name is required' };
  
  const trimmed = name.trim();
  if (trimmed.length < SECURITY.minNameLength) {
    return { valid: false, error: 'Name too short' };
  }
  if (trimmed.length > SECURITY.maxNameLength) {
    return { valid: false, error: 'Name too long' };
  }

  return { valid: true };
}

function validatePlayerLevel(level) {
  if (level === null || level === undefined) return { valid: true }; // Optional field
  
  const num = parseInt(level);
  if (isNaN(num) || num < SECURITY.validLevelRange.min || num > SECURITY.validLevelRange.max) {
    return { valid: false, error: `Level must be between ${SECURITY.validLevelRange.min} and ${SECURITY.validLevelRange.max}` };
  }

  return { valid: true };
}

function validatePlayerId(playerId) {
  if (!playerId) return { valid: true }; // Optional field
  
  // Hex format (Modern Warships)
  if (/^[0-9A-Fa-f]{8,16}$/.test(playerId)) {
    return { valid: true };
  }
  
  // Decimal format
  if (/^\d{6,12}$/.test(playerId)) {
    return { valid: true };
  }

  return { valid: false, error: 'Invalid player ID format' };
}

module.exports = {
  SECURITY,
  validateFile,
  validatePlayerName,
  validatePlayerLevel,
  validatePlayerId
};
