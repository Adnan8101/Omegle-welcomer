import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Initialize database - create tables if they don't exist
 */
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY
      )
    `);

    // Create guild_config table
    await client.query(`
      CREATE TABLE IF NOT EXISTS guild_config (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) UNIQUE NOT NULL,
        welcome_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create welcome_panels table
    await client.query(`
      CREATE TABLE IF NOT EXISTS welcome_panels (
        id VARCHAR(36) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        panel_name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        welcome_channel VARCHAR(255) NOT NULL,
        auto_delete_ms INTEGER,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(guild_id, panel_name)
      )
    `);

    // Create setup_sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS setup_sessions (
        id VARCHAR(36) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        step VARCHAR(50) NOT NULL,
        message TEXT,
        auto_delete_ms INTEGER,
        welcome_channel VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      )
    `);

    console.log('✅ Database initialized successfully');
  } finally {
    client.release();
  }
}

/**
 * Execute a query
 */
export async function query(text: string, params?: unknown[]): Promise<any> {
  return pool.query(text, params);
}

/**
 * Get a single row
 */
export async function getOne(text: string, params?: unknown[]): Promise<any> {
  const result = await pool.query(text, params);
  return result.rows[0];
}

/**
 * Get multiple rows
 */
export async function getMany(text: string, params?: unknown[]): Promise<any[]> {
  const result = await pool.query(text, params);
  return result.rows;
}

/**
 * Run in transaction
 */
export async function transaction(callback: (client: any) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await callback(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log('✅ Database connection closed');
  }
}

export { pool };
