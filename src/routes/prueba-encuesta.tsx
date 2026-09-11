import { createFileRoute } from "@tanstack/react-router";
import { EncuestaFinal } from "@/components/EncuestaFinal";

export const Route = createFileRoute("/prueba-encuesta")({
  ssr: false,
  component: () => (
    <div className="mx-auto max-w-md p-4">
      <EncuestaFinal examId="719bec80-9950-4c64-b80c-77fbb0eed97d" />
    </div>
  ),
});
