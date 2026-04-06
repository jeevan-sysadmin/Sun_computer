ALTER TABLE `service_orders`
  MODIFY `staff_id` int(11) DEFAULT NULL,
  MODIFY `issue_description` text DEFAULT NULL,
  MODIFY `estimated_cost` decimal(10,2) DEFAULT NULL,
  MODIFY `final_cost` decimal(10,2) DEFAULT NULL,
  MODIFY `estimated_delivery_date` date DEFAULT NULL,
  MODIFY `deposit_amount` decimal(10,2) DEFAULT 0.00,
  MODIFY `warranty_status` enum('in_warranty','out_of_warranty','extended_warranty') DEFAULT 'out_of_warranty',
  MODIFY `payment_status` enum('pending','partially_paid','paid','refunded') NOT NULL DEFAULT 'pending',
  MODIFY `status` enum('pending','scheduled','process','ready','completed','delivered','cancelled') DEFAULT 'pending',
  MODIFY `priority` enum('low','medium','high','urgent') DEFAULT 'medium';
