import React, { useState, useMemo } from 'react';
import { OrderItem, OrderItemStatus, TableStatus, UserRole, Table, OrderType, MenuItem, AppNotification, User } from '../types.ts';
import { ConfirmModal } from '../App.tsx';
import { CATEGORIES } from '../constants';
import { PlusCircle, Utensils, Search, X, Bell, Trash2, ChevronRight, QrCode, LogOut, CheckCheck, MoveHorizontal, Merge, Sparkles, Eraser, Loader2 } from 'lucide-react';
import { ensureArray } from '../store.ts';

interface StaffViewProps { store: any; currentUser: User; }

const StaffView: React.FC<StaffViewProps> = ({ store, currentUser }) => {
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, { qty: number, note: string }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'TABLES' | 'ORDER' | 'PAYMENTS'>('TABLES');
  const [showBillTableId, setShowBillTableId] = useState<number | null>(null);
  const [quickActionTable, setQuickActionTable] = useState<Table | null>(null);
  const [showQrModal, setShowQrModal] = useState<Table | null>(null);
  const [moveRequest, setMoveRequest] = useState<{fromId: number, mode: 'MOVE' | 'MERGE'} | null>(null);

  const visibleTables = useMemo(() => {
    return ensureArray<Table>(store.tables).filter((t: Table) => {
      if (t.id === 0) return true;
      if (t.status === TableStatus.AVAILABLE || t.qrRequested) return true;
      return t.claimedBy === currentUser.id;
    });
  }, [store.tables, currentUser.id]);

  const activeTableCount = useMemo(() => 
    ensureArray<Table>(store.tables).filter((t: Table) => t.claimedBy === currentUser.id && t.id !== 0 && t.status !== TableStatus.AVAILABLE && t.status !== TableStatus.CLEANING).length
  , [store.tables, currentUser.id]);

  const myNotifications = useMemo(() => {
    return ensureArray<AppNotification>(store.notifications).filter((n: AppNotification) => 
        !n.read && 
        n.targetRole === UserRole.STAFF && 
        (!n.payload || n.payload.claimedBy === currentUser.id || n.payload.tableId === 0)
    );
  }, [store.notifications, currentUser.id]);

  const handlePlaceStaffOrder = async () => {
    if (selectedTableId === null) return alert("Vui lòng chọn bàn!");
    if (Object.keys(cart).length === 0) return alert("Vui lòng chọn món!");
    
    const newItems: OrderItem[] = (Object.entries(cart) as [string, { qty: number, note: string }][])
      .map(([id, data]) => {
        const m = store.menu.find((x: MenuItem) => x.id === id);
        return {
          id: `ST-${Date.now()}-${id}`, menuItemId: id, name: m?.name || '',
          price: m?.price || 0, quantity: data.qty, status: OrderItemStatus.CONFIRMED,
          timestamp: Date.now(), note: data.note
        };
      });

    try {
      await store.placeOrder(selectedTableId, newItems, selectedTableId === 0 ? OrderType.TAKEAWAY : OrderType.DINE_IN);
      setCart({}); setSelectedTableId(null); setActiveTab('TABLES');
    } catch (e) { alert("Lỗi đặt đơn!"); }
  };

  return (
    <div className="flex flex-col h-full max-w-full overflow-hidden animate-fadeIn pb-12">
      <div className="bg-white px-5 py-3 border-b border-slate-100 flex justify-between items-center shrink-0">
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black italic shadow-lg">S</div>
           <div>
             <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Nhân viên</p>
             <p className="text-xs font-black text-slate-800 uppercase italic leading-none">{currentUser.fullName}</p>
           </div>
         </div>
         <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <div className={`w-2 h-2 rounded-full ${activeTableCount >= 3 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[9px] font-black uppercase text-slate-600">{activeTableCount}/3 bàn</span>
         </div>
      </div>

      <div className="bg-white p-2 border-b border-slate-200 shrink-0">
        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
          <button onClick={() => setActiveTab('TABLES')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'TABLES' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Utensils size={14}/> Sơ đồ</button>
          <button onClick={() => setActiveTab('ORDER')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'ORDER' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><PlusCircle size={14}/> Gọi món</button>
          <button onClick={() => setActiveTab('PAYMENTS')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'PAYMENTS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><CheckCheck size={14}/> Bill</button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50">
        {activeTab === 'TABLES' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {myNotifications.length > 0 && (
                <section className="bg-slate-900 text-white rounded-[2rem] p-5 shadow-xl border border-white/5 animate-slideUp">
                    <div className="flex items-center gap-2 mb-4">
                        <Bell size={16} className="text-orange-500 animate-bounce" />
                        <h4 className="text-[10px] font-black uppercase italic tracking-widest text-slate-400">Thông báo ({myNotifications.length})</h4>
                    </div>
                </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffView;
