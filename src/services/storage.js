// ─── Storage Service ──────────────────────────────────────────────────────────
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const BUCKET_NAME = 'verification-attachments';

async function uploadFile(fileBuffer, filePath, contentType) {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileBuffer, {
      contentType: contentType,
      upsert: true
    });

  if (error) {
    logger.error('Storage', 'Upload failed', { filePath, error: error.message });
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  logger.info('Storage', 'File uploaded successfully', { filePath });
  return data;
}

function getPublicUrl(filePath) {
  const { publicURL, error } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  if (error) {
    logger.error('Storage', 'Failed to get public URL', { filePath, error: error.message });
    throw new Error(`Get URL failed: ${error.message}`);
  }

  if (!publicURL) {
    throw new Error('Public URL is null');
  }

  return publicURL;
}

module.exports = {
  uploadFile,
  getPublicUrl
};
