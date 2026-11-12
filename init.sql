-- Habilitar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla principal de fragmentos documentales
CREATE TABLE IF NOT EXISTS corporate_documents (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(150) NOT NULL,
    tenant_id VARCHAR(100) NOT NULL DEFAULT 'omnicorp',
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    content TEXT NOT NULL,
    embedding vector(4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice HNSW optimizado para similitud coseno (<=>)
CREATE INDEX IF NOT EXISTS idx_docs_embedding_hnsw 
ON corporate_documents 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Datos semilla iniciales (OmniCorp) para pruebas inmediatas
INSERT INTO corporate_documents (document_id, tenant_id, category, content, embedding)
VALUES 
    ('doc_101', 'omnicorp', 'reintegros', 'El tope mensual de reintegro de conectividad y trabajo remoto es de $45.000 ARS por empleado.', '[0.1200, 0.8800, 0.3500, 0.0500]'),
    ('doc_102', 'omnicorp', 'vacaciones', 'Al cumplir 5 años de antigüedad en la compañía corresponden 7 días hábiles complementarios de vacaciones.', '[0.7800, 0.1500, 0.4200, 0.1100]'),
    ('doc_103', 'omnicorp', 'seguridad', 'El acceso a servidores de producción exige validación biométrica y conexión obligatoria mediante túnel Zero Trust.', '[0.0900, 0.2100, 0.1400, 0.9400]'),
    ('doc_104', 'omnicorp', 'reintegros', 'El beneficio de guardería cubre hasta el 60% de la cuota mensual presentando factura tipo B o C.', '[0.1800, 0.8400, 0.3100, 0.0900]');