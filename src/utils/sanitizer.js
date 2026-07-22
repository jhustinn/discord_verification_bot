// ─── Input Sanitization ──────────────────────────────────────────────────────
const MAX_LENGTH =50;

function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .replace(/[;\\]/g, '') // Remove injection chars
    .trim()
    .substring(0, MAX_LENGTH);
}

function sanitizePlayerName(name) {
  if (!name || typeof name !== 'string') return null;
  
  const sanitized = name
    .replace(/[#\[\]\(\)]/g, '') // Remove brackets and hash
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .substring(0, MAX_LENGTH);

  // Skip UI elements and common OCR artifacts
  const skipWords = ['Back', 'Title', 'Level', 'Showcase', 'Academy', 'STATISTICS', 'ACHIEVEMENTS'];
  if (skipWords.includes(sanitized)) {
    return null;
  }

  return sanitized.length >=2 ? sanitized : null;
}

function sanitizeOCRText(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Remove excessive whitespace but keep structure
  return text
    .replace(/\n{3,}/g, '\n\n') // Max2 consecutive newlines
    .replace(/[^\x20-\x7E\n]/g, '') // Keep only printable ASCII + newlines
    .trim();
}

module.exports = {
  sanitizeInput,
  sanitizePlayerName,
  sanitizeOCRText
};
