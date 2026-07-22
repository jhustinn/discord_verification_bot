// ─── Logger Utility ───────────────────────────────────────────────────────────
const LOG_LEVELS = {
  DEBUG:0,
  INFO:1,
  WARN:2,
  ERROR:3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.INFO;

function formatMessage(level, module, message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] [${level}] [${module}] ${message}`;
  
  if (data) {
    logMessage += ` | ${JSON.stringify(data)}`;
  }
  
  return logMessage;
}

function debug(module, message, data = null) {
  if (currentLevel <= LOG_LEVELS.DEBUG) {
    console.debug(formatMessage('DEBUG', module, message, data));
  }
}

function info(module, message, data = null) {
  if (currentLevel <= LOG_LEVELS.INFO) {
    console.log(formatMessage('INFO', module, message, data));
  }
}

function warn(module, message, data = null) {
  if (currentLevel <= LOG_LEVELS.WARN) {
    console.warn(formatMessage('WARN', module, message, data));
  }
}

function error(module, message, data = null) {
  if (currentLevel <= LOG_LEVELS.ERROR) {
    console.error(formatMessage('ERROR', module, message, data));
  }
}

module.exports = {
  LOG_LEVELS,
  debug,
  info,
  warn,
  error
};
