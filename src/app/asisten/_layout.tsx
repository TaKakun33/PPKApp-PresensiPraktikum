// Layout tab asisten (SRS-12, Akmal). Isi navigasi ada di src/navigation/.
import RoleGuard from '../../navigation/RoleGuard';
import RoleTabs from '../../navigation/RoleTabs';
import { ASISTEN_TABS } from '../../navigation/tabConfig';

export default function AsistenLayout() {
  return (
    <RoleGuard role="asisten">
      <RoleTabs tabs={ASISTEN_TABS} />
    </RoleGuard>
  );
}
