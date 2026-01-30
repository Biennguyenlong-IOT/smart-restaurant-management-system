
import { MenuItem } from './types';

export const INITIAL_MENU: MenuItem[] = [
  { id: 'b1', name: 'Bò Lúc Lắc', price: 150000, category: 'Bò', image: 'https://picsum.photos/seed/beef1/400/300', description: 'Bò xào mềm với rau củ' },
  { id: 'b2', name: 'Bò Bít Tết', price: 250000, category: 'Bò', image: 'https://picsum.photos/seed/beef2/400/300', description: 'Bò Mỹ hảo hạng' },
  { id: 'c1', name: 'Cá Kho Tộ', price: 120000, category: 'Cá', image: 'https://picsum.photos/seed/fish1/400/300', description: 'Cá lóc kho tộ đậm đà' },
  { id: 'c2', name: 'Cá Chiên Xù', price: 180000, category: 'Cá', image: 'https://picsum.photos/seed/fish2/400/300', description: 'Cá điêu hồng chiên xù giòn tan' },
  { id: 'h1', name: 'Tôm Sú Nướng Mối Ớt', price: 320000, category: 'Hải Sản', image: 'https://picsum.photos/seed/seafood1/400/300', description: 'Tôm tươi nướng muối ớt' },
  { id: 'h2', name: 'Cua Rang Me', price: 450000, category: 'Hải Sản', image: 'https://picsum.photos/seed/seafood2/400/300', description: 'Cua gạch rang me chua ngọt' },
  { id: 'd1', name: 'Nước Ngọt', price: 15000, category: 'Đồ Uống', image: 'https://picsum.photos/seed/drink1/400/300', description: 'Coca, Pepsi, 7up' },
  { id: 'd2', name: 'Bia Heineken', price: 25000, category: 'Đồ Uống', image: 'https://picsum.photos/seed/drink2/400/300', description: 'Bia lon lạnh' },
];

export const CATEGORIES = ['Tất cả', 'Bò', 'Cá', 'Hải Sản', 'Đồ Uống'];
