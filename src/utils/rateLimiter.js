// ─── Rate Limiter ─────────────────────────────────────────────────────────────
const attempts = new Map(); // userId -> { count, lastAttempt }

const LIMITS = {
  maxAttempts:3,
  windowMs:24*60*60*1000, //24 hours
  cooldownMs:60*1000 //1 minute
};

function check(userId) {
  const now = Date.now();
  const userAttempts = attempts.get(userId);

  if (!userAttempts) {
    return { allowed: true };
  }

  // Check cooldown
  if (now - userAttempts.lastAttempt < LIMITS.cooldownMs) {
    const remaining = Math.ceil((LIMITS.cooldownMs - (now - userAttempts.lastAttempt)) /1000);
    return { 
      allowed: false, 
      message: `Please wait ${remaining} seconds before trying again.` 
    };
  }

  // Check rate limit
  if (userAttempts.count >= LIMITS.maxAttempts) {
    const timeLeft = Math.ceil((LIMITS.windowMs - (now - userAttempts.lastAttempt)) / (60*60*1000));
    return { 
      allowed: false, 
      message: `Rate limit exceeded. Try again in ${timeLeft} hours.` 
    };
  }

  return { allowed: true };
}

function update(userId) {
  const now = Date.now();
  const userAttempts = attempts.get(userId);

  if (!userAttempts) {
    attempts.set(userId, { count:1, lastAttempt: now });
  } else {
    userAttempts.count +=1;
    userAttempts.lastAttempt = now;
  }
}

function reset(userId) {
  attempts.delete(userId);
}

module.exports = { check, update, reset, LIMITS };
