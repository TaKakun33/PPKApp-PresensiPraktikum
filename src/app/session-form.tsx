// Route + penjaga peran. Isi layar ada di screens/SessionFormScreen.tsx (milik Hadrian, SRS-16).
// Hanya asisten yang boleh membuka layar ini (SRS-12); praktikan dialihkan ke berandanya.
import SessionFormScreen from '../screens/SessionFormScreen';
import RoleGuard from '../navigation/RoleGuard';

export default function SessionFormRoute() {
  return (
    <RoleGuard role="asisten">
      <SessionFormScreen />
    </RoleGuard>
  );
}
