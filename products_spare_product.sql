ALTER TABLE `products`
  ADD COLUMN `is_spare_product` TINYINT(1) NOT NULL DEFAULT 0 AFTER `serial_number`;
