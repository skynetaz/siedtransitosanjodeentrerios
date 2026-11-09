import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Copy, Mail, MessageCircle, Share2 } from "lucide-react";

export function enlaceInstitucion(slug: string | null | undefined) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return slug ? `${base}/i/${slug}` : `${base}/auth`;
}

/** Botones para enviar un texto por WhatsApp, correo o copiarlo. */
export function BotonesEnvio({ texto, asunto, telefono, email }: { texto: string; asunto: string; telefono?: string; email?: string }) {
  const tel = (telefono ?? "").replace(/\D/g, "");
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" asChild><a href={`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</a></Button>
      <Button size="sm" variant="outline" asChild><a href={`mailto:${email ?? ""}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`}><Mail className="mr-1 h-4 w-4" />Correo</a></Button>
      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(texto); toast.success("Mensaje copiado."); }}><Copy className="mr-1 h-4 w-4" />Copiar</Button>
      {typeof navigator !== "undefined" && "share" in navigator && (
        <Button size="sm" variant="outline" onClick={() => navigator.share({ title: asunto, text: texto }).catch(() => {})}><Share2 className="mr-1 h-4 w-4" />Otras apps</Button>
      )}
    </div>
  );
}

export function textoAccesos(p: { institucion: string; slug?: string | null; nombre?: string; email?: string; password?: string; telefonos?: string[] }) {
  return [
    `Hola${p.nombre ? ` ${p.nombre}` : ""}, ya está habilitada la cuenta de *${p.institucion}* en SIED — Sistema Integral de Evaluación para Licencias de Conducir.`,
    "",
    `🔗 Ingreso: ${enlaceInstitucion(p.slug)}`,
    `👉 Personal: elegir la pestaña "Personal" e ingresar con:`,
    p.email ? `• Usuario: ${p.email}` : "",
    p.password ? `• Contraseña provisoria: ${p.password}` : "",
    "",
    "Pasos sugeridos:",
    "1. Ingresar y cambiar la contraseña desde el perfil.",
    "2. Revisar categorías y banco de preguntas.",
    "3. Crear inspectores y generar códigos de examen para los aspirantes.",
    "",
    p.telefonos?.length ? `Soporte IA Triunfar: ${p.telefonos.join(" / ")}` : "Soporte: IA Triunfar",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

export function DialogoCompartirAccesos(props: { institucion: string; slug?: string | null; telefonoDestino?: string | null; emailDestino?: string | null; telefonos: string[]; inicial?: { nombre?: string; email?: string; password?: string }; trigger?: React.ReactNode; open?: boolean; onOpenChange?: (v: boolean) => void }) {
  const [d, setD] = useState({ nombre: props.inicial?.nombre ?? "", email: props.inicial?.email ?? "", password: props.inicial?.password ?? "", tel: props.telefonoDestino ?? "" });
  const texto = textoAccesos({ institucion: props.institucion, slug: props.slug, nombre: d.nombre, email: d.email, password: d.password, telefonos: props.telefonos });
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.trigger && <DialogTrigger asChild>{props.trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Compartir accesos — {props.institucion}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Nombre</Label><Input value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} /></div>
          <div><Label className="text-xs">WhatsApp destino</Label><Input placeholder="5493434..." value={d.tel} onChange={(e) => setD({ ...d, tel: e.target.value })} /></div>
          <div><Label className="text-xs">Usuario (correo)</Label><Input value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} /></div>
          <div><Label className="text-xs">Contraseña provisoria</Label><Input value={d.password} onChange={(e) => setD({ ...d, password: e.target.value })} /></div>
        </div>
        <Textarea readOnly rows={12} value={texto} className="text-xs" />
        <BotonesEnvio texto={texto} asunto={`Accesos SIED — ${props.institucion}`} telefono={d.tel} email={d.email || props.emailDestino || ""} />
      </DialogContent>
    </Dialog>
  );
}

const BENEFICIOS = [
  "✅ Exámenes 100% digitales desde el celular del aspirante: sin papel, sin impresiones, sin planillas.",
  "🔒 Seguridad anti-fraude: código único de un solo uso, pantalla completa obligatoria y registro de cada evento.",
  "✍️ Firma digital del aspirante con aval del inspector y acta en PDF lista para archivar.",
  "⚡ Corrección automática e inmediata con reglas estrictas (eliminatorias, máximo de errores, tiempo).",
  "🚦 Señales de tránsito oficiales en alta definición, separadas por clase de licencia.",
  "📊 Estadísticas en vivo: aprobados, tiempos ideales y rendimiento por categoría.",
  "🤖 Escáner con IA: digitalizamos sus exámenes actuales en PDF, Word o foto en minutos.",
];

export function GeneradorMarketing({ telefonos, email }: { telefonos: string[]; email?: string | null }) {
  const [f, setF] = useState({ destinatario: "", municipio: "", tono: "formal" });
  const saludo = f.tono === "formal" ? `Estimado/a ${f.destinatario || "Director/a de Tránsito"}:` : `¡Hola ${f.destinatario || ""}!`.replace(" !", "!");
  const texto = [
    saludo, "",
    `Le presento *SIED*, el Sistema Integral de Evaluación para Licencias de Conducir desarrollado por *IA Triunfar*${f.municipio ? `, pensado para modernizar la oficina de licencias de ${f.municipio}` : ""}.`, "",
    ...BENEFICIOS, "",
    "💡 Resultado: menos tiempo de atención, cero costos de papel, trazabilidad total ante auditorías y una imagen moderna y transparente frente a los vecinos.", "",
    "🎁 Ofrecemos una DEMO GRATUITA sin compromiso, con su escudo y sus preguntas cargadas por nuestro equipo.", "",
    "¿Coordinamos una breve presentación de 15 minutos?", "",
    "Saludos cordiales,", "IA Triunfar — Inteligencia Artificial & Éxito Empresarial",
    telefonos.length ? `📞 ${telefonos.join(" / ")}` : "", email ? `✉️ ${email}` : "",
  ].join("\n").trim();
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <Input placeholder="Destinatario (ej. Sr. Intendente)" value={f.destinatario} onChange={(e) => setF({ ...f, destinatario: e.target.value })} />
        <Input placeholder="Municipio" value={f.municipio} onChange={(e) => setF({ ...f, municipio: e.target.value })} />
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={f.tono} onChange={(e) => setF({ ...f, tono: e.target.value })}>
          <option value="formal">Tono institucional</option><option value="cercano">Tono cercano</option>
        </select>
      </div>
      <Textarea readOnly rows={14} value={texto} className="text-xs" />
      <BotonesEnvio texto={texto} asunto="SIED — Exámenes de licencia 100% digitales para su municipio" />
    </div>
  );
}
