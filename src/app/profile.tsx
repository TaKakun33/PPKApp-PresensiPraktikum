// Route + penjaga login. Isi layar ada di screens/ProfileScreen.tsx. Terbuka untuk kedua peran.
import RoleGuard from '../navigation/RoleGuard';
import ProfileScreen from '../screens/ProfileScreen';

export default function ProfileRoute() {
  return (
    <RoleGuard>
      <ProfileScreen />
    </RoleGuard>
  );
}
