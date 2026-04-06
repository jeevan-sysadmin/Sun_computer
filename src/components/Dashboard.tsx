import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiAlertCircle,
  FiBell,
  FiBox,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiClock,
  FiFilter,
  FiHome,
  FiLogOut,
  FiMenu,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiTruck,
  FiUsers,
} from "react-icons/fi";
import "./css/Dashboard.css";
import DateRangeSelector from "./dashboard/DateRangeSelector";
import NotificationDropdown from "./dashboard/NotificationDropdown";
import ClientFormModal from "./dashboard/modals/ClientFormModal";
import ReceiptActionModal from "./dashboard/modals/ReceiptActionModal";
import OrderDetailModal from "./dashboard/modals/OrderDetailModal";
import OrderFormModal from "./dashboard/modals/OrderFormModal";
import ProductFormModal from "./dashboard/modals/ProductFormModal";
import ConfirmDeleteModal from "./dashboard/modals/ConfirmDeleteModal";
import ClientsTab from "./dashboard/tabs/ClientsTab";
import DashboardOverviewTab from "./dashboard/tabs/DashboardOverviewTab";
import DeliveryTab from "./dashboard/tabs/DeliveryTab";
import OrdersTab from "./dashboard/tabs/OrdersTab";
import ProductsTab from "./dashboard/tabs/ProductsTab";
import ReplacementOrdersTab from "./dashboard/tabs/ReplacementOrdersTab";
import CompanyClaimTab from "./dashboard/tabs/CompanyClaimTab";
import CompanyToSunTab from "./dashboard/tabs/CompanyToSunTab";
import ShopclaimTab from "./dashboard/tabs/ShopclaimTab";
import SpareProductsTab from "./dashboard/tabs/SpareProductsTab";
import SunToCompanyTab from "./dashboard/tabs/SunToCompanyTab";
import type {
  ApiResponse,
  Client,
  ClientForm,
  DashboardProps,
  DashboardStats,
  DateRange,
  Delivery,
  LoadingState,
  NavItem,
  Notification,
  Order,
  OrderForm,
  Product,
  ProductForm,
  User,
} from "./dashboard/types";
import {
  createDeliveryReceiptMarkup,
  createOrderReceiptMarkup,
  downloadReceiptPdf,
} from "./dashboard/receiptUtils";
import { formatCurrency, formatDisplayDate, formatISODate } from "./dashboard/utils";

const API_BASE_URL = "http://localhost/sun_computers/api";

const createDefaultOrderForm = (): OrderForm => ({
  client_name: "",
  client_phone: "",
  product_name: "",
  replacement_product_name: "",
  issue_description: "",
  warranty_status: "out_of_warranty",
  estimated_cost: "",
  final_cost: "",
  payment_status: "pending",
  service_type: "general",
  estimated_delivery_date: "",
  status: "pending",
  priority: "medium",
  notes: "",
  client_id: "",
  product_id: "",
  replacement_product_id: "",
  staff_id: "",
  deposit_amount: "",
});

const createDefaultClientForm = (): ClientForm => ({
  full_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  notes: "",
});

const createDefaultProductForm = (): ProductForm => ({
  product_name: "",
  serial_number: "",
  is_spare_product: false,
  brand: "",
  model: "",
  category: "laptop",
  claim_type: "none",
  specifications: "",
  purchase_date: "",
  warranty_period: "",
  price: "",
  status: "active",
});

type ReceiptTarget =
  | { kind: "order"; order: Order }
  | { kind: "delivery"; delivery: Delivery };

