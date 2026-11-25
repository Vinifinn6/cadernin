import React, { Suspense } from "react";
import { PlannerWorkspace } from "@/components/planejador/PlannerWorkspace";

export default function PlanejadorPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-[13.5px] text-[var(--text-secondary)]">
          Carregando planejador...
        </div>
      }
    >
      <PlannerWorkspace />
    </Suspense>
  );
}
