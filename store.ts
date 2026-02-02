
import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, set, get, Database } from 'firebase/database';
import { getRemoteDatabase } from './firebase';
import { Table, TableStatus, MenuItem, OrderItem, OrderItemStatus, HistoryEntry, AppNotification, UserRole, User, BankConfig } from './types';
import { INITIAL_MENU } from './constants';

const CLOUD_CONFIG_KEY = 'resto_v5_url_v2';
const DEFAULT_CLOUD_URL = 'https://smart-resto-e3a59-default-rtdb.asia-southeast1.firebasedatabase.app/';

const DEFAULT_USERS: User[] = [
  { id: 'u-admin', username: 'admin', password: '123', role: UserRole.ADMIN, fullName: 'Quản lý Tổng' },
  { id: 'u-staff', username: 'staff', password: '123', role: UserRole.STAFF, fullName: 'Phục vụ' },
  { id: 'u-kitchen', username: 'kitchen', password: '123', role: UserRole.KITCHEN, fullName: 'Bếp trưởng' }
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
}

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
    return localStorage.getItem(CLOUD_CONFIG_KEY) || DEFAULT_CLOUD_URL;
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
      throw e;
    }
  }, []);

  return {
    tables, menu, history, notifications, users, bankConfig, syncStatus, cloudUrl,
    updateCloudUrl: (u: string) => { 
      setCloudUrl(u); 
      localStorage.setItem(CLOUD_CONFIG_KEY, u);
      isInitialLoad.current = true;
    },
    
    updateBankConfig: async (config: BankConfig) => {
      await pushToCloud({ bankConfig: config });
    },
    
    placeOrder: async (tid: number, items: OrderItem[]) => {
      const targetTable = tables.find(t => t.id === tid);
      if (!targetTable) throw new Error("Table not found");
      const existingOrders = targetTable.currentOrders || [];
      const updatedTables = tables.map(t => 
        t.id === tid 
          ? { ...t, currentOrders: [...existingOrders, ...items], status: TableStatus.OCCUPIED } 
          : t
      );
      const nnotif: AppNotification = { 
        id: `O-${Date.now()}`, 
        targetRole: UserRole.STAFF, 
        title: 'Món mới', 
        message: `Bàn ${tid} gọi thêm món.`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'order',
        payload: { tableId: tid }
      };
      await pushToCloud({ tables: updatedTables, notifications: [nnotif, ...notifications] });
    },

    confirmBulkOrders: async (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, currentOrders: t.currentOrders.map(o => o.status === OrderItemStatus.PENDING ? { ...o, status: OrderItemStatus.CONFIRMED } : o) } : t);
      const kitchenNotif: AppNotification = {
        id: `K-${Date.now()}`,
        targetRole: UserRole.KITCHEN,
        title: 'Bếp ơi có món',
        message: `Bàn ${tid} đã duyệt món.`,
        timestamp: Date.now(),
        read: false,
        type: 'order'
      };
      await pushToCloud({ tables: nt, notifications: [kitchenNotif, ...notifications] });
    },

    updateOrderItemStatus: async (tid: number, oid: string, s: OrderItemStatus) => {
      const nt = tables.map(t => t.id === tid ? { ...t, currentOrders: t.currentOrders.map(o => o.id === oid ? { ...o, status: s } : o) } : t);
      if (s === OrderItemStatus.READY) {
        const item = tables.find(t => t.id === tid)?.currentOrders.find(o => o.id === oid);
        const staffNotif: AppNotification = {
            id: `R-${Date.now()}`,
            targetRole: UserRole.STAFF,
            title: 'Món đã xong',
            message: `Bàn ${tid}: ${item?.name} đã xong.`,
            timestamp: Date.now(),
            read: false,
            type: 'kitchen'
        };
        await pushToCloud({ tables: nt, notifications: [staffNotif, ...notifications] });
        return;
      }
      await pushToCloud({ tables: nt });
    },

    cancelOrderItem: async (tid: number, oid: string) => {
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
        title: 'Huỷ món', 
        message: `Bàn ${tid} huỷ món ${item.name}.`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'system' 
      };
      await pushToCloud({ tables: nt, notifications: [nnotif, ...notifications] });
    },

    requestTableQr: async (tid: number, sid: string) => {
      const nt = tables.map(t => t.id === tid ? { ...t, qrRequested: true, claimedBy: sid } : t);
      const nnotif: AppNotification = { 
        id: `QR-REQ-${Date.now()}`, 
        targetRole: UserRole.ADMIN, 
        title: 'Yêu cầu mở bàn', 
        message: `Bàn ${tid} cần mở QR.`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'qr_request',
        payload: { tableId: tid, staffId: sid }
      };
      await pushToCloud({ tables: nt, notifications: [nnotif, ...notifications] });
    },

    approveTableQr: async (nid: string) => {
      const notif = notifications.find(n => n.id === nid);
      if (!notif?.payload) return;
      const { tableId, staffId } = notif.payload;
      const token = Math.random().toString(36).substring(2, 9).toUpperCase();
      const nt = tables.map(t => t.id === tableId ? { ...t, qrRequested: false, status: TableStatus.OCCUPIED, sessionToken: token, claimedBy: staffId } : t);
      const staffNotif: AppNotification = {
        id: `QR-OK-${Date.now()}`,
        targetRole: UserRole.STAFF,
        title: 'Đã mở bàn',
        message: `Mã QR Bàn ${tableId} đã sẵn sàng.`,
        timestamp: Date.now(),
        read: false,
        type: 'system'
      };
      await pushToCloud({ tables: nt, notifications: [staffNotif, ...notifications.filter(n => n.id !== nid)] });
    },

    requestMoveTable: async (fromId: number, toId: number, type: 'SWAP' | 'MERGE', staffId: string) => {
      const nnotif: AppNotification = { 
        id: `MOVE-REQ-${Date.now()}`, 
        targetRole: UserRole.ADMIN, 
        title: type === 'SWAP' ? 'Yêu cầu đổi bàn' : 'Yêu cầu gộp bàn', 
        message: `NV ${staffId} yêu cầu ${type === 'SWAP' ? 'đổi' : 'gộp'} bàn ${fromId} sang ${toId}.`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'move_request',
        payload: { fromId, toId, type, staffId }
      };
      await pushToCloud({ notifications: [nnotif, ...notifications] });
    },

    approveMoveTable: async (nid: string) => {
      const notif = notifications.find(n => n.id === nid);
      if (!notif?.payload) return;
      const { fromId, toId, type } = notif.payload;
      
      const tableFrom = tables.find(t => t.id === fromId);
      const tableTo = tables.find(t => t.id === toId);
      
      if (!tableFrom || !tableTo) return;

      let nt = [...tables];
      if (type === 'SWAP') {
        nt = tables.map(t => {
          if (t.id === fromId) return { ...t, status: TableStatus.AVAILABLE, currentOrders: [], sessionToken: null, claimedBy: null };
          if (t.id === toId) return { ...t, status: tableFrom.status, currentOrders: tableFrom.currentOrders, sessionToken: tableFrom.sessionToken, claimedBy: tableFrom.claimedBy };
          return t;
        });
      } else { // MERGE
        nt = tables.map(t => {
          if (t.id === fromId) return { ...t, status: TableStatus.AVAILABLE, currentOrders: [], sessionToken: null, claimedBy: null };
          if (t.id === toId) return { ...t, currentOrders: [...tableTo.currentOrders, ...tableFrom.currentOrders], status: TableStatus.OCCUPIED };
          return t;
        });
      }
      
      await pushToCloud({ tables: nt, notifications: notifications.filter(n => n.id !== nid) });
    },

    requestPayment: async (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.PAYING } : t);
      const nnotif: AppNotification = { 
        id: `PAY-${Date.now()}`, 
        targetRole: UserRole.STAFF, 
        title: 'Khách thanh toán', 
        message: `Bàn ${tid} yêu cầu tính tiền.`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'payment' 
      };
      await pushToCloud({ tables: nt, notifications: [nnotif, ...notifications] });
    },

    confirmPayment: async (tid: number) => {
      const table = tables.find(t => t.id === tid);
      if (!table) return;
      const h: HistoryEntry = { 
        id: `H-${Date.now()}`, 
        tableId: tid, 
        total: table.currentOrders.filter(o => o.status !== OrderItemStatus.CANCELLED).reduce((s, o) => s + (o.price * o.quantity), 0), 
        items: table.currentOrders, 
        date: new Date().toLocaleString() 
      };
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.BILLING } : t);
      const staffNotif: AppNotification = {
        id: `CLEAN-${Date.now()}`,
        targetRole: UserRole.STAFF,
        title: 'Dọn dẹp bàn',
        message: `Bàn ${tid} đã thanh toán, hãy dọn dẹp.`,
        timestamp: Date.now(),
        read: false,
        type: 'system'
      };
      await pushToCloud({ tables: nt, history: [h, ...history], notifications: [staffNotif, ...notifications] });
    },

    adminForceClose: async (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null, qrRequested: false } : t);
      await pushToCloud({ tables: nt });
    },

    upsertMenuItem: async (item: MenuItem) => {
      const nm = menu.find(m => m.id === item.id) ? menu.map(m => m.id === item.id ? item : m) : [...menu, item];
      await pushToCloud({ menu: nm });
    },

    deleteMenuItem: async (id: string) => {
      const nm = menu.filter(m => m.id !== id);
      await pushToCloud({ menu: nm });
    },

    upsertUser: async (u: User) => {
      const nu = users.find(x => x.id === u.id) ? users.map(x => x.id === u.id ? u : x) : [...users, u];
      await pushToCloud({ users: nu });
    },

    deleteUser: async (id: string) => {
      const nu = users.filter(u => u.id !== id);
      await pushToCloud({ users: nu });
    },

    deleteNotification: async (id: string) => await pushToCloud({ notifications: notifications.filter(n => n.id !== id) }),
    
    setTableEmpty: async (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null, qrRequested: false } : t);
      await pushToCloud({ tables: nt });
    }
  };
};
