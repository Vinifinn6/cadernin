import React from "react";
import {
  Atom,
  BookOpen,
  BookOpenText,
  Brain,
  Calculator,
  Compass,
  Dna,
  Flask,
  Function as FunctionIcon,
  GlobeHemisphereWest,
  GraduationCap,
  Heartbeat,
  Hourglass,
  Leaf,
  Lightning,
  MusicNotes,
  Notebook,
  Palette,
  PenNib,
  Planet,
  Scales,
  Scroll,
  TextAa,
  Translate,
} from "@phosphor-icons/react";

export type SubjectIconComponent = React.ComponentType<{
  size?: number;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  className?: string;
}>;

export interface SubjectIconOption {
  name: string;
  label: string;
  icon: SubjectIconComponent;
}

export const SUBJECT_ICON_OPTIONS: SubjectIconOption[] = [
  { name: "BookOpen", label: "Livro", icon: BookOpen },
  { name: "Function", label: "Matemática", icon: FunctionIcon },
  { name: "Calculator", label: "Cálculo", icon: Calculator },
  { name: "Compass", label: "Geometria", icon: Compass },
  { name: "Atom", label: "Física", icon: Atom },
  { name: "Lightning", label: "Eletromagnetismo", icon: Lightning },
  { name: "Planet", label: "Astronomia", icon: Planet },
  { name: "Flask", label: "Química", icon: Flask },
  { name: "Dna", label: "Biologia", icon: Dna },
  { name: "Leaf", label: "Ecologia", icon: Leaf },
  { name: "Heartbeat", label: "Fisiologia", icon: Heartbeat },
  { name: "BookOpenText", label: "Literatura", icon: BookOpenText },
  { name: "TextAa", label: "Gramática", icon: TextAa },
  { name: "PenNib", label: "Redação", icon: PenNib },
  { name: "Translate", label: "Idiomas", icon: Translate },
  { name: "Scroll", label: "História", icon: Scroll },
  { name: "Hourglass", label: "História Geral", icon: Hourglass },
  { name: "GlobeHemisphereWest", label: "Geografia", icon: GlobeHemisphereWest },
  { name: "Scales", label: "Filosofia / Sociologia", icon: Scales },
  { name: "Brain", label: "Raciocínio", icon: Brain },
  { name: "Palette", label: "Artes", icon: Palette },
  { name: "MusicNotes", label: "Música", icon: MusicNotes },
  { name: "Notebook", label: "Caderno", icon: Notebook },
  { name: "GraduationCap", label: "Vestibular", icon: GraduationCap },
];

const ICON_MAP: Record<string, SubjectIconComponent> = Object.fromEntries(
  SUBJECT_ICON_OPTIONS.map((opt) => [opt.name, opt.icon])
);

export function getSubjectIcon(iconName: string): SubjectIconComponent {
  return ICON_MAP[iconName] ?? BookOpen;
}

export interface EditorialColorOption {
  hex: string;
  label: string;
}

export const SUBJECT_COLOR_OPTIONS: EditorialColorOption[] = [
  { hex: "#5F7A61", label: "Verde Sálvia" },
  { hex: "#567189", label: "Azul Ardósia" },
  { hex: "#C46D53", label: "Terracota" },
  { hex: "#C99A4E", label: "Ocre Suave" },
  { hex: "#7E5A6E", label: "Ameixa Fosca" },
  { hex: "#4D6E68", label: "Verde Musgo" },
  { hex: "#9E634B", label: "Argila" },
  { hex: "#6B655D", label: "Grafite Quente" },
];
