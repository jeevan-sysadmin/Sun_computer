import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiPackage,
  FiPrinter,
  FiSearch,
  FiTruck,
  FiX,
} from "react-icons/fi";
import BulkActionPanel from "../BulkActionPanel";
import DateRangeSelector from "../DateRangeSelector";
import DeliveryDetailModal from "../modals/DeliveryDetailModal";
import { exportStyledPdfReport } from "../pdfExport";
import type { DateRange, Delivery } from "../types";
import { formatDisplayDate } from "../utils";

interface DeliveryTabProps {
  filteredDeliveries: Delivery[];
  loading: boolean;
  searchTerm: string;
  dateRange: DateRange;
  onSearchChange: (value: string) => void;
  onDateRangeChange: (start: string, end: string) => void;
  onPresetClick: (preset: "today" | "yesterday" | "thisWeek" | "thisMonth" | "lastMonth" | "thisYear") => void;
  onPrintDeliveryReceipt: (delivery: Delivery) => void;
  onViewOrders: () => void;
  onClearFilters: () => void;
}

const ITEMS_PER_PAGE = 20;

const escapeHtml = (value: string | number | undefined | null) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const DeliveryTab = ({
  filteredDeliveries,
  loading,
  searchTerm,
  dateRange,
  onSearchChange,
  onDateRangeChange,
  onPresetClick,
  onPrintDeliveryReceipt,
  onViewOrders,
  onClearFilters,
}: DeliveryTabProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<number[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const sortedDeliveries = useMemo(
    () =>
      [...filteredDeliveries].sort((a, b) => {
        const aTime = new Date(a.scheduled_date || a.created_at).getTime();
        const bTime = new Date(b.scheduled_date || b.created_at).getTime();
        return bTime - aTime;
      }),
    [filteredDeliveries],
  );

  const deliveredCount = sortedDeliveries.filter(
    (delivery) => delivery.status === "delivered" || (delivery.delivered_date && delivery.delivered_date !== "0000-00-00 00:00:00"),
  ).length;

  const totalPages = Math.max(1, Math.ceil(sortedDeliveries.length / ITEMS_PER_PAGE));
  const pageStartIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDeliveries = sortedDeliveries.slice(pageStartIndex, pageStartIndex + ITEMS_PER_PAGE);
  const selectedDeliveries = sortedDeliveries.filter((delivery) => selectedDeliveryIds.includes(delivery.id));
  const bulkDeliveries = selectedDeliveries.length > 0 ? selectedDeliveries : sortedDeliveries;
  const allPageSelected =
    paginatedDeliveries.length > 0 && paginatedDeliveries.every((delivery) => selectedDeliveryIds.includes(delivery.id));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setSelectedDeliveryIds((prev) => prev.filter((id) => sortedDeliveries.some((delivery) => delivery.id === id)));
  }, [sortedDeliveries]);

  const toggleDeliverySelection = (deliveryId: number) => {
    setSelectedDeliveryIds((prev) =>
      prev.includes(deliveryId) ? prev.filter((id) => id !== deliveryId) : [...prev, deliveryId],
    );
  };

  const togglePageSelection = () => {
    const pageIds = paginatedDeliveries.map((delivery) => delivery.id);
    if (allPageSelected) {
      setSelectedDeliveryIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedDeliveryIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  };

  const selectAllFilteredDeliveries = () => {
    setSelectedDeliveryIds(sortedDeliveries.map((delivery) => delivery.id));
  };

  const clearSelection = () => {
    setSelectedDeliveryIds([]);
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

  const exportDeliveriesToCSV = () => {
    if (bulkDeliveries.length === 0) return;

    const header = ["Delivery Code", "Order Code", "Client", "Product", "Scheduled Date", "Status", "Delivered Date"];
    const rows = bulkDeliveries.map((delivery) => {
      const isDelivered = delivery.status === "delivered" || (delivery.delivered_date && delivery.delivered_date !== "0000-00-00 00:00:00");

      return [
        delivery.delivery_code || `DEL${String(delivery.id).padStart(3, "0")}`,
        delivery.order_code || `ORD${String(delivery.order_id).padStart(3, "0")}`,
        delivery.client_name || "N/A",
        delivery.product_name || "N/A",
        delivery.scheduled_date_formatted || formatDisplayDate(delivery.scheduled_date),
        isDelivered ? "Delivered" : delivery.status,
        isDelivered ? delivery.delivered_date_formatted || formatDisplayDate(delivery.delivered_date) : "Not Delivered",
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",");
    });

    downloadFile(
      `\uFEFF${header.join(",")}\n${rows.join("\n")}`,
      `deliveries_${new Date().toISOString().split("T")[0]}.csv`,
      "text/csv;charset=utf-8;",
    );
  };

  const exportDeliveriesToPDF = () => {
    if (bulkDeliveries.length === 0) return;
    const deliveredItems = bulkDeliveries.filter(
      (delivery) =>
        delivery.status === "delivered" ||
        (delivery.delivered_date && delivery.delivered_date !== "0000-00-00 00:00:00"),
    ).length;
    const scheduledItems = bulkDeliveries.filter((delivery) => delivery.status === "scheduled").length;
    const uniqueClients = new Set(
      bulkDeliveries.map((delivery) => delivery.client_name).filter(Boolean),
    ).size;

    exportStyledPdfReport({
      filename: `deliveries_${new Date().toISOString().split("T")[0]}.pdf`,
      title: "Delivery Report",
      subtitle: "Dispatch status, client details, scheduled dates, and handover tracking.",
      scopeLabel:
        selectedDeliveries.length > 0
          ? `${selectedDeliveries.length} selected deliveries`
          : `${filteredDeliveries.length} filtered deliveries`,
      accentColor: "#7c3aed",
      metrics: [
        { label: "Included", value: `${bulkDeliveries.length} deliveries` },
        { label: "Delivered", value: `${deliveredItems}` },
        { label: "Scheduled", value: `${scheduledItems}` },
        { label: "Clients", value: `${uniqueClients}` },
      ],
      head: [["Delivery", "Order", "Client", "Product", "Scheduled", "Delivered", "Status"]],
      body: bulkDeliveries.map((delivery) => {
        const isDelivered =
          delivery.status === "delivered" ||
          (delivery.delivered_date && delivery.delivered_date !== "0000-00-00 00:00:00");

        return [
          delivery.delivery_code || `DEL${String(delivery.id).padStart(3, "0")}`,
          delivery.order_code || `ORD${String(delivery.order_id).padStart(3, "0")}`,
          delivery.client_name || "N/A",
          delivery.product_name || "N/A",
          delivery.scheduled_date_formatted || formatDisplayDate(delivery.scheduled_date),
          isDelivered
            ? delivery.delivered_date_formatted || formatDisplayDate(delivery.delivered_date)
            : "Pending",
          isDelivered ? "Delivered" : delivery.status,
        ];
      }),
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 24 },
        2: { cellWidth: 42 },
        3: { cellWidth: 54 },
        4: { cellWidth: 30 },
        5: { cellWidth: 30 },
        6: { cellWidth: 24 },
      },
    });
  };

  const printDeliveries = () => {
    if (bulkDeliveries.length === 0) return;

    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) return;

    const rows = bulkDeliveries
      .map((delivery) => {
        const isDelivered = delivery.status === "delivered" || (delivery.delivered_date && delivery.delivered_date !== "0000-00-00 00:00:00");
        return `
          <tr>
            <td>${escapeHtml(delivery.delivery_code || `DEL${String(delivery.id).padStart(3, "0")}`)}</td>
            <td>${escapeHtml(delivery.order_code || `ORD${String(delivery.order_id).padStart(3, "0")}`)}</td>
            <td>${escapeHtml(delivery.client_name || "N/A")}</td>
            <td>${escapeHtml(delivery.product_name || "N/A")}</td>
            <td>${escapeHtml(delivery.scheduled_date_formatted || formatDisplayDate(delivery.scheduled_date))}</td>
            <td>${escapeHtml(isDelivered ? "Delivered" : delivery.status)}</td>
          </tr>`;
      })
      .join("");

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Deliveries Print</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 6px; color: #1d4ed8; }
            p { margin: 0 0 16px; color: #475569; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px; }
            th { background: #eff6ff; color: #1e3a8a; }
            tr:nth-child(even) { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Sun Computers Delivery Report</h1>
          <p>${escapeHtml(selectedDeliveries.length > 0 ? `${selectedDeliveries.length} selected deliveries` : `${filteredDeliveries.length} filtered deliveries`)}</p>
          <table>
            <thead>
              <tr><th>Delivery</th><th>Order</th><th>Client</th><th>Product</th><th>Scheduled</th><th>Status</th></tr>
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
    <div className="delivery-section">
      <div className="section-header">
        <div className="section-title">
          <h2>Delivery Tracking</h2>
          <p>Showing {sortedDeliveries.length} deliveries</p>
          {dateRange.startDate && dateRange.endDate && (
            <p className="date-range-info">
              Date Range: {dateRange.startDate} to {dateRange.endDate}
            </p>
          )}
        </div>
      </div>

      <div className="section-filters-row orders-toolbar-row">
        <DateRangeSelector dateRange={dateRange} onDateRangeChange={onDateRangeChange} onPresetClick={onPresetClick} />
        <div className="search-filter">
          <FiSearch className="search-filter-icon" />
          <input
            type="text"
            placeholder="Search deliveries by order, client, product..."
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

      <div className="delivery-stats">
        <div className="delivery-stat-card">
          <div className="delivery-stat-icon" style={{ backgroundColor: "#8B5CF620", color: "#8B5CF6" }}>
            <FiCheckCircle />
          </div>
          <div className="delivery-stat-content">
            <h3>{deliveredCount}</h3>
            <p>Delivered</p>
          </div>
        </div>
      </div>

      <BulkActionPanel
        itemLabelSingular="delivery"
        itemLabelPlural="deliveries"
        selectedCount={selectedDeliveries.length}
        filteredCount={sortedDeliveries.length}
        totalPages={totalPages}
        itemsPerPage={ITEMS_PER_PAGE}
        helperText="Export and print use selected rows first. If nothing is selected, all filtered deliveries are used."
        receiptHint="Use the receipt button in any delivery row to preview and download the receipt PDF."
        onSelectAll={selectAllFilteredDeliveries}
        onClearSelection={clearSelection}
        onExportCSV={exportDeliveriesToCSV}
        onExportPDF={exportDeliveriesToPDF}
        onPrint={printDeliveries}
        disableSelectAll={filteredDeliveries.length === 0}
        disableClearSelection={selectedDeliveryIds.length === 0}
        disableActions={bulkDeliveries.length === 0}
      />

      <div className="table-container">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading deliveries...</p>
          </div>
        ) : filteredDeliveries.length > 0 ? (
          <table className="orders-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="row-checkbox"
                    checked={allPageSelected}
                    onChange={togglePageSelection}
                    aria-label="Select all deliveries on this page"
                  />
                </th>
                <th>Delivery Code</th>
                <th>Order Code</th>
                <th>Client</th>
                <th>Product</th>
                <th>Scheduled Date</th>
                <th>Status</th>
                <th>Delivered Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDeliveries.map((delivery, index) => {
                const isDelivered = delivery.status === "delivered" || (delivery.delivered_date && delivery.delivered_date !== "0000-00-00 00:00:00");
                const isSelected = selectedDeliveryIds.includes(delivery.id);

                return (
                  <motion.tr key={delivery.id} className={isSelected ? "selected-row" : ""} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ backgroundColor: "#f8fafc", cursor: "pointer" }} onClick={() => setSelectedDelivery(delivery)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        checked={isSelected}
                        onChange={() => toggleDeliverySelection(delivery.id)}
                        aria-label={`Select ${delivery.delivery_code || delivery.id}`}
                      />
                    </td>
                    <td>
                      <span className="delivery-code" style={{ fontWeight: "bold", color: "#8B5CF6" }}>
                        {delivery.delivery_code || `DEL${String(delivery.id).padStart(3, "0")}`}
                      </span>
                    </td>
                    <td>
                      <span className="order-code" style={{ fontWeight: "10" ,fontSize: "12px"}}>
                        {delivery.order_code || `ORD${String(delivery.order_id).padStart(3, "0")}`}
                      </span>
                    </td>
                    <td>
                      <div className="client-cell">
                        <div className="client-avatar-placeholder" style={{ background: "#8B5CF6" }}>
                          {delivery.client_name?.charAt(0) || "C"}
                        </div>
                        <div className="client-info">
                          <span className="client-name" style={{ fontWeight: "600" }}>{delivery.client_name || "N/A"}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="product-cell">
                        <FiPackage className="product-icon" />
                        <span style={{ fontWeight: "500" }}>{delivery.product_name || "N/A"}{delivery.product_brand && ` (${delivery.product_brand})`}</span>
                      </div>
                    </td>
                    <td>
                      <div className="date-cell">
                        <FiCalendar />
                        <span>{delivery.scheduled_date_formatted || formatDisplayDate(delivery.scheduled_date)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="status-cell">
                        <div className="status-indicator" style={{ backgroundColor: isDelivered ? "#8B5CF6" : delivery.status === "scheduled" ? "#10B981" : delivery.status === "pending" ? "#DC2626" : "#6B7280" }}></div>
                        <span className="status-label" style={{ color: isDelivered ? "#8B5CF6" : delivery.status === "scheduled" ? "#10B981" : delivery.status === "pending" ? "#DC2626" : "#6B7280", fontWeight: "600" }}>
                          {isDelivered ? "Delivered" : delivery.status}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="date-cell">
                        <FiCalendar />
                        <span>{isDelivered ? delivery.delivered_date_formatted || formatDisplayDate(delivery.delivered_date) : "Not Delivered"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <motion.button className="action-btn print" onClick={(e) => { e.stopPropagation(); onPrintDeliveryReceipt(delivery); }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="Receipt Options">
                          <FiPrinter />
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
            <FiTruck className="empty-icon" />
            <h3>No deliveries found</h3>
            <p>No delivery records available.</p>
            <div className="empty-state-actions">
              <motion.button className="btn primary" onClick={onViewOrders} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <FiPackage />
                View Orders
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {sortedDeliveries.length > 0 && (
        <div className="orders-pagination">
          <div className="orders-pagination-info">
            Showing {pageStartIndex + 1} to {Math.min(pageStartIndex + ITEMS_PER_PAGE, sortedDeliveries.length)} of {sortedDeliveries.length} deliveries
          </div>
          <div className="orders-pagination-controls">
            <button type="button" className="pagination-btn" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
              <FiChevronLeft />
              <span>Previous</span>
            </button>
            <span className="pagination-page-chip">Page {currentPage} of {totalPages}</span>
            <button type="button" className="pagination-btn" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>
              <span>Next</span>
              <FiChevronRight />
            </button>
          </div>
        </div>
      )}

      {selectedDelivery && (
        <DeliveryDetailModal
          delivery={selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
          onPrint={onPrintDeliveryReceipt}
        />
      )}
    </div>
  );
};

export default DeliveryTab;
