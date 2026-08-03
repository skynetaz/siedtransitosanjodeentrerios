import { createFileRoute, Navigate } from "@tanstack/react-router";

// El ingreso al examen es exclusivamente por DNI + código en /examen.
export const Route = createFileRoute("/aspirante")({
  component: () => <Navigate to="/examen" replace />,
});
