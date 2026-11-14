// Route + penjaga peran. Isi layar ada di screens/ManageClassScreen.tsx (milik Hadrian, SRS-15).
// Hanya asisten yang boleh membuka layar ini (SRS-12); praktikan dialihkan ke berandanya.
import ManageClassScreen from '../screens/ManageClassScreen';
import RoleGuard from '../navigation/RoleGuard';

export default function KelasRoute() {
  return (
    <RoleGuard role="asisten">
      <ManageClassScreen />
    </RoleGuard>
  );
}
