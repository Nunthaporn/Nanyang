type Props = { label: string; value: string };

export default function KpiCard({ label, value }: Props) {
  return (
    <div className="ez-kpi-card">
      <div className="ez-kpi-label">{label}</div>
      <div className="ez-kpi-value">{value}</div>
    </div>
  );
}
