import { CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type UpcomingExpiration = {
  id: string;
  name: string;
  plan?: string;
  nextPayment: Date;
};

type UpcomingExpirationsCardProps = {
  entries: UpcomingExpiration[];
  today: Date;
};

export function UpcomingExpirationsCard({ entries, today }: UpcomingExpirationsCardProps) {
  if (entries.length === 0) return null;

  return <Card>
    <CardHeader><CardTitle className="flex items-center"><CalendarDays className="mr-2 h-5 w-5" />Próximos Vencimientos</CardTitle></CardHeader>
    <CardContent><Table><TableHeader><TableRow><TableHead>Socio</TableHead><TableHead>Plan</TableHead><TableHead>Vencimiento</TableHead><TableHead>Días Restantes</TableHead></TableRow></TableHeader><TableBody>
      {entries.map((member) => {
        const daysUntilExpiration = Math.ceil((member.nextPayment.getTime() - today.getTime()) / 86400000);
        return <TableRow key={member.id}><TableCell className="font-medium">{member.name}</TableCell><TableCell>{member.plan}</TableCell><TableCell>{member.nextPayment.toLocaleDateString()}</TableCell><TableCell><Badge variant={daysUntilExpiration <= 3 ? "destructive" : "secondary"}>{daysUntilExpiration === 0 ? "Hoy" : `${daysUntilExpiration} días`}</Badge></TableCell></TableRow>;
      })}
    </TableBody></Table></CardContent>
  </Card>;
}
