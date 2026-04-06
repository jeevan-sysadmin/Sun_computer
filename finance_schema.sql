-- Sun Computers finance schema
-- Run this against the `sun_computers` database before using the new finance APIs.

SET @has_service_type := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'service_orders'
      AND COLUMN_NAME = 'service_type'
);

SET @service_type_sql := IF(
    @has_service_type = 0,
    'ALTER TABLE service_orders ADD COLUMN service_type VARCHAR(50) NOT NULL DEFAULT ''general'' AFTER staff_id',
    'SELECT ''service_type column already exists'''
);

PREPARE stmt FROM @service_type_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE service_orders
SET service_type = 'general'
WHERE service_type IS NULL OR TRIM(service_type) = '';

SET @has_service_type_index := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'service_orders'
      AND INDEX_NAME = 'idx_service_orders_service_type'
);

SET @service_type_index_sql := IF(
    @has_service_type_index = 0,
    'ALTER TABLE service_orders ADD INDEX idx_service_orders_service_type (service_type)',
    'SELECT ''idx_service_orders_service_type already exists'''
);

PREPARE stmt FROM @service_type_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS staff_salaries (
    id INT NOT NULL AUTO_INCREMENT,
    staff_id INT NOT NULL,
    staff_name VARCHAR(255) NOT NULL,
    service_type VARCHAR(50) NOT NULL DEFAULT 'general',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    bonus DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    deductions DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    net_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    salary_date DATE NOT NULL,
    salary_month CHAR(7) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
    transaction_id VARCHAR(100) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    paid_by INT DEFAULT NULL,
    paid_by_name VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_staff_salaries_staff_date (staff_id, salary_date),
    KEY idx_staff_salaries_service_date (service_type, salary_date),
    KEY idx_staff_salaries_salary_month (salary_month),
    CONSTRAINT fk_staff_salaries_staff
        FOREIGN KEY (staff_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_staff_salaries_paid_by
        FOREIGN KEY (paid_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_expenses (
    id INT NOT NULL AUTO_INCREMENT,
    staff_id INT NOT NULL,
    staff_name VARCHAR(255) NOT NULL,
    service_type VARCHAR(50) NOT NULL DEFAULT 'general',
    expense_type VARCHAR(50) NOT NULL DEFAULT 'others',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    description VARCHAR(255) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
    receipt_number VARCHAR(100) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_by_name VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_staff_expenses_staff_date (staff_id, expense_date),
    KEY idx_staff_expenses_service_date (service_type, expense_date),
    KEY idx_staff_expenses_type_date (expense_type, expense_date),
    CONSTRAINT fk_staff_expenses_staff
        FOREIGN KEY (staff_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_staff_expenses_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS income_entries (
    id INT NOT NULL AUTO_INCREMENT,
    service_type VARCHAR(50) NOT NULL DEFAULT 'general',
    income_source VARCHAR(100) NOT NULL DEFAULT 'manual',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    income_date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
    reference_number VARCHAR(100) DEFAULT NULL,
    client_id INT DEFAULT NULL,
    order_id INT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_by_name VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_income_entries_service_date (service_type, income_date),
    KEY idx_income_entries_client_date (client_id, income_date),
    KEY idx_income_entries_order_date (order_id, income_date),
    CONSTRAINT fk_income_entries_client
        FOREIGN KEY (client_id) REFERENCES clients(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_income_entries_order
        FOREIGN KEY (order_id) REFERENCES service_orders(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_income_entries_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
