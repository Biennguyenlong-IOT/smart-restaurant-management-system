
import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, set, get, Database } from 'firebase/database';
import { getRemoteDatabase } from './firebase';
import { Table, TableStatus, MenuItem, OrderItem, OrderItemStatus, HistoryEntry, AppNotification, UserRole, User, BankConfig } from './types';
import { INITIAL_MENU } from './constants';

const CLOUD_CONFIG_KEY = 'resto_v5_url_v2';
const DEFAULT_USERS: User[] = [
  { id: 'u-admin', username: 'admin', password: '123', role: UserRole.ADMIN, fullName: 'Quản lý Tổng' }
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
    // Ưu tiên 1: Cấu hình từ URL param (config=...)
    const params = new URLSearchParams(window.location.search);
    const configParam = params.get('config');
    if (configParam) {
      try {
        const decodedUrl = atob(configParam);
        if (decodedUrl.startsWith('http')) {
          localStorage.setItem(CLOUD_CONFIG_KEY, decodedUrl);
          // Không xóa ngay để effect bên dưới nhận diện được sự thay đổi
          return decodedUrl;
        }
      } catch (e) { console.error("Invalid config param"); }
    }
    // Ưu tiên 2: LocalStorage
    return localStorage.getItem(CLOUD_CONFIG_KEY) || process.env.VITE_FIREBASE_DB_URL || '';
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
      const nnotif: AppNotification = { id: `O-${Date.now()}`, targetRole: UserRole.STAFF, title: 'Món mới', message: `Bàn ${tid} gọi món`, timestamp: Date.now(), read: false, type: 'order' };
      pushToCloud({ tables: nt, notifications: [nnotif, ...notifications] });
    },

    confirmBulkOrders: (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, currentOrders: t.currentOrders.map(o => o.status === OrderItemStatus.PENDING ? { ...o, status: OrderItemStatus.CONFIRMED } : o) } : t);
      pushToCloud({ tables: nt });
    },

    updateOrderItemStatus: (tid: number, oid: string, s: OrderItemStatus) => {
      const nt = tables.map(t => t.id === tid ? { ...t, currentOrders: t.currentOrders.map(o => o.id === oid ? { ...o, status: s } : o) } : t);
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

      // Thông báo cho nhân viên biết khách huỷ món
      const nnotif: AppNotification = { id: `C-${Date.now()}`, targetRole: UserRole.STAFF, title: 'Huỷ món', message: `Bàn ${tid} huỷ: ${item.name}`, timestamp: Date.now(), read: false, type: 'system' };
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
      const { tableId } = notif.payload;
      const token = Math.random().toString(36).substring(2, 9).toUpperCase();
      const nt = tables.map(t => t.id === tableId ? { ...t, qrRequested: false, status: TableStatus.OCCUPIED, sessionToken: token } : t);
      pushToCloud({ tables: nt, notifications: notifications.filter(n => n.id !== nid) });
    },

    claimTable: (tid: number, sid: string) => {
      const nt = tables.map(t => t.id === tid ? { ...t, claimedBy: sid, status: TableStatus.OCCUPIED } : t);
      pushToCloud({ tables: nt });
    },

    requestPayment: (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.PAYING } : t);
      pushToCloud({ tables: nt });
    },

    confirmPayment: (tid: number) => {
      const table = tables.find(t => t.id === tid);
      if (!table) return;
      const h: HistoryEntry = { id: `H-${Date.now()}`, tableId: tid, total: table.currentOrders.reduce((s, o) => s + (o.price * o.quantity), 0), items: table.currentOrders, date: new Date().toLocaleString() };
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null, qrRequested: false } : t);
      pushToCloud({ tables: nt, history: [h, ...history] });
    },

    requestMoveTable: (fid: number, tid: number, ty: 'SWAP'|'MERGE', sid: string) => {
      const n: AppNotification = { id: `M-${Date.now()}`, targetRole: UserRole.ADMIN, title: 'Đổi bàn', message: `NV ${sid} yêu cầu chuyển bàn ${fid} -> ${tid}`, timestamp: Date.now(), read: false, type: 'move_request', payload: { fromId: fid, toId: tid, type: ty, staffId: sid } };
      pushToCloud({ notifications: [n, ...notifications] });
    },

    approveMoveRequest: (nid: string) => {
      const notif = notifications.find(n => n.id === nid);
      if (!notif?.payload) return;
      const { fromId, toId, type, staffId } = notif.payload;
      const fromT = tables.find(t => t.id === fromId);
      if (!fromT) return;
      const nt = tables.map(t => {
        if (t.id === fromId) return { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null, qrRequested: false };
        if (t.id === toId) return { ...t, status: TableStatus.OCCUPIED, claimedBy: staffId, sessionToken: fromT.sessionToken, currentOrders: type === 'MERGE' ? [...t.currentOrders, ...fromT.currentOrders] : fromT.currentOrders };
        return t;
      });
      pushToCloud({ tables: nt, notifications: notifications.filter(n => n.id !== nid) });
    },

    setTotalTables: (c: number) => {
      let nt = [...tables];
      if (c > nt.length) for (let i = nt.length + 1; i <= c; i++) nt.push({ id: i, status: TableStatus.AVAILABLE, currentOrders: [] });
      else nt = nt.slice(0, c);
      pushToCloud({ tables: nt });
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
    },

    saveAndPush: (tables: any, menu: any, history: any, notifications: any, users: any, bankConfig: any) => {
      pushToCloud({ tables, menu, history, notifications, users, bankConfig });
    },
    
    userHeartbeat: (id: string) => {} 
  };
};
