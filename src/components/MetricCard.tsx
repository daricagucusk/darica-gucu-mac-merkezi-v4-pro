type MetricCardProps = {
  label: string;
  value: string | number;
  detail: string;
  tone: 'emerald' | 'cyan' | 'amber' | 'coral' | 'violet';
  icon: string;
};

export default function MetricCard({ label, value, detail, tone, icon }: MetricCardProps) {
  return (
    <article className={`metric-card glass-card tone-${tone}`}>
      <div className="metric-card-top">
        <span className="metric-icon" aria-hidden="true">{icon}</span>
        <span className="metric-label">{label}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
      <span className="metric-glow" aria-hidden="true" />
    </article>
  );
}
