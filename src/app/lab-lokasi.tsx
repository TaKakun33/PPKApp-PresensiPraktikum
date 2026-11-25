import LabLocationScreen from '../screens/LabLocationScreen';
import RoleGuard from '../navigation/RoleGuard';

export default function LabLocationRoute() {
  return (
    <RoleGuard role="asisten">
      <LabLocationScreen />
    </RoleGuard>
  );
}
