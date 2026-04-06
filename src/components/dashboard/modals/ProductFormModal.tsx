import { useEffect, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { motion } from "framer-motion";
import {
  FiBox,
  FiCheckSquare,
  FiCpu,
  FiCreditCard,
  FiDisc,
  FiFileText,
  FiLayers,
  FiPackage,
  FiSave,
  FiTag,
  FiX,
  FiZap,
} from "react-icons/fi";
import type { ProductForm } from "../types";

interface ProductFormModalProps {
  show: boolean;
  editMode: boolean;
  productForm: ProductForm;
  onClose: () => void;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

const ProductFormModal = ({
  show,
  editMode,
  productForm,
  onClose,
  onChange,
  onSubmit,
}: ProductFormModalProps) => {
  const serialInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!show || editMode) return;
    const timer = window.setTimeout(() => {
      serialInputRef.current?.focus();
      serialInputRef.current?.select();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [show, editMode]);

  if (!show) return null;

  const productLabel = productForm.product_name.trim() || "New Product";
  const productMeta = [productForm.brand.trim(), productForm.model.trim()].filter(Boolean).join(" • ") || "Brand and model not added";
  const serialValue = productForm.serial_number.trim() || "Ready for barcode scanner";
  const progressCount = [
    productForm.product_name,
    productForm.serial_number,
    productForm.brand,
    productForm.model,
    productForm.specifications,
    productForm.purchase_date,
    productForm.warranty_period,
    productForm.price,
  ].filter((value) => value.trim().length > 0).length;

  return (
    <motion.div
      className="modal-overlay-enhanced"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-content-enhanced product-modal-content"
        initial={{ opacity: 0, scale: 0.95, y: 32 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 32 }}
        transition={{ type: "spring", damping: 24, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-enhanced product-modal-header">
          <div className="modal-header-left">
            <div className="modal-icon-wrapper">
              <div className="modal-icon-bg">
                <FiPackage />
              </div>
            </div>
            <div className="modal-title-enhanced">
              <h2>{editMode ? "Edit Product" : "Create New Product"}</h2>
              <p>
                {editMode
                  ? "Update product, serial, claim, and spare-part details in one place."
                  : "Register inventory fast with barcode scanner support, spare-product tagging, and clean stock details."}
              </p>
            </div>
          </div>
          <motion.button
            className="close-btn-enhanced"
            onClick={onClose}
            whileHover={{ rotate: 90 }}
            whileTap={{ scale: 0.9 }}
          >
            <FiX />
          </motion.button>
        </div>

        <form onSubmit={onSubmit} className="service-form-enhanced product-form-enhanced">
          <div className="product-form-shell">
            <aside className="product-form-aside">
              <div className="product-identity-card">
                <div className="product-identity-icon">
                  <FiBox />
                </div>
                <span className="product-identity-badge">
                  {productForm.is_spare_product ? "Spare Product" : "Standard Product"}
                </span>
                <h3>{productLabel}</h3>
                <p>{productMeta}</p>
                <div className="product-identity-meta">
                  <span>{serialValue}</span>
                  <span>{productForm.category || "Category not set"}</span>
                  <span>{productForm.claim_type || "none"}</span>
                </div>
              </div>

              <div className="product-scan-card">
                <div className="product-scan-header">
                  <FiZap />
                  <strong>Barcode scanner ready</strong>
                </div>
                <p>Click into Serial Number and scan with your hardware barcode scanner. Most scanners type like a keyboard automatically.</p>
                <button
                  type="button"
                  className="product-scan-focus-btn"
                  onClick={() => serialInputRef.current?.focus()}
                >
                  Focus Serial Number
                </button>
              </div>

              <div className="product-progress-card">
                <div className="product-progress-header">
                  <strong>Form completeness</strong>
                  <span>{progressCount}/8</span>
                </div>
                <div className="product-progress-track">
                  <div className="product-progress-fill" style={{ width: `${(progressCount / 8) * 100}%` }} />
                </div>
                <p>Best results come from product name, serial number, category, and claim type.</p>
              </div>
            </aside>

            <div className="product-form-main">
              <section className="product-form-panel">
                <div className="product-form-panel-header">
                  <div>
                    <h3>Identity & Scanner</h3>
                    <p>Fast entry for product name, serial number, and spare-product tagging.</p>
                  </div>
                  <span className="product-form-badge required">Core details</span>
                </div>

                <div className="form-grid product-form-grid">
                  <div className="form-group product-form-group">
                    <label htmlFor="product_name">
                      <FiPackage /> Product Name *
                    </label>
                    <div className="product-input-wrap">
                      <FiPackage className="product-input-icon" />
                      <input
                        type="text"
                        id="product_name"
                        name="product_name"
                        value={productForm.product_name}
                        onChange={onChange}
                        placeholder="Product name"
                        required
                        className="product-input has-icon"
                      />
                    </div>
                  </div>

                  <div className="form-group product-form-group">
                    <label htmlFor="serial_number">
                      <FiZap /> Serial Number
                    </label>
                    <div className="product-input-wrap">
                      <FiZap className="product-input-icon" />
                      <input
                        ref={serialInputRef}
                        type="text"
                        id="serial_number"
                        name="serial_number"
                        value={productForm.serial_number}
                        onChange={onChange}
                        placeholder="Scan barcode or type serial number"
                        autoComplete="off"
                        inputMode="text"
                        className="product-input has-icon scanner-input"
                      />
                    </div>
                    <small className="product-field-help">
                      Hardware barcode scanners usually type directly into this field.
                    </small>
                  </div>

                  <div className="form-group full-width product-form-group">
                    <label className="product-checkbox-card">
                      <input
                        type="checkbox"
                        id="is_spare_product"
                        name="is_spare_product"
                        checked={productForm.is_spare_product}
                        onChange={onChange}
                      />
                      <span className="product-checkbox-visual">
                        <FiCheckSquare />
                      </span>
                      <span className="product-checkbox-copy">
                        <strong>Mark as Spare Product</strong>
                        <small>Use this for spare parts, stock items, and replacement components.</small>
                      </span>
                    </label>
                  </div>
                </div>
              </section>

              <section className="product-form-panel">
                <div className="product-form-panel-header">
                  <div>
                    <h3>Classification</h3>
                    <p>Define how this product should be organized and tracked.</p>
                  </div>
                  <span className="product-form-badge optional">Operational</span>
                </div>

                <div className="form-grid product-form-grid">
                  <div className="form-group product-form-group">
                    <label htmlFor="brand">
                      <FiTag /> Brand
                    </label>
                    <div className="product-input-wrap">
                      <FiTag className="product-input-icon" />
                      <input
                        type="text"
                        id="brand"
                        name="brand"
                        value={productForm.brand}
                        onChange={onChange}
                        placeholder="Brand"
                        className="product-input has-icon"
                      />
                    </div>
                  </div>

                  <div className="form-group product-form-group">
                    <label htmlFor="model">
                      <FiDisc /> Model
                    </label>
                    <div className="product-input-wrap">
                      <FiDisc className="product-input-icon" />
                      <input
                        type="text"
                        id="model"
                        name="model"
                        value={productForm.model}
                        onChange={onChange}
                        placeholder="Model"
                        className="product-input has-icon"
                      />
                    </div>
                  </div>

                  <div className="form-group product-form-group">
                    <label htmlFor="category">
                      <FiLayers /> Category
                    </label>
                    <select id="category" name="category" value={productForm.category} onChange={onChange} className="product-input">
                      <option value="laptop">Laptop</option>
                      <option value="desktop">Desktop</option>
                      <option value="mobile">Mobile</option>
                      <option value="tablet">Tablet</option>
                      <option value="accessory">Accessory</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-group product-form-group">
                    <label htmlFor="claim_type">
                      <FiCheckSquare /> Claim Type
                    </label>
                    <select id="claim_type" name="claim_type" value={productForm.claim_type} onChange={onChange} className="product-input">
                      <option value="none">None</option>
                      <option value="shop_claim">Shop Claim</option>
                      <option value="company_claim">Company Claim</option>
                      <option value="sun_to_company">Sun to Company</option>
                      <option value="company_to_sun">Company to Sun</option>
                    </select>
                  </div>

                  <div className="form-group product-form-group">
                    <label htmlFor="status">
                      <FiCheckSquare /> Status
                    </label>
                    <select id="status" name="status" value={productForm.status} onChange={onChange} className="product-input">
                      <option value="active">Active</option>
                      <option value="discontinued">Discontinued</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="product-form-panel">
                <div className="product-form-panel-header">
                  <div>
                    <h3>Commercial & Technical</h3>
                    <p>Optional pricing, warranty, purchase, and specification details.</p>
                  </div>
                  <span className="product-form-badge soft">Optional</span>
                </div>

                <div className="form-grid product-form-grid">
                  <div className="form-group product-form-group">
                    <label htmlFor="price">
                      <FiCreditCard /> Price (Rs.)
                    </label>
                    <div className="product-input-wrap">
                      <FiCreditCard className="product-input-icon" />
                      <input
                        type="number"
                        id="price"
                        name="price"
                        value={productForm.price}
                        onChange={onChange}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="product-input has-icon"
                      />
                    </div>
                  </div>

                  <div className="form-group product-form-group">
                    <label htmlFor="purchase_date">
                      <FiDisc /> Purchase Date
                    </label>
                    <input
                      type="date"
                      id="purchase_date"
                      name="purchase_date"
                      value={productForm.purchase_date}
                      onChange={onChange}
                      className="product-input"
                    />
                  </div>

                  <div className="form-group product-form-group">
                    <label htmlFor="warranty_period">
                      <FiCpu /> Warranty Period
                    </label>
                    <div className="product-input-wrap">
                      <FiCpu className="product-input-icon" />
                      <input
                        type="text"
                        id="warranty_period"
                        name="warranty_period"
                        value={productForm.warranty_period}
                        onChange={onChange}
                        placeholder="e.g. 6 months, 1 year"
                        className="product-input has-icon"
                      />
                    </div>
                  </div>

                  <div className="form-group full-width product-form-group">
                    <label htmlFor="specifications">
                      <FiFileText /> Specifications
                    </label>
                    <div className="product-input-wrap">
                      <FiFileText className="product-input-icon textarea-icon" />
                      <textarea
                        id="specifications"
                        name="specifications"
                        value={productForm.specifications}
                        onChange={onChange}
                        placeholder="Important specifications, compatibility notes, hardware details, or spare-part remarks..."
                        rows={4}
                        className="product-input product-textarea has-icon"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="form-actions-enhanced product-form-actions">
            <div className="product-form-actions-note">Tip: for barcode hardware scanners, keep the cursor in Serial Number and scan once.</div>
            <div className="product-form-actions-buttons">
              <motion.button
                type="button"
                className="btn-secondary-enhanced"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>
              <motion.button
                type="submit"
                className="btn-primary-enhanced"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <FiSave />
                {editMode ? "Update Product" : "Create Product"}
              </motion.button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default ProductFormModal;
