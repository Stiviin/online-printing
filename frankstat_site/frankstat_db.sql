/*-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password_hash TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Function to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function on update
CREATE TRIGGER trigger_update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

*/

/*
INSERT INTO users (
    full_name,
    email,
    phone,
    password_hash
) VALUES (
    'John Doe',
    'john@example.com',
    '0712345678',
    '$2b$10$examplehashedpassword'
)
RETURNING *;
*/

-- Index for faster email lookups (already created via UNIQUE, but explicit naming is cleaner)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index for verification filtering
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);

-- Optional: Index for created_at sorting (useful for admin dashboards)
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);