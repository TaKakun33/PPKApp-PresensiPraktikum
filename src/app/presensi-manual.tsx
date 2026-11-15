// Route + penjaga peran. Isi layar ada di screens/ManualAttendanceScreen.tsx.
// Hanya asisten yang boleh membuka layar ini; praktikan dialihkan ke berandanya.
import RoleGuard from '../navigation/RoleGuard';
import ManualAttendanceScreen from '../screens/ManualAttendanceScreen';

export default function ManualAttendanceRoute() {
  return (
    <RoleGuard role="asisten">
      <ManualAttendanceScreen />
    </RoleGuard>
  );
}
