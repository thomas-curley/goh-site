import { AdminGate } from "@/components/admin/AdminGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminGate permission="manage_member_profiles">{children}</AdminGate>;
}
