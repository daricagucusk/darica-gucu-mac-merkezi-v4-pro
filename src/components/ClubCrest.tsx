export const CREST_SRC = '/brand/darica-gucu-arma.png';

export default function ClubCrest({ className }: { className?: string }) {
  return <img className={className} src={CREST_SRC} alt="Darıca Gücü Spor Kulübü arması" width="512" height="512" decoding="async" />;
}
