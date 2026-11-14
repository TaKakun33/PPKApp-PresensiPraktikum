// Route + penjaga login. Isi layar ada di screens/SessionDetailScreen.tsx (milik Hadrian).
// Terbuka untuk kedua peran, tetapi pengguna yang belum login dialihkan ke Login (SRS-12).
import SessionDetailScreen from '../../screens/SessionDetailScreen';
import RoleGuard from '../../navigation/RoleGuard';

export default function SessionDetailRoute() {
  return (
    <RoleGuard>
      <SessionDetailScreen />
    </RoleGuard>
  );
}
