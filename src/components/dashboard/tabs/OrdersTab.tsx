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
import type { DateRange, Order, Product } from "../types";
import { formatCurrency, formatDisplayDate } from "../utils";
import * as XLSX from "xlsx";

interface OrdersTabProps {
  orders: Order[];
  filteredOrders: Order[];
  products?: Product[];
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
const MAX_VISIBLE_PRODUCT_CHIPS = 2;

const escapeHtml = (value: string | number | undefined | null) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const parseJsonArray = (value: string): unknown[] | null => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeNames = (value: unknown) => {
  const rawValues =
    Array.isArray(value)
      ? value
      : typeof value === "number"
        ? [value]
        : typeof value === "string"
          ? parseJsonArray(value.trim()) ??
            (value.includes("||") ? value.split("||") : value.split(","))
          : [];

  return Array.from(
    new Set(
      rawValues
        .map((entry) => String(entry ?? "").trim())
        .filter((entry) => {
          const normalized = entry.toLowerCase();
          return Boolean(normalized) && normalized !== "null" && normalized !== "undefined";
        }),
    ),
  );
};

const normalizeIds = (value: unknown) => {
  const rawValues =
    Array.isArray(value)
      ? value
      : typeof value === "number"
        ? [value]
        : typeof value === "string"
          ? parseJsonArray(value.trim()) ?? value.split(",")
          : [];

  return Array.from(
    new Set(
      rawValues
        .map((entry) => Number(entry))
        .filter((entry) => Number.isInteger(entry) && entry > 0),
    ),
  );
};

const mergeIds = (...values: unknown[]) =>
  Array.from(
    new Set(
      values.reduce<number[]>((allIds, value) => [...allIds, ...normalizeIds(value)], []),
    ),
  );

const withIdFallback = (names: string[], ids: number[], prefix: string) =>
  names.length > 0 ? names : ids.map((id) => `${prefix} #${id}`);

interface ProductEntry {
  label: string;
  serialNumber: string;
}

const parseSerialList = (value: unknown) => normalizeNames(value);

const buildOrderProductEntries = (
  order: Order,
  products: Product[],
  isReplacement: boolean,
): ProductEntry[] => {
  const ids = isReplacement
    ? mergeIds(order.replacement_product_ids, order.replacement_product_id)
    : mergeIds(order.product_ids, order.product_id);
  const namesFromList = isReplacement ? normalizeNames(order.replacement_product_names) : normalizeNames(order.product_names);
  const fallbackNames = isReplacement ? normalizeNames(order.replacement_product_name) : normalizeNames(order.product_name);
  const names = namesFromList.length > 0 ? namesFromList : fallbackNames;
  const serialsFromList = parseSerialList(
    isReplacement ? order.replacement_product_serial_numbers : order.product_serial_numbers,
  );
  const fallbackSerial = (isReplacement ? order.replacement_serial_number : order.serial_number) || "";

  const idEntries = ids.map((id, index) => {
    const matched = products.find((product) => product.id === id);
    const label = names[index] || matched?.product_name || `${isReplacement ? "Replacement Product" : "Product"} #${id}`;
    const serialNumber = serialsFromList[index] || matched?.serial_number || (index === 0 ? fallbackSerial : "") || "";
    return { label, serialNumber };
  });

  if (idEntries.length > 0) return idEntries;

  return withIdFallback(names, ids, isReplacement ? "Replacement Product" : "Product").map((label, index) => ({
    label,
    serialNumber: serialsFromList[index] || (index === 0 ? fallbackSerial : "") || "",
  }));
};

const getOrderProductEntries = (order: Order, products: Product[]) => {
  const entries = buildOrderProductEntries(order, products, false);
  return entries.length > 0 ? entries : [{ label: "Not added", serialNumber: "" }];
};

const getOrderReplacementEntries = (order: Order, products: Product[]) => {
  return buildOrderProductEntries(order, products, true);
};

const formatProductEntry = (entry: ProductEntry) =>
  entry.serialNumber ? `${entry.label} (SN: ${entry.serialNumber})` : entry.label;

const formatProductEntryList = (entries: ProductEntry[], fallback: string) =>
  entries.length > 0 ? entries.map(formatProductEntry).join(", ") : fallback;

const renderOrderProductChips = (entries: ProductEntry[], emptyLabel: string) => {
  if (!entries.length) {
    return <span className="product-empty">{emptyLabel}</span>;
  }

  const visibleEntries = entries.slice(0, MAX_VISIBLE_PRODUCT_CHIPS);
  const hiddenCount = entries.length - visibleEntries.length;

  return (
    <div className="order-product-stack" title={entries.map((entry) => entry.label).join(", ")}>
      <div className="order-product-chips">
        {visibleEntries.map((entry, index) => (
          <span key={`${entry.label}-${index}`} className="product-chip">
            {index + 1}. {entry.label}
          </span>
        ))}
        {hiddenCount > 0 && <span className="product-chip more">+{hiddenCount} more</span>}
      </div>
      <span className="order-product-count">
        {entries.length} item{entries.length > 1 ? "s" : ""}
      </span>
    </div>
  );
};

const getPendingDays = (createdAt?: string) => {
  if (!createdAt) return 0;
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return 0;
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((now.getTime() - createdDate.getTime()) / msPerDay));
};

