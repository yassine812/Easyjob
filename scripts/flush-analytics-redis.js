const Redis = require('ioredis');

async function main() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const keys = await redis.keys('*analytics*');
  console.log('Found analytics Redis keys:', keys);
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log('Successfully flushed all analytics Redis cache keys!');
  }
  await redis.quit();
}

main().catch(console.error);
