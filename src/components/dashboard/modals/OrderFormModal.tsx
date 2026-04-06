import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiAlertCircle, FiBriefcase, FiCalendar, FiCheck, FiChevronDown, FiClock, FiCreditCard, FiDollarSign, FiPackage, FiPhone, FiSave, FiSearch, FiStar, FiTrendingUp, FiUser, FiUsers, FiX } from "react-icons/fi";
import type { Client, OrderForm, Product, User } from "../types";

interface OrderFormModalProps {
  show: boolean;
  editMode: boolean;
  orderForm: OrderForm;
  users: User[];
  clientsForDropdown: Client[];
  products: Product[];
  loadingClientsForDropdown: boolean;
  onClose: () => void;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onProductSelect: (productId: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

const OrderFormModal = ({ show, editMode, orderForm, users, clientsForDropdown, products, loadingClientsForDropdown, onClose, onChange, onProductSelect, onSubmit }: OrderFormModalProps) => {
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState(orderForm.product_name);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [replacementSearchTerm, setReplacementSearchTerm] = useState(orderForm.replacement_product_name);
  const [showReplacementDropdown, setShowReplacementDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [showReplacementProducts, setShowReplacementProducts] = useState(false);

  useEffect(() => setProductSearchTerm(orderForm.product_name), [orderForm.product_name]);
  useEffect(() => setReplacementSearchTerm(orderForm.replacement_product_name), [orderForm.replacement_product_name]);
  useEffect(() => {
    if (orderForm.client_id) setSelectedClient(clientsForDropdown.find((c) => c.id.toString() === orderForm.client_id) || null);
    else setSelectedClient(null);
  }, [orderForm.client_id, clientsForDropdown]);
  useEffect(() => {
    setClientSearchTerm(selectedClient ? `${selectedClient.full_name} - ${selectedClient.phone}` : "");
  }, [selectedClient]);
  useEffect(() => {
    if (orderForm.staff_id) setSelectedStaff(users.find((u) => u.id.toString() === orderForm.staff_id) || null);
    else setSelectedStaff(null);
  }, [orderForm.staff_id, users]);
  useEffect(() => {
    if (!show) {
      setShowClientDropdown(false);
      setShowReplacementProducts(false);
      setShowProductDropdown(false);
      setShowReplacementDropdown(false);
    }
  }, [show]);
  useEffect(() => {
    setShowReplacementProducts(Boolean(orderForm.replacement_product_id));
  }, [orderForm.replacement_product_id]);

  const filteredProducts = useMemo(() => {
    const search = productSearchTerm.trim().toLowerCase();
    const sourceProducts = products.filter((p) => !Boolean(Number(p.is_spare_product || 0)));
    if (!search) return sourceProducts.slice(0, 8);
    return sourceProducts.filter((p) => [p.product_name, p.serial_number, p.brand, p.model, p.product_code].some((v) => v?.toLowerCase().includes(search))).slice(0, 12);
  }, [productSearchTerm, products]);
  const filteredClients = useMemo(() => {
    const search = clientSearchTerm.trim().toLowerCase();
    if (!search) return clientsForDropdown.slice(0, 8);
    return clientsForDropdown
      .filter((client) =>
        [client.full_name, client.phone, client.email]
          .some((value) => value?.toLowerCase().includes(search)),
      )
      .slice(0, 12);
  }, [clientSearchTerm, clientsForDropdown]);
  const filteredReplacementProducts = useMemo(() => {
    const search = replacementSearchTerm.trim().toLowerCase();
    const sourceProducts = products.filter((p) => Boolean(Number(p.is_spare_product || 0)));
    if (!search) return sourceProducts.slice(0, 8);
    return sourceProducts.filter((p) => [p.product_name, p.serial_number, p.brand, p.model, p.product_code].some((v) => v?.toLowerCase().includes(search))).slice(0, 12);
  }, [replacementSearchTerm, products]);
  const shouldShowProductDropdown = showProductDropdown;
  const shouldShowClientDropdown = showClientDropdown;
  const shouldShowReplacementDropdown = showReplacementDropdown && showReplacementProducts;

  const selectedProduct = useMemo(() => orderForm.product_id ? products.find((p) => p.id.toString() === orderForm.product_id) || null : null, [orderForm.product_id, products]);
  const selectedReplacementProduct = useMemo(() => orderForm.replacement_product_id ? products.find((p) => p.id.toString() === orderForm.replacement_product_id) || null : null, [orderForm.replacement_product_id, products]);
  const estimatedCost = Number.parseFloat(orderForm.estimated_cost || "0") || 0;
  const depositAmount = Number.parseFloat(orderForm.deposit_amount || "0") || 0;
  const finalCost = Number.parseFloat(orderForm.final_cost || orderForm.estimated_cost || "0") || 0;
  const remainingBalance = Math.max(estimatedCost - depositAmount, 0);
  const completionCount = [orderForm.client_id, orderForm.client_phone, orderForm.product_id, orderForm.staff_id, orderForm.issue_description, orderForm.estimated_cost, orderForm.status, orderForm.priority].filter((v) => String(v || "").trim().length > 0).length;

  const getPriorityColor = (priority: string) => ({ urgent: "#ef4444", high: "#f59e0b", medium: "#3b82f6", low: "#10b981" }[priority] || "#10b981");
  const getStatusColor = (status: string) => ({ completed: "#10b981", process: "#3b82f6", scheduled: "#8b5cf6", ready: "#06b6d4", delivered: "#6366f1", cancelled: "#ef4444", pending: "#f59e0b" }[status] || "#f59e0b");
  const triggerReplacementChange = (productId: string) => onChange({ target: { name: "replacement_product_id", value: productId } } as ChangeEvent<HTMLInputElement>);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div className="modal-overlay-enhanced" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div className="modal-content-enhanced order-modal-content" initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header-enhanced order-modal-header">
            <div className="modal-header-left">
              <div className="modal-icon-wrapper"><div className="modal-icon-bg"><FiPackage /></div></div>
              <div className="modal-title-enhanced">
                <h2>{editMode ? "Edit Service Order" : "Create New Service Order"}</h2>
                <p>{editMode ? "Refresh order progress, payment details, and service notes in one focused workspace." : "Create a service order with client, product, financial, and repair details in one polished flow."}</p>
              </div>
            </div>
            <motion.button className="close-btn-enhanced" onClick={onClose} whileHover={{ rotate: 90, scale: 1.1 }} whileTap={{ scale: 0.9 }}><FiX /></motion.button>
          </div>

          <form onSubmit={onSubmit} className="service-form-enhanced order-form-enhanced">
            <div className="order-form-shell">
              <aside className="order-form-aside">
                <div className="order-preview-card">
                  <span className="order-preview-badge">{editMode ? "Live Order Snapshot" : "New Order Snapshot"}</span>
                  <h3>{selectedClient?.full_name || "Select a client"}</h3>
                  <p>{selectedProduct?.product_name || orderForm.product_name || "Choose a product for service"}</p>
                  <div className="order-preview-meta">
                    <span>{orderForm.client_phone || "Phone pending"}</span>
                    <span>{selectedStaff?.name || "No staff assigned"}</span>
                    <span>{orderForm.estimated_delivery_date || "No delivery date"}</span>
                    {selectedReplacementProduct && <span>Replacement: {selectedReplacementProduct.product_name}</span>}
                  </div>
                </div>
                <div className="order-progress-card">
                  <div className="order-progress-header"><strong>Form completeness</strong><span>{completionCount}/8</span></div>
                  <div className="order-progress-track"><div className="order-progress-fill" style={{ width: `${(completionCount / 8) * 100}%` }} /></div>
                  <p>Client, phone, and product are the essentials. The rest improves repair tracking and billing clarity.</p>
                </div>
                <div className="order-payment-card">
                  <div className="order-payment-card-header"><FiCreditCard /><strong>Financial snapshot</strong></div>
                  <div className="order-payment-metric"><span>Estimated</span><strong>Rs. {estimatedCost.toLocaleString()}</strong></div>
                  <div className="order-payment-metric"><span>Deposit</span><strong className="text-success">Rs. {depositAmount.toLocaleString()}</strong></div>
                  <div className="order-payment-metric"><span>Final</span><strong>Rs. {finalCost.toLocaleString()}</strong></div>
                  <div className="order-payment-divider" />
                  <div className="order-payment-metric total"><span>Balance</span><strong className="text-warning">Rs. {remainingBalance.toLocaleString()}</strong></div>
                </div>
              </aside>

              <div className="order-form-main">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="form-grid-enhanced order-form-grid">
                  <div className="form-group-enhanced full-width order-section-heading"><div className="summary-title">Basic Info</div><p>Identify the customer, device, and service owner clearly.</p></div>

                  <div className="form-group-enhanced">
                    <label className="form-label"><FiUser className="label-icon" /><span>Client Name <span className="required-star">*</span></span></label>
                    {loadingClientsForDropdown ? <div className="loading-dropdown-enhanced"><div className="loading-spinner-small-enhanced"></div><span>Loading clients...</span></div> : <div className="product-search-container">
                      <div className="search-wrapper">
                        <FiSearch className="search-icon-enhanced" />
                        <input type="text" id="client_search" value={clientSearchTerm} onChange={(e) => { setClientSearchTerm(e.target.value); onChange({ target: { name: "client_id", value: "" } } as ChangeEvent<HTMLInputElement>); setShowClientDropdown(true); }} onFocus={() => setShowClientDropdown(true)} placeholder="Search client by name, phone, or email" className="product-search-input" autoComplete="off" />
                        {clientSearchTerm && <button type="button" className="clear-search" onClick={() => { setClientSearchTerm(""); onChange({ target: { name: "client_id", value: "" } } as ChangeEvent<HTMLInputElement>); setShowClientDropdown(false); }}><FiX /></button>}
                      </div>
                      {!clientSearchTerm.trim() && <div className="input-hint info"><FiSearch /> Client list opens automatically</div>}
                      <AnimatePresence>
                        {shouldShowClientDropdown && <motion.div className="product-dropdown-enhanced" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                          {filteredClients.length > 0 ? filteredClients.map((client, index) => <motion.button key={client.id} type="button" className="product-item" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }} onClick={() => { setClientSearchTerm(`${client.full_name} - ${client.phone}`); onChange({ target: { name: "client_id", value: client.id.toString() } } as ChangeEvent<HTMLInputElement>); setShowClientDropdown(false); }}>
                            <div className="product-item-icon"><FiUser /></div>
                            <div className="product-item-info">
                              <div className="product-item-name">{client.full_name}</div>
                              <div className="product-item-details">
                                <span className="product-serial">{client.phone}</span>
                                {client.email && <span className="product-brand">{client.email}</span>}
                                {client.city && <span className="product-model">{client.city}</span>}
                              </div>
                            </div>
                            {orderForm.client_id === client.id.toString() && <FiCheck className="product-check" />}
                          </motion.button>) : <div className="no-products"><FiAlertCircle /><span>No matching clients found</span></div>}
                        </motion.div>}
                      </AnimatePresence>
                    </div>}
                    {selectedClient && <div className="selected-info"><div className="info-chip"><FiUsers /><span>{selectedClient.full_name}</span></div>{selectedClient.email && <div className="info-chip"><span>{selectedClient.email}</span></div>}</div>}
                  </div>

                  <div className="form-group-enhanced">
                    <label className="form-label"><FiPhone className="label-icon" /><span>Client Phone <span className="required-star">*</span></span></label>
                    <input type="tel" id="client_phone" name="client_phone" value={orderForm.client_phone} onChange={onChange} placeholder="Will be auto-filled when you select a client" required readOnly={Boolean(orderForm.client_id)} className={`enhanced-input ${orderForm.client_id ? "auto-filled" : ""}`} />
                    {orderForm.client_id && <div className="input-hint success"><FiCheck /> Phone auto-filled from selected client</div>}
                  </div>

                  <div className="form-group-enhanced">
                    <label className="form-label"><FiPackage className="label-icon" /><span>Product <span className="required-star">*</span></span></label>
                    <div className="product-search-container">
                      <div className="search-wrapper">
                        <FiSearch className="search-icon-enhanced" />
                        <input type="text" id="product_search" value={productSearchTerm} onChange={(e) => { setProductSearchTerm(e.target.value); onProductSelect(""); setShowProductDropdown(true); }} onFocus={() => setShowProductDropdown(true)} placeholder="Type to search products by name, serial, brand, or model" className="product-search-input" autoComplete="off" />
                        {productSearchTerm && <button type="button" className="clear-search" onClick={() => { setProductSearchTerm(""); onProductSelect(""); setShowProductDropdown(false); }}><FiX /></button>}
                      </div>
                      {!productSearchTerm.trim() && <div className="input-hint info"><FiSearch /> Product list opens automatically</div>}
                      <AnimatePresence>
                        {shouldShowProductDropdown && <motion.div className="product-dropdown-enhanced" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                          {filteredProducts.length > 0 ? filteredProducts.map((product, index) => <motion.button key={product.id} type="button" className="product-item" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }} onClick={() => { setProductSearchTerm(product.product_name); onProductSelect(product.id.toString()); setShowProductDropdown(false); }}>
                            <div className="product-item-icon"><FiPackage /></div>
                            <div className="product-item-info">
                              <div className="product-item-name">{product.product_name}</div>
                              <div className="product-item-details">
                                {product.serial_number && <span className="product-serial">SN: {product.serial_number}</span>}
                                {product.brand && <span className="product-brand">{product.brand}</span>}
                                {product.model && <span className="product-model">{product.model}</span>}
                              </div>
                            </div>
                            {orderForm.product_id === product.id.toString() && <FiCheck className="product-check" />}
                          </motion.button>) : <div className="no-products"><FiAlertCircle /><span>No matching products found</span></div>}
                        </motion.div>}
                      </AnimatePresence>
                    </div>
                    {selectedProduct && <div className="selected-info">{selectedProduct.serial_number && <div className="info-chip"><span>SN: {selectedProduct.serial_number}</span></div>}{selectedProduct.brand && <div className="info-chip"><span>{selectedProduct.brand}</span></div>}{selectedProduct.model && <div className="info-chip"><span>{selectedProduct.model}</span></div>}</div>}
                  </div>

                  <div className="form-group-enhanced">
                    <label className="form-label"><FiPackage className="label-icon" /><span>Replacement Product</span></label>
                    <label className="order-replacement-toggle">
                      <input
                        type="checkbox"
                        checked={showReplacementProducts}
                        onChange={(e) => {
                          setShowReplacementProducts(e.target.checked);
                          setShowReplacementDropdown(e.target.checked);
                          if (!e.target.checked) {
                            setReplacementSearchTerm("");
                            triggerReplacementChange("");
                          }
                        }}
                      />
                      <span className="order-replacement-toggle-box">
                        <FiCheck />
                      </span>
                      <span className="order-replacement-toggle-copy">
                        <strong>Replacement Product</strong>
                        <small>{showReplacementProducts ? "Showing spare products only" : "Turn on to pick from spare products"}</small>
                      </span>
                    </label>
                    {showReplacementProducts && (
                      <div className="product-search-container">
                        <div className="search-wrapper">
                          <FiSearch className="search-icon-enhanced" />
                          <input type="text" id="replacement_product_search" value={replacementSearchTerm} onChange={(e) => { setReplacementSearchTerm(e.target.value); triggerReplacementChange(""); setShowReplacementDropdown(true); }} onFocus={() => setShowReplacementDropdown(true)} placeholder="Search spare products by name, serial, brand, or model" className="product-search-input" autoComplete="off" />
                          {replacementSearchTerm && <button type="button" className="clear-search" onClick={() => { setReplacementSearchTerm(""); triggerReplacementChange(""); setShowReplacementDropdown(false); }}><FiX /></button>}
                        </div>
                        <div className="input-hint info">
                          <FiCheck /> Spare products only are shown in this dropdown
                        </div>
                        <AnimatePresence>
                          {shouldShowReplacementDropdown && <motion.div className="product-dropdown-enhanced" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                            {filteredReplacementProducts.length > 0 ? filteredReplacementProducts.map((product, index) => <motion.button key={product.id} type="button" className="product-item" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }} onClick={() => { setReplacementSearchTerm(product.product_name); triggerReplacementChange(product.id.toString()); setShowReplacementDropdown(false); }}>
                              <div className="product-item-icon"><FiPackage /></div>
                              <div className="product-item-info">
                                <div className="product-item-name">{product.product_name}</div>
                                <div className="product-item-details">
                                  {product.serial_number && <span className="product-serial">SN: {product.serial_number}</span>}
                                  {product.brand && <span className="product-brand">{product.brand}</span>}
                                  {product.model && <span className="product-model">{product.model}</span>}
                                  <span className="product-brand">Spare</span>
                                </div>
                              </div>
                              {orderForm.replacement_product_id === product.id.toString() && <FiCheck className="product-check" />}
                            </motion.button>) : <div className="no-products"><FiAlertCircle /><span>No matching spare products found</span></div>}
                          </motion.div>}
                        </AnimatePresence>
                      </div>
                    )}
                    {selectedReplacementProduct && <div className="selected-info">{selectedReplacementProduct.serial_number && <div className="info-chip"><span>SN: {selectedReplacementProduct.serial_number}</span></div>}{selectedReplacementProduct.brand && <div className="info-chip"><span>{selectedReplacementProduct.brand}</span></div>}{selectedReplacementProduct.model && <div className="info-chip"><span>{selectedReplacementProduct.model}</span></div>}{Boolean(Number(selectedReplacementProduct.is_spare_product || 0)) && <div className="info-chip"><span>Spare Product</span></div>}</div>}
                  </div>

                  <div className="form-group-enhanced">
                    <label className="form-label"><FiBriefcase className="label-icon" /><span>Service Staff</span></label>
                    <div className="enhanced-dropdown"><select id="staff_id" name="staff_id" value={orderForm.staff_id} onChange={onChange} className="enhanced-select"><option value="">Select Staff Member</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role === "admin" ? "Admin" : "Staff"})</option>)}</select><FiChevronDown className="dropdown-icon" /></div>
                    {selectedStaff && <div className="selected-info"><div className="info-chip"><FiBriefcase /><span>{selectedStaff.name}</span></div>{selectedStaff.email && <div className="info-chip"><span>{selectedStaff.email}</span></div>}</div>}
                  </div>

                  <div className="form-group-enhanced">
                    <label className="form-label"><FiBriefcase className="label-icon" /><span>Service Type</span></label>
                    <div className="enhanced-dropdown">
                      <select id="service_type" name="service_type" value={orderForm.service_type} onChange={onChange} className="enhanced-select">
                        <option value="general">General</option>
                        <option value="repair">Repair</option>
                        <option value="sales">Sales</option>
                        <option value="water">Water</option>
                        <option value="inverter">Inverter</option>
                      </select>
                      <FiChevronDown className="dropdown-icon" />
                    </div>
                    <div className="input-hint info"><FiCheck /> Used by income, salary, and expense reporting.</div>
                  </div>

                  <div className="form-group-enhanced">
                    <label className="form-label"><FiClock className="label-icon" /><span>Warranty Status</span></label>
                    <div className="enhanced-dropdown"><select id="warranty_status" name="warranty_status" value={orderForm.warranty_status} onChange={onChange} className="enhanced-select"><option value="in_warranty">In Warranty</option><option value="extended_warranty">Extended Warranty</option><option value="out_of_warranty">Out of Warranty</option></select><FiChevronDown className="dropdown-icon" /></div>
                  </div>

                  <div className="form-group-enhanced">
                    <label className="form-label"><FiStar className="label-icon" /><span>Priority Level</span></label>
                    <div className="enhanced-dropdown"><select id="priority" name="priority" value={orderForm.priority} onChange={onChange} className="enhanced-select" style={{ borderLeftColor: getPriorityColor(orderForm.priority) }}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select><FiChevronDown className="dropdown-icon" /></div>
                    <div className="priority-indicator" style={{ background: getPriorityColor(orderForm.priority) }} />
                  </div>

                  <div className="form-group-enhanced">
                    <label className="form-label"><FiTrendingUp className="label-icon" /><span>Status</span></label>
                    <div className="enhanced-dropdown"><select id="status" name="status" value={orderForm.status} onChange={onChange} className="enhanced-select" style={{ borderLeftColor: getStatusColor(orderForm.status) }}><option value="pending">Pending</option><option value="scheduled">Scheduled</option><option value="process">In Process</option><option value="completed">Completed</option><option value="ready">Ready</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select><FiChevronDown className="dropdown-icon" /></div>
                  </div>

                  <div className="form-group-enhanced">
                    <label className="form-label"><FiCalendar className="label-icon" /><span>Estimated Delivery</span></label>
                    <input type="date" id="estimated_delivery_date" name="estimated_delivery_date" value={orderForm.estimated_delivery_date} onChange={onChange} className="enhanced-input" min={new Date().toISOString().split("T")[0]} />
                  </div>

                  <div className="form-group-enhanced full-width order-section-heading"><div className="summary-title">Financial</div><p>Capture pricing, deposits, and payment status with a clearer breakdown.</p></div>

                  <div className="form-group-enhanced"><label className="form-label"><FiDollarSign className="label-icon" /><span>Estimated Cost</span></label><div className="currency-input"><span className="currency-symbol">Rs.</span><input type="number" id="estimated_cost" name="estimated_cost" value={orderForm.estimated_cost} onChange={onChange} placeholder="0.00" min="0" step="0.01" className="enhanced-input currency-field" /></div></div>
                  <div className="form-group-enhanced"><label className="form-label"><FiCreditCard className="label-icon" /><span>Deposit Amount</span></label><div className="currency-input"><span className="currency-symbol">Rs.</span><input type="number" id="deposit_amount" name="deposit_amount" value={orderForm.deposit_amount} onChange={onChange} placeholder="0.00" min="0" step="0.01" className="enhanced-input currency-field" /></div><div className="input-hint info"><FiCheck /> Advance payment received, if any</div></div>
                  <div className="form-group-enhanced"><label className="form-label"><FiDollarSign className="label-icon" /><span>Final Cost</span></label><div className="currency-input"><span className="currency-symbol">Rs.</span><input type="number" id="final_cost" name="final_cost" value={orderForm.final_cost} onChange={onChange} placeholder="0.00" min="0" step="0.01" className="enhanced-input currency-field" /></div></div>
                  <div className="form-group-enhanced"><label className="form-label"><FiCreditCard className="label-icon" /><span>Payment Status</span></label><div className="enhanced-dropdown"><select id="payment_status" name="payment_status" value={orderForm.payment_status} onChange={onChange} className="enhanced-select"><option value="pending">Pending</option><option value="paid">Paid</option><option value="partial">Partially Paid</option><option value="refunded">Refunded</option></select><FiChevronDown className="dropdown-icon" /></div></div>
                  <div className="financial-summary order-financial-summary"><div className="summary-title">Payment Summary</div><div className="summary-item"><span>Estimated Cost:</span><strong>Rs. {estimatedCost.toLocaleString()}</strong></div><div className="summary-item"><span>Deposit Paid:</span><strong className="text-success">- Rs. {depositAmount.toLocaleString()}</strong></div><div className="summary-divider"></div><div className="summary-item total"><span>Remaining Balance:</span><strong className="text-warning">Rs. {remainingBalance.toLocaleString()}</strong></div></div>

                  <div className="form-group-enhanced full-width order-section-heading"><div className="summary-title">Details & Notes</div><p>Describe the issue well so technicians and front-desk staff stay aligned.</p></div>
                  <div className="form-group-enhanced full-width"><label className="form-label"><FiAlertCircle className="label-icon" /><span>Issue Description</span></label><textarea id="issue_description" name="issue_description" value={orderForm.issue_description} onChange={onChange} placeholder="Describe the issue in detail. Include symptoms, user-reported problems, or any visible faults..." rows={5} className="enhanced-textarea" /><div className="char-count">{orderForm.issue_description?.length || 0} characters</div></div>
                  <div className="form-group-enhanced full-width"><label className="form-label"><FiPackage className="label-icon" /><span>Additional Notes</span></label><textarea id="notes" name="notes" value={orderForm.notes} onChange={onChange} placeholder="Special instructions, promised accessories, approval notes, or internal comments..." rows={4} className="enhanced-textarea" /></div>
                </motion.div>
              </div>
            </div>

            <div className="form-actions-enhanced order-form-actions">
              <div className="order-form-actions-note">Required: client, phone, and product. The remaining fields help with service quality, internal clarity, and billing.</div>
              <div className="order-form-actions-buttons">
                <motion.button type="button" className="btn-secondary-enhanced" onClick={onClose} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Cancel</motion.button>
                <motion.button type="submit" className="btn-primary-enhanced" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><FiSave />{editMode ? "Update Order" : "Create Order"}</motion.button>
              </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OrderFormModal;
