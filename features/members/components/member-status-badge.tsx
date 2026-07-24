import { Badge } from "@/components/ui/badge";

type MemberStatusBadgeProps = {
  status: "active" | "expired" | "inactive";
  inactiveLevel?: "green" | "yellow" | "red";
};

/** Shared, visual-only representation of a member status. */
export function MemberStatusBadge({ status, inactiveLevel }: MemberStatusBadgeProps) {
  if (status === "active") return <Badge variant="default">Activo</Badge>;
  if (status === "expired") return <Badge variant="destructive">Vencido</Badge>;

  const color = inactiveLevel === "green"
    ? "bg-green-500"
    : inactiveLevel === "yellow"
      ? "bg-yellow-500"
      : "bg-red-500";

  return <Badge className={`${color} text-white`}>Inactivo</Badge>;
}
