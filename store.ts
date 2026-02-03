
import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, set, get, Database } from 'firebase/database';
import { getRemoteDatabase } from './firebase';
import { Table, TableStatus, MenuItem, OrderItem, OrderItemStatus, HistoryEntry, AppNotification, UserRole, User, BankConfig, OrderType, Review } from './types';
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
  const [reviews, setReviews] = useState<Review[]>([]);
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
          // Luôn đảm bảo có Bàn 0 cho khách lẻ mang đi
          const rawTables = data.tables || [];
          if (!rawTables.find((t:any) => t.id === 0)) {
            rawTables.unshift({ id: 0, status: TableStatus.AVAILABLE, currentOrders: [], orderType: OrderType.TAKEAWAY });
          }
          setTables(rawTables);
          
          const syncedMenu = (data.menu || INITIAL_MENU).map((m: any) => ({
            ...m,
            isAvailable: m.isAvailable !== undefined ? m.isAvailable : true
          }));
          setMenu(syncedMenu);
          setHistory(data.history || []);
          setNotifications(data.notifications || []);
          setUsers(data.users || DEFAULT_USERS);
          setBankConfig(data.bankConfig || DEFAULT_BANK);
          setReviews(data.reviews || []);
          setSyncStatus('SUCCESS');
        } else if (isInitialLoad.current) {
          const initialData = {
            tables: [
                { id: 0, status: TableStatus.AVAILABLE, currentOrders: [], orderType: OrderType.TAKEAWAY },
                ...Array.from({ length: 12 }, (_, i) => ({ id: i + 1, status: TableStatus.AVAILABLE, currentOrders: [], orderType: OrderType.DINE_IN }))
            ],
            menu: INITIAL_MENU.map(m => ({ ...m, isAvailable: true })),
            history: [],
            notifications: [],
            users: DEFAULT_USERS,
            bankConfig: DEFAULT_BANK,
            reviews: [],
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
    tables, menu, history, notifications, users, bankConfig, reviews, syncStatus, cloudUrl,
    updateCloudUrl: (u: string) => { 
      setCloudUrl(u); 
      localStorage.setItem(CLOUD_CONFIG_KEY, u);
      isInitialLoad.current = true;
    },
    
    toggleMenuItemAvailability: async (id: string) => {
      const nm = menu.map(m => m.id === id ? { ...m, isAvailable: !m.isAvailable } : m);
      await pushToCloud({ menu: nm });
    },

    updateTableCount: async (count: number) => {
      if (count < 1) return;
      const currentTables = tables.filter(t => t.id !== 0);
      const currentCount = currentTables.length;
      let newTables = [...currentTables];
      if (count > currentCount) {
        const extra = Array.from({ length: count - currentCount }, (_, i) => ({
          id: currentCount + i + 1,
          status: TableStatus.AVAILABLE,
          currentOrders: [],
          orderType: OrderType.DINE_IN
        }));
        newTables = [...newTables, ...extra];
      } else {
        newTables = newTables.slice(0, count);
      }
      // Re-add table 0
      newTables.unshift({ id: 0, status: TableStatus.AVAILABLE, currentOrders: [], orderType: OrderType.TAKEAWAY });
      await pushToCloud({ tables: newTables });
    },

    updateBankConfig: async (config: BankConfig) => {
      await pushToCloud({ bankConfig: config });
    },
    
    placeOrder: async (tid: number, items: OrderItem[], type: OrderType = OrderType.DINE_IN) => {
      const targetTable = tables.find(t => t.id === tid);
      if (!targetTable) throw new Error("Table not found");
      const existingOrders = targetTable.currentOrders || [];
      const updatedTables = tables.map(t => 
        t.id === tid 
          ? { ...t, currentOrders: [...existingOrders, ...items], status: TableStatus.OCCUPIED, orderType: type } 
          : t
      );
      const nnotif: AppNotification = { 
        id: `O-${Date.now()}`, 
        targetRole: UserRole.STAFF, 
        title: type === OrderType.TAKEAWAY ? '📦 Đơn MANG VỀ' : '🍽️ Món mới', 
        message: `Bàn ${tid === 0 ? 'Khách lẻ' : tid} gọi ${items.length} món.`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'order',
        payload: { tableId: tid }
      };
      
      const kitchenNotif: AppNotification = {
        id: `K-${Date.now()}`,
        targetRole: UserRole.KITCHEN,
        title: type === OrderType.TAKEAWAY ? '📦 Đơn MANG VỀ' : '🍳 Có món mới',
        message: `Bàn ${tid === 0 ? 'Khách lẻ' : tid} có ${items.length} món mới.`,
        timestamp: Date.now(),
        read: false,
        type: 'order'
      };

      await pushToCloud({ tables: updatedTables, notifications: [nnotif, kitchenNotif, ...notifications] });
    },

    updateOrderItemStatus: async (tid: number, oid: string, s: OrderItemStatus) => {
      const nt = tables.map(t => t.id === tid ? { ...t, currentOrders: t.currentOrders.map(o => o.id === oid ? { ...o, status: s } : o) } : t);
      if (s === OrderItemStatus.READY) {
        const item = tables.find(t => t.id === tid)?.currentOrders.find(o => o.id === oid);
        const staffNotif: AppNotification = {
            id: `R-${Date.now()}`,
            targetRole: UserRole.STAFF,
            title: 'Món đã xong',
            message: `Bàn ${tid === 0 ? 'Khách lẻ' : tid}: ${item?.name} đã xong.`,
            timestamp: Date.now(),
            read: false,
            type: 'kitchen'
        };
        await pushToCloud({ tables: nt, notifications: [staffNotif, ...notifications] });
        return;
      }
      await pushToCloud({ tables: nt }); // Sửa lỗi: Cập nhật tables thay vì nt
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
        message: `Bàn ${tid === 0 ? 'Khách lẻ' : tid} huỷ món ${item.name}.`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'system' 
      };
      await pushToCloud({ tables: nt, notifications: [nnotif, ...notifications] });
    },

    requestTableQr: async (tid: number, sid: string) => {
      if (tid === 0) return; // Bàn 0 không cần quét QR
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
      await pushToCloud({ tables: nt, notifications: notifications.filter(n => n.id !== nid) });
      await pushToCloud({ notifications: [staffNotif, ...notifications.filter(n => n.id !== nid)] });
    },

    requestPayment: async (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.PAYING } : t);
      const nnotif: AppNotification = { 
        id: `PAY-${Date.now()}`, 
        targetRole: UserRole.STAFF, 
        title: 'Yêu cầu tính tiền', 
        message: `${tid === 0 ? 'Khách lẻ mang đi' : 'Bàn ' + tid} muốn tính tiền.`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'payment',
        payload: { tableId: tid }
      };
      await pushToCloud({ tables: nt, notifications: [nnotif, ...notifications] });
    },

    confirmPayment: async (tid: number) => {
      const table = tables.find(t => t.id === tid);
      if (!table) return;
      const h: HistoryEntry = { 
        id: `H-${Date.now()}`, 
        tableId: tid, 
        staffId: table.claimedBy || 'staff_direct',
        total: table.currentOrders.filter(o => o.status !== OrderItemStatus.CANCELLED).reduce((s, o) => s + (o.price * o.quantity), 0), 
        items: table.currentOrders, 
        date: new Date().toISOString(),
        orderType: table.orderType
      };
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.BILLING } : t);
      await pushToCloud({ tables: nt, history: [h, ...history], notifications: notifications });
    },

    completeBilling: async (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null } : t);
      await pushToCloud({ tables: nt });
    },

    adminForceClose: async (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null, qrRequested: false } : t);
      await pushToCloud({ tables: nt });
    },

    submitReview: async (review: Review) => {
      const nr = [review, ...reviews];
      const nt = tables.map(t => t.id === review.tableId ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null } : t);
      await pushToCloud({ reviews: nr, tables: nt });
    },

    upsertMenuItem: async (item: MenuItem) => {
      const nm = menu.find(m => m.id === item.id) ? menu.map(m => m.id === item.id ? item : m) : [...menu, { ...item, isAvailable: true }];
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

    deleteNotification: async (id: string) => {
      const filteredNotifs = notifications.filter(n => n.id !== id);
      await pushToCloud({ notifications: filteredNotifs });
    },
    
    setTableEmpty: async (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null, qrRequested: false } : t);
      await pushToCloud({ tables: nt });
    }
  };
};
