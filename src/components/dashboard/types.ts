import type React from "react";

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
  phone?: string;
  is_active?: string;
  last_login?: string;
  created_at?: string;
}

export interface DashboardStats {
  total_orders?: number;
  pending_orders?: number;
  total_clients?: number;
  total_products?: number;
  delivered_orders?: number;
  revenue?: number;
}

export interface Activity {
  activity: string;
  timestamp: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  created_at: string;
  is_read: boolean;
  order_id?: number;
  order_code?: string;
  pending_days?: number;
}

export interface Order {
  id: number;
  order_code: string;
  client_id: number;
  client_name: string;
  client_phone: string;
  product_id: number;
  product_name: string;
  product_ids?: number[];
  product_names?: string[];
  replacement_product_id?: number | null;
  replacement_product_name?: string;
  replacement_product_ids?: number[];
  replacement_product_names?: string[];
  serial_number?: string;
  replacement_serial_number?: string;
  product_serial_numbers?: string[];
  replacement_product_serial_numbers?: string[];
  issue_description: string;
  warranty_status: string;
  estimated_cost: string | number;
  final_cost: string | number;
  payment_status: string;
  estimated_delivery_date: string;
  status: string;
  priority: string;
  notes: string;
  created_at: string;
  client_address?: string;
  product_brand?: string;
  staff_id: number;
  staff_name: string;
  staff_email?: string;
  deposit_amount?: string | number;
  client_email?: string;
  product_model?: string;
  diagnosis_notes?: string;
  repair_notes?: string;
  rating?: string | number;
  actual_delivery_date?: string;
  service_type?: string;
}

export interface Client {
  id: number;
  client_code: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  notes: string;
  created_at: string;
  total_orders?: number;
}

export interface Product {
  id: number;
  product_code: string;
  product_name: string;
  serial_number?: string;
  is_spare_product?: boolean | number | string;
  brand: string;
  model: string;
  category: string;
  claim_type?: string;
  specifications: string;
  purchase_date: string;
  warranty_period: string;
  price: string | number;
  status: string;
  created_at: string;
  total_orders?: number;
}

export interface Delivery {
  id: number;
  delivery_code?: string;
  order_id: number;
  order_code?: string;
  client_name?: string;
  client_phone?: string;
  client_address?: string;
  product_name?: string;
  product_brand?: string;
  delivery_type: string;
  address: string;
  contact_person: string;
  contact_phone: string;
  scheduled_date: string;
  scheduled_date_formatted?: string;
  scheduled_time: string;
  scheduled_time_formatted?: string;
  delivery_person: string;
  notes: string;
  status: string;
  delivered_date: string;
  delivered_date_formatted?: string;
  created_at: string;
}

export interface LoadingState {
  orders: boolean;
  replacementOrders: boolean;
  clients: boolean;
  products: boolean;
  spareProducts: boolean;
  shopClaims: boolean;
  companyClaims: boolean;
  sunToCompanyClaims: boolean;
  companyToSunClaims: boolean;
  dashboard: boolean;
  user: boolean;
  deliveries: boolean;
  users: boolean;
  clientsForDropdown: boolean;
}

export interface OrderForm {
  client_name: string;
  client_phone: string;
  product_name: string;
  replacement_product_name: string;
  service_type: string;
  issue_description: string;
  warranty_status: string;
  estimated_cost: string;
  final_cost: string;
  payment_status: string;
  estimated_delivery_date: string;
  status: string;
  priority: string;
  notes: string;
  client_id: string;
  product_id: string;
  replacement_product_id: string;
  product_ids: string[];
  replacement_product_ids: string[];
  staff_id: string;
  deposit_amount: string;
}

export interface ClientForm {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  notes: string;
}

export interface ProductForm {
  product_name: string;
  serial_number: string;
  is_spare_product: boolean;
  brand: string;
  model: string;
  category: string;
  claim_type: string;
  specifications: string;
  purchase_date: string;
  warranty_period: string;
  price: string;
  status: string;
}

export interface NavItem {
  icon: React.ReactNode;
  label: string;
  id: string;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  partial?: boolean;
  created_count?: number;
  failed_count?: number;
  created_products?: Array<{
    index: number;
    product_name: string;
    product_id: number;
    product_code: string;
  }>;
  errors?: Array<{
    index: number;
    product_name?: string;
    message: string;
  }>;
  stats?: DashboardStats;
  activities?: Activity[];
  user?: User;
  recent_orders?: Order[];
  orders?: Order[];
  replacementOrders?: Order[];
  data?: Client[] | User[];
  clients?: Client[];
  products?: Product[];
  spareProducts?: Product[];
  shopClaims?: Product[];
  companyClaims?: Product[];
  sunToCompanyClaims?: Product[];
  companyToSunClaims?: Product[];
  deliveries?: Delivery[];
  notifications?: Notification[];
  token?: string;
  order_id?: number;
  client_id?: number;
  product_id?: number;
  users?: User[];
  revenue?: number;
  count?: number;
  order?: Order;
}

export interface DashboardProps {
  onLogout: () => void;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}