const Dashboard = ({ onLogout }: DashboardProps) => {
  const [user, setUser] = useState<User>({
    id: 1,
    name: "Admin",
    email: "admin@suncomputers.com",
    role: "Admin",
    avatar: "",
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formType, setFormType] = useState<"order" | "client" | "product">("order");
  const [showFilters, setShowFilters] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deleteOrderTarget, setDeleteOrderTarget] = useState<Order | null>(null);
  const [deleteOrderPending, setDeleteOrderPending] = useState(false);
  const [currentItem, setCurrentItem] = useState<Order | Client | Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: "", endDate: "" });
  const [loading, setLoading] = useState<LoadingState>({
    orders: false,
    replacementOrders: false,
    clients: false,
    products: false,
    spareProducts: false,
    shopClaims: false,
    companyClaims: false,
    sunToCompanyClaims: false,
    companyToSunClaims: false,
    dashboard: false,
    user: false,
    deliveries: false,
    users: false,
    clientsForDropdown: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const ordersRef = useRef<Order[]>([]);
  const [replacementOrders, setReplacementOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [spareProducts, setSpareProducts] = useState<Product[]>([]);
  const [shopClaims, setShopClaims] = useState<Product[]>([]);
  const [companyClaims, setCompanyClaims] = useState<Product[]>([]);
  const [sunToCompanyClaims, setSunToCompanyClaims] = useState<Product[]>([]);
  const [companyToSunClaims, setCompanyToSunClaims] = useState<Product[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<{ activity: string; timestamp: string }[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [clientsForDropdown, setClientsForDropdown] = useState<Client[]>([]);
  const [orderForm, setOrderForm] = useState<OrderForm>(createDefaultOrderForm());
  const [clientForm, setClientForm] = useState<ClientForm>(createDefaultClientForm());
  const [productForm, setProductForm] = useState<ProductForm>(createDefaultProductForm());
  const [receiptTarget, setReceiptTarget] = useState<ReceiptTarget | null>(null);

  const navItems: NavItem[] = [
    { icon: <FiHome />, label: "Dashboard", id: "dashboard" },
    { icon: <FiPackage />, label: "Orders", id: "orders" },
    { icon: <FiPackage />, label: "Replacement Orders", id: "replacementorders" },
    { icon: <FiUsers />, label: "Clients", id: "clients" },
    { icon: <FiBox />, label: "Products", id: "products" },
    { icon: <FiPackage />, label: "Spare Products", id: "spareproducts" },
    { icon: <FiShoppingBag />, label: "Shop Claim", id: "shopclaim" },
    { icon: <FiShoppingBag />, label: "Company Claim", id: "companyclaim" },
    { icon: <FiShoppingBag />, label: "Sun To Company", id: "suntocompany" },
    { icon: <FiShoppingBag />, label: "Company To Sun", id: "companytosun" },
    { icon: <FiTruck />, label: "Delivery", id: "delivery" },
  ];

  const dashboardContentRef = useRef<HTMLDivElement>(null);
  const notificationDropdownRef = useRef<HTMLDivElement>(null);

  const getAuthToken = () => localStorage.getItem("authToken") || localStorage.getItem("token");

  const handleLogout = useCallback(() => {
    localStorage.clear();
    onLogout();
    window.location.href = "/login";
  }, [onLogout]);

  const attemptTokenRefresh = useCallback(async (): Promise<boolean> => {
    try {
      const token = getAuthToken();
      if (!token) return false;
      const response = await fetch(`${API_BASE_URL}/auth/refresh.php`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return false;
      const data: ApiResponse = await response.json();
      if (data.success && data.token) {
        localStorage.setItem("authToken", data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const authorizedFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = getAuthToken();
      if (!token) {
        handleLogout();
        return null;
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });

      if (response.status === 401) {
        const refreshed = await attemptTokenRefresh();
        if (!refreshed) {
          handleLogout();
          return null;
        }

        const newToken = getAuthToken();
        return fetch(url, {
          ...options,
          headers: {
            Authorization: `Bearer ${newToken}`,
            ...(options.headers || {}),
          },
        });
      }

      return response;
    },
    [attemptTokenRefresh, handleLogout],
  );

  const loadUsers = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, users: true }));
      const response = await authorizedFetch(`${API_BASE_URL}/User.php`);
      if (!response || !response.ok) throw new Error("Failed to load users");
      const data: ApiResponse = await response.json();
      if (data.success && data.data) {
        setUsers(
          (data.data as User[]).filter(
            (entry) => (entry.role === "user" || entry.role === "admin") && entry.is_active === "1",
          ),
        );
      }
    } catch {
      // non-critical
    } finally {
      setLoading((prev) => ({ ...prev, users: false }));
    }
  }, [authorizedFetch]);

  const loadClientsForDropdown = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, clientsForDropdown: true }));
      const response = await authorizedFetch(`${API_BASE_URL}/client.php`);
      if (!response || !response.ok) throw new Error("Failed to load clients");
      const data: ApiResponse = await response.json();
      if (data.success && data.data) setClientsForDropdown(data.data as Client[]);
    } catch {
      // non-critical
    } finally {
      setLoading((prev) => ({ ...prev, clientsForDropdown: false }));
    }
  }, [authorizedFetch]);

  const loadDashboardData = useCallback(async () => {
    try {
      let url = `${API_BASE_URL}/dashboard.php?stats=true`;
      if (dateRange.startDate && dateRange.endDate) {
        url += `&start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;
      }
      const response = await authorizedFetch(url);
      if (!response || !response.ok) throw new Error("Failed to load dashboard");
      const data: ApiResponse = await response.json();
      if (data.success) {
        setDashboardStats(data.stats || {});
        setActivities(data.activities || []);
        if (data.user) {
          const userData = {
            name: data.user.name || user.name,
            email: data.user.email || user.email,
            role: data.user.role || user.role,
          };
          setUser((prev) => ({ ...prev, ...userData }));
          localStorage.setItem("userData", JSON.stringify(userData));
        }
      }
    } catch {
      // keep dashboard usable
    }
  }, [authorizedFetch, dateRange.endDate, dateRange.startDate, user.email, user.name, user.role]);

  const loadOrders = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, orders: true }));
      const params = new URLSearchParams();
      if (dateRange.startDate && dateRange.endDate) {
        params.append("start_date", dateRange.startDate);
        params.append("end_date", dateRange.endDate);
      }
      const response = await authorizedFetch(`${API_BASE_URL}/Order.php${params.toString() ? `?${params.toString()}` : ""}`);
      if (!response || !response.ok) throw new Error("Failed to load orders");
      const data: ApiResponse = await response.json();
      if (!data.success) throw new Error(data.message || "Failed to load orders");
      setOrders(data.orders || []);
    } catch (err) {
      setError(`Failed to load orders: ${(err as Error).message}`);
    } finally {
      setLoading((prev) => ({ ...prev, orders: false }));
    }
  }, [authorizedFetch, dateRange.endDate, dateRange.startDate]);

  const loadReplacementOrders = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, replacementOrders: true }));
      const params = new URLSearchParams();
      if (dateRange.startDate && dateRange.endDate) {
        params.append("start_date", dateRange.startDate);
        params.append("end_date", dateRange.endDate);
      }
      const response = await authorizedFetch(`${API_BASE_URL}/replacementorders.php${params.toString() ? `?${params.toString()}` : ""}`);
      if (!response || !response.ok) throw new Error("Failed to load replacement orders");
      const data: ApiResponse = await response.json();
      if (!data.success) throw new Error(data.message || "Failed to load replacement orders");
      setReplacementOrders(data.orders || data.replacementOrders || []);
    } catch (err) {
      setError(`Failed to load replacement orders: ${(err as Error).message}`);
    } finally {
      setLoading((prev) => ({ ...prev, replacementOrders: false }));
    }
  }, [authorizedFetch, dateRange.endDate, dateRange.startDate]);

  const loadClients = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, clients: true }));
      const query =
        dateRange.startDate && dateRange.endDate
          ? `?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`
          : "";
      const response = await authorizedFetch(`${API_BASE_URL}/Client.php${query}`);
      if (!response || !response.ok) throw new Error("Failed to load clients");
      const data: ApiResponse = await response.json();
      if (!data.success) throw new Error(data.message || "Failed to load clients");
      setClients((data.data as Client[]) || []);
    } catch (err) {
      setError(`Failed to load clients: ${(err as Error).message}`);
    } finally {
      setLoading((prev) => ({ ...prev, clients: false }));
    }
  }, [authorizedFetch, dateRange.endDate, dateRange.startDate]);

  const loadProducts = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, products: true }));
      const query =
        dateRange.startDate && dateRange.endDate
          ? `?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`
          : "";
      const response = await authorizedFetch(`${API_BASE_URL}/Product.php${query}`);
      if (!response || !response.ok) throw new Error("Failed to load products");
      const data: ApiResponse = await response.json();
      if (!data.success) throw new Error(data.message || "Failed to load products");
      setProducts(data.products || []);
    } catch (err) {
      setError(`Failed to load products: ${(err as Error).message}`);
    } finally {
      setLoading((prev) => ({ ...prev, products: false }));
    }
  }, [authorizedFetch, dateRange.endDate, dateRange.startDate]);

  const loadSpareProducts = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, spareProducts: true }));
      const query =
        dateRange.startDate && dateRange.endDate
          ? `?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`
          : "";
      const response = await authorizedFetch(`${API_BASE_URL}/spareproducts.php${query}`);
      if (!response || !response.ok) throw new Error("Failed to load spare products");
      const data: ApiResponse = await response.json();
      if (!data.success) throw new Error(data.message || "Failed to load spare products");
      setSpareProducts(data.products || data.spareProducts || []);
    } catch (err) {
      setError(`Failed to load spare products: ${(err as Error).message}`);
    } finally {
      setLoading((prev) => ({ ...prev, spareProducts: false }));
    }
  }, [authorizedFetch, dateRange.endDate, dateRange.startDate]);

  const loadDeliveries = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, deliveries: true }));
      const query =
        dateRange.startDate && dateRange.endDate
          ? `?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`
          : "";
      const response = await authorizedFetch(`${API_BASE_URL}/deliveries.php${query}`);
      if (!response || !response.ok) throw new Error("Failed to load deliveries");
      const data: ApiResponse = await response.json();
      if (!data.success) throw new Error(data.message || "Failed to load deliveries");
      setDeliveries(data.deliveries || []);
    } catch (err) {
      setError(`Failed to load deliveries: ${(err as Error).message}`);
    } finally {
      setLoading((prev) => ({ ...prev, deliveries: false }));
    }
  }, [authorizedFetch, dateRange.endDate, dateRange.startDate]);

  const loadShopClaims = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, shopClaims: true }));
      const query =
        dateRange.startDate && dateRange.endDate
          ? `?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`
          : "";
      const response = await authorizedFetch(`${API_BASE_URL}/shopclaim.php${query}`);
      if (!response || !response.ok) throw new Error("Failed to load shop claim products");
      const data: ApiResponse = await response.json();
      if (!data.success) throw new Error(data.message || "Failed to load shop claim products");
      setShopClaims(data.products || data.shopClaims || []);
    } catch (err) {
      setError(`Failed to load shop claim products: ${(err as Error).message}`);
    } finally {
      setLoading((prev) => ({ ...prev, shopClaims: false }));
    }
  }, [authorizedFetch, dateRange.endDate, dateRange.startDate]);

  const loadCompanyClaims = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, companyClaims: true }));
      const query =
        dateRange.startDate && dateRange.endDate
          ? `?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`
          : "";
      const response = await authorizedFetch(`${API_BASE_URL}/companyclaim.php${query}`);
      if (!response || !response.ok) throw new Error("Failed to load company claim products");
      const data: ApiResponse = await response.json();
      if (!data.success) throw new Error(data.message || "Failed to load company claim products");
      setCompanyClaims(data.products || data.companyClaims || []);
    } catch (err) {
      setError(`Failed to load company claim products: ${(err as Error).message}`);
    } finally {
      setLoading((prev) => ({ ...prev, companyClaims: false }));
    }
  }, [authorizedFetch, dateRange.endDate, dateRange.startDate]);

  const loadSunToCompanyClaims = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, sunToCompanyClaims: true }));
      const query =
        dateRange.startDate && dateRange.endDate
          ? `?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`
          : "";
      const response = await authorizedFetch(`${API_BASE_URL}/suntocompany.php${query}`);
      if (!response || !response.ok) throw new Error("Failed to load sun to company products");
      const data: ApiResponse = await response.json();
      if (!data.success) throw new Error(data.message || "Failed to load sun to company products");
      setSunToCompanyClaims(data.products || data.sunToCompanyClaims || []);
    } catch (err) {
      setError(`Failed to load sun to company products: ${(err as Error).message}`);
    } finally {
      setLoading((prev) => ({ ...prev, sunToCompanyClaims: false }));
    }
  }, [authorizedFetch, dateRange.endDate, dateRange.startDate]);

  const loadCompanyToSunClaims = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, companyToSunClaims: true }));
      const query =
        dateRange.startDate && dateRange.endDate
          ? `?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`
          : "";
      const response = await authorizedFetch(`${API_BASE_URL}/companytosun.php${query}`);
      if (!response || !response.ok) throw new Error("Failed to load company to sun products");
      const data: ApiResponse = await response.json();
      if (!data.success) throw new Error(data.message || "Failed to load company to sun products");
      setCompanyToSunClaims(data.products || data.companyToSunClaims || []);
    } catch (err) {
      setError(`Failed to load company to sun products: ${(err as Error).message}`);
    } finally {
      setLoading((prev) => ({ ...prev, companyToSunClaims: false }));
    }
  }, [authorizedFetch, dateRange.endDate, dateRange.startDate]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const calculatePendingDays = useCallback((createdAt: string) => {
    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) return 0;
    const diffMs = Date.now() - createdDate.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }, []);

  const buildPendingOrderNotifications = useCallback(
    (sourceOrders: Order[], previous: Notification[]) => {
      const existingByOrder = new Map<number, Notification>();
      previous.forEach((notification) => {
        if (notification.order_id) {
          existingByOrder.set(notification.order_id, notification);
        }
      });

      return sourceOrders
        .filter((order) => String(order.status || "").toLowerCase() === "pending")
        .map((order) => {
          const pendingDays = calculatePendingDays(order.created_at);
          const existing = existingByOrder.get(order.id);
          const pendingMessage =
            pendingDays <= 0 ? "Pending today" : `Pending for ${pendingDays} day${pendingDays === 1 ? "" : "s"}`;

        return {
          id: existing?.id ?? 1000000 + order.id,
          title: `Order ${order.order_code} pending`,
          message: pendingMessage,
          type: "order",
          created_at: order.created_at || new Date().toISOString(),
          is_read: existing?.is_read ?? false,
          order_id: order.id,
          order_code: order.order_code,
          pending_days: pendingDays,
        };
      })
      .sort((a, b) => (b.pending_days || 0) - (a.pending_days || 0));
    },
    [calculatePendingDays],
  );

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await authorizedFetch(`${API_BASE_URL}/notifications.php`);
      if (!response || !response.ok) return;
      const data: ApiResponse = await response.json();
      if (data.success) {
        setNotifications((prev) => {
          const pendingNotifications = buildPendingOrderNotifications(ordersRef.current, prev);
          const nonOrderNotifications = (data.notifications || []).filter(
            (notification: Notification) => !notification.order_id,
          );
          return [...pendingNotifications, ...nonOrderNotifications];
        });
      }
    } catch {
      // optional
    }
  }, [authorizedFetch, buildPendingOrderNotifications]);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      const tablet = width >= 768 && width < 1024;
      setIsMobile(mobile);
      setIsTablet(tablet);
      setSidebarOpen(!(mobile || tablet));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const initDashboard = async () => {
      try {
        const token = getAuthToken();
        const userData = localStorage.getItem("userData");
        if (!token || !userData) {
          handleLogout();
          return;
        }
        const parsedUserData = JSON.parse(userData);
        setUser((prev) => ({
          ...prev,
          name: parsedUserData.name || "User",
          email: parsedUserData.email || "",
          role: parsedUserData.role || "Staff",
        }));
        setLoading((prev) => ({ ...prev, dashboard: true }));
        await Promise.allSettled([
          loadDashboardData(),
          loadUsers(),
          loadOrders(),
          loadReplacementOrders(),
          loadClients(),
          loadProducts(),
          loadSpareProducts(),
          loadShopClaims(),
          loadCompanyClaims(),
          loadSunToCompanyClaims(),
          loadCompanyToSunClaims(),
          loadDeliveries(),
          loadClientsForDropdown(),
        ]);
        await fetchNotifications();
      } catch {
        setError("Failed to load dashboard data. Please refresh the page or check your connection.");
      } finally {
        setLoading((prev) => ({ ...prev, dashboard: false }));
      }
    };
    void initDashboard();
  }, [
    fetchNotifications,
    handleLogout,
    loadClients,
    loadClientsForDropdown,
    loadDashboardData,
    loadDeliveries,
    loadOrders,
    loadReplacementOrders,
    loadProducts,
    loadSpareProducts,
    loadShopClaims,
    loadCompanyClaims,
    loadSunToCompanyClaims,
    loadCompanyToSunClaims,
    loadUsers,
  ]);

  useEffect(() => {
    const contentElement = dashboardContentRef.current;
    const onScroll = () => {
      if (contentElement) setShowScrollTop(contentElement.scrollTop > 300);
    };
    contentElement?.addEventListener("scroll", onScroll);
    return () => contentElement?.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!notificationDropdownRef.current) return;
      if (!notificationDropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchNotifications();
    }, 60 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [fetchNotifications]);

  useEffect(() => {
    const loadTabData = async () => {
      if (activeTab === "orders") await loadOrders();
      if (activeTab === "replacementorders") await loadReplacementOrders();
      if (activeTab === "clients") await loadClients();
      if (activeTab === "products") await loadProducts();
      if (activeTab === "spareproducts") await loadSpareProducts();
      if (activeTab === "shopclaim") await loadShopClaims();
      if (activeTab === "companyclaim") await loadCompanyClaims();
      if (activeTab === "suntocompany") await loadSunToCompanyClaims();
      if (activeTab === "companytosun") await loadCompanyToSunClaims();
      if (activeTab === "delivery") await loadDeliveries();
    };
    if (activeTab !== "dashboard") void loadTabData();
  }, [activeTab, loadClients, loadDeliveries, loadOrders, loadReplacementOrders, loadProducts, loadSpareProducts, loadShopClaims, loadCompanyClaims, loadSunToCompanyClaims, loadCompanyToSunClaims]);

  useEffect(() => {
    if (orders.length === 0) return;
    setNotifications((prev) => {
      const pendingNotifications = buildPendingOrderNotifications(orders, prev);
      const nonOrderNotifications = prev.filter((notification) => !notification.order_id);
      return [...pendingNotifications, ...nonOrderNotifications];
    });
  }, [orders, buildPendingOrderNotifications]);

  const findClientIdByName = (clientName: string, clientPhone = "") => {
    const client = clients.find(
      (entry) => entry.full_name === clientName || (clientPhone && entry.phone === clientPhone),
    );
    return client ? client.id : null;
  };

  const findProductIdByName = (productName: string) => {
    const product = products.find((entry) => entry.product_name === productName);
    return product ? product.id : null;
  };

  const resetOrderForm = () => {
    setOrderForm(createDefaultOrderForm());
    setEditMode(false);
    setCurrentItem(null);
  };
  const resetClientForm = () => {
    setClientForm(createDefaultClientForm());
    setEditMode(false);
    setCurrentItem(null);
  };
  const resetProductForm = () => {
    setProductForm(createDefaultProductForm());
    setEditMode(false);
    setCurrentItem(null);
  };

  const closeForm = () => {
    setShowForm(false);
    if (formType === "order") resetOrderForm();
    if (formType === "client") resetClientForm();
    if (formType === "product") resetProductForm();
  };

  const handleClientSelection = (clientId: string) => {
    if (!clientId) {
      setOrderForm((prev) => ({ ...prev, client_id: "", client_name: "", client_phone: "" }));
      return;
    }
    const selectedClient = clientsForDropdown.find((client) => client.id.toString() === clientId);
    if (selectedClient) {
      setOrderForm((prev) => ({
        ...prev,
        client_id: clientId,
        client_name: selectedClient.full_name,
        client_phone: selectedClient.phone,
      }));
    }
  };

  const handleProductSelection = (productId: string) => {
    if (!productId) {
      setOrderForm((prev) => ({ ...prev, product_id: "", product_name: "" }));
      return;
    }
    const selectedProduct = products.find((product) => product.id.toString() === productId);
    if (selectedProduct) {
      setOrderForm((prev) => ({
        ...prev,
        product_id: productId,
        product_name: selectedProduct.product_name,
      }));
    }
  };

  const handleReplacementProductSelection = (productId: string) => {
    if (!productId) {
      setOrderForm((prev) => ({ ...prev, replacement_product_id: "", replacement_product_name: "" }));
      return;
    }
    const selectedProduct = products.find((product) => product.id.toString() === productId);
    if (selectedProduct) {
      setOrderForm((prev) => ({
        ...prev,
        replacement_product_id: productId,
        replacement_product_name: selectedProduct.product_name,
      }));
    }
  };

  const handleOrderInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    if (name === "client_id") handleClientSelection(value);
    else if (name === "product_id") handleProductSelection(value);
    else if (name === "replacement_product_id") handleReplacementProductSelection(value);
    else setOrderForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleClientInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setClientForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleProductInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) =>
    setProductForm((prev) => ({
      ...prev,
      [e.target.name]:
        e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let clientId = orderForm.client_id ? Number.parseInt(orderForm.client_id, 10) : null;
      if (!clientId && orderForm.client_name) {
        clientId = findClientIdByName(orderForm.client_name, orderForm.client_phone);
        if (!clientId) {
          const clientResponse = await authorizedFetch(`${API_BASE_URL}/Client.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              full_name: orderForm.client_name,
              phone: orderForm.client_phone,
              email: "",
              address: "",
              city: "",
              state: "",
              zip_code: "",
              notes: "Created from order",
            }),
          });
          const clientData: ApiResponse = clientResponse ? await clientResponse.json() : { success: false };
          if (clientData.success) {
            clientId = clientData.client_id || null;
            await loadClients();
            await loadClientsForDropdown();
          }
        }
      }

      let productId = orderForm.product_id ? Number.parseInt(orderForm.product_id, 10) : null;
      if (!productId && orderForm.product_name) {
        productId = findProductIdByName(orderForm.product_name);
        if (!productId) {
          const productResponse = await authorizedFetch(`${API_BASE_URL}/Product.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              product_name: orderForm.product_name,
              serial_number: "",
              brand: "",
              model: "",
              category: "laptop",
              claim_type: "none",
              specifications: "",
              purchase_date: new Date().toISOString().split("T")[0],
              warranty_period: "1 year",
              price: orderForm.estimated_cost || "0",
              status: "active",
            }),
          });
          const productData: ApiResponse = productResponse ? await productResponse.json() : { success: false };
          if (productData.success) {
            productId = productData.product_id || null;
            await loadProducts();
          }
        }
      }

      const replacementProductId = orderForm.replacement_product_id
        ? Number.parseInt(orderForm.replacement_product_id, 10)
        : null;

      if (!clientId || !productId) {
        throw new Error("Please fill all required fields");
      }

      const response = await authorizedFetch(
        editMode && currentItem ? `${API_BASE_URL}/Order.php?id=${currentItem.id}` : `${API_BASE_URL}/Order.php`,
        {
          method: editMode ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            product_id: productId,
            replacement_product_id: replacementProductId,
            staff_id: orderForm.staff_id ? Number.parseInt(orderForm.staff_id, 10) : null,
            issue_description: orderForm.issue_description?.trim() || "",
            warranty_status: orderForm.warranty_status,
            estimated_cost: orderForm.estimated_cost?.trim() || "",
            payment_status: orderForm.payment_status,
            estimated_delivery_date: orderForm.estimated_delivery_date || "",
            status: orderForm.status,
            priority: orderForm.priority,
            notes: orderForm.notes,
            final_cost: orderForm.final_cost || orderForm.estimated_cost || "",
            deposit_amount: orderForm.deposit_amount || "0",
          }),
        },
      );

      const data: ApiResponse = response ? await response.json() : { success: false };
      if (!data.success) throw new Error(data.message || "Failed to save order");
      await Promise.all([loadOrders(), loadDashboardData()]);
      closeForm();
      setError(null);
      setSuccessMessage(editMode ? "Order updated successfully!" : "Order created successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(`Failed to save order: ${(err as Error).message}`);
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await authorizedFetch(
        editMode && currentItem ? `${API_BASE_URL}/Client.php?id=${currentItem.id}` : `${API_BASE_URL}/Client.php`,
        {
          method: editMode ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clientForm),
        },
      );
      const data: ApiResponse = response ? await response.json() : { success: false };
      if (!data.success) throw new Error(data.message || "Failed to save client");
      await Promise.all([loadClients(), loadClientsForDropdown(), loadDashboardData()]);
      closeForm();
      setError(null);
      setSuccessMessage(editMode ? "Client updated successfully!" : "Client created successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(`Failed to save client: ${(err as Error).message}`);
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await authorizedFetch(
        editMode && currentItem ? `${API_BASE_URL}/Product.php?id=${currentItem.id}` : `${API_BASE_URL}/Product.php`,
        {
          method: editMode ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productForm),
        },
      );
      const data: ApiResponse = response ? await response.json() : { success: false };
      if (!data.success) throw new Error(data.message || "Failed to save product");
      await Promise.all([loadProducts(), loadDashboardData()]);
      closeForm();
      setError(null);
      setSuccessMessage(editMode ? "Product updated successfully!" : "Product created successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(`Failed to save product: ${(err as Error).message}`);
    }
  };

  const handleEditOrder = (order: Order) => {
    setOrderForm({
      client_name: order.client_name || "",
      client_phone: order.client_phone || "",
      product_name: order.product_name || "",
      replacement_product_name: order.replacement_product_name || "",
      issue_description: order.issue_description || "",
      warranty_status: order.warranty_status || "out_of_warranty",
      estimated_cost: order.estimated_cost?.toString() || "",
      final_cost: order.final_cost?.toString() || "",
      payment_status: order.payment_status || "pending",
      service_type: order.service_type || "general",
      estimated_delivery_date: order.estimated_delivery_date || new Date().toISOString().split("T")[0],
      status: order.status || "pending",
      priority: order.priority || "medium",
      notes: order.notes || "",
      client_id: order.client_id?.toString() || "",
      product_id: order.product_id?.toString() || "",
      replacement_product_id: order.replacement_product_id?.toString() || "",
      staff_id: order.staff_id?.toString() || "",
      deposit_amount: order.deposit_amount?.toString() || "",
    });
    setCurrentItem(order);
    setEditMode(true);
    setFormType("order");
    setShowForm(true);
  };

  const handleEditClient = (client: Client) => {
    setClientForm({
      full_name: client.full_name || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      city: client.city || "",
      state: client.state || "",
      zip_code: client.zip_code || "",
      notes: client.notes || "",
    });
    setCurrentItem(client);
    setEditMode(true);
    setFormType("client");
    setShowForm(true);
  };

  const handleEditProduct = (product: Product) => {
    setProductForm({
      product_name: product.product_name || "",
      serial_number: product.serial_number || "",
      is_spare_product: Boolean(Number(product.is_spare_product || 0)),
      brand: product.brand || "",
      model: product.model || "",
      category: product.category || "laptop",
      claim_type: product.claim_type || "none",
      specifications: product.specifications || "",
      purchase_date: product.purchase_date || "",
      warranty_period: product.warranty_period || "",
      price: product.price?.toString() || "",
      status: product.status || "active",
    });
    setCurrentItem(product);
    setEditMode(true);
    setFormType("product");
    setShowForm(true);
  };

  const handleDeleteOrder = (order: Order) => {
    setDeleteOrderTarget(order);
  };

  const confirmDeleteOrder = async () => {
    if (!deleteOrderTarget) return;
    setDeleteOrderPending(true);
    try {
      const response = await authorizedFetch(`${API_BASE_URL}/Order.php?id=${deleteOrderTarget.id}`, {
        method: "DELETE",
      });
      const data: ApiResponse = response ? await response.json() : { success: false };
      if (!data.success) throw new Error(data.message || "Failed to delete order");
      await Promise.all([loadOrders(), loadDashboardData()]);
      setSuccessMessage("Order deleted successfully!");
      setDeleteOrderTarget(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(`Failed to delete order: ${(err as Error).message}`);
    } finally {
      setDeleteOrderPending(false);
    }
  };

  const handleDeleteClient = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this client?")) return;
    try {
      const response = await authorizedFetch(`${API_BASE_URL}/Client.php?id=${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data: ApiResponse = response ? await response.json() : { success: false };
      if (!data.success) throw new Error(data.message || "Failed to delete client");
      await Promise.all([loadClients(), loadClientsForDropdown(), loadDashboardData()]);
      setSuccessMessage("Client deleted successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(`Failed to delete client: ${(err as Error).message}`);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      const response = await authorizedFetch(`${API_BASE_URL}/Product.php?id=${id}`, { method: "DELETE" });
      const data: ApiResponse = response ? await response.json() : { success: false };
      if (!data.success) throw new Error(data.message || "Failed to delete product");
      await Promise.all([loadProducts(), loadDashboardData()]);
      setSuccessMessage("Product deleted successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(`Failed to delete product: ${(err as Error).message}`);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    const isReminder = notification.title.toLowerCase().includes("reminder");
    const isPendingOrder = Boolean(notification.order_id);

    if (!isReminder && !isPendingOrder) {
      setNotifications((prev) =>
        prev.map((entry) => (entry.id === notification.id ? { ...entry, is_read: true } : entry)),
      );
    }

    if (notification.order_id || notification.order_code) {
      const matchedOrder =
        orders.find((order) => order.id === notification.order_id) ||
        orders.find((order) => order.order_code === notification.order_code);

      setActiveTab("orders");
      setFilterStatus("pending");
      setFilterPriority("all");

      if (matchedOrder) {
        setSelectedOrder(matchedOrder);
      } else if (notification.order_code) {
        setSearchTerm(notification.order_code);
      }

      setShowNotifications(false);
    }
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((entry) => ({ ...entry, is_read: true })));
  };

  const handleClearNotifications = () => {
    setNotifications((prev) =>
      prev
        .filter((entry) => entry.order_id)
        .map((entry) => ({
          ...entry,
          is_read: true,
        })),
    );
  };

  const handleNavItemClick = (id: string) => {
    setActiveTab(id);
    if (isMobile || isTablet) setSidebarOpen(false);
    setSearchTerm("");
    setFilterStatus("all");
    setFilterPriority("all");
  };

  const handleRefresh = async () => {
    setError(null);
    try {
      if (activeTab === "dashboard") await loadDashboardData();
      if (activeTab === "orders") await loadOrders();
      if (activeTab === "replacementorders") await loadReplacementOrders();
      if (activeTab === "clients") await loadClients();
      if (activeTab === "products") await loadProducts();
      if (activeTab === "spareproducts") await loadSpareProducts();
      if (activeTab === "shopclaim") await loadShopClaims();
      if (activeTab === "companyclaim") await loadCompanyClaims();
      if (activeTab === "suntocompany") await loadSunToCompanyClaims();
      if (activeTab === "companytosun") await loadCompanyToSunClaims();
      if (activeTab === "delivery") await loadDeliveries();
      await loadClientsForDropdown();
      setSuccessMessage("Data refreshed successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setError("Failed to refresh data");
    }
  };

  const scrollToTop = () =>
    dashboardContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  const handleDateRangeChange = (start: string, end: string) => {
    setDateRange({ startDate: start, endDate: end });
    setTimeout(() => void handleRefresh(), 100);
  };

  const clearAllFilters = () => {
    setFilterStatus("all");
    setFilterPriority("all");
    setSearchTerm("");
    setDateRange({ startDate: "", endDate: "" });
    setTimeout(() => void handleRefresh(), 100);
  };

  const setDateRangePreset = (
    preset: "today" | "yesterday" | "thisWeek" | "thisMonth" | "lastMonth" | "thisYear",
  ) => {
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();
    switch (preset) {
      case "today":
        break;
      case "yesterday":
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        endDate = new Date(startDate);
        break;
      case "thisWeek":
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay());
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case "thisMonth":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case "lastMonth":
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case "thisYear":
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        break;
    }
    setDateRange({
      startDate: formatISODate(startDate.toISOString()),
      endDate: formatISODate(endDate.toISOString()),
    });
    setTimeout(() => void handleRefresh(), 100);
  };

  const openOrderReceiptOptions = (order: Order) => {
    setReceiptTarget({ kind: "order", order });
  };

  const openDeliveryReceiptOptions = (delivery: Delivery) => {
    setReceiptTarget({ kind: "delivery", delivery });
  };

  const downloadOrderReceipt = async (order: Order) => {
    try {
      await downloadReceiptPdf(createOrderReceiptMarkup(order), `Receipt_${order.order_code}.pdf`);
      setSuccessMessage("Receipt PDF downloaded successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setError("Failed to generate receipt");
    }
  };

  const downloadDeliveryReceipt = async (delivery: Delivery) => {
    try {
      await downloadReceiptPdf(
        createDeliveryReceiptMarkup(delivery),
        `Delivery_Receipt_${delivery.delivery_code || delivery.id}.pdf`,
      );
      setSuccessMessage("Delivery receipt PDF downloaded successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setError("Failed to generate delivery receipt");
    }
  };

  const getStatusColor = (status: string) =>
    ({ delivered: "#8B5CF6", ready: "#F59E0B", completed: "#06B6D4", process: "#8B5CF6", pending: "#6B7280", scheduled: "#EC4899", cancelled: "#DC2626" }[status] || "#6B7280");
  const getPriorityColor = (priority: string) =>
    ({ urgent: "#DC2626", high: "#EF4444", medium: "#F59E0B", low: "#10B981" }[priority] || "#6B7280");
  const getWarrantyColor = (warranty: string) =>
    ({ in_warranty: "#10B981", extended_warranty: "#3B82F6", out_of_warranty: "#6B7280" }[warranty] || "#6B7280");

  const handleNewButtonClick = () => {
    if (activeTab === "orders") {
      resetOrderForm();
      setFormType("order");
      setShowForm(true);
    }
    if (activeTab === "clients") {
      resetClientForm();
      setFormType("client");
      setShowForm(true);
    }
    if (activeTab === "products") {
      resetProductForm();
      setFormType("product");
      setShowForm(true);
    }
  };

  const getFilteredDashboardData = () => {
    if (!searchTerm.trim()) return orders;
    const searchLower = searchTerm.toLowerCase();
    return orders.filter(
      (order) =>
        order.client_name?.toLowerCase().includes(searchLower) ||
        order.client_phone?.includes(searchTerm) ||
        order.order_code?.toLowerCase().includes(searchLower) ||
        order.staff_name?.toLowerCase().includes(searchLower),
    );
  };

  const getFilteredOrders = () =>
    orders.filter((order) => {
      const matchesSearch =
        !searchTerm ||
        [order.client_name, order.product_name, order.order_code, order.issue_description, order.staff_name].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ||
        order.client_phone?.includes(searchTerm);
      const matchesStatus = filterStatus === "all" || order.status === filterStatus;
      const matchesPriority = filterPriority === "all" || order.priority === filterPriority;
      const orderDate = formatISODate(order.created_at);
      const matchesDate =
        !dateRange.startDate ||
        !dateRange.endDate ||
        (orderDate >= dateRange.startDate && orderDate <= dateRange.endDate);
      return matchesSearch && matchesStatus && matchesPriority && matchesDate;
    });

  const getFilteredReplacementOrders = () =>
    replacementOrders.filter((order) => {
      const matchesSearch =
        !searchTerm ||
        [order.client_name, order.product_name, order.replacement_product_name, order.order_code, order.issue_description, order.staff_name].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ||
        order.client_phone?.includes(searchTerm);
      const matchesStatus = filterStatus === "all" || order.status === filterStatus;
      const matchesPriority = filterPriority === "all" || order.priority === filterPriority;
      const orderDate = formatISODate(order.created_at);
      const matchesDate =
        !dateRange.startDate ||
        !dateRange.endDate ||
        (orderDate >= dateRange.startDate && orderDate <= dateRange.endDate);
      return matchesSearch && matchesStatus && matchesPriority && matchesDate;
    });

  const getFilteredClients = () =>
    clients.filter((client) => {
      const matchesSearch =
        !searchTerm ||
        [client.full_name, client.email, client.client_code, client.city].some((value) =>
          value?.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ||
        client.phone?.includes(searchTerm);
      const createdDate = formatISODate(client.created_at);
      const matchesDate =
        !dateRange.startDate ||
        !dateRange.endDate ||
        (createdDate >= dateRange.startDate && createdDate <= dateRange.endDate);
      return matchesSearch && matchesDate;
    });

  const getFilteredProducts = () =>
    products.filter((product) => {
      const matchesSearch =
        !searchTerm ||
        [product.product_name, product.brand, product.model, product.product_code, product.category].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ||
        [product.serial_number, product.claim_type].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        );
      const matchesStatus = filterStatus === "all" || product.status === filterStatus;
      const createdDate = formatISODate(product.created_at);
      const matchesDate =
        !dateRange.startDate ||
        !dateRange.endDate ||
        (createdDate >= dateRange.startDate && createdDate <= dateRange.endDate);
      return matchesSearch && matchesStatus && matchesDate;
    });

  const getFilteredSpareProducts = () =>
    spareProducts.filter((product) => {
      const matchesSearch =
        !searchTerm ||
        [product.product_name, product.brand, product.model, product.product_code, product.category].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ||
        [product.serial_number, product.claim_type].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        );
      const createdDate = formatISODate(product.created_at);
      const matchesDate =
        !dateRange.startDate ||
        !dateRange.endDate ||
        (createdDate >= dateRange.startDate && createdDate <= dateRange.endDate);
      return matchesSearch && matchesDate;
    });

  const getFilteredDeliveries = () =>
    deliveries.filter((delivery) => {
      const matchesSearch =
        !searchTerm ||
        [delivery.order_code, delivery.client_name, delivery.product_name, delivery.delivery_code, delivery.address].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ||
        delivery.client_phone?.includes(searchTerm);
      const createdDate = formatISODate(delivery.created_at);
      const matchesDate =
        !dateRange.startDate ||
        !dateRange.endDate ||
        (createdDate >= dateRange.startDate && createdDate <= dateRange.endDate);
      return matchesSearch && matchesDate;
    });

  const getFilteredShopClaims = () =>
    shopClaims.filter((product) => {
      const matchesSearch =
        !searchTerm ||
        [product.product_name, product.brand, product.model, product.product_code, product.category].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ||
        [product.serial_number, product.claim_type].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        );
      const createdDate = formatISODate(product.created_at);
      const matchesDate =
        !dateRange.startDate ||
        !dateRange.endDate ||
        (createdDate >= dateRange.startDate && createdDate <= dateRange.endDate);
      return matchesSearch && matchesDate;
    });

  const getFilteredCompanyClaims = () =>
    companyClaims.filter((product) => {
      const matchesSearch =
        !searchTerm ||
        [product.product_name, product.brand, product.model, product.product_code, product.category].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ||
        [product.serial_number, product.claim_type].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        );
      const createdDate = formatISODate(product.created_at);
      const matchesDate =
        !dateRange.startDate ||
        !dateRange.endDate ||
        (createdDate >= dateRange.startDate && createdDate <= dateRange.endDate);
      return matchesSearch && matchesDate;
    });

  const getFilteredSunToCompanyClaims = () =>
    sunToCompanyClaims.filter((product) => {
      const matchesSearch =
        !searchTerm ||
        [product.product_name, product.brand, product.model, product.product_code, product.category].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ||
        [product.serial_number, product.claim_type].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        );
      const createdDate = formatISODate(product.created_at);
      const matchesDate =
        !dateRange.startDate ||
        !dateRange.endDate ||
        (createdDate >= dateRange.startDate && createdDate <= dateRange.endDate);
      return matchesSearch && matchesDate;
    });

  const getFilteredCompanyToSunClaims = () =>
    companyToSunClaims.filter((product) => {
      const matchesSearch =
        !searchTerm ||
        [product.product_name, product.brand, product.model, product.product_code, product.category].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ||
        [product.serial_number, product.claim_type].some(
          (value) => value?.toLowerCase().includes(searchTerm.toLowerCase()),
        );
      const createdDate = formatISODate(product.created_at);
      const matchesDate =
        !dateRange.startDate ||
        !dateRange.endDate ||
        (createdDate >= dateRange.startDate && createdDate <= dateRange.endDate);
      return matchesSearch && matchesDate;
    });

  const filteredOrders = getFilteredOrders();
  const filteredReplacementOrders = getFilteredReplacementOrders();
  const filteredClients = getFilteredClients();
  const filteredProducts = getFilteredProducts();
  const filteredSpareProducts = getFilteredSpareProducts();
  const filteredShopClaims = getFilteredShopClaims();
  const filteredCompanyClaims = getFilteredCompanyClaims();
  const filteredSunToCompanyClaims = getFilteredSunToCompanyClaims();
  const filteredCompanyToSunClaims = getFilteredCompanyToSunClaims();
  const filteredDeliveries = getFilteredDeliveries();
  const dashboardSearchResults = getFilteredDashboardData();

  const statsData = [
    { id: 1, title: "Total Orders", value: dashboardStats?.total_orders?.toString() || orders.length.toString() || "0", change: "+12.5%", icon: <FiPackage />, color: "#3B82F6", filter: () => setActiveTab("orders") },
    { id: 2, title: "Active Orders", value: dashboardStats?.pending_orders?.toString() || orders.filter((order) => ["pending", "scheduled", "process"].includes(order.status)).length.toString() || "0", change: "+8.2%", icon: <FiClock />, color: "#F59E0B", filter: () => { setActiveTab("orders"); setFilterStatus("pending"); } },
    { id: 3, title: "Total Clients", value: dashboardStats?.total_clients?.toString() || clients.length.toString() || "0", change: "+5.3%", icon: <FiUsers />, color: "#10B981", filter: () => setActiveTab("clients") },
    { id: 4, title: "Delivered Orders", value: dashboardStats?.delivered_orders?.toString() || orders.filter((order) => order.status === "delivered").length.toString() || "0", change: "+15.2%", icon: <FiCheckCircle />, color: "#8B5CF6", filter: () => { setActiveTab("orders"); setFilterStatus("delivered"); } },
    { id: 5, title: "Pending Orders", value: orders.filter((order) => order.status === "pending").length.toString() || "0", change: "-2.1%", icon: <FiAlertCircle />, color: "#EF4444", filter: () => { setActiveTab("orders"); setFilterStatus("pending"); } },
    { id: 6, title: "Total Products", value: dashboardStats?.total_products?.toString() || products.length.toString() || "0", change: "+3.7%", icon: <FiBox />, color: "#3B82F6", filter: () => setActiveTab("products") },
  ];

  const receiptModalConfig =
    receiptTarget?.kind === "order"
      ? {
          kind: "order" as const,
          code: receiptTarget.order.order_code,
          subtitle: `${receiptTarget.order.client_name} | ${receiptTarget.order.product_name}`,
          description: "Download a customer-ready PDF service receipt.",
          previewMarkup: createOrderReceiptMarkup(receiptTarget.order),
          summaryItems: [
            { label: "Client", value: receiptTarget.order.client_name || "N/A" },
            { label: "Status", value: receiptTarget.order.status || "Pending" },
            {
              label: "Amount",
              value: `Rs. ${formatCurrency(receiptTarget.order.final_cost || receiptTarget.order.estimated_cost)}`,
            },
          ],
          onDownload: () => void downloadOrderReceipt(receiptTarget.order),
        }
      : receiptTarget?.kind === "delivery"
        ? {
            kind: "delivery" as const,
            code: receiptTarget.delivery.delivery_code || `DEL${String(receiptTarget.delivery.id).padStart(3, "0")}`,
            subtitle: `${receiptTarget.delivery.client_name || "N/A"} | ${receiptTarget.delivery.product_name || "N/A"}`,
            description: "Download a clean PDF handover slip for delivery records.",
            previewMarkup: createDeliveryReceiptMarkup(receiptTarget.delivery),
            summaryItems: [
              { label: "Client", value: receiptTarget.delivery.client_name || "N/A" },
              {
                label: "Scheduled",
                value:
                  receiptTarget.delivery.scheduled_date_formatted ||
                  formatDisplayDate(receiptTarget.delivery.scheduled_date),
              },
              { label: "Status", value: receiptTarget.delivery.status || "Pending" },
            ],
            onDownload: () => void downloadDeliveryReceipt(receiptTarget.delivery),
          }
        : null;

  return (
    <div className="dashboard">
      <AnimatePresence>{sidebarOpen && <motion.aside className="sidebar" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}><div className="sidebar-header"><div className="brand"><div className="logo"><div className="logo-circle"><span>SC</span></div><div className="brand-info"><h2 className="sidebar-brand-text">Sun Computers</h2><p className="sidebar-subtext">Service Center</p></div></div></div><button className="sidebar-toggle close" onClick={() => setSidebarOpen(false)}><FiChevronLeft className="sidebar-icon" /></button></div><div className="sidebar-content"><div className="user-profile"><div className="user-info"><h3>{user.name}</h3><p>{user.role}</p><span className="user-email">{user.email}</span></div></div><nav className="sidebar-nav">{navItems.map((item) => <motion.button key={item.id} className={`nav-item ${activeTab === item.id ? "active" : ""}`} onClick={() => handleNavItemClick(item.id)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span><span className="nav-arrow"><FiChevronRight /></span></motion.button>)}</nav><div className="sidebar-footer"><motion.button className="logout-btn" onClick={handleLogout} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><FiLogOut className="logout-icon" /><span className="logout-text">Logout</span></motion.button></div></div></motion.aside>}</AnimatePresence>
      <div className={`main-content ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
        <header className="top-nav"><div className="nav-left">{!sidebarOpen && <motion.button className="sidebar-toggle open" onClick={() => setSidebarOpen(true)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><FiMenu /></motion.button>}<div className="brand-mobile"><div className="logo-circle"><span>SC</span></div><div className="brand-info"><h2>Sun Computers</h2></div></div><motion.div className="search-box" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}><FiSearch className="search-icon" /><input type="text" placeholder={`Search ${activeTab === "dashboard" ? "dashboard by client name or mobile" : `${activeTab} by name, phone, ID...`}`} className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></motion.div></div><div className="nav-right"><motion.button className="nav-btn filter-btn" onClick={() => setShowFilters(!showFilters)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="Show Filters"><FiFilter />{showFilters && <span className="filter-active"></span>}</motion.button><motion.button className="nav-btn refresh-btn" onClick={() => void handleRefresh()} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="Refresh Data"><FiRefreshCw /></motion.button><div className={`notification-dropdown${showNotifications ? " open" : ""}`} ref={notificationDropdownRef}><motion.button className="nav-btn notification-btn" onClick={() => setShowNotifications((prev) => !prev)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><FiBell />{notifications.filter((notification) => !notification.is_read).length > 0 && <span className="notification-badge">{notifications.filter((notification) => !notification.is_read).length}</span>}</motion.button><NotificationDropdown notifications={notifications} onNotificationClick={handleNotificationClick} onMarkAllRead={handleMarkAllNotificationsRead} onClearAll={handleClearNotifications} /></div><div className="user-menu"><div className="user-avatar-placeholder">{user.name.charAt(0).toUpperCase()}</div><div className="user-menu-info"><span>{user.name}</span><span className="user-role">{user.role}</span></div></div></div></header>
        <AnimatePresence>{showFilters && <motion.div className="filters-panel" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}><div className="advanced-filters"><div className="filter-section"><h4>Date Range Filter</h4><div className="date-presets"><button type="button" onClick={() => setDateRangePreset("today")}>Today</button><button type="button" onClick={() => setDateRangePreset("yesterday")}>Yesterday</button><button type="button" onClick={() => setDateRangePreset("thisWeek")}>This Week</button><button type="button" onClick={() => setDateRangePreset("thisMonth")}>This Month</button><button type="button" onClick={() => setDateRangePreset("lastMonth")}>Last Month</button><button type="button" onClick={() => setDateRangePreset("thisYear")}>This Year</button></div><DateRangeSelector dateRange={dateRange} onDateRangeChange={handleDateRangeChange} onPresetClick={setDateRangePreset} /></div>{(activeTab === "orders" || activeTab === "dashboard") && <><div className="filter-section"><h4>Status Filter</h4><div className="status-filters">{["all", "pending", "scheduled", "process", "completed", "ready", "delivered", "cancelled"].map((status) => <button type="button" key={status} className={`status-filter ${filterStatus === status ? "active" : ""}`} onClick={() => setFilterStatus(status)}>{status.charAt(0).toUpperCase() + status.slice(1)}</button>)}</div></div><div className="filter-section"><h4>Priority Filter</h4><div className="priority-filters">{["all", "urgent", "high", "medium", "low"].map((priority) => <button type="button" key={priority} className={`priority-filter ${filterPriority === priority ? "active" : ""}`} onClick={() => setFilterPriority(priority)}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</button>)}</div></div></>}{activeTab === "products" && <div className="filter-section"><h4>Status Filter</h4><div className="status-filters">{["all", "active", "discontinued", "out_of_stock"].map((status) => <button type="button" key={status} className={`status-filter ${filterStatus === status ? "active" : ""}`} onClick={() => setFilterStatus(status)}>{status.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}</button>)}</div></div>}<div className="filter-actions"><button type="button" className="btn secondary" onClick={clearAllFilters}>Clear All Filters</button></div></div></motion.div>}</AnimatePresence>
        <div className="dashboard-content" ref={dashboardContentRef} style={{ overflowY: "auto", height: "calc(100vh - 70px)", WebkitOverflowScrolling: "touch" }}>{successMessage && <div className="success-alert"><FiCheckCircle /><span>{successMessage}</span><button onClick={() => setSuccessMessage(null)}>×</button></div>}{error && <div className="error-alert"><FiAlertCircle /><span>{error}</span><button onClick={() => setError(null)}>×</button></div>}<div className="header-section"><div className="header-content"><div><h1>Welcome back, {user.name}! 👋</h1><p>Manage and track all service orders in one place</p>{dateRange.startDate && dateRange.endDate && <div className="date-range-info"><span>Showing data from {dateRange.startDate} to {dateRange.endDate}</span></div>}{activeTab === "dashboard" && searchTerm && <div className="search-result-info"><span>Found {dashboardSearchResults.length} results for "{searchTerm}"</span></div>}</div><div className="header-actions">{(activeTab === "orders" || activeTab === "clients" || activeTab === "products") && <motion.button className="btn primary" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleNewButtonClick}><FiPlus /><span>{activeTab === "orders" && "New Order"}{activeTab === "clients" && "New Client"}{activeTab === "products" && "New Product"}</span></motion.button>}</div></div></div>{loading[activeTab as keyof LoadingState] && <div className="loading-state"><div className="loading-spinner"></div><p>Loading {activeTab} data...</p></div>}<AnimatePresence>{showForm && formType === "order" && <OrderFormModal show editMode={editMode} orderForm={orderForm} users={users} clientsForDropdown={clientsForDropdown} products={products} loadingClientsForDropdown={loading.clientsForDropdown} onClose={closeForm} onChange={handleOrderInputChange} onProductSelect={handleProductSelection} onSubmit={handleOrderSubmit} />}{showForm && formType === "client" && <ClientFormModal show editMode={editMode} clientForm={clientForm} onClose={closeForm} onChange={handleClientInputChange} onSubmit={handleClientSubmit} />}{showForm && formType === "product" && <ProductFormModal show editMode={editMode} productForm={productForm} onClose={closeForm} onChange={handleProductInputChange} onSubmit={handleProductSubmit} />}{selectedOrder && <OrderDetailModal order={selectedOrder} getStatusColor={getStatusColor} getPriorityColor={getPriorityColor} getWarrantyColor={getWarrantyColor} onClose={() => setSelectedOrder(null)} onEdit={(order) => { setSelectedOrder(null); handleEditOrder(order); }} onPrint={openOrderReceiptOptions} />}{receiptModalConfig && <ReceiptActionModal kind={receiptModalConfig.kind} code={receiptModalConfig.code} subtitle={receiptModalConfig.subtitle} description={receiptModalConfig.description} summaryItems={receiptModalConfig.summaryItems} previewMarkup={receiptModalConfig.previewMarkup} onClose={() => setReceiptTarget(null)} onDownload={() => { receiptModalConfig.onDownload(); setReceiptTarget(null); }} />}</AnimatePresence><ConfirmDeleteModal open={Boolean(deleteOrderTarget)} title={deleteOrderTarget ? `Delete ${deleteOrderTarget.order_code}` : "Delete Order"} description="This will permanently remove the order and its history." details={deleteOrderTarget ? [{ label: "Order Code", value: deleteOrderTarget.order_code }, { label: "Client", value: deleteOrderTarget.client_name || "-" }, { label: "Product", value: deleteOrderTarget.product_name || "-" }, { label: "Status", value: deleteOrderTarget.status || "-" }, { label: "Created", value: formatDisplayDate(deleteOrderTarget.created_at) }, { label: "Amount", value: `Rs. ${formatCurrency(deleteOrderTarget.final_cost || deleteOrderTarget.estimated_cost)}` }] : []} confirmLabel="Delete Order" cancelLabel="Keep Order" isProcessing={deleteOrderPending} onConfirm={confirmDeleteOrder} onCancel={() => { if (!deleteOrderPending) setDeleteOrderTarget(null); }} />{activeTab === "dashboard" && !loading.dashboard && <DashboardOverviewTab statsData={statsData} orders={orders} activities={activities} searchTerm={searchTerm} dashboardSearchResults={dashboardSearchResults} onSetActiveTab={setActiveTab} onSetFilterStatus={setFilterStatus} onViewOrder={setSelectedOrder} onEditOrder={handleEditOrder} onPrintReceipt={openOrderReceiptOptions} getPriorityColor={getPriorityColor} />}{activeTab === "orders" && <OrdersTab orders={orders} filteredOrders={filteredOrders} loading={loading.orders} searchTerm={searchTerm} filterStatus={filterStatus} filterPriority={filterPriority} dateRange={dateRange} onSearchChange={setSearchTerm} onFilterStatusChange={setFilterStatus} onFilterPriorityChange={setFilterPriority} onDateRangeChange={handleDateRangeChange} onPresetClick={setDateRangePreset} onViewOrder={setSelectedOrder} onEditOrder={handleEditOrder} onPrintReceipt={openOrderReceiptOptions} onDeleteOrder={handleDeleteOrder} onCreateOrder={() => { resetOrderForm(); setFormType("order"); setShowForm(true); }} onClearFilters={clearAllFilters} getStatusColor={getStatusColor} getPriorityColor={getPriorityColor} getWarrantyColor={getWarrantyColor} />}{activeTab === "replacementorders" && <ReplacementOrdersTab replacementOrders={replacementOrders} filteredReplacementOrders={filteredReplacementOrders} loading={loading.replacementOrders} searchTerm={searchTerm} filterStatus={filterStatus} filterPriority={filterPriority} dateRange={dateRange} onSearchChange={setSearchTerm} onFilterStatusChange={setFilterStatus} onFilterPriorityChange={setFilterPriority} onDateRangeChange={handleDateRangeChange} onPresetClick={setDateRangePreset} onViewOrder={setSelectedOrder} onEditOrder={handleEditOrder} onPrintReceipt={openOrderReceiptOptions} onDeleteOrder={handleDeleteOrder} onCreateOrder={() => { resetOrderForm(); setFormType("order"); setShowForm(true); }} onClearFilters={clearAllFilters} getStatusColor={getStatusColor} getPriorityColor={getPriorityColor} getWarrantyColor={getWarrantyColor} />}{activeTab === "clients" && <ClientsTab clients={clients} orders={orders} filteredClients={filteredClients} loading={loading.clients} searchTerm={searchTerm} dateRange={dateRange} onSearchChange={setSearchTerm} onDateRangeChange={handleDateRangeChange} onPresetClick={setDateRangePreset} onEditClient={handleEditClient} onDeleteClient={handleDeleteClient} onCreateClient={() => { resetClientForm(); setFormType("client"); setShowForm(true); }} onClearFilters={clearAllFilters} />}{activeTab === "products" && <ProductsTab products={products} orders={orders} filteredProducts={filteredProducts} loading={loading.products} searchTerm={searchTerm} filterStatus={filterStatus} dateRange={dateRange} onSearchChange={setSearchTerm} onFilterStatusChange={setFilterStatus} onDateRangeChange={handleDateRangeChange} onPresetClick={setDateRangePreset} onEditProduct={handleEditProduct} onDeleteProduct={handleDeleteProduct} onCreateProduct={() => { resetProductForm(); setFormType("product"); setShowForm(true); }} onClearFilters={clearAllFilters} />}{activeTab === "spareproducts" && <SpareProductsTab spareProducts={spareProducts} orders={orders} filteredSpareProducts={filteredSpareProducts} loading={loading.spareProducts} searchTerm={searchTerm} dateRange={dateRange} onSearchChange={setSearchTerm} onDateRangeChange={handleDateRangeChange} onPresetClick={setDateRangePreset} onClearFilters={clearAllFilters} />}{activeTab === "shopclaim" && <ShopclaimTab shopClaims={shopClaims} orders={orders} filteredShopClaims={filteredShopClaims} loading={loading.shopClaims} searchTerm={searchTerm} dateRange={dateRange} onSearchChange={setSearchTerm} onDateRangeChange={handleDateRangeChange} onPresetClick={setDateRangePreset} onClearFilters={clearAllFilters} />}{activeTab === "companyclaim" && <CompanyClaimTab companyClaims={companyClaims} orders={orders} filteredCompanyClaims={filteredCompanyClaims} loading={loading.companyClaims} searchTerm={searchTerm} dateRange={dateRange} onSearchChange={setSearchTerm} onDateRangeChange={handleDateRangeChange} onPresetClick={setDateRangePreset} onClearFilters={clearAllFilters} />}{activeTab === "suntocompany" && <SunToCompanyTab sunToCompanyClaims={sunToCompanyClaims} orders={orders} filteredSunToCompanyClaims={filteredSunToCompanyClaims} loading={loading.sunToCompanyClaims} searchTerm={searchTerm} dateRange={dateRange} onSearchChange={setSearchTerm} onDateRangeChange={handleDateRangeChange} onPresetClick={setDateRangePreset} onClearFilters={clearAllFilters} />}{activeTab === "companytosun" && <CompanyToSunTab companyToSunClaims={companyToSunClaims} orders={orders} filteredCompanyToSunClaims={filteredCompanyToSunClaims} loading={loading.companyToSunClaims} searchTerm={searchTerm} dateRange={dateRange} onSearchChange={setSearchTerm} onDateRangeChange={handleDateRangeChange} onPresetClick={setDateRangePreset} onClearFilters={clearAllFilters} />}{activeTab === "delivery" && <DeliveryTab filteredDeliveries={filteredDeliveries} loading={loading.deliveries} searchTerm={searchTerm} dateRange={dateRange} onSearchChange={setSearchTerm} onDateRangeChange={handleDateRangeChange} onPresetClick={setDateRangePreset} onPrintDeliveryReceipt={openDeliveryReceiptOptions} onViewOrders={() => setActiveTab("orders")} onClearFilters={clearAllFilters} />}<motion.button className={`scroll-to-top ${showScrollTop ? "visible" : ""}`} onClick={scrollToTop} initial={{ opacity: 0 }} animate={{ opacity: showScrollTop ? 1 : 0 }} transition={{ duration: 0.3 }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><FiChevronUp /></motion.button><footer className="dashboard-footer"><div className="footer-content"><p>© 2026 Sun Computers Service Center. All rights reserved</p><div className="footer-links"><a href="#privacy">Privacy Policy</a><a href="#terms">Terms of Service</a><a href="#support">Support Center</a><a href="#contact">Contact Us</a></div></div></footer></div>
      </div>
    </div>
  );
};

export default Dashboard;








