declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    DEEPSEEK_API_KEY?: string;
    DEEPSEEK_MODEL?: string;
    AI_ENABLED?: string;
    AI_USER_DAILY_LIMIT?: string;
    AI_SITE_DAILY_LIMIT?: string;
  }
}
