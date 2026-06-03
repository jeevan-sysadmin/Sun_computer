USE `sun_computers`;

DROP TRIGGER IF EXISTS `trg_products_bi_normalize_serial`;
DROP TRIGGER IF EXISTS `trg_products_bu_normalize_serial`;

DELIMITER $$

CREATE TRIGGER `trg_products_bi_normalize_serial`
BEFORE INSERT ON `products`
FOR EACH ROW
BEGIN
  IF NEW.serial_number IS NOT NULL THEN
    SET NEW.serial_number = TRIM(NEW.serial_number);
  END IF;
END$$

CREATE TRIGGER `trg_products_bu_normalize_serial`
BEFORE UPDATE ON `products`
FOR EACH ROW
BEGIN
  IF NEW.serial_number IS NOT NULL THEN
    SET NEW.serial_number = TRIM(NEW.serial_number);
  END IF;
END$$

DELIMITER ;