const getPendingLabel = (order: Order) => {
  const normalizedStatus = String(order.status || "").toLowerCase();
  if (normalizedStatus === "delivered") {
    return "Delivered";
  }
  const days = getPendingDays(order.created_at);
  return `${days} day${days === 1 ? "" : "s"} pending`;
};

const OrdersTab = (props: OrdersTabProps) => {
  const {
    orders,
    filteredOrders,
    products = [],
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
  const excelOrders = selectedOrders.length > 0 ? selectedOrders : orders;
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

  const exportOrdersToExcel = () => {
    if (excelOrders.length === 0) return;

    const excelData = excelOrders.map((order) => {
      const productEntries = getOrderProductEntries(order, products);
      const replacementEntries = getOrderReplacementEntries(order, products);
      const finalAmount = Number(order.final_cost || order.estimated_cost || 0);
      const deposit = Number(order.deposit_amount || 0);
      const balanceDue = Math.max(finalAmount - deposit, 0);

      return {
        "Order Code": order.order_code,
        "Created Date": formatDisplayDate(order.created_at),
        "Updated Date": formatDisplayDate((order as unknown as { updated_at?: string }).updated_at || ""),
        Client: order.client_name,
        Phone: order.client_phone,
        Email: order.client_email || "N/A",
        "Main Products": formatProductEntryList(productEntries, "Not added"),
        "Replacement Products": formatProductEntryList(replacementEntries, "No replacement"),
        Issue: order.issue_description,
        "Diagnosis Notes": order.diagnosis_notes || "",
        "Repair Notes": order.repair_notes || "",
        Notes: order.notes || "",
        Staff: order.staff_name || "Not assigned",
        "Service Type": order.service_type || "general",
        Warranty: order.warranty_status?.replaceAll("_", " ") || "N/A",
        "Estimated Delivery": formatDisplayDate(order.estimated_delivery_date),
        "Actual Delivery": formatDisplayDate(order.actual_delivery_date || ""),
        Status: order.status,
        Priority: order.priority,
        "Payment Method": (order as unknown as { payment_method?: string }).payment_method || "N/A",
        "Estimated Cost": formatCurrency(order.estimated_cost),
        "Final Cost": formatCurrency(order.final_cost || order.estimated_cost),
        Deposit: formatCurrency(order.deposit_amount),
        "Balance Due": formatCurrency(balanceDue),
        "Payment Status": order.payment_status,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Service Orders");
    XLSX.writeFile(workbook, `service_orders_${new Date().toISOString().split("T")[0]}.xlsx`);
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
      subtitle: "Complete service order export including product/replacement lists, serials, workflow, notes, and payment details.",
      scopeLabel:
        selectedOrders.length > 0
          ? `${selectedOrders.length} selected orders`
          : `${filteredOrders.length} filtered orders`,
      accentColor: "#2563eb",
      orientation: "landscape",
      metrics: [
        { label: "Included", value: `${bulkOrders.length} orders` },
        { label: "Collection", value: `Rs. ${formatCurrency(totalValue)}` },
        { label: "Closed", value: `${closedOrders}` },
        { label: "Payment Pending", value: `${unpaidOrders}` },
      ],
      head: [[
        "Order",
        "Client",
        "Main Products",
        "Replacement Products",
        "Issue / Notes",
        "Status / Priority",
        "Timeline",
        "Staff",
        "Payment",
      ]],
      body: bulkOrders.map((order) => {
        const productEntries = getOrderProductEntries(order, products);
        const replacementEntries = getOrderReplacementEntries(order, products);
        const issueText = [order.issue_description, order.diagnosis_notes, order.repair_notes, order.notes]
          .filter((value) => Boolean(String(value || "").trim()))
          .join("\n");
        const finalAmount = Number(order.final_cost || order.estimated_cost || 0);
        const deposit = Number(order.deposit_amount || 0);
        const balanceDue = Math.max(finalAmount - deposit, 0);

        return [
          `${order.order_code}\nCreated: ${formatDisplayDate(order.created_at)}`,
          `${order.client_name}\n${order.client_phone || "N/A"}\n${order.client_email || "N/A"}`,
          formatProductEntryList(productEntries, "Not added"),
          formatProductEntryList(replacementEntries, "No replacement"),
          issueText || "N/A",
          `${order.status} | ${order.priority}\nWarranty: ${order.warranty_status || "N/A"}`,
          `Est: ${formatDisplayDate(order.estimated_delivery_date)}\nAct: ${formatDisplayDate(order.actual_delivery_date || "")}`,
          order.staff_name || "Not assigned",
          `Estimated: Rs. ${formatCurrency(order.estimated_cost)}\nFinal: Rs. ${formatCurrency(order.final_cost || order.estimated_cost)}\nDeposit: Rs. ${formatCurrency(order.deposit_amount)}\nBalance: Rs. ${formatCurrency(balanceDue)}\nStatus: ${order.payment_status}`,
        ];
      }),
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 36 },
        2: { cellWidth: 44 },
        3: { cellWidth: 44 },
        4: { cellWidth: 46 },
        5: { cellWidth: 28 },
        6: { cellWidth: 30 },
        7: { cellWidth: 24 },
        8: { cellWidth: 36 },
      },
    });
  };

  const printOrders = () => {
    if (bulkOrders.length === 0) return;

    const printWindow = window.open("", "_blank", "width=1400,height=960");
    if (!printWindow) return;

    const rows = bulkOrders
      .map((order) => {
        const productEntries = getOrderProductEntries(order, products);
        const replacementEntries = getOrderReplacementEntries(order, products);
        const finalAmount = Number(order.final_cost || order.estimated_cost || 0);
        const deposit = Number(order.deposit_amount || 0);
        const balanceDue = Math.max(finalAmount - deposit, 0);

        return `
          <tr>
            <td>${escapeHtml(order.order_code)}<br /><small>${escapeHtml(formatDisplayDate(order.created_at))}</small></td>
            <td>${escapeHtml(order.client_name)}<br /><small>${escapeHtml(order.client_phone)}</small><br /><small>${escapeHtml(order.client_email || "N/A")}</small></td>
            <td>${escapeHtml(formatProductEntryList(productEntries, "Not added"))}</td>
            <td>${escapeHtml(formatProductEntryList(replacementEntries, "No replacement"))}</td>
            <td>${escapeHtml(order.issue_description || "N/A")}<br /><small>${escapeHtml(order.notes || "")}</small></td>
            <td>${escapeHtml(order.staff_name || "Not assigned")}<br /><small>${escapeHtml(order.service_type || "general")}</small></td>
            <td>${escapeHtml(order.status)}<br /><small>${escapeHtml(order.priority)}</small><br /><small>${escapeHtml(order.warranty_status || "N/A")}</small></td>
            <td>Est: ${escapeHtml(formatDisplayDate(order.estimated_delivery_date))}<br /><small>Act: ${escapeHtml(formatDisplayDate(order.actual_delivery_date || ""))}</small></td>
            <td>Estimated: Rs. ${escapeHtml(formatCurrency(order.estimated_cost))}<br />Final: Rs. ${escapeHtml(formatCurrency(order.final_cost || order.estimated_cost))}<br />Deposit: Rs. ${escapeHtml(formatCurrency(order.deposit_amount))}<br /><strong>Balance: Rs. ${escapeHtml(formatCurrency(balanceDue))}</strong><br /><small>${escapeHtml(order.payment_status)}</small></td>
          </tr>`;
      })
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
            table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 11px; vertical-align: top; word-break: break-word; }
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
                <th>Main Products</th>
                <th>Replacement</th>
                <th>Issue / Notes</th>
                <th>Staff / Service</th>
                <th>Status</th>
                <th>Timeline</th>
                <th>Payment</th>
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
        helperText="Excel export uses selected rows first. If nothing is selected, it exports full order data."
        receiptHint="Use the receipt button in any order row to preview and download the receipt PDF."
        onSelectAll={selectAllFilteredOrders}
        onClearSelection={clearSelection}
        onExportCSV={exportOrdersToExcel}
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
                <th>Pending Days</th>
                <th>Payment Status</th>
                <th>Priority</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order, index) => {
                const isSelected = selectedOrderIds.includes(order.id);
                const productEntries = getOrderProductEntries(order, products);
                const replacementEntries = getOrderReplacementEntries(order, products);

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
                      <div className="product-cell order-products-cell">
                        <FiPackage className="product-icon" />
                        {renderOrderProductChips(productEntries, "Not added")}
                      </div>
                    </td>
                    <td>
                      <div className="product-cell order-products-cell">
                        <FiPackage className="product-icon" />
                        {renderOrderProductChips(replacementEntries, "No replacement")}
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
                      <span
                        className={`pending-days-badge ${
                          String(order.status || "").toLowerCase() === "delivered" ? "is-delivered" : "is-pending"
                        }`}
                      >
                        {getPendingLabel(order)}
                      </span>
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
