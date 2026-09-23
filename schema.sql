CREATE TABLE
  products (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    sku VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    unitPrice DECIMAL(10, 2) NOT NULL,
    stockQuantity INT NOT NULL,
    Is_Deleted BOOLEAN NOT NULL DEFAULT FALSE,
    Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    Created_by VARCHAR(36) NULL,
    UNIQUE KEY UQ_products_sku (sku),
    KEY IDX_products_name (name)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE
  distributors (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    creditLimit DECIMAL(10, 2) NOT NULL,
    Is_Deleted BOOLEAN NOT NULL DEFAULT FALSE,
    Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    Created_by VARCHAR(36) NULL
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE
  sales_managers (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    Is_Deleted BOOLEAN NOT NULL DEFAULT FALSE,
    Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    Created_by VARCHAR(36) NULL
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE
  orders (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    distributor_id VARCHAR(36) NOT NULL,
    status ENUM (
      'Placed',
      'Confirmed',
      'PendingApproval',
      'Rejected',
      'Dispatched',
      'Delivered',
      'Cancelled'
    ) NOT NULL,
    discountPercent DECIMAL(5, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    idempotencyKey VARCHAR(255) NULL,
    Is_Deleted BOOLEAN NOT NULL DEFAULT FALSE,
    Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    Created_by VARCHAR(36) NULL,
    UNIQUE KEY UQ_orders_idempotencyKey (idempotencyKey),
    KEY IDX_orders_distributor (distributor_id),
    KEY IDX_orders_status (status),
    KEY IDX_orders_created_at (Created_At),
    CONSTRAINT FK_orders_distributor FOREIGN KEY (distributor_id) REFERENCES distributors (id) ON DELETE RESTRICT
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE
  order_line_items (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    quantity INT NOT NULL,
    unitPrice DECIMAL(10, 2) NOT NULL,
    Is_Deleted BOOLEAN NOT NULL DEFAULT FALSE,
    Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    Created_by VARCHAR(36) NULL,
    CONSTRAINT FK_order_line_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT FK_order_line_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE
  order_events (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    fromStatus VARCHAR(255) NULL,
    toStatus VARCHAR(255) NOT NULL,
    actorType ENUM ('Distributor', 'SalesManager', 'System') NOT NULL,
    actorId VARCHAR(36) NULL,
    Is_Deleted BOOLEAN NOT NULL DEFAULT FALSE,
    Created_At DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    Updated_At DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    Created_by VARCHAR(36) NULL,
    sequence BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    idempotencyKey VARCHAR(100) NULL,
    KEY IDX_order_events_order (order_id),
    UNIQUE KEY sequence (sequence),
    UNIQUE KEY UQ_order_events_idempotency_key (idempotencyKey),
    CONSTRAINT FK_order_events_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Append-only audit log (R8/Q14): the database rejects any UPDATE or DELETE
-- of an event row. Deleting an order still removes its events through the
-- ON DELETE CASCADE above (MySQL does not fire triggers for FK cascades).
CREATE TRIGGER trg_order_events_no_update BEFORE
UPDATE ON order_events FOR EACH ROW SIGNAL SQLSTATE '45000'
SET
  MESSAGE_TEXT = 'order_events is append-only: rows cannot be updated';

CREATE TRIGGER trg_order_events_no_delete BEFORE DELETE ON order_events FOR EACH ROW SIGNAL SQLSTATE '45000'
SET
  MESSAGE_TEXT = 'order_events is append-only: rows cannot be deleted';

CREATE TABLE
  points_ledger (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    distributor_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36) NOT NULL,
    points INT NOT NULL,
    Is_Deleted BOOLEAN NOT NULL DEFAULT FALSE,
    Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    Created_by VARCHAR(36) NULL,
    KEY IDX_points_ledger_distributor (distributor_id),
    CONSTRAINT FK_points_ledger_distributor FOREIGN KEY (distributor_id) REFERENCES distributors (id) ON DELETE CASCADE,
    CONSTRAINT FK_points_ledger_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE
  outbound_events (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    eventType VARCHAR(255) NOT NULL,
    payload JSON NOT NULL,
    status ENUM ('Pending', 'Sent', 'Failed') NOT NULL,
    attemptCount INT NOT NULL DEFAULT 0,
    lastAttemptedAt DATETIME NULL,
    nextRetryAt DATETIME NULL,
    errorMessage VARCHAR(500) NULL,
    Is_Deleted BOOLEAN NOT NULL DEFAULT FALSE,
    Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    Created_by VARCHAR(36) NULL,
    KEY IDX_outbound_events_retry (status, nextRetryAt),
    CONSTRAINT FK_outbound_events_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE
  users (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    contactNumber VARCHAR(50) NULL,
    role ENUM ('DISTRIBUTOR', 'SALES_MANAGER') NOT NULL,
    distributor_id VARCHAR(36) NULL,
    sales_manager_id VARCHAR(36) NULL,
    Is_Deleted BOOLEAN NOT NULL DEFAULT FALSE,
    Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    Created_by VARCHAR(36) NULL,
    UNIQUE KEY UQ_users_email (email),
    KEY IDX_users_distributor (distributor_id),
    KEY IDX_users_sales_manager (sales_manager_id),
    CONSTRAINT FK_users_distributor FOREIGN KEY (distributor_id) REFERENCES distributors (id) ON DELETE RESTRICT,
    CONSTRAINT FK_users_sales_manager FOREIGN KEY (sales_manager_id) REFERENCES sales_managers (id) ON DELETE RESTRICT
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;