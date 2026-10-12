import { AdminGate } from "@/components/admin/AdminGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminGate permission="manage_staff_applications">{children}</AdminGate>;
}
