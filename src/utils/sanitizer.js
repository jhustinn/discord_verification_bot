// ─── Input Sanitization ──────────────────────────────────────────────────────
const MAX_LENGTH = 50;

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
  
  // Preserve Unicode characters, only remove specific artifacts
  const sanitized = name
    .replace(/[#]\d*$/g, '') // Remove trailing #number
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .substring(0, MAX_LENGTH);

  // Skip UI elements and common OCR artifacts
  const skipWords = ['Back', 'Title', 'Level', 'Showcase', 'Academy', 'STATISTICS', 'ACHIEVEMENTS'];
  if (skipWords.includes(sanitized)) {
    return null;
  }

  return sanitized.length >= 2 ? sanitized : null;
}

function sanitizeOCRText(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Preserve Unicode characters (including special chars like Ψ, Ω, etc.)
  // Only remove control characters but keep printable Unicode
  return text
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars but keep Unicode
    .trim();
}

module.exports = {
  sanitizeInput,
  sanitizePlayerName,
  sanitizeOCRText
};
