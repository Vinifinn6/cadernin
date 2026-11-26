export interface EditorialSwatch {
  hex: string;
  label: string;
}

/**
 * Paleta curada de 12 pigmentos editoriais foscos (Anti-Feiura).
 * Harmonizam naturalmente com o Modo Claro (#FAF8F5) e Modo Escuro (#181715).
 */
export const EDITORIAL_SWATCHES: EditorialSwatch[] = [
  { hex: "#5F7A61", label: "Sálvia" },
  { hex: "#C46D53", label: "Terracota" },
  { hex: "#567189", label: "Ardósia" },
  { hex: "#C99A4E", label: "Ocre" },
  { hex: "#866076", label: "Ameixa Seca" },
  { hex: "#6B7A54", label: "Musgo" },
  { hex: "#B57249", label: "Cobre" },
  { hex: "#7C7696", label: "Lavanda Poeira" },
  { hex: "#4B7479", label: "Petrol" },
  { hex: "#A66A63", label: "Argila" },
  { hex: "#85824E", label: "Oliva" },
  { hex: "#6E6963", label: "Grafite Quente" },
];

function parseHexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return {
    r: Number.parseInt(cleaned.slice(0, 2), 16),
    g: Number.parseInt(cleaned.slice(2, 4), 16),
    b: Number.parseInt(cleaned.slice(4, 6), 16),
  };
}

/**
 * Gera estilos translúcidos harmônicos para pills de matéria em ambos os temas,
 * com fallback seguro para cores antigas já salvas no banco.
 */
export function getSubjectColorStyles(hex?: string | null): {
  base: string;
  pillBg: string;
  pillBorder: string;
  textColor: string;
} {
  const fallback = "#5F7A61";
  const safeHex = hex && parseHexToRgb(hex) ? hex : fallback;
  const rgb = parseHexToRgb(safeHex) ?? { r: 95, g: 122, b: 97 };

  return {
    base: safeHex,
    pillBg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
    pillBorder: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.32)`,
    textColor: safeHex,
  };
}
