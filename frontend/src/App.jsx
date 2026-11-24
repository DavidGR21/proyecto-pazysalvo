import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calculator,
  ClipboardCheck,
  Download,
  Eye,
  FilePlus,
  FileStack,
  FileText,
  FolderOpen,
  Paperclip,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { api, money, urls } from "./api.js";

function Layout({ children }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div>
          <div className="brand-kicker">Ecuador · Código del Trabajo</div>
          <div className="brand">
            SIGEL
            <small>Paz y salvo y liquidación laboral</small>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            <FolderOpen size={18} /> Expedientes
          </NavLink>
          <NavLink to="/nuevo">
            <FilePlus size={18} /> Nuevo expediente
          </NavLink>
        </nav>
        <p className="side-note">
          Adjunte el PDF de respaldo junto a cada requisito. El expediente final une paz y salvo, liquidación y anexos en un solo documento.
        </p>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

function Lista() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const load = async () => {
    try {
      setItems(await api.listar());
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cargarCaso = async () => {
    setBusy(true);
    setError("");
    try {
      const exp = await api.casoHipotetico();
      nav(`/expediente/${exp.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Bandeja de trabajo</div>
          <h1>Expedientes de liquidación</h1>
          <p className="muted">Consulte el expediente, los anexos por requisito y el PDF único generado.</p>
        </div>
        <div className="actions">
          <button className="btn gold" onClick={cargarCaso} disabled={busy}>
            {busy ? "Cargando…" : "Cargar caso hipotético"}
          </button>
          <button className="btn" onClick={() => nav("/nuevo")}>
            Nuevo
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Trabajador</th>
              <th>Empresa</th>
              <th>Causa</th>
              <th>Neto</th>
              <th>Paz y salvo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link to={`/expediente/${e.id}`}>{e.codigo}</Link>
                  {e.hipotetico ? <div className="badge pend">Caso hipotético</div> : null}
                </td>
                <td>
                  <strong>{e.trabajador.nombres}</strong>
                  <div className="muted">{e.trabajador.cedula}</div>
                </td>
                <td>{e.empleador.razonSocial}</td>
                <td>{e.liquidacion?.calculo?.causa?.nombre || "—"}</td>
                <td className="money">$ {money(e.liquidacion?.calculo?.neto)}</td>
                <td>
                  <span className={`badge ${e.pazSalvoCompleto ? "ok" : "pend"}`}>
                    {e.pazSalvoCompleto ? "Completo" : "En trámite"}
                  </span>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="muted">
                  No hay expedientes. Cargue el caso hipotético para la demostración.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function Adjunto({ expId, evidencia, meta, onChange, onPreview }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const subir = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await api.subirEvidencia(expId, file, meta));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const quitar = async () => {
    if (!evidencia?.id) return;
    setBusy(true);
    try {
      onChange(await api.borrarEvidencia(expId, evidencia.id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adjunto">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        hidden
        onChange={(e) => subir(e.target.files?.[0])}
      />
      {evidencia ? (
        <>
          <button type="button" className="icon-btn ok" title="Ver anexo" onClick={() => onPreview(evidencia)}>
            <Eye size={16} />
          </button>
          <a className="icon-btn" title="Descargar" href={urls.descargarEvidencia(expId, evidencia.id)}>
            <Download size={16} />
          </a>
          <button type="button" className="icon-btn danger" title="Quitar" disabled={busy} onClick={quitar}>
            <Trash2 size={16} />
          </button>
        </>
      ) : (
        <button type="button" className="icon-btn" title="Adjuntar PDF o imagen" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload size={16} />
        </button>
      )}
    </div>
  );
}

const empty = {
  empleador: {
    razonSocial: "",
    ruc: "",
    ciudad: "",
    direccion: "",
    telefono: "",
    correo: "",
    representante: "",
    cargoRepresentante: "Representante legal",
    actividad: "",
  },
  trabajador: {
    nombres: "",
    cedula: "",
    cargo: "",
    unidad: "",
    jefeInmediato: "",
    tipoVinculacion: "Contrato indefinido — Código del Trabajo",
    fechaIngreso: "",
    fechaSalida: "",
    sueldo: "",
    correo: "",
    telefono: "",
    domicilio: "",
  },
  terminacion: { causaId: "desahucio_trabajador", fechaAviso: "", observaciones: "" },
};

function Nuevo() {
  const nav = useNavigate();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const set = (grupo, key, value) => setForm((f) => ({ ...f, [grupo]: { ...f[grupo], [key]: value } }));

  const guardar = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form, trabajador: { ...form.trabajador, sueldo: Number(form.trabajador.sueldo || 0) } };
      const exp = await api.crear(body);
      nav(`/expediente/${exp.id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <div className="eyebrow">Alta</div>
      <h1>Registrar expediente</h1>
      {error && <div className="error">{error}</div>}
      <form onSubmit={guardar} className="grid">
        <DatosForm form={form} set={set} />
        <div className="actions">
          <button className="btn" type="submit">
            Crear expediente
          </button>
        </div>
      </form>
    </>
  );
}

function DatosForm({ form, set }) {
  return (
    <div className="grid grid-2">
      <section className="card">
        <h3>
          <Building2 size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
          Empleador
        </h3>
        <Field label="Razón social">
          <input value={form.empleador.razonSocial} onChange={(e) => set("empleador", "razonSocial", e.target.value)} />
        </Field>
        <div className="grid grid-2">
          <Field label="RUC">
            <input value={form.empleador.ruc} onChange={(e) => set("empleador", "ruc", e.target.value)} />
          </Field>
          <Field label="Ciudad">
            <input value={form.empleador.ciudad} onChange={(e) => set("empleador", "ciudad", e.target.value)} />
          </Field>
        </div>
        <Field label="Dirección">
          <input value={form.empleador.direccion} onChange={(e) => set("empleador", "direccion", e.target.value)} />
        </Field>
        <div className="grid grid-2">
          <Field label="Representante legal">
            <input value={form.empleador.representante} onChange={(e) => set("empleador", "representante", e.target.value)} />
          </Field>
          <Field label="Cargo">
            <input value={form.empleador.cargoRepresentante} onChange={(e) => set("empleador", "cargoRepresentante", e.target.value)} />
          </Field>
        </div>
      </section>
      <section className="card">
        <h3>
          <Briefcase size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
          Trabajador
        </h3>
        <Field label="Nombres y apellidos">
          <input value={form.trabajador.nombres} onChange={(e) => set("trabajador", "nombres", e.target.value)} />
        </Field>
        <div className="grid grid-2">
          <Field label="Cédula">
            <input value={form.trabajador.cedula} onChange={(e) => set("trabajador", "cedula", e.target.value)} />
          </Field>
          <Field label="Sueldo mensual (USD)">
            <input type="number" step="0.01" value={form.trabajador.sueldo} onChange={(e) => set("trabajador", "sueldo", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-2">
          <Field label="Cargo">
            <input value={form.trabajador.cargo} onChange={(e) => set("trabajador", "cargo", e.target.value)} />
          </Field>
          <Field label="Unidad">
            <input value={form.trabajador.unidad} onChange={(e) => set("trabajador", "unidad", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-2">
          <Field label="Fecha de ingreso">
            <input type="date" value={form.trabajador.fechaIngreso} onChange={(e) => set("trabajador", "fechaIngreso", e.target.value)} />
          </Field>
          <Field label="Fecha de salida">
            <input type="date" value={form.trabajador.fechaSalida} onChange={(e) => set("trabajador", "fechaSalida", e.target.value)} />
          </Field>
        </div>
        <Field label="Jefe inmediato">
          <input value={form.trabajador.jefeInmediato} onChange={(e) => set("trabajador", "jefeInmediato", e.target.value)} />
        </Field>
      </section>
    </div>
  );
}

function Detalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const [exp, setExp] = useState(null);
  const [causas, setCausas] = useState([]);
  const [tab, setTab] = useState("datos");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  const load = async () => {
    const [e, c] = await Promise.all([api.obtener(id), api.catalogos()]);
    setExp(e);
    setCausas(c.causas);
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);

  const set = (grupo, key, value) => setExp((f) => ({ ...f, [grupo]: { ...f[grupo], [key]: value } }));

  const guardar = async () => {
    setError("");
    try {
      const body = {
        ...exp,
        trabajador: { ...exp.trabajador, sueldo: Number(exp.trabajador.sueldo || 0) },
        liquidacion: {
          ...exp.liquidacion,
          sbu: Number(exp.liquidacion.sbu || 0),
          vacacionesPendientes: Number(exp.liquidacion.vacacionesPendientes || 0),
          diasTrabajadosMesSalida: Number(exp.liquidacion.diasTrabajadosMesSalida || 0),
          anticipos: Number(exp.liquidacion.anticipos || 0),
          otrosIngresos: Number(exp.liquidacion.otrosIngresos || 0),
          otrasDeducciones: Number(exp.liquidacion.otrasDeducciones || 0),
          aporteIessPct: Number(exp.liquidacion.aporteIessPct || 0),
        },
      };
      setExp(await api.guardar(id, body));
      setMsg("Expediente actualizado y recálculo aplicado.");
    } catch (e) {
      setError(e.message);
    }
  };

  const generar = async () => {
    setError("");
    try {
      await guardar();
      await api.genExpediente(id);
      await load();
      setMsg("Expediente PDF generado: paz y salvo, liquidación y todos los anexos en un solo archivo.");
      setTab("documentos");
    } catch (e) {
      setError(e.message);
    }
  };

  if (!exp) return <p className="muted">{error || "Cargando expediente…"}</p>;

  const calc = exp.liquidacion?.calculo;
  const causa = causas.find((c) => c.id === exp.terminacion.causaId);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">{exp.codigo}</div>
          <h1>{exp.trabajador.nombres || "Expediente"}</h1>
          <p className="muted">
            {exp.empleador.razonSocial} · {exp.trabajador.cargo}
          </p>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => nav("/")}>
            <ArrowLeft size={16} /> Volver
          </button>
          <button className="btn" onClick={guardar}>
            <Save size={16} /> Guardar
          </button>
          <button className="btn teal" onClick={generar}>
            <FileStack size={16} /> Generar expediente PDF
          </button>
        </div>
      </div>
      {msg && <div className="flash">{msg}</div>}
      {error && <div className="error">{error}</div>}

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="muted">Tiempo de servicio</div>
          <div className="hero-stat">{calc?.servicio ? `${calc.servicio.years}a ${calc.servicio.months}m` : "—"}</div>
        </div>
        <div className="card">
          <div className="muted">Neto a recibir</div>
          <div className="hero-stat">$ {money(calc?.neto)}</div>
        </div>
        <div className="card">
          <div className="muted">Paz y salvo</div>
          <div className="hero-stat">{exp.pazSalvoCompleto ? "Completo" : "En trámite"}</div>
        </div>
      </div>

      <div className="tabs">
        {[
          ["datos", "Datos"],
          ["terminacion", "Terminación"],
          ["paz", "Paz y salvo"],
          ["liquidacion", "Liquidación"],
          ["documentos", "Expediente PDF"],
        ].map(([t, label]) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "datos" && <DatosForm form={exp} set={set} />}

      {tab === "terminacion" && (
        <section className="card">
          <h3>
            <FileText size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Causa de terminación
          </h3>
          <Field label="Causa">
            <select value={exp.terminacion.causaId} onChange={(e) => set("terminacion", "causaId", e.target.value)}>
              <option value="">Seleccione…</option>
              {causas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha del aviso / acto">
            <input type="date" value={exp.terminacion.fechaAviso || ""} onChange={(e) => set("terminacion", "fechaAviso", e.target.value)} />
          </Field>
          {causa && (
            <p className="muted">
              {causa.baseLegal}. {causa.descripcion}
            </p>
          )}
          <Field label="Observaciones">
            <textarea value={exp.terminacion.observaciones || ""} onChange={(e) => set("terminacion", "observaciones", e.target.value)} />
          </Field>
          <div className="req-row">
            <div>
              <strong>Documento de respaldo (aviso, visto bueno o acta)</strong>
              <div className="muted">{exp.terminacion.evidencia?.nombreOriginal || "Adjunte el PDF o imagen correspondiente"}</div>
            </div>
            <span className="badge pend">Obligatorio</span>
            <Adjunto
              expId={exp.id}
              evidencia={exp.terminacion.evidencia}
              meta={{ alcance: "terminacion" }}
              onChange={setExp}
              onPreview={setPreview}
            />
          </div>
        </section>
      )}

      {tab === "paz" && (
        <PazPanel
          exp={exp}
          onChange={(departamentos) => setExp((e) => ({ ...e, departamentos }))}
          onFecha={(fechaEmision) => set("pazSalvo", "fechaEmision", fechaEmision)}
          onExp={setExp}
          onPreview={setPreview}
        />
      )}

      {tab === "liquidacion" && <LiqPanel exp={exp} set={set} calc={calc} />}

      {tab === "documentos" && (
        <section className="card">
          <h3>
            <FileStack size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Expediente completo
          </h3>
          <p className="muted">
            Un solo PDF, como el expediente de clase: certificado de paz y salvo, liquidación de haberes e índice de anexos con cada evidencia.
          </p>
          {exp.documentos.expediente ? (
            <>
              <p className="muted">
                Generado: {new Date(exp.documentos.expediente.generadoEn).toLocaleString("es-EC")} · {exp.documentos.expediente.anexos || 0} anexos
              </p>
              <div className="actions" style={{ marginBottom: 12 }}>
                <a className="btn teal" href={urls.expedientePdf(exp.id)}>
                  <Download size={16} /> Descargar expediente
                </a>
                {exp.documentos.pazYSalvo && (
                  <a className="btn ghost" href={urls.pazPdf(exp.id)}>
                    Solo paz y salvo
                  </a>
                )}
                {exp.documentos.liquidacion && (
                  <a className="btn ghost" href={urls.liqPdf(exp.id)}>
                    Solo liquidación
                  </a>
                )}
              </div>
              <iframe className="preview" title="Expediente" src={urls.verArchivo(exp.id, exp.documentos.expediente.fileName)} />
            </>
          ) : (
            <p className="muted">Pulse “Generar expediente PDF” para unir todos los documentos.</p>
          )}
        </section>
      )}

      {preview && (
        <div className="preview-modal" onClick={() => setPreview(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <div className="topbar">
              <h3>{preview.nombreOriginal}</h3>
              <button className="btn ghost" type="button" onClick={() => setPreview(null)}>
                Cerrar
              </button>
            </div>
            {preview.mime?.startsWith("image/") ? (
              <img className="preview" alt={preview.nombreOriginal} src={urls.verArchivo(exp.id, preview.storedName)} />
            ) : (
              <iframe className="preview" title={preview.nombreOriginal} src={urls.verArchivo(exp.id, preview.storedName)} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PazPanel({ exp, onChange, onFecha, onExp, onPreview }) {
  const updateDep = (i, patch) => {
    onChange(exp.departamentos.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };
  const updateReq = (i, ri, valor) => {
    onChange(
      exp.departamentos.map((d, idx) =>
        idx === i ? { ...d, requisitos: d.requisitos.map((r, j) => (j === ri ? { ...r, valor } : r)) } : d
      )
    );
  };

  return (
    <div className="grid">
      <div className="card">
        <Field label="Fecha de emisión del certificado">
          <input type="date" value={exp.pazSalvo?.fechaEmision || ""} onChange={(e) => onFecha(e.target.value)} />
        </Field>
        <p className="muted">
          <Paperclip size={14} style={{ verticalAlign: "middle" }} /> Cada casilla del certificado tiene su propio anexo (PDF o imagen).
        </p>
      </div>
      {exp.departamentos.map((dep, i) => (
        <section className="card" key={dep.id}>
          <div className="topbar">
            <h3>
              <ClipboardCheck size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
              {dep.nombre}
            </h3>
            <span className={`badge ${dep.estado === "aprobado" ? "ok" : dep.estado === "observado" ? "obs" : dep.estado === "no_aplica" ? "na" : "pend"}`}>
              {dep.estado}
            </span>
          </div>
          {dep.requisitos.map((r, ri) => (
            <div className="req-row" key={r.id}>
              <div>
                {r.etiqueta}
                {r.evidencia && <div className="file-name">{r.evidencia.nombreOriginal}</div>}
              </div>
              <select value={r.valor} onChange={(e) => updateReq(i, ri, e.target.value)}>
                <option value="pendiente">Pendiente</option>
                <option value="si">Sí / cumple</option>
                <option value="no">No / pendiente de entrega</option>
                <option value="na">No aplica</option>
              </select>
              <Adjunto
                expId={exp.id}
                evidencia={r.evidencia}
                meta={{ departamentoId: dep.id, requisitoId: r.id }}
                onChange={onExp}
                onPreview={onPreview}
              />
            </div>
          ))}
          <div className="grid grid-3" style={{ marginTop: 12 }}>
            <Field label="Responsable">
              <input value={dep.responsable} onChange={(e) => updateDep(i, { responsable: e.target.value })} />
            </Field>
            <Field label="Cargo">
              <input value={dep.cargoResponsable} onChange={(e) => updateDep(i, { cargoResponsable: e.target.value })} />
            </Field>
            <Field label="Fecha">
              <input type="date" value={dep.fecha || ""} onChange={(e) => updateDep(i, { fecha: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-2">
            <Field label="Estado de aprobación">
              <select value={dep.estado} onChange={(e) => updateDep(i, { estado: e.target.value })}>
                <option value="pendiente">Pendiente</option>
                <option value="aprobado">Aprobado</option>
                <option value="observado">Observado</option>
                <option value="no_aplica">No aplica</option>
              </select>
            </Field>
            <Field label="Observaciones">
              <input value={dep.observaciones} onChange={(e) => updateDep(i, { observaciones: e.target.value })} />
            </Field>
          </div>
        </section>
      ))}
    </div>
  );
}

function LiqPanel({ exp, set, calc }) {
  const L = exp.liquidacion;
  return (
    <div className="grid grid-2">
      <section className="card">
        <h3>
          <Calculator size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
          Parámetros de cálculo
        </h3>
        <div className="grid grid-2">
          <Field label="SBU vigente (USD)">
            <input type="number" step="0.01" value={L.sbu} onChange={(e) => set("liquidacion", "sbu", e.target.value)} />
          </Field>
          <Field label="Vacaciones pendientes (días)">
            <input type="number" value={L.vacacionesPendientes} onChange={(e) => set("liquidacion", "vacacionesPendientes", e.target.value)} />
          </Field>
          <Field label="Días trabajados en el mes de salida">
            <input type="number" value={L.diasTrabajadosMesSalida} onChange={(e) => set("liquidacion", "diasTrabajadosMesSalida", e.target.value)} />
          </Field>
          <Field label="Aporte IESS personal %">
            <input type="number" step="0.01" value={L.aporteIessPct} onChange={(e) => set("liquidacion", "aporteIessPct", e.target.value)} />
          </Field>
          <Field label="Anticipos / préstamos">
            <input type="number" step="0.01" value={L.anticipos} onChange={(e) => set("liquidacion", "anticipos", e.target.value)} />
          </Field>
          <Field label="Otras deducciones">
            <input type="number" step="0.01" value={L.otrasDeducciones} onChange={(e) => set("liquidacion", "otrasDeducciones", e.target.value)} />
          </Field>
        </div>
        <Field label="Incluir fondos de reserva en esta liquidación (si no se pagaron mensualizados)">
          <select value={String(L.incluirFondosReserva)} onChange={(e) => set("liquidacion", "incluirFondosReserva", e.target.value === "true")}>
            <option value="false">No (ya se pagan al IESS)</option>
            <option value="true">Sí, liquidar 8,33%</option>
          </select>
        </Field>
        <div className="grid grid-2">
          <Field label="Elaborado por">
            <input value={L.elaboradoPor || ""} onChange={(e) => set("liquidacion", "elaboradoPor", e.target.value)} />
          </Field>
          <Field label="Revisado por">
            <input value={L.revisadoPor || ""} onChange={(e) => set("liquidacion", "revisadoPor", e.target.value)} />
          </Field>
        </div>
      </section>
      <section className="card">
        <h3>Detalle de haberes</h3>
        {!calc?.valido && <p className="muted">{calc?.mensaje || "Complete fechas y sueldo."}</p>}
        {calc?.valido && (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {calc.ingresos
                  .filter((i) => i.valor !== 0 || !["despido", "fondos", "otros"].includes(i.id))
                  .map((i) => (
                    <tr key={i.id}>
                      <td>{i.concepto}</td>
                      <td className="money">$ {money(i.valor)}</td>
                    </tr>
                  ))}
                <tr>
                  <td>
                    <strong>Total ingresos</strong>
                  </td>
                  <td className="money">
                    <strong>$ {money(calc.totalIngresos)}</strong>
                  </td>
                </tr>
                {calc.egresos.map((i) => (
                  <tr key={i.id}>
                    <td>{i.concepto}</td>
                    <td className="money">$ {money(i.valor)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Total egresos</strong>
                  </td>
                  <td className="money">
                    <strong>$ {money(calc.totalEgresos)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="neto" style={{ marginTop: 12 }}>
              <span>Valor neto a pagar</span>
              <strong>$ {money(calc.neto)}</strong>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Lista />} />
        <Route path="/nuevo" element={<Nuevo />} />
        <Route path="/expediente/:id" element={<Detalle />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
