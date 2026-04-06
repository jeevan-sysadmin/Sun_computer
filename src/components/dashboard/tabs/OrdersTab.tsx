import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FiChevronLeft,
  FiChevronRight,
  FiEdit,
  FiEye,
  FiPackage,
  FiPlus,
  FiPrinter,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import BulkActionPanel from "../BulkActionPanel";
import DateRangeSelector from "../DateRangeSelector";
import { exportStyledPdfReport } from "../pdfExport";
import type { DateRange, Order } from "../types";
import { formatCurrency, formatDisplayDate } from "../utils";

interface OrdersTabProps {
  orders: Order[];
  filteredOrders: Order[];
  loading: boolean;
  searchTerm: string;
  filterStatus: string;
  filterPriority: string;
  dateRange: DateRange;
  onSearchChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onFilterPriorityChange: (value: string) => void;
  onDateRangeChange: (start: string, end: string) => void;
  onPresetClick: (preset: "today" | "yesterday" | "thisWeek" | "thisMonth" | "lastMonth" | "thisYear") => void;
  onViewOrder: (order: Order) => void;
  onEditOrder: (order: Order) => void;
  onPrintReceipt: (order: Order) => void;
  onDeleteOrder: (order: Order) => void;
  onCreateOrder: () => void;
  onClearFilters: () => void;
  getStatusColor: (status: string) => string;
  getPriorityColor: (priority: string) => string;
  getWarrantyColor: (warranty: string) => string;
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  createLabel?: string;
}

const ITEMS_PER_PAGE = 20;

