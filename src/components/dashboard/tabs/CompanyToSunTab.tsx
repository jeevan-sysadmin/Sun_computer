import ClaimProductsTab from "./ClaimProductsTab";
import type { DateRange, Order, Product } from "../types";

interface CompanyToSunTabProps {
  companyToSunClaims: Product[];
  orders: Order[];
  filteredCompanyToSunClaims: Product[];
  loading: boolean;
  searchTerm: string;
  dateRange: DateRange;
  onSearchChange: (value: string) => void;
  onDateRangeChange: (start: string, end: string) => void;
  onPresetClick: (preset: "today" | "yesterday" | "thisWeek" | "thisMonth" | "lastMonth" | "thisYear") => void;
  onClearFilters: () => void;
}

const CompanyToSunTab = ({
  companyToSunClaims,
  orders,
  filteredCompanyToSunClaims,
  loading,
  searchTerm,
  dateRange,
  onSearchChange,
  onDateRangeChange,
  onPresetClick,
  onClearFilters,
}: CompanyToSunTabProps) => (
  <ClaimProductsTab
    claimLabel="Company To Sun"
    emptyLabel="Company To Sun"
    filePrefix="company_to_sun"
    accentColor="#059669"
    products={companyToSunClaims}
    orders={orders}
    filteredProducts={filteredCompanyToSunClaims}
    loading={loading}
    searchTerm={searchTerm}
    dateRange={dateRange}
    onSearchChange={onSearchChange}
    onDateRangeChange={onDateRangeChange}
    onPresetClick={onPresetClick}
    onClearFilters={onClearFilters}
  />
);

export default CompanyToSunTab;
