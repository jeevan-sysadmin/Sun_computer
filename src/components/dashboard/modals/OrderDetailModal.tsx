import { motion } from "framer-motion";
import {
  FiCalendar,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiEdit,
  FiInfo,
  FiPackage,
  FiPrinter,
  FiShield,
  FiTrendingUp,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";
import type { Order } from "../types";
import { formatCurrency, formatDisplayDate, getBalanceDue } from "../utils";

interface OrderDetailModalProps {
  order: Order;
  getStatusColor: (status: string) => string;
  getPriorityColor: (priority: string) => string;
  getWarrantyColor: (warranty: string) => string;
  onClose: () => void;
  onEdit: (order: Order) => void;
  onPrint: (order: Order) => void;
}

const formatOrderMeta = (value?: string) =>
  value && value !== "0000-00-00 00:00:00" ? formatDisplayDate(value) : "Not set";

const prettify = (value?: string) =>
  (value || "n/a")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const OrderDetailModal = ({
  order,
  getStatusColor,
  getPriorityColor,
  getWarrantyColor,
  onClose,
  onEdit,
  onPrint,
}: OrderDetailModalProps) => {
  const statusColor = getStatusColor(order.status);
  const priorityColor = getPriorityColor(order.priority);
  const warrantyColor = getWarrantyColor(order.warranty_status);
  const finalAmount = formatCurrency(order.final_cost || order.estimated_cost);
  const depositAmount = formatCurrency(order.deposit_amount);
  const balanceDue = getBalanceDue(order.final_cost, order.estimated_cost, order.deposit_amount);

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-content order-detail-modal"
        initial={{ opacity: 0, scale: 0.94, y: 36 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 24 }}
        transition={{ type: "spring", stiffness: 240, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header order-detail-header">
          <div className="order-detail-title-wrap">
            <div className="order-detail-kicker">Service Order</div>
            <div className="modal-title">
              <h2>{order.order_code}</h2>
              <p>
                {order.client_name} | {order.product_name}
              </p>
            </div>
          </div>
          <div className="order-detail-header-actions">
            <div className="order-detail-status-row">
              <span className="order-detail-pill" style={{ backgroundColor: `${statusColor}18`, color: statusColor }}>
                {prettify(order.status)}
              </span>
              <span className="order-detail-pill" style={{ backgroundColor: `${priorityColor}18`, color: priorityColor }}>
                {prettify(order.priority)} Priority
              </span>
              <span className="order-detail-pill" style={{ backgroundColor: `${warrantyColor}18`, color: warrantyColor }}>
                {prettify(order.warranty_status)}
              </span>
            </div>
            <motion.button className="close-btn" onClick={onClose} whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }}>
              <FiX />
            </motion.button>
          </div>
        </div>

        <div className="order-detail-content">
          <div className="order-detail-hero">
            <div className="order-detail-hero-card">
              <div className="order-detail-hero-icon"><FiUser /></div>
              <div>
                <span className="order-detail-hero-label">Client</span>
                <strong>{order.client_name}</strong>
                <p>{order.client_phone || "Phone not available"}</p>
              </div>
            </div>
            <div className="order-detail-hero-card">
              <div className="order-detail-hero-icon"><FiPackage /></div>
              <div>
                <span className="order-detail-hero-label">Product</span>
                <strong>{order.product_name}</strong>
                <p>{order.replacement_product_name ? `Replacement: ${order.replacement_product_name}` : "No replacement product"}</p>
              </div>
            </div>
            <div className="order-detail-hero-card">
              <div className="order-detail-hero-icon"><FiCreditCard /></div>
              <div>
                <span className="order-detail-hero-label">Payment</span>
                <strong>Rs. {finalAmount}</strong>
                <p>{prettify(order.payment_status)}</p>
              </div>
            </div>
            <div className="order-detail-hero-card">
              <div className="order-detail-hero-icon"><FiCalendar /></div>
              <div>
                <span className="order-detail-hero-label">Timeline</span>
                <strong>{formatOrderMeta(order.estimated_delivery_date)}</strong>
                <p>Created {formatOrderMeta(order.created_at)}</p>
              </div>
            </div>
          </div>

          <div className="order-detail-grid">
            <div className="detail-section detail-section-emphasis">
              <h3><FiInfo /> Service Summary</h3>
              <div className="detail-stack">
                <div className="detail-copy-block">
                  <span className="detail-copy-label">Issue Description</span>
                  <p>{order.issue_description || "No issue description provided."}</p>
                </div>
                <div className="detail-copy-grid">
                  <div className="detail-copy-block">
                    <span className="detail-copy-label">Diagnosis Notes</span>
                    <p>{order.diagnosis_notes || "No diagnosis notes yet."}</p>
                  </div>
                  <div className="detail-copy-block">
                    <span className="detail-copy-label">Repair Notes</span>
                    <p>{order.repair_notes || "No repair notes yet."}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3><FiPackage /> Product Details</h3>
              <div className="detail-item"><span className="detail-label">Main Product</span><span className="detail-value">{order.product_name}</span></div>
              <div className="detail-item"><span className="detail-label">Replacement Product</span><span className="detail-value">{order.replacement_product_name || "Not added"}</span></div>
              <div className="detail-item"><span className="detail-label">Brand</span><span className="detail-value">{order.product_brand || "N/A"}</span></div>
              <div className="detail-item"><span className="detail-label">Model</span><span className="detail-value">{order.product_model || "N/A"}</span></div>
            </div>

            <div className="detail-section">
              <h3><FiDollarSign /> Payment Snapshot</h3>
              <div className="detail-item"><span className="detail-label">Estimated Cost</span><span className="detail-value">Rs. {formatCurrency(order.estimated_cost)}</span></div>
              <div className="detail-item"><span className="detail-label">Final Cost</span><span className="detail-value">Rs. {finalAmount}</span></div>
              <div className="detail-item"><span className="detail-label">Deposit</span><span className="detail-value">Rs. {depositAmount}</span></div>
              <div className="detail-item"><span className="detail-label">Balance Due</span><span className="detail-value">Rs. {balanceDue}</span></div>
              <div className="detail-item">
                <span className="detail-label">Payment Status</span>
                <span className="detail-value order-inline-badge">{prettify(order.payment_status)}</span>
              </div>
            </div>

            <div className="detail-section">
              <h3><FiTrendingUp /> Workflow</h3>
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span className="detail-value order-inline-badge" style={{ backgroundColor: `${statusColor}18`, color: statusColor }}>
                  {prettify(order.status)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Priority</span>
                <span className="detail-value order-inline-badge" style={{ backgroundColor: `${priorityColor}18`, color: priorityColor }}>
                  {prettify(order.priority)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Warranty</span>
                <span className="detail-value order-inline-badge" style={{ backgroundColor: `${warrantyColor}18`, color: warrantyColor }}>
                  {prettify(order.warranty_status)}
                </span>
              </div>
              <div className="detail-item"><span className="detail-label">Estimated Delivery</span><span className="detail-value">{formatOrderMeta(order.estimated_delivery_date)}</span></div>
              <div className="detail-item"><span className="detail-label">Actual Delivery</span><span className="detail-value">{formatOrderMeta(order.actual_delivery_date)}</span></div>
            </div>

            <div className="detail-section">
              <h3><FiUsers /> Team & Client</h3>
              <div className="detail-item"><span className="detail-label">Client Phone</span><span className="detail-value">{order.client_phone || "N/A"}</span></div>
              <div className="detail-item"><span className="detail-label">Client Email</span><span className="detail-value">{order.client_email || "N/A"}</span></div>
              <div className="detail-item"><span className="detail-label">Service Staff</span><span className="detail-value">{order.staff_name || "Not assigned"}</span></div>
              <div className="detail-item"><span className="detail-label">Staff Email</span><span className="detail-value">{order.staff_email || "N/A"}</span></div>
            </div>

            <div className="detail-section">
              <h3><FiClock /> Record Timeline</h3>
              <div className="detail-item"><span className="detail-label">Created At</span><span className="detail-value">{new Date(order.created_at).toLocaleString()}</span></div>
              <div className="detail-item"><span className="detail-label">Order ID</span><span className="detail-value">#{order.id}</span></div>
              <div className="detail-item"><span className="detail-label">Code</span><span className="detail-value">{order.order_code}</span></div>
            </div>

            {order.notes && (
              <div className="detail-section full-width detail-section-notes">
                <h3><FiShield /> Notes & Instructions</h3>
                <div className="detail-copy-block">
                  <span className="detail-copy-label">Additional Notes</span>
                  <p>{order.notes}</p>
                </div>
              </div>
            )}
          </div>

          <div className="order-detail-actions">
            <motion.button className="btn outline" onClick={onClose} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>Close</motion.button>
            <motion.button className="btn primary" onClick={() => onEdit(order)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}><FiEdit /> Edit Order</motion.button>
            <motion.button className="btn secondary" onClick={() => onPrint(order)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}><FiPrinter /> Receipt Options</motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default OrderDetailModal;
