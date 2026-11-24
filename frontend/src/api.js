async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res;
}

export const api = {
  catalogos: () => request("/api/catalogos"),
  listar: () => request("/api/expedientes"),
  obtener: (id) => request(`/api/expedientes/${id}`),
  crear: (body) =>
    request("/api/expedientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  guardar: (id, body) =>
    request(`/api/expedientes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  eliminar: (id) => request(`/api/expedientes/${id}`, { method: "DELETE" }),
  casoHipotetico: () => request("/api/expedientes/caso-hipotetico", { method: "POST" }),
  subirEvidencia: (id, file, meta) => {
    const fd = new FormData();
    fd.append("archivo", file);
    if (meta.alcance) fd.append("alcance", meta.alcance);
    if (meta.departamentoId) fd.append("departamentoId", meta.departamentoId);
    if (meta.requisitoId) fd.append("requisitoId", meta.requisitoId);
    return request(`/api/expedientes/${id}/evidencias`, { method: "POST", body: fd });
  },
  borrarEvidencia: (id, evidenciaId) => request(`/api/expedientes/${id}/evidencias/${evidenciaId}`, { method: "DELETE" }),
  genPaz: (id) => request(`/api/expedientes/${id}/pdf/paz-salvo`, { method: "POST" }),
  genLiq: (id) => request(`/api/expedientes/${id}/pdf/liquidacion`, { method: "POST" }),
  genExpediente: (id) => request(`/api/expedientes/${id}/pdf/expediente`, { method: "POST" }),
};

export const urls = {
  descargarEvidencia: (id, evId) => `/api/expedientes/${id}/evidencias/${evId}`,
  verArchivo: (id, name) => `/api/expedientes/${id}/archivos/${name}`,
  pazPdf: (id) => `/api/expedientes/${id}/pdf/paz-salvo`,
  liqPdf: (id) => `/api/expedientes/${id}/pdf/liquidacion`,
  expedientePdf: (id) => `/api/expedientes/${id}/pdf/expediente`,
};

export function money(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
