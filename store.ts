
import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, set, get, Database } from 'firebase/database';
import { getRemoteDatabase } from './firebase';
import { Table, TableStatus, MenuItem, OrderItem, OrderItemStatus, HistoryEntry, AppNotification, UserRole, User, BankConfig } from './types';
import { INITIAL_MENU } from './constants';

const CLOUD_CONFIG_KEY = 'resto_v5_url_v2';

// Cung cấp các tài khoản mặc định để dễ dàng kiểm tra hệ thống
const DEFAULT_USERS: User[] = [
  { id: 'u-admin', username: 'admin', password: '123', role: UserRole.ADMIN, fullName: 'Quản lý Tổng' },
  { id: 'u-staff', username: 'staff', password: '123', role: UserRole.STAFF, fullName: 'Nhân viên Phục vụ' },
  { id: 'u-kitchen', username: 'kitchen', password: '123', role: UserRole.KITCHEN, fullName: 'Đầu bếp Chính' }
];

const DEFAULT_BANK: BankConfig = { bankId: 'ICB', accountNo: '', accountName: '' };

const sanitizeForFirebase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirebase);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, sanitizeForFirebase(value)])
    );
  }
  return obj;
};

export const useRestaurantStore = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  const [bankConfig, setBankConfig] = useState<BankConfig>(DEFAULT_BANK);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR' | 'SUCCESS' | 'NEED_CONFIG'>('IDLE');
  
  const [cloudUrl, setCloudUrl] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const configParam = params.get('config');
    if (configParam) {
      try {
        const decodedUrl = atob(configParam);
        if (decodedUrl.startsWith('http')) {
          localStorage.setItem(CLOUD_CONFIG_KEY, decodedUrl);
          return decodedUrl;
        }
      } catch (e) { console.error("URL Config error"); }
    }
    return localStorage.getItem(CLOUD_CONFIG_KEY) || '';
  });

  const dbRef = useRef<Database | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!cloudUrl) {
      setSyncStatus('NEED_CONFIG');
      return;
    }

    const db = getRemoteDatabase(cloudUrl);
    if (!db) {
      setSyncStatus('NEED_CONFIG');
      return;
    }

    try {
      dbRef.current = db;
      const dataRef = ref(db, 'restaurant_data');
      setSyncStatus('SYNCING');

      const unsubscribe = onValue(dataRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setTables(data.tables || []);
          setMenu(data.menu || INITIAL_MENU);
          setHistory(data.history || []);
          setNotifications(data.notifications || []);
          setUsers(data.users || DEFAULT_USERS);
          setBankConfig(data.bankConfig || DEFAULT_BANK);
          setSyncStatus('SUCCESS');
        } else if (isInitialLoad.current) {
          const initialData = {
            tables: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, status: TableStatus.AVAILABLE, currentOrders: [] })),
            menu: INITIAL_MENU,
            history: [],
            notifications: [],
            users: DEFAULT_USERS,
            bankConfig: DEFAULT_BANK,
            lastUpdated: Date.now()
          };
          set(dataRef, initialData);
        }
        isInitialLoad.current = false;
      }, (error) => {
        console.error("Firebase Sync Error:", error);
        setSyncStatus('ERROR');
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Database initialization failed:", e);
      setSyncStatus('ERROR');
    }
  }, [cloudUrl]);

  const pushToCloud = useCallback(async (updates: any) => {
    if (!dbRef.current) return;
    try {
      const dataRef = ref(dbRef.current, 'restaurant_data');
      const snapshot = await get(dataRef);
      const currentData = snapshot.val() || {};
      const cleanUpdates = sanitizeForFirebase(updates);
      const newData = { ...currentData, ...cleanUpdates, lastUpdated: Date.now() };
      await set(dataRef, newData);
    } catch (e) {
      console.error("Push failed:", e);
    }
  }, []);

  return {
    tables, menu, history, notifications, users, syncStatus, cloudUrl,
    updateCloudUrl: (u: string) => { 
      setCloudUrl(u); 
      localStorage.setItem(CLOUD_CONFIG_KEY, u);
      isInitialLoad.current = true;
    },
    
    placeOrder: (tid: number, items: OrderItem[]) => {
      const nt = tables.map(t => t.id === tid ? { ...t, currentOrders: [...t.currentOrders, ...items], status: TableStatus.OCCUPIED } : t);
      const nnotif: AppNotification = { 
        id: `O-${Date.now()}`, 
        targetRole: UserRole.STAFF, 
        title: 'Món mới chờ duyệt', 
        message: `Bàn ${tid} vừa gọi thêm ${items.length} món`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'order',
        payload: { tableId: tid }
      };
      pushToCloud({ tables: nt, notifications: [nnotif, ...notifications] });
    },

    confirmBulkOrders: (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, currentOrders: t.currentOrders.map(o => o.status === OrderItemStatus.PENDING ? { ...o, status: OrderItemStatus.CONFIRMED } : o) } : t);
      const kitchenNotif: AppNotification = {
        id: `K-${Date.now()}`,
        targetRole: UserRole.KITCHEN,
        title: 'Có món mới cần nấu',
        message: `Bàn ${tid} đã được duyệt món`,
        timestamp: Date.now(),
        read: false,
        type: 'order'
      };
      pushToCloud({ tables: nt, notifications: [kitchenNotif, ...notifications] });
    },

    updateOrderItemStatus: (tid: number, oid: string, s: OrderItemStatus) => {
      const nt = tables.map(t => t.id === tid ? { ...t, currentOrders: t.currentOrders.map(o => o.id === oid ? { ...o, status: s } : o) } : t);
      if (s === OrderItemStatus.READY) {
        const item = tables.find(t => t.id === tid)?.currentOrders.find(o => o.id === oid);
        const staffNotif: AppNotification = {
            id: `R-${Date.now()}`,
            targetRole: UserRole.STAFF,
            title: 'Món đã xong',
            message: `Bàn ${tid}: ${item?.name} đã nấu xong`,
            timestamp: Date.now(),
            read: false,
            type: 'kitchen'
        };
        pushToCloud({ tables: nt, notifications: [staffNotif, ...notifications] });
        return;
      }
      pushToCloud({ tables: nt });
    },

    cancelOrderItem: (tid: number, oid: string) => {
      const table = tables.find(t => t.id === tid);
      const item = table?.currentOrders.find(o => o.id === oid);
      if (!item) return;

      const nt = tables.map(t => t.id === tid ? { 
        ...t, 
        currentOrders: t.currentOrders.map(o => 
          (o.id === oid && (o.status === OrderItemStatus.PENDING || o.status === OrderItemStatus.CONFIRMED)) 
          ? { ...o, status: OrderItemStatus.CANCELLED } 
          : o
        ) 
      } : t);

      const nnotif: AppNotification = { 
        id: `C-${Date.now()}`, 
        targetRole: UserRole.STAFF, 
        title: 'Khách huỷ món', 
        message: `Bàn ${tid} huỷ món: ${item.name}`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'system' 
      };
      pushToCloud({ tables: nt, notifications: [nnotif, ...notifications] });
    },

    requestTableQr: (tid: number, sid: string) => {
      const nt = tables.map(t => t.id === tid ? { ...t, qrRequested: true, claimedBy: sid } : t);
      const nnotif: AppNotification = { 
        id: `QR-REQ-${Date.now()}`, 
        targetRole: UserRole.ADMIN, 
        title: 'Yêu cầu mở bàn', 
        message: `NV ${sid} yêu cầu mở bàn ${tid}`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'qr_request',
        payload: { tableId: tid, staffId: sid }
      };
      pushToCloud({ tables: nt, notifications: [nnotif, ...notifications] });
    },

    approveTableQr: (nid: string) => {
      const notif = notifications.find(n => n.id === nid);
      if (!notif?.payload) return;
      const { tableId, staffId } = notif.payload;
      const token = Math.random().toString(36).substring(2, 9).toUpperCase();
      const nt = tables.map(t => t.id === tableId ? { ...t, qrRequested: false, status: TableStatus.OCCUPIED, sessionToken: token, claimedBy: staffId } : t);
      const staffNotif: AppNotification = {
        id: `QR-OK-${Date.now()}`,
        targetRole: UserRole.STAFF,
        title: 'Bàn đã mở',
        message: `Admin đã cấp QR cho bàn ${tableId}`,
        timestamp: Date.now(),
        read: false,
        type: 'system'
      };
      pushToCloud({ tables: nt, notifications: [staffNotif, ...notifications.filter(n => n.id !== nid)] });
    },

    requestPayment: (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.PAYING } : t);
      const nnotif: AppNotification = { 
        id: `PAY-${Date.now()}`, 
        targetRole: UserRole.STAFF, 
        title: 'Yêu cầu thanh toán', 
        message: `Bàn ${tid} yêu cầu tính tiền`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'payment' 
      };
      pushToCloud({ tables: nt, notifications: [nnotif, ...notifications] });
    },

    confirmPayment: (tid: number) => {
      const table = tables.find(t => t.id === tid);
      if (!table) return;
      const h: HistoryEntry = { id: `H-${Date.now()}`, tableId: tid, total: table.currentOrders.reduce((s, o) => s + (o.price * o.quantity), 0), items: table.currentOrders, date: new Date().toLocaleString() };
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null, qrRequested: false } : t);
      pushToCloud({ tables: nt, history: [h, ...history] });
    },

    adminForceClose: (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null, qrRequested: false } : t);
      pushToCloud({ tables: nt });
    },

    upsertMenuItem: (item: MenuItem) => {
      const nm = menu.find(m => m.id === item.id) ? menu.map(m => m.id === item.id ? item : m) : [...menu, item];
      pushToCloud({ menu: nm });
    },

    deleteMenuItem: (id: string) => {
      const nm = menu.filter(m => m.id !== id);
      pushToCloud({ menu: nm });
    },

    upsertUser: (u: User) => {
      const nu = users.find(x => x.id === u.id) ? users.map(x => x.id === u.id ? u : x) : [...users, u];
      pushToCloud({ users: nu });
    },

    deleteUser: (id: string) => {
      const nu = users.filter(u => u.id !== id);
      pushToCloud({ users: nu });
    },

    deleteNotification: (id: string) => pushToCloud({ notifications: notifications.filter(n => n.id !== id) }),
    
    setTableEmpty: (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null, qrRequested: false } : t);
      pushToCloud({ tables: nt });
    }
  };
};
