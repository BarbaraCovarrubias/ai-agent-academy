
ALTER TABLE corporate_documents ADD COLUMN IF NOT EXISTS content_tsv tsvector;
UPDATE corporate_documents SET content_tsv = to_tsvector('spanish', COALESCE(content, ''));
CREATE INDEX IF NOT EXISTS idx_docs_content_fts ON corporate_documents USING GIN(content_tsv);

CREATE OR REPLACE FUNCTION docs_tsv_trigger() RETURNS trigger AS $$
BEGIN
  new.content_tsv := to_tsvector('spanish', COALESCE(new.content, ''));
  return new;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_docs_tsv_update ON corporate_documents;
CREATE TRIGGER trg_docs_tsv_update BEFORE INSERT OR UPDATE
ON corporate_documents FOR EACH ROW EXECUTE PROCEDURE docs_tsv_trigger();

CREATE TABLE IF NOT EXISTS mcp_audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_role VARCHAR(50) DEFAULT 'architect',
    server_url VARCHAR(255),
    tool_name VARCHAR(100),
    input_payload JSONB,
    output_payload JSONB,
    approval_status VARCHAR(30),
    latency_ms FLOAT
);

CREATE TABLE IF NOT EXISTS saved_workflows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    version INT DEFAULT 1,
    nodes JSONB NOT NULL,
    edges JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
