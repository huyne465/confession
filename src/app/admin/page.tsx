import { AdminDashboard } from '@/components/admin/AdminDashboard';

export const metadata = {
  title: 'Quản lý nội dung',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
