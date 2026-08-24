import { PAGE_BLUEPRINTS } from "../../config/erpBlueprints";
import LearningMaterialsPage from "../Resources/LearningMaterialsPage";

export default function AdminContentManagementPage() {
  const blueprint = PAGE_BLUEPRINTS["/learn/materials"];
  return <LearningMaterialsPage blueprint={blueprint} advanced adminMode />;
}
