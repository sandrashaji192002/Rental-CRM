import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { AdminLayout, MobileLayout, OpsLayout } from './layouts';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Assets from './pages/Assets';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Staff from './pages/Staff';
import Rentals from './pages/Rentals';
import NewRental from './pages/NewRental';
import RentalDetail from './pages/RentalDetail';
import Suppliers from './pages/Suppliers';
import Maintenance from './pages/Maintenance';
import Reports from './pages/Reports';

function Guard({ role, children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const mobile = pathname === '/m' || pathname.startsWith('/m/');
  if (!user) return <Navigate to={mobile ? '/m/login' : '/login'} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/ops'} replace />;
}

const adminPages = (
  <>
    <Route index element={<Dashboard />} />
    <Route path="rentals" element={<Rentals />} />
    <Route path="rentals/new" element={<NewRental />} />
    <Route path="rentals/:id" element={<RentalDetail />} />
    <Route path="products" element={<Products />} />
    <Route path="assets" element={<Assets />} />
    <Route path="customers" element={<Customers />} />
    <Route path="customers/:id" element={<CustomerDetail />} />
    <Route path="maintenance" element={<Maintenance />} />
    <Route path="suppliers" element={<Suppliers />} />
    <Route path="reports" element={<Reports />} />
    <Route path="staff" element={<Staff />} />
  </>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/m/login" element={<Login mobile />} />
      <Route
        path="/admin"
        element={
          <Guard role="admin">
            <AdminLayout />
          </Guard>
        }
      >
        {adminPages}
      </Route>
      <Route
        path="/m"
        element={
          <Guard role="admin">
            <MobileLayout />
          </Guard>
        }
      >
        {adminPages}
      </Route>
      <Route
        path="/ops"
        element={
          <Guard>
            <OpsLayout />
          </Guard>
        }
      >
        <Route index element={<Rentals />} />
        <Route path="rentals/new" element={<NewRental />} />
        <Route path="rentals/:id" element={<RentalDetail />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
