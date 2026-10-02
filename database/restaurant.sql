-- =====================================================================
-- Online Restaurant Management System - MySQL 8+ / MariaDB 10.5+ schema
--
-- Safe to run repeatedly: it creates what is missing, upgrades older
-- installations in place (without losing data) and never duplicates the
-- starter menu. Run it with `npm run db:setup` (from the backend folder)
-- or paste it into MySQL Workbench.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS restaurant_db
	CHARACTER SET utf8mb4
	COLLATE utf8mb4_unicode_ci;

USE restaurant_db;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
	user_id INT NOT NULL AUTO_INCREMENT,
	name VARCHAR(100) NOT NULL,
	email VARCHAR(100) NOT NULL,
	password VARCHAR(255) NOT NULL,
	phone VARCHAR(15) DEFAULT NULL,
	role ENUM('CUSTOMER', 'ADMIN', 'STAFF', 'DELIVERY') NOT NULL DEFAULT 'CUSTOMER',
	is_active TINYINT(1) NOT NULL DEFAULT 1,
	last_login_at TIMESTAMP NULL DEFAULT NULL,
	created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (user_id),
	UNIQUE KEY uq_users_email (email),
	KEY idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
	category_id INT NOT NULL AUTO_INCREMENT,
	category_name VARCHAR(100) NOT NULL,
	description VARCHAR(255) DEFAULT NULL,
	created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (category_id),
	UNIQUE KEY uq_categories_name (category_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS food_items (
	food_id INT NOT NULL AUTO_INCREMENT,
	category_id INT NOT NULL,
	food_name VARCHAR(150) NOT NULL,
	description TEXT DEFAULT NULL,
	price DECIMAL(10,2) NOT NULL,
	image_url VARCHAR(500) DEFAULT NULL,
	availability TINYINT(1) NOT NULL DEFAULT 1,
	created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (food_id),
	KEY idx_food_items_category (category_id),
	CONSTRAINT chk_food_price CHECK (price >= 0),
	CONSTRAINT fk_food_items_category
		FOREIGN KEY (category_id) REFERENCES categories (category_id)
		ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cart (
	cart_id INT NOT NULL AUTO_INCREMENT,
	user_id INT NOT NULL,
	created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (cart_id),
	UNIQUE KEY uq_cart_user (user_id),
	CONSTRAINT fk_cart_user
		FOREIGN KEY (user_id) REFERENCES users (user_id)
		ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cart_items (
	cart_item_id INT NOT NULL AUTO_INCREMENT,
	cart_id INT NOT NULL,
	food_id INT NOT NULL,
	quantity INT NOT NULL DEFAULT 1,
	PRIMARY KEY (cart_item_id),
	UNIQUE KEY uq_cart_items_cart_food (cart_id, food_id),
	KEY idx_cart_items_food (food_id),
	CONSTRAINT chk_cart_quantity CHECK (quantity > 0),
	CONSTRAINT fk_cart_items_cart
		FOREIGN KEY (cart_id) REFERENCES cart (cart_id)
		ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT fk_cart_items_food
		FOREIGN KEY (food_id) REFERENCES food_items (food_id)
		ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Orders are business records: a user with orders cannot be deleted
-- (deactivate the account instead).
CREATE TABLE IF NOT EXISTS orders (
	order_id INT NOT NULL AUTO_INCREMENT,
	user_id INT NOT NULL,
	total_amount DECIMAL(10,2) NOT NULL,
	order_status ENUM(
		'PENDING', 'CONFIRMED', 'PREPARING', 'READY',
		'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'
	) NOT NULL DEFAULT 'PENDING',
	delivery_address TEXT NOT NULL,
	order_date TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (order_id),
	KEY idx_orders_user (user_id),
	KEY idx_orders_status (order_status),
	KEY idx_orders_date (order_date),
	CONSTRAINT fk_orders_user
		FOREIGN KEY (user_id) REFERENCES users (user_id)
		ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- food_name is copied at order time and food_id becomes NULL if the menu item
-- is later deleted, so order history is never lost or rewritten.
CREATE TABLE IF NOT EXISTS order_items (
	order_item_id INT NOT NULL AUTO_INCREMENT,
	order_id INT NOT NULL,
	food_id INT DEFAULT NULL,
	food_name VARCHAR(150) DEFAULT NULL,
	quantity INT NOT NULL,
	price DECIMAL(10,2) NOT NULL,
	PRIMARY KEY (order_item_id),
	KEY idx_order_items_order (order_id),
	KEY idx_order_items_food (food_id),
	CONSTRAINT chk_order_item_quantity CHECK (quantity > 0),
	CONSTRAINT fk_order_items_order
		FOREIGN KEY (order_id) REFERENCES orders (order_id)
		ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT fk_order_items_food
		FOREIGN KEY (food_id) REFERENCES food_items (food_id)
		ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
	payment_id INT NOT NULL AUTO_INCREMENT,
	order_id INT NOT NULL,
	payment_method ENUM('COD', 'UPI', 'CARD') NOT NULL,
	payment_status ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
	transaction_id VARCHAR(100) DEFAULT NULL,
	payment_date TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (payment_id),
	UNIQUE KEY uq_payments_order (order_id),
	CONSTRAINT fk_payments_order
		FOREIGN KEY (order_id) REFERENCES orders (order_id)
		ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_feedback (
	feedback_id INT NOT NULL AUTO_INCREMENT,
	name VARCHAR(100) NOT NULL,
	email VARCHAR(100) NOT NULL,
	message TEXT NOT NULL,
	created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (feedback_id),
	KEY idx_customer_feedback_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
	review_id INT NOT NULL AUTO_INCREMENT,
	user_id INT NOT NULL,
	food_id INT NOT NULL,
	rating INT NOT NULL,
	comment TEXT DEFAULT NULL,
	created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (review_id),
	KEY idx_reviews_user (user_id),
	KEY idx_reviews_food (food_id),
	CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
	CONSTRAINT fk_reviews_user
		FOREIGN KEY (user_id) REFERENCES users (user_id)
		ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT fk_reviews_food
		FOREIGN KEY (food_id) REFERENCES food_items (food_id)
		ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Upgrades for databases created by earlier versions of this project.
-- Every step checks first, so on a fresh database they all do nothing.
-- ---------------------------------------------------------------------

-- users: roles, active flag, last login
ALTER TABLE users
	MODIFY role ENUM('CUSTOMER', 'ADMIN', 'STAFF', 'DELIVERY') NOT NULL DEFAULT 'CUSTOMER';

SET @stmt = IF(
	(SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
	 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_active') = 0,
	'ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
	'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = IF(
	(SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
	 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login_at') = 0,
	'ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL',
	'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- food_items.availability should never be NULL
UPDATE food_items SET availability = 1 WHERE availability IS NULL;
ALTER TABLE food_items MODIFY availability TINYINT(1) NOT NULL DEFAULT 1;

-- cart_items: merge duplicate rows, then enforce one row per food per cart
UPDATE cart_items a
	JOIN (SELECT MIN(cart_item_id) AS keep_id, SUM(quantity) AS total_quantity
		FROM cart_items GROUP BY cart_id, food_id HAVING COUNT(*) > 1) d
		ON a.cart_item_id = d.keep_id
	SET a.quantity = d.total_quantity;

DELETE a FROM cart_items a
	JOIN cart_items b
		ON a.cart_id = b.cart_id AND a.food_id = b.food_id AND a.cart_item_id > b.cart_item_id;

SET @stmt = IF(
	(SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
	 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cart_items'
	   AND INDEX_NAME = 'uq_cart_items_cart_food') = 0,
	'ALTER TABLE cart_items ADD UNIQUE KEY uq_cart_items_cart_food (cart_id, food_id)',
	'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- order_items: keep a copy of the dish name and survive menu deletions
SET @stmt = IF(
	(SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
	 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'food_name') = 0,
	'ALTER TABLE order_items ADD COLUMN food_name VARCHAR(150) DEFAULT NULL AFTER food_id',
	'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE order_items oi
	JOIN food_items f ON f.food_id = oi.food_id
	SET oi.food_name = f.food_name
	WHERE oi.food_name IS NULL;

SET @stmt = IF(
	(SELECT COUNT(*) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
	 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items'
	   AND CONSTRAINT_NAME = 'fk_order_items_food' AND DELETE_RULE <> 'SET NULL') > 0,
	'ALTER TABLE order_items DROP FOREIGN KEY fk_order_items_food',
	'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = IF(
	(SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
	 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items'
	   AND COLUMN_NAME = 'food_id' AND IS_NULLABLE = 'NO') > 0,
	'ALTER TABLE order_items MODIFY food_id INT NULL',
	'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = IF(
	(SELECT COUNT(*) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
	 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items'
	   AND CONSTRAINT_NAME = 'fk_order_items_food') = 0,
	'ALTER TABLE order_items ADD CONSTRAINT fk_order_items_food FOREIGN KEY (food_id) REFERENCES food_items (food_id) ON DELETE SET NULL ON UPDATE CASCADE',
	'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- orders: never cascade-delete business records when a user row is removed
SET @stmt = IF(
	(SELECT COUNT(*) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
	 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
	   AND CONSTRAINT_NAME = 'fk_orders_user' AND DELETE_RULE <> 'RESTRICT') > 0,
	'ALTER TABLE orders DROP FOREIGN KEY fk_orders_user',
	'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = IF(
	(SELECT COUNT(*) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
	 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
	   AND CONSTRAINT_NAME = 'fk_orders_user') = 0,
	'ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE CASCADE',
	'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = IF(
	(SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
	 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_status') = 0,
	'ALTER TABLE orders ADD KEY idx_orders_status (order_status)',
	'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = IF(
	(SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
	 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_date') = 0,
	'ALTER TABLE orders ADD KEY idx_orders_date (order_date)',
	'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------
-- Starter menu (not duplicated when the script is run again)
-- ---------------------------------------------------------------------

INSERT INTO categories (category_name, description)
VALUES
	('Starters', 'Delicious appetizers and starters'),
	('Main Course', 'Main meals and special dishes'),
	('Pizza', 'Freshly prepared pizzas'),
	('Burgers', 'Tasty burgers and sandwiches'),
	('Desserts', 'Sweet dishes and desserts'),
	('Beverages', 'Hot and cold beverages')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO food_items (category_id, food_name, description, price, image_url, availability)
SELECT c.category_id, seed.food_name, seed.description, seed.price, NULL, 1
FROM (
	SELECT 'Starters' AS category_name, 'Paneer Tikka' AS food_name,
		'Grilled Indian cottage cheese with spices' AS description, 180.00 AS price
	UNION ALL SELECT 'Starters', 'French Fries', 'Crispy golden potato fries', 120.00
	UNION ALL SELECT 'Main Course', 'Veg Biryani',
		'Aromatic basmati rice cooked with vegetables and spices', 220.00
	UNION ALL SELECT 'Main Course', 'Paneer Butter Masala', 'Creamy tomato-based paneer curry', 240.00
	UNION ALL SELECT 'Pizza', 'Margherita Pizza',
		'Classic pizza with tomato, mozzarella and basil', 299.00
	UNION ALL SELECT 'Pizza', 'Farmhouse Pizza',
		'Pizza loaded with fresh vegetables and cheese', 399.00
	UNION ALL SELECT 'Burgers', 'Veg Burger',
		'Crispy vegetable patty with fresh vegetables', 159.00
	UNION ALL SELECT 'Burgers', 'Cheese Burger',
		'Classic burger with cheese and crispy patty', 199.00
	UNION ALL SELECT 'Desserts', 'Chocolate Brownie', 'Rich chocolate brownie', 149.00
	UNION ALL SELECT 'Desserts', 'Ice Cream', 'Creamy vanilla ice cream', 99.00
	UNION ALL SELECT 'Beverages', 'Cold Coffee', 'Chilled creamy cold coffee', 129.00
	UNION ALL SELECT 'Beverages', 'Fresh Lime Soda', 'Refreshing lime soda', 89.00
) AS seed
INNER JOIN categories c ON c.category_name = seed.category_name
WHERE NOT EXISTS (
	SELECT 1
	FROM food_items existing
	WHERE existing.category_id = c.category_id
	  AND existing.food_name = seed.food_name
);

-- The first admin is created with:  npm run create-admin
-- (there is deliberately no default admin account or password in this file)
