// Layout tab praktikan (SRS-12, Akmal). Isi navigasi ada di src/navigation/.
import RoleGuard from '../../navigation/RoleGuard';
import RoleTabs from '../../navigation/RoleTabs';
import { PRAKTIKAN_TABS } from '../../navigation/tabConfig';

export default function PraktikanLayout() {
  return (
    <RoleGuard role="praktikan">
      <RoleTabs tabs={PRAKTIKAN_TABS} />
    </RoleGuard>
  );
}
