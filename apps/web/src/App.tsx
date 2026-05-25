import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { MerchantLayout } from './pages/merchant/Layout';
import { MerchantHome } from './pages/merchant/Home';
import { MerchantCoupons } from './pages/merchant/Coupons';
import { MerchantLicense } from './pages/merchant/License';
import { MerchantConnect } from './pages/merchant/Connect';
import { MerchantStoreDoctor } from './pages/merchant/StoreDoctor';
import { MerchantAutomations } from './pages/merchant/Automations';
import { MerchantCampaigns } from './pages/merchant/Campaigns';
import { MerchantSegments } from './pages/merchant/Segments';
import { MerchantCustomers } from './pages/merchant/Customers';
import { MerchantEmailDesigner } from './pages/merchant/EmailDesigner';
import { MerchantDeliverability } from './pages/merchant/Deliverability';
import { MerchantReports } from './pages/merchant/Reports';
import { MerchantAgency } from './pages/merchant/Agency';
import { AdminLayout } from './pages/admin/Layout';
import { AdminOverview } from './pages/admin/Overview';
import { AdminLicenses } from './pages/admin/Licenses';
import type { ReactNode } from 'react';

function Protected({ children, staff }: { children: ReactNode; staff?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container" style={{ paddingTop: 40 }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (staff && !['super_admin', 'support'].includes(user.role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/app"
        element={
          <Protected>
            <MerchantLayout />
          </Protected>
        }
      >
        <Route index element={<MerchantHome />} />
        <Route path="store-doctor" element={<MerchantStoreDoctor />} />
        <Route path="automations" element={<MerchantAutomations />} />
        <Route path="campaigns" element={<MerchantCampaigns />} />
        <Route path="coupons" element={<MerchantCoupons />} />
        <Route path="segments" element={<MerchantSegments />} />
        <Route path="customers" element={<MerchantCustomers />} />
        <Route path="email-designer" element={<MerchantEmailDesigner />} />
        <Route path="deliverability" element={<MerchantDeliverability />} />
        <Route path="reports" element={<MerchantReports />} />
        <Route path="agency" element={<MerchantAgency />} />
        <Route path="license" element={<MerchantLicense />} />
        <Route path="connect" element={<MerchantConnect />} />
      </Route>

      <Route
        path="/admin"
        element={
          <Protected staff>
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<AdminOverview />} />
        <Route path="licenses" element={<AdminLicenses />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
