const Palette = [
  "#4f46e5",
  "#0f766e",
  "#b45309",
  "#be185d",
  "#1d4ed8",
  "#15803d",
];

function initialsOf(Name: string): string {
  const Parts = Name.trim().split(/\s+/).filter(Boolean);
  if (Parts.length === 0) return "?";
  if (Parts.length === 1) return Parts[0].slice(0, 2).toUpperCase();
  return `${Parts[0][0]}${Parts[Parts.length - 1][0]}`.toUpperCase();
}

function colorFor(Name: string): string {
  let Hash = 0;
  for (let I = 0; I < Name.length; I += 1)
    Hash = (Hash * 31 + Name.charCodeAt(I)) % Palette.length;
  return Palette[Math.abs(Hash) % Palette.length];
}

interface AvatarProps {
  name: string;
}

export default function Avatar({ name: Name }: AvatarProps) {
  return (
    <span className="avatar" style={{ backgroundColor: colorFor(Name) }}>
      {initialsOf(Name)}
    </span>
  );
}
