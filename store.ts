
import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, set, Database } from 'firebase/database';
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

/**
 * Đảm bảo dữ liệu từ Firebase (đôi khi là object với key số) luôn được xử lý như mảng.
 */
export const ensureArray = <T>(val: any): T[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.values(val) as T[];
};

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
          const rawTables = ensureArray<Table>(data.tables);
          if (!rawTables.find((t:any) => t.id === 0)) {
            rawTables.unshift({ id: 0, status: TableStatus.AVAILABLE, currentOrders: [], orderType: OrderType.TAKEAWAY });
          }
          // Đảm bảo currentOrders trong mỗi bàn cũng là mảng
          const processedTables = rawTables.map(t => ({
            ...t,
            currentOrders: ensureArray<OrderItem>(t.currentOrders)
          }));
          
          setTables(processedTables);
          setMenu(ensureArray<MenuItem>(data.menu || INITIAL_MENU));
          setHistory(ensureArray<HistoryEntry>(data.history));
          setNotifications(ensureArray<AppNotification>(data.notifications));
          setUsers(ensureArray<User>(data.users || DEFAULT_USERS));
          setBankConfig(data.bankConfig || DEFAULT_BANK);
          setReviews(ensureArray<Review>(data.reviews));
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
      const cleanUpdates = sanitizeForFirebase(updates);
      await set(dataRef, {
        tables, menu, history, notifications, users, bankConfig, reviews, 
        ...cleanUpdates,
        lastUpdated: Date.now()
      });
    } catch (e) { console.error("Push failed:", e); throw e; }
  }, [tables, menu, history, notifications, users, bankConfig, reviews]);

  return {
    tables, menu, history, notifications, users, bankConfig, reviews, syncStatus, cloudUrl,
    updateCloudUrl: (u: string) => { 
      setCloudUrl(u); 
      localStorage.setItem(CLOUD_CONFIG_KEY, u);
      isInitialLoad.current = true;
    },

    requestTableMove: async (fromId: number, toId: number, sid: string) => {
        const nnotif: AppNotification = {
            id: `MOVE-${Date.now()}`, targetRole: UserRole.ADMIN, title: 'Yêu cầu chuyển/gộp bàn',
            message: `Yêu cầu: Bàn ${fromId} -> Bàn ${toId}.`, timestamp: Date.now(), read: false,
            type: 'move_request', payload: { fromId, toId, staffId: sid }
        };
        await pushToCloud({ notifications: [nnotif, ...notifications] });
    },

    approveTableMove: async (nid: string) => {
        const notif = notifications.find(n => n.id === nid);
        if (!notif?.payload) return;
        const { fromId, toId } = notif.payload;
        const fromTable = tables.find(t => t.id === fromId);
        const toTable = tables.find(t => t.id === toId);
        if (!fromTable || !toTable) return;

        const nt = tables.map(t => {
            if (t.id === toId) {
                const mergedOrders = [...(ensureArray<OrderItem>(toTable.currentOrders)), ...(ensureArray<OrderItem>(fromTable.currentOrders))];
                return { 
                    ...t, 
                    status: TableStatus.OCCUPIED, 
                    currentOrders: mergedOrders, 
                    sessionToken: toTable.status === TableStatus.AVAILABLE ? fromTable.sessionToken : toTable.sessionToken,
                    claimedBy: toTable.claimedBy || fromTable.claimedBy, 
                    orderType: toTable.orderType 
                };
            }
            if (t.id === fromId) return { ...t, status: TableStatus.AVAILABLE, currentOrders: [], sessionToken: null, claimedBy: null, qrRequested: false };
            return t;
        });
        await pushToCloud({ tables: nt, notifications: notifications.filter(n => n.id !== nid) });
    },
    
    toggleMenuItemAvailability: async (id: string) => {
      const nm = menu.map(m => m.id === id ? { ...m, isAvailable: !m.isAvailable } : m);
      await pushToCloud({ menu: nm });
    },

    updateTableCount: async (count: number) => {
      if (count < 1) return;
      const currentTables = tables.filter(t => t.id !== 0);
      let newTables = [...currentTables];
      if (count > currentTables.length) {
        const extra = Array.from({ length: count - currentTables.length }, (_, i) => ({ id: currentTables.length + i + 1, status: TableStatus.AVAILABLE, currentOrders: [], orderType: OrderType.DINE_IN }));
        newTables = [...newTables, ...extra];
      } else { newTables = newTables.slice(0, count); }
      newTables.unshift({ id: 0, status: TableStatus.AVAILABLE, currentOrders: [], orderType: OrderType.TAKEAWAY });
      await pushToCloud({ tables: newTables });
    },

    updateBankConfig: async (config: BankConfig) => { await pushToCloud({ bankConfig: config }); },
    
    placeOrder: async (tid: number, items: OrderItem[], type: OrderType = OrderType.DINE_IN) => {
      const targetTable = tables.find(t => t.id === tid);
      if (!targetTable) throw new Error("Table not found");
      
      const updatedTables = tables.map(t => t.id === tid ? { 
        ...t, 
        currentOrders: [...(ensureArray<OrderItem>(t.currentOrders)), ...items], 
        status: TableStatus.OCCUPIED, 
        orderType: type 
      } : t);

      // Nếu có món đã CONFIRMED (do Staff đặt), thông báo trực tiếp cho Kitchen
      const confirmedCount = items.filter(i => i.status === OrderItemStatus.CONFIRMED).length;
      const newNotifs = [...notifications];

      if (confirmedCount > 0) {
        newNotifs.unshift({
            id: `K-DIR-${Date.now()}`,
            targetRole: UserRole.KITCHEN,
            title: '🍳 Món mới từ Phục vụ',
            message: `Bàn ${tid === 0 ? 'Khách lẻ' : tid} có ${confirmedCount} món mới trực tiếp.`,
            timestamp: Date.now(),
            read: false,
            type: 'kitchen',
            payload: { tableId: tid }
        });
      }

      // Thông báo cho Staff nếu có món PENDING (khách đặt)
      const pendingCount = items.filter(i => i.status === OrderItemStatus.PENDING).length;
      if (pendingCount > 0) {
        newNotifs.unshift({ 
            id: `O-${Date.now()}`, 
            targetRole: UserRole.STAFF, 
            title: '🔔 Khách đặt món mới', 
            message: `Bàn ${tid === 0 ? 'Khách lẻ' : tid} vừa đặt ${pendingCount} món.`, 
            timestamp: Date.now(), 
            read: false, 
            type: 'order', 
            payload: { tableId: tid, claimedBy: targetTable.claimedBy } 
        });
      }

      await pushToCloud({ tables: updatedTables, notifications: newNotifs });
    },

    confirmTableOrders: async (tid: number) => {
      const targetTable = tables.find(t => t.id === tid);
      if (!targetTable) return;
      const pendingItems = ensureArray<OrderItem>(targetTable.currentOrders).filter(o => o.status === OrderItemStatus.PENDING);
      if (pendingItems.length === 0) return;
      
      const updatedTables = tables.map(t => t.id === tid ? { ...t, currentOrders: ensureArray<OrderItem>(t.currentOrders).map(o => o.status === OrderItemStatus.PENDING ? { ...o, status: OrderItemStatus.CONFIRMED } : o) } : t);
      
      const kitchenNotif: AppNotification = { 
        id: `K-${Date.now()}`, 
        targetRole: UserRole.KITCHEN, 
        title: '🍳 Món mới đã duyệt', 
        message: `Bàn ${tid === 0 ? 'Khách lẻ' : tid} có ${pendingItems.length} món mới cần làm.`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'kitchen', 
        payload: { tableId: tid } 
      };
      
      await pushToCloud({ tables: updatedTables, notifications: [kitchenNotif, ...notifications] });
    },

    callStaff: async (tid: number) => {
      const targetTable = tables.find(t => t.id === tid);
      const nnotif: AppNotification = { id: `CALL-${Date.now()}`, targetRole: UserRole.STAFF, title: '🔔 Gọi nhân viên', message: `Bàn ${tid} đang gọi phục vụ.`, timestamp: Date.now(), read: false, type: 'call_staff', payload: { tableId: tid, claimedBy: targetTable?.claimedBy } };
      await pushToCloud({ notifications: [nnotif, ...notifications] });
    },

    updateOrderItemStatus: async (tid: number, oid: string, s: OrderItemStatus) => {
      const targetTable = tables.find(t => t.id === tid);
      const nt = tables.map(t => t.id === tid ? { ...t, currentOrders: ensureArray<OrderItem>(t.currentOrders).map(o => o.id === oid ? { ...o, status: s } : o) } : t);
      if (s === OrderItemStatus.READY) {
        const item = ensureArray<OrderItem>(targetTable?.currentOrders).find(o => o.id === oid);
        const staffNotif: AppNotification = { id: `R-${Date.now()}`, targetRole: UserRole.STAFF, title: '🍳 Món ăn đã xong', message: `Bàn ${tid === 0 ? 'Khách lẻ' : tid}: ${item?.name} đã làm xong.`, timestamp: Date.now(), read: false, type: 'kitchen', payload: { tableId: tid, claimedBy: targetTable?.claimedBy, itemId: oid } };
        await pushToCloud({ tables: nt, notifications: [staffNotif, ...notifications] });
        return;
      }
      await pushToCloud({ tables: nt });
    },

    cancelOrderItem: async (tid: number, oid: string) => {
      const table = tables.find(t => t.id === tid);
      const item = ensureArray<OrderItem>(table?.currentOrders).find(o => o.id === oid);
      if (!item) return;
      
      const nt = tables.map(t => t.id === tid ? { 
        ...t, 
        currentOrders: ensureArray<OrderItem>(t.currentOrders).map(o => (o.id === oid && (o.status === OrderItemStatus.PENDING || o.status === OrderItemStatus.CONFIRMED || o.status === OrderItemStatus.COOKING)) ? { ...o, status: OrderItemStatus.CANCELLED } : o) 
      } : t);
      
      const kitchenNotif: AppNotification = {
        id: `KC-${Date.now()}`,
        targetRole: UserRole.KITCHEN,
        title: '⚠️ Món bị hủy',
        message: `Bàn ${tid === 0 ? 'Khách lẻ' : tid} hủy: ${item.name}`,
        timestamp: Date.now(),
        read: false,
        type: 'kitchen'
      };

      await pushToCloud({ tables: nt, notifications: [kitchenNotif, ...notifications] });
    },

    requestTableQr: async (tid: number, sid: string) => {
      if (tid === 0) return;
      const staffActiveTables = tables.filter(t => t.claimedBy === sid && t.id !== 0 && t.status !== TableStatus.AVAILABLE).length;
      if (staffActiveTables >= 3) throw new Error("LIMIT_REACHED");
      const nt = tables.map(t => t.id === tid ? { ...t, qrRequested: true, claimedBy: sid } : t);
      const nnotif: AppNotification = { id: `QR-REQ-${Date.now()}`, targetRole: UserRole.ADMIN, title: 'Yêu cầu mở bàn', message: `Bàn ${tid} cần mở QR.`, timestamp: Date.now(), read: false, type: 'qr_request', payload: { tableId: tid, staffId: sid } };
      await pushToCloud({ tables: nt, notifications: [nnotif, ...notifications] });
    },

    approveTableQr: async (nid: string) => {
      const notif = notifications.find(n => n.id === nid);
      if (!notif?.payload) return;
      const { tableId, staffId } = notif.payload;
      const token = Math.random().toString(36).substring(2, 9).toUpperCase();
      
      const nt = tables.map(t => t.id === tableId ? { 
        ...t, 
        qrRequested: false, 
        status: TableStatus.OCCUPIED, 
        sessionToken: token, 
        claimedBy: staffId,
        currentOrders: [] 
      } : t);
      
      const staffNotif: AppNotification = { 
        id: `QR-OK-${Date.now()}`, 
        targetRole: UserRole.STAFF, 
        title: 'Đã mở bàn', 
        message: `Mã QR Bàn ${tableId} đã sẵn sàng.`, 
        timestamp: Date.now(), 
        read: false, 
        type: 'system', 
        payload: { tableId, claimedBy: staffId } 
      };

      await pushToCloud({ 
        tables: nt, 
        notifications: [staffNotif, ...notifications.filter(n => n.id !== nid)] 
      });
    },

    adminForceClose: async (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null, qrRequested: false } : t);
      await pushToCloud({ tables: nt });
    },

    submitReview: async (review: Review) => {
      const nr = [review, ...reviews];
      const nt = tables.map(t => t.id === review.tableId ? { ...t, status: TableStatus.CLEANING, sessionToken: null } : t);
      await pushToCloud({ reviews: nr, tables: nt });
    },

    upsertMenuItem: async (item: MenuItem) => {
      const nm = menu.find(m => m.id === item.id) ? menu.map(m => m.id === item.id ? item : m) : [...menu, { ...item, isAvailable: true }];
      await pushToCloud({ menu: nm });
    },

    deleteMenuItem: async (id: string) => {
      const nm = menu.filter(m => m.id !== id); await pushToCloud({ menu: nm });
    },

    upsertUser: async (u: User) => {
      const nu = users.find(x => x.id === u.id) ? users.map(x => x.id === u.id ? u : x) : [...users, u]; await pushToCloud({ users: nu });
    },

    deleteUser: async (id: string) => {
      const nu = users.filter(u => u.id !== id); await pushToCloud({ users: nu });
    },

    deleteNotification: async (id: string) => {
      const fn = id === 'all' ? [] : notifications.filter(n => n.id !== id);
      await pushToCloud({ notifications: fn });
    },

    clearHistory: async () => { await pushToCloud({ history: [] }); },
    clearReviews: async () => { await pushToCloud({ reviews: [] }); },
    
    requestPayment: async (tid: number) => {
      const targetTable = tables.find(t => t.id === tid);
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.PAYING } : t);
      const nnotif: AppNotification = { id: `PAY-${Date.now()}`, targetRole: UserRole.STAFF, title: 'Yêu cầu tính tiền', message: `${tid === 0 ? 'Khách lẻ' : 'Bàn ' + tid} muốn tính tiền.`, timestamp: Date.now(), read: false, type: 'payment', payload: { tableId: tid, claimedBy: targetTable?.claimedBy } };
      await pushToCloud({ tables: nt, notifications: [nnotif, ...notifications] });
    },

    confirmPayment: async (tid: number) => {
      const table = tables.find(t => t.id === tid);
      if (!table || table.status === TableStatus.AVAILABLE) return;
      
      const paidItems = ensureArray<OrderItem>(table.currentOrders).filter(o => o.status !== OrderItemStatus.CANCELLED);
      const total = paidItems.reduce((s, o) => s + (o.price * o.quantity), 0);
      const transactionId = `BILL-${table.sessionToken || 'CASH'}-${Date.now()}`;
      
      const h: HistoryEntry = { 
        id: transactionId, 
        tableId: tid, 
        staffId: table.claimedBy || 'direct',
        total, 
        items: ensureArray<OrderItem>(table.currentOrders), 
        date: new Date().toISOString(), 
        orderType: table.orderType
      };
      
      if (tid === 0) {
        const nt = tables.map(t => t.id === 0 ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null, qrRequested: false } : t);
        await pushToCloud({ tables: nt, history: [h, ...history] });
      } else {
        const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.REVIEWING } : t);
        await pushToCloud({ tables: nt, history: [h, ...history] });
      }
    },

    completeBilling: async (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.REVIEWING } : t);
      await pushToCloud({ tables: nt });
    },

    setTableEmpty: async (tid: number) => {
      const nt = tables.map(t => t.id === tid ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], claimedBy: null, sessionToken: null, qrRequested: false } : t);
      await pushToCloud({ tables: nt });
    }
  };
};