const escapeHtml = (value: string | number | undefined | null) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const OrdersTab = (props: OrdersTabProps) => {
  const {
    orders,
    filteredOrders,
    loading,
    searchTerm,
    filterStatus,
    filterPriority,
    dateRange,
    onSearchChange,
    onFilterStatusChange,
    onFilterPriorityChange,
    onDateRangeChange,
    onPresetClick,
    onViewOrder,
    onEditOrder,
    onPrintReceipt,
    onDeleteOrder,
    onCreateOrder,
    onClearFilters,
    getStatusColor,
    getPriorityColor,
    getWarrantyColor,
    title = "Service Orders",
    emptyTitle = "No orders found",
    emptyDescription = "Try adjusting your filters or create a new order",
    createLabel = "Create New Order",
  } = props;

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));
  const pageStartIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedOrders = filteredOrders.slice(pageStartIndex, pageStartIndex + ITEMS_PER_PAGE);
  const selectedOrders = filteredOrders.filter((order) => selectedOrderIds.includes(order.id));
  const bulkOrders = selectedOrders.length > 0 ? selectedOrders : filteredOrders;
  const allPageSelected =
    paginatedOrders.length > 0 && paginatedOrders.every((order) => selectedOrderIds.includes(order.id));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterPriority, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setSelectedOrderIds((prev) => prev.filter((id) => filteredOrders.some((order) => order.id === id)));
  }, [filteredOrders]);

  const toggleOrderSelection = (orderId: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    );
  };

  const togglePageSelection = () => {
    const pageIds = paginatedOrders.map((order) => order.id);
    if (allPageSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  };

  const selectAllFilteredOrders = () => {
    setSelectedOrderIds(filteredOrders.map((order) => order.id));
  };

  const clearSelection = () => {
    setSelectedOrderIds([]);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const exportOrdersToCSV = () => {
    if (bulkOrders.length === 0) return;

    const header = [
      "Order Code",
      "Created Date",
      "Client",
      "Phone",
      "Product",
      "Issue",
      "Staff",
      "Warranty",
      "Delivery Date",
      "Status",
      "Estimated Cost",
      "Final Cost",
      "Deposit",
      "Payment Status",
      "Priority",
    ];

    const rows = bulkOrders.map((order) =>
      [
        order.order_code,
        formatDisplayDate(order.created_at),
        order.client_name,
        order.client_phone,
        order.product_name,
        order.issue_description,
        order.staff_name || "Not assigned",
        order.warranty_status?.replaceAll("_", " ") || "N/A",
        formatDisplayDate(order.estimated_delivery_date),
        order.status,
        formatCurrency(order.estimated_cost),
        formatCurrency(order.final_cost || order.estimated_cost),
        formatCurrency(order.deposit_amount),
        order.payment_status,
        order.priority,
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );

    downloadFile(
      `\uFEFF${header.join(",")}\n${rows.join("\n")}`,
      `service_orders_${new Date().toISOString().split("T")[0]}.csv`,
      "text/csv;charset=utf-8;",
    );
  };

  const exportOrdersToPDF = () => {
    if (bulkOrders.length === 0) return;
    const totalValue = bulkOrders.reduce(
      (sum, order) => sum + Number(order.final_cost || order.estimated_cost || 0),
      0,
    );
    const closedOrders = bulkOrders.filter((order) =>
      ["completed", "ready", "delivered"].includes(order.status),
    ).length;
    const unpaidOrders = bulkOrders.filter(
      (order) => (order.payment_status || "").toLowerCase() !== "paid",
    ).length;

    exportStyledPdfReport({
      filename: `service_orders_${new Date().toISOString().split("T")[0]}.pdf`,
      title: "Service Orders Report",
      subtitle: "Repair jobs, client details, delivery timelines, and payment overview.",
      scopeLabel:
        selectedOrders.length > 0
          ? `${selectedOrders.length} selected orders`
          : `${filteredOrders.length} filtered orders`,
      accentColor: "#2563eb",
      metrics: [
        { label: "Included", value: `${bulkOrders.length} orders` },
        { label: "Collection", value: `Rs. ${formatCurrency(totalValue)}` },
        { label: "Closed", value: `${closedOrders}` },
        { label: "Payment Pending", value: `${unpaidOrders}` },
      ],
      head: [["Order", "Client", "Product", "Status", "Priority", "Delivery", "Amount", "Payment"]],
      body: bulkOrders.map((order) => [
        order.order_code,
        `${order.client_name}\n${order.client_phone}`,
        order.product_name,
        order.status,
        order.priority,
        formatDisplayDate(order.estimated_delivery_date),
        `Rs. ${formatCurrency(order.final_cost || order.estimated_cost)}`,
        order.payment_status,
      ]),
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 48 },
        2: { cellWidth: 58 },
        3: { cellWidth: 24 },
        4: { cellWidth: 22 },
        5: { cellWidth: 28 },
        6: { cellWidth: 26, halign: "right" },
        7: { cellWidth: 28 },
      },
    });
  };

  const printOrders = () => {
    if (bulkOrders.length === 0) return;

    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) return;

    const rows = bulkOrders
      .map(
        (order) => `
          <tr>
            <td>${escapeHtml(order.order_code)}</td>
            <td>${escapeHtml(order.client_name)}<br /><small>${escapeHtml(order.client_phone)}</small></td>
            <td>${escapeHtml(order.product_name)}</td>
            <td>${escapeHtml(order.staff_name || "Not assigned")}</td>
            <td>${escapeHtml(order.status)}</td>
            <td>${escapeHtml(order.priority)}</td>
            <td>${escapeHtml(formatDisplayDate(order.estimated_delivery_date))}</td>
            <td>Rs. ${escapeHtml(formatCurrency(order.final_cost || order.estimated_cost))}</td>
          </tr>`,
      )
      .join("");

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Service Orders Print</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            .header { margin-bottom: 20px; }
            .header h1 { margin: 0 0 6px; color: #1d4ed8; }
            .header p { margin: 0; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px; }
            th { background: #eff6ff; color: #1e3a8a; }
            tr:nth-child(even) { background: #f8fafc; }
            small { color: #64748b; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Sun Computers Service Orders</h1>
            <p>${escapeHtml(
              selectedOrders.length > 0
                ? `${selectedOrders.length} selected orders`
                : `${filteredOrders.length} filtered orders`,
            )}</p>
            <p>Printed on ${escapeHtml(new Date().toLocaleString("en-IN"))}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Client</th>
                <th>Product</th>
                <th>Staff</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Delivery</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="orders-section">
      <div className="section-header">
        <div className="section-title">
          <h2>{title}</h2>
          <p>
            Showing {filteredOrders.length} of {orders.length} orders
          </p>
          {dateRange.startDate && dateRange.endDate && (
            <p className="date-range-info">
              Date Range: {dateRange.startDate} to {dateRange.endDate}
            </p>
          )}
        </div>
        <div className="section-filters">
          <motion.button
            type="button"
            className="btn primary"
            onClick={onCreateOrder}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FiPlus />
            <span>{createLabel}</span>
          </motion.button>
          <div className="filter-group">
            <select className="filter-select" value={filterStatus} onChange={(e) => onFilterStatusChange(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="process">Process</option>
              <option value="completed">Completed</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select className="filter-select" value={filterPriority} onChange={(e) => onFilterPriorityChange(e.target.value)}>
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="section-filters-row orders-toolbar-row">
        <DateRangeSelector dateRange={dateRange} onDateRangeChange={onDateRangeChange} onPresetClick={onPresetClick} />
        <div className="search-filter">
          <FiSearch className="search-filter-icon" />
          <input
            type="text"
            placeholder="Search orders by client, product, order code..."
            className="search-filter-input"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <button type="button" className="btn secondary orders-clear-btn" onClick={onClearFilters}>
          <FiX />
          <span>Clear Filters</span>
        </button>
      </div>

      <BulkActionPanel
        itemLabelSingular="order"
        itemLabelPlural="orders"
        selectedCount={selectedOrders.length}
        filteredCount={filteredOrders.length}
        totalPages={totalPages}
        itemsPerPage={ITEMS_PER_PAGE}
        helperText="Export and print use selected rows first. If nothing is selected, all filtered orders are used."
        receiptHint="Use the receipt button in any order row to preview and download the receipt PDF."
        onSelectAll={selectAllFilteredOrders}
        onClearSelection={clearSelection}
        onExportCSV={exportOrdersToCSV}
        onExportPDF={exportOrdersToPDF}
        onPrint={printOrders}
        disableSelectAll={filteredOrders.length === 0}
        disableClearSelection={selectedOrderIds.length === 0}
        disableActions={bulkOrders.length === 0}
      />

      <div className="table-container">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading orders...</p>
          </div>
        ) : filteredOrders.length > 0 ? (
          <table className="orders-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="row-checkbox"
                    checked={allPageSelected}
                    onChange={togglePageSelection}
                    aria-label="Select all orders on this page"
                  />
                </th>
                <th>Order ID</th>
                <th>Product</th>
                <th>Replacement</th>
                <th>Client</th>
                <th>Staff</th>
                <th>Warranty</th>
                <th>Status</th>
                <th>Payment Status</th>
                <th>Priority</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order, index) => {
                const isSelected = selectedOrderIds.includes(order.id);

                return (
                  <motion.tr
                    key={order.id}
                    className={isSelected ? "selected-row" : ""}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    whileHover={{ backgroundColor: "#f8fafc", cursor: "pointer" }}
                    onClick={() => onViewOrder(order)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        checked={isSelected}
                        onChange={() => toggleOrderSelection(order.id)}
                        aria-label={`Select ${order.order_code}`}
                      />
                    </td>
                    <td>
                      <div className="order-id-cell">
                        <span className="order-id">{order.order_code}</span>
                        <span className="order-date">{formatDisplayDate(order.created_at)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="product-cell">
                        <FiPackage className="product-icon" />
                        <span>{order.product_name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="product-cell">
                        <FiPackage className="product-icon" />
                        <span>{order.replacement_product_name || "No replacement"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="client-cell">
                        <div className="client-avatar-placeholder">{order.client_name?.charAt(0) || "C"}</div>
                        <div className="client-info">
                          <span className="client-name">{order.client_name}</span>
                          <span className="client-phone">{order.client_phone}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="staff-name">
                        {order.staff_name || "Not assigned"}
                        {order.staff_email && <small className="staff-email">{order.staff_email}</small>}
                      </span>
                    </td>
                    <td>
                      <span
                        className="warranty-badge"
                        style={{
                          backgroundColor: `${getWarrantyColor(order.warranty_status)}20`,
                          color: getWarrantyColor(order.warranty_status),
                        }}
                      >
                        {order.warranty_status?.replace("_", " ") || "N/A"}
                      </span>
                    </td>
                    <td>
                      <div className="status-cell">
                        <div className="status-indicator" style={{ backgroundColor: getStatusColor(order.status) }}></div>
                        <span className="status-label">{order.status === "ready" ? "Ready" : order.status}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`payment-status ${order.payment_status}`}>{order.payment_status}</span>
                    </td>
                    <td>
                      <div className="priority-cell">
                        <div className="priority-dot" style={{ backgroundColor: getPriorityColor(order.priority) }}></div>
                        <span className="priority-label">{order.priority}</span>
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <motion.button
                          className="action-btn view"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewOrder(order);
                          }}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.94 }}
                          title="View Details"
                        >
                          <FiEye />
                        </motion.button>
                        <motion.button
                          className="action-btn edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditOrder(order);
                          }}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.94 }}
                          title="Edit Order"
                        >
                          <FiEdit />
                        </motion.button>
                        <motion.button
                          className="action-btn print"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPrintReceipt(order);
                          }}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.94 }}
                          title="Receipt Options"
                        >
                          <FiPrinter />
                        </motion.button>
                        <motion.button
                          className="action-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteOrder(order);
                          }}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.94 }}
                          title="Delete Order"
                        >
                          <FiTrash2 />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <FiPackage className="empty-icon" />
            <h3>{emptyTitle}</h3>
            <p>{emptyDescription}</p>
            <motion.button className="btn primary" onClick={onCreateOrder} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <FiPlus />
              {createLabel}
            </motion.button>
          </div>
        )}
      </div>

      {filteredOrders.length > 0 && (
        <div className="orders-pagination">
          <div className="orders-pagination-info">
            Showing {pageStartIndex + 1} to {Math.min(pageStartIndex + ITEMS_PER_PAGE, filteredOrders.length)} of{" "}
            {filteredOrders.length} orders
          </div>
          <div className="orders-pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              <FiChevronLeft />
              <span>Previous</span>
            </button>
            <span className="pagination-page-chip">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
            >
              <span>Next</span>
              <FiChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
