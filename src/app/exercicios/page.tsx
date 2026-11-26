import React, { Suspense } from "react";
import { ExercisesWorkspace } from "@/components/exercicios/ExercisesWorkspace";

export default function ExerciciosPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-[13.5px] text-[var(--text-secondary)]">
          Carregando exercícios...
        </div>
      }
    >
      <ExercisesWorkspace />
    </Suspense>
  );
}
