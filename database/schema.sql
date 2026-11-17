CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'staff'
        CHECK (role IN ('admin', 'staff')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category_id BIGINT REFERENCES categories(id),
    base_unit VARCHAR(30) NOT NULL,
    current_stock NUMERIC(14,3) DEFAULT 0,
    minimum_stock NUMERIC(14,3) DEFAULT 0,
    purchase_price NUMERIC(14,2) DEFAULT 0,
    selling_price NUMERIC(14,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unit_conversions (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    purchase_unit VARCHAR(30) NOT NULL,
    base_unit VARCHAR(30) NOT NULL,
    conversion_quantity NUMERIC(14,3) NOT NULL
        CHECK (conversion_quantity > 0),
    UNIQUE(product_id, purchase_unit)
);

CREATE TABLE IF NOT EXISTS stock_transactions (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('IN', 'OUT', 'ADJUSTMENT')),
    quantity NUMERIC(14,3) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    conversion_factor NUMERIC(14,3) DEFAULT 1,
    base_quantity NUMERIC(14,3) NOT NULL,
    supplier_id BIGINT REFERENCES suppliers(id),
    notes TEXT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monthly_reports (
    id BIGSERIAL PRIMARY KEY,
    report_month DATE NOT NULL UNIQUE,
    report_data JSONB NOT NULL,
    verified_by BIGINT REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_logs (
    id BIGSERIAL PRIMARY KEY,
    backup_date TIMESTAMPTZ DEFAULT NOW(),
    backup_type VARCHAR(30),
    status VARCHAR(20),
    file_name TEXT,
    details TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(100),
    record_id BIGINT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_product
ON stock_transactions(product_id);

CREATE INDEX IF NOT EXISTS idx_transactions_date
ON stock_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_products_category
ON products(category_id);

-- SUBCATEGORIES
CREATE TABLE IF NOT EXISTS subcategories (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES categories(id),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, name)
);

-- CONNECT PRODUCTS WITH SUBCATEGORIES
ALTER TABLE products
ADD COLUMN IF NOT EXISTS subcategory_id BIGINT
REFERENCES subcategories(id);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_subcategories_category
ON subcategories(category_id);

CREATE INDEX IF NOT EXISTS idx_products_subcategory
ON products(subcategory_id);
