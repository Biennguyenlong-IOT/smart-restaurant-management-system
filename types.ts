
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
  SERVED = 'SERVED'
}

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  PAYING = 'PAYING',
  BILLING = 'BILLING'
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  description: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  status: OrderItemStatus;
  timestamp: number;
}

export interface Table {
  id: number;
  status: TableStatus;
  currentOrders: OrderItem[];
  needsCleaning?: boolean;
  sessionToken?: string; // Token duy nhất cho mỗi lượt khách
  qrRequested?: boolean; // Đánh dấu đang chờ Admin cấp QR
}

export interface HistoryEntry {
  id: string;
  tableId: number;
  items: OrderItem[];
  total: number;
  date: string;
}

export interface AppNotification {
  id: string;
  targetRole: UserRole;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  type: 'order' | 'kitchen' | 'payment' | 'system' | 'qr_request';
}

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  fullName: string;
}

export interface BankConfig {
  bankId: string;
  accountNo: string;
  accountName: string;
}
