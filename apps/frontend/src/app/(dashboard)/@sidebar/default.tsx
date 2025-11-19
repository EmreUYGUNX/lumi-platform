import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { getCurrentUser, resolvePreviewUser } from "@/lib/session";

export default async function DashboardSidebarSlot(): Promise<JSX.Element> {
  const user = (await getCurrentUser()) ?? resolvePreviewUser();
  return <DashboardSidebar user={user} />;
}
