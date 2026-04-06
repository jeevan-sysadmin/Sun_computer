import ClaimProductsTab from "./ClaimProductsTab";
import type { DateRange, Order, Product } from "../types";

interface SunToCompanyTabProps {
  sunToCompanyClaims: Product[];
  orders: Order[];
  filteredSunToCompanyClaims: Product[];
  loading: boolean;
  searchTerm: string;
  dateRange: DateRange;
  onSearchChange: (value: string) => void;
  onDateRangeChange: (start: string, end: string) => void;
  onPresetClick: (preset: "today" | "yesterday" | "thisWeek" | "thisMonth" | "lastMonth" | "thisYear") => void;
  onClearFilters: () => void;
}

const SunToCompanyTab = ({
  sunToCompanyClaims,
  orders,
  filteredSunToCompanyClaims,
  loading,
  searchTerm,
  dateRange,
  onSearchChange,
  onDateRangeChange,
  onPresetClick,
  onClearFilters,
}: SunToCompanyTabProps) => (
  <ClaimProductsTab
    claimLabel="Sun To Company"
    emptyLabel="Sun To Company"
    filePrefix="sun_to_company"
    accentColor="#7c3aed"
    products={sunToCompanyClaims}
    orders={orders}
    filteredProducts={filteredSunToCompanyClaims}
    loading={loading}
    searchTerm={searchTerm}
    dateRange={dateRange}
    onSearchChange={onSearchChange}
    onDateRangeChange={onDateRangeChange}
    onPresetClick={onPresetClick}
    onClearFilters={onClearFilters}
  />
);

export default SunToCompanyTab;
