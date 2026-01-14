const Redis = require('ioredis');

const redis = new Redis({
  host: '127.0.0.1',
  port: 6379
});

const TIMEOUT = 5 * 60;

async function setValue(key, value, expireIn = null) {
  try {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
    if (expireIn) {
      await redis.set(key, stringValue, 'EX', expireIn);
    } else {
      await redis.set(key, stringValue);
    }
    return true;
  } catch (error) {
    console.error('Redis setValue error:', error);
    return false;
  }
}

async function getValue(key) {
  try {
    const data = await redis.get(key);
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  } catch (error) {
    console.error('Redis getValue error:', error);
    return null;
  }
}

async function deleteKey(key) {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Redis deleteKey error:', error);
    return false;
  }
}

async function exists(key) {
  try {
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    console.error('Redis exists error:', error);
    return false;
  }
}

// Session Helpers
async function createSession(sessionId, data, ttl = TIMEOUT) {
  return await setValue(`session:${sessionId}`, data, ttl);
}

async function getSession(sessionId) {
  return await getValue(`session:${sessionId}`);
}

async function refreshSession(sessionId, ttl = TIMEOUT) {
  try {
    const key = `session:${sessionId}`;
    const session = await getValue(key);
    if (session) {
      await setValue(key, session, ttl);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Redis refreshSession error:', error);
    return false;
  }
}

async function destroySession(sessionId) {
  return await deleteKey(`session:${sessionId}`);
}

module.exports = { redis, setValue, getValue, deleteKey, exists, createSession, getSession, refreshSession, destroySession };
