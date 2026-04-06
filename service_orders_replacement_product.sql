ALTER TABLE `service_orders`
  ADD COLUMN `replacement_product_id` int(11) DEFAULT NULL AFTER `product_id`,
  ADD CONSTRAINT `fk_service_orders_replacement_product`
    FOREIGN KEY (`replacement_product_id`) REFERENCES `products`(`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
