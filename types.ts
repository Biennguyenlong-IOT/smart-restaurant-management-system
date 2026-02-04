export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  KITCHEN = 'KITCHEN',
  ADMIN = 'ADMIN'
}

export enum OrderItemStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COOKING = 'COOKING',
  READY = 'READY',
  SERVED = 'SERVED',
  CANCELLED = 'CANCELLED'
}

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  PAYING = 'PAYING',
  BILLING = 'BILLING',
  REVIEWING = 'REVIEWING',
  CLEANING = 'CLEANING'
}

export enum OrderType {
  DINE_IN = 'DINE_IN',
  TAKEAWAY = 'TAKEAWAY'
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  description: string;
  isAvailable: boolean;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  status: OrderItemStatus;
  timestamp: number;
  note?: string;
  kitchenStaffId?: string; // Track who prepared this item
}

export interface Table {
  id: number;
  status: TableStatus;
  currentOrders: OrderItem[];
  orderType: OrderType;
  needsCleaning?: boolean;
  sessionToken?: string | null;
  qrRequested?: boolean;
  claimedBy?: string | null;
}

export interface Review {
  id: string;
  tableId: number;
  staffId: string;
  ratingFood: number;
  ratingService: number;
  comment: string;
  timestamp: number;
}

export interface HistoryEntry {
  id: string;
  tableId: number;
  staffId?: string;
  items: OrderItem[];
  total: number;
  date: string;
  orderType: OrderType;
}

export interface AppNotification {
  id: string;
  targetRole: UserRole;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  type: 'order' | 'kitchen' | 'payment' | 'system' | 'qr_request' | 'move_request' | 'call_staff';
  payload?: any;
}

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  fullName: string;
  lastActive?: number;
}

export interface BankConfig {
  bankId: string;
  accountNo: string;
  accountName: string;
}
