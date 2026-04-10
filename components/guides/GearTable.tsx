import { Card } from "@/components/ui/Card";

interface GearSlot {
  slot: string;
  budget: string;
  mid: string;
  endgame: string;
}

interface GearTableProps {
  title: string;
  slots: GearSlot[];
}

export function GearTable({ title, slots }: GearTableProps) {
  return (
    <Card hover={false} className="overflow-x-auto">
      <h3 className="font-display text-lg text-gnome-green mb-3">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-bark-brown-light">
            <th className="text-left py-2 pr-4 text-iron-grey font-semibold">Slot</th>
            <th className="text-left py-2 pr-4 text-iron-grey font-semibold">Budget</th>
            <th className="text-left py-2 pr-4 text-iron-grey font-semibold">Mid-Tier</th>
            <th className="text-left py-2 text-iron-grey font-semibold">Endgame</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.slot} className="border-b border-parchment-dark last:border-0">
              <td className="py-2 pr-4 font-semibold text-bark-brown">{slot.slot}</td>
              <td className="py-2 pr-4 text-bark-brown-light">{slot.budget}</td>
              <td className="py-2 pr-4 text-bark-brown-light">{slot.mid}</td>
              <td className="py-2 text-bark-brown-light">{slot.endgame}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
