// Route + penjaga login. Isi layar ada di screens/NotificationsScreen.tsx. 
import RoleGuard from '../navigation/RoleGuard';
import NotificationsScreen from '../screens/NotificationsScreen';

export default function NotificationsRoute() {
  return (
    <RoleGuard>
      <NotificationsScreen />
    </RoleGuard>
  );
}
