/* ============ UTILIDADES ============ */

function cargar(clave) {
  const datos = localStorage.getItem(clave);
  return datos ? JSON.parse(datos) : [];
}

function guardar(clave, valor) {
  localStorage.setItem(clave, JSON.stringify(valor));
}

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function mostrarVista(id, paginaNav) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if (paginaNav) {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.getAttribute("data-page") === paginaNav));
  }
}

function formatearFechaCorta(fechaStr) {
  const [anio, mes, dia] = fechaStr.split("-");
  return `${dia}/${mes}/${anio}`;
}

function abrirModal(id) {
  document.getElementById(id).classList.add("visible");
}

function cerrarModal(id) {
  document.getElementById(id).classList.remove("visible");
}

document.querySelectorAll("[data-cerrar]").forEach(btn => {
  btn.addEventListener("click", () => cerrarModal(btn.getAttribute("data-cerrar")));
});

document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("visible");
  });
});

/* ============ NAVEGACIÓN ENTRE PANTALLAS ============ */

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    const pagina = btn.getAttribute("data-page");
    if (pagina === "home") renderDashboard();
    mostrarVista(`view-${pagina}`, pagina);
  });
});

/* ============ AGENDA ============ */

const STORAGE_CITAS = "greenhome_citas";
let vista = "dia"; // "dia" o "semana"

const ESTADOS_CITA = ["pendiente", "confirmada", "cancelada"];
const ESTADO_CITA_LABEL = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  cancelada: "Cancelada"
};

function formatearEtiquetaFecha(fechaStr) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaStr + "T00:00:00");
  const diffDias = Math.round((fecha - hoy) / 86400000);

  if (diffDias === 0) return "HOY";
  if (diffDias === 1) return "MAÑANA";

  const dias = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  const nombreDia = dias[fecha.getDay()];
  return `${nombreDia} ${fecha.getDate()}`;
}

function citasVisibles(citas) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return citas.filter(c => {
    const fecha = new Date(c.fecha + "T00:00:00");
    const diffDias = Math.round((fecha - hoy) / 86400000);
    if (vista === "dia") return diffDias === 0;
    return diffDias >= 0 && diffDias < 7;
  });
}

function renderAgenda() {
  const contenedor = document.getElementById("lista-citas");
  const citas = cargar(STORAGE_CITAS);
  const visibles = citasVisibles(citas).sort((a, b) =>
    (a.fecha + a.hora).localeCompare(b.fecha + b.hora)
  );

  contenedor.innerHTML = "";

  if (visibles.length === 0) {
    contenedor.innerHTML = `<div class="vacio">No hay citas para mostrar</div>`;
    return;
  }

  const grupos = {};
  visibles.forEach(c => {
    if (!grupos[c.fecha]) grupos[c.fecha] = [];
    grupos[c.fecha].push(c);
  });

  Object.keys(grupos).sort().forEach(fecha => {
    const grupoDiv = document.createElement("div");
    grupoDiv.className = "grupo-fecha";

    const titulo = document.createElement("div");
    titulo.className = "grupo-titulo";
    titulo.textContent = formatearEtiquetaFecha(fecha);
    grupoDiv.appendChild(titulo);

    grupos[fecha].forEach(cita => {
      const estado = cita.estado || "pendiente";
      const citaDiv = document.createElement("div");
      citaDiv.className = `cita estado-${estado}`;
      citaDiv.setAttribute("data-id", cita.id);
      citaDiv.innerHTML = `
        <div class="cita-hora ${cita.hora ? "" : "cita-hora-accion"}">${cita.hora || "Acción"}</div>
        <div class="cita-info">
          <div class="cita-titulo">${escapeHtml(cita.titulo)}</div>
          <div class="cita-direccion">${escapeHtml(cita.direccion || "")}</div>
        </div>
        <button class="estado-pill estado-${estado}" data-id="${cita.id}">${ESTADO_CITA_LABEL[estado]}</button>
        <button class="cita-borrar" data-id="${cita.id}">✕</button>
      `;
      grupoDiv.appendChild(citaDiv);
    });

    contenedor.appendChild(grupoDiv);
  });

  contenedor.querySelectorAll(".cita").forEach(div => {
    div.addEventListener("click", () => abrirEditarCita(div.getAttribute("data-id")));
  });

  contenedor.querySelectorAll(".cita-borrar").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      guardar(STORAGE_CITAS, cargar(STORAGE_CITAS).filter(c => c.id !== id));
      renderAgenda();
    });
  });

  contenedor.querySelectorAll(".estado-pill").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const nuevasCitas = cargar(STORAGE_CITAS).map(c => {
        if (c.id !== id) return c;
        const actual = ESTADOS_CITA.indexOf(c.estado || "pendiente");
        return { ...c, estado: ESTADOS_CITA[(actual + 1) % ESTADOS_CITA.length] };
      });
      guardar(STORAGE_CITAS, nuevasCitas);
      renderAgenda();
    });
  });
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    vista = tab.getAttribute("data-view");
    renderAgenda();
  });
});

let citaEditandoId = null;

document.getElementById("btn-add-cita").addEventListener("click", () => {
  citaEditandoId = null;
  document.getElementById("modal-cita-titulo").textContent = "Nueva cita o acción";
  document.getElementById("form-cita").reset();
  document.getElementById("input-fecha").value = new Date().toISOString().slice(0, 10);
  abrirModal("modal-cita");
});

function abrirEditarCita(id) {
  const cita = cargar(STORAGE_CITAS).find(c => c.id === id);
  if (!cita) return;
  citaEditandoId = cita.id;
  document.getElementById("modal-cita-titulo").textContent = "Editar cita o acción";
  document.getElementById("input-titulo").value = cita.titulo;
  document.getElementById("input-direccion").value = cita.direccion || "";
  document.getElementById("input-fecha").value = cita.fecha;
  document.getElementById("input-hora").value = cita.hora || "";
  document.getElementById("input-telefono").value = cita.telefono || "";
  abrirModal("modal-cita");
}

document.getElementById("form-cita").addEventListener("submit", (e) => {
  e.preventDefault();

  const datos = {
    titulo: document.getElementById("input-titulo").value.trim(),
    direccion: document.getElementById("input-direccion").value.trim(),
    fecha: document.getElementById("input-fecha").value,
    hora: document.getElementById("input-hora").value,
    telefono: document.getElementById("input-telefono").value.trim()
  };

  const citas = cargar(STORAGE_CITAS);

  if (citaEditandoId) {
    guardar(STORAGE_CITAS, citas.map(c => c.id === citaEditandoId ? { ...c, ...datos } : c));
  } else {
    citas.push({ id: Date.now().toString(), estado: "pendiente", ...datos });
    guardar(STORAGE_CITAS, citas);
  }

  cerrarModal("modal-cita");
  renderAgenda();
});

/* ============ LEADS ============ */

const STORAGE_LEADS = "greenhome_leads";
let filtroLead = null;
let busquedaLead = "";

const LEAD_ESTADO_LABEL = {
  nuevo: "Nuevo",
  pendiente: "Pendiente",
  seguimiento: "Seguimiento",
  urgente: "Urgente",
  descartado: "Descartado"
};

function inicial(nombre) {
  return (nombre || "?").trim().charAt(0).toUpperCase();
}

function renderFiltrosLeads(leads) {
  const contenedor = document.getElementById("filtros-leads");
  contenedor.innerHTML = "";

  Object.keys(LEAD_ESTADO_LABEL).forEach(estado => {
    const cantidad = leads.filter(l => l.estado === estado).length;
    const pill = document.createElement("button");
    pill.className = `filtro-pill ${estado}${filtroLead === estado ? " activo" : ""}`;
    pill.textContent = `${cantidad} ${LEAD_ESTADO_LABEL[estado]}`;
    pill.addEventListener("click", () => {
      filtroLead = filtroLead === estado ? null : estado;
      renderLeads();
    });
    contenedor.appendChild(pill);
  });
}

function renderLeads() {
  const leads = cargar(STORAGE_LEADS);
  document.getElementById("leads-total").textContent = leads.length;

  renderFiltrosLeads(leads);

  const contenedor = document.getElementById("lista-leads");
  contenedor.innerHTML = "";

  const texto = busquedaLead.trim().toLowerCase();
  const visibles = leads.filter(l => {
    if (filtroLead && l.estado !== filtroLead) return false;
    if (!texto) return true;
    return l.nombre.toLowerCase().includes(texto)
      || (l.telefono || "").includes(texto)
      || (l.referencia || "").toLowerCase().includes(texto);
  });

  if (visibles.length === 0) {
    contenedor.innerHTML = `<div class="vacio">No hay leads para mostrar</div>`;
    return;
  }

  visibles.forEach(lead => {
    const div = document.createElement("div");
    div.className = "lead-card";
    div.setAttribute("data-id", lead.id);
    div.innerHTML = `
      <div class="lead-avatar">${inicial(lead.nombre)}</div>
      <div class="lead-info">
        <div class="lead-nombre">${escapeHtml(lead.nombre)}</div>
        <div class="lead-referencia">${escapeHtml(lead.referencia || "")}</div>
        <div class="lead-telefono">${escapeHtml(lead.telefono || "")}</div>
      </div>
      <button class="lead-badge ${lead.estado}" data-id="${lead.id}">${LEAD_ESTADO_LABEL[lead.estado]}</button>
    `;
    contenedor.appendChild(div);
  });

  contenedor.querySelectorAll(".lead-card").forEach(card => {
    card.addEventListener("click", () => abrirDetalleLead(card.getAttribute("data-id")));
  });

  contenedor.querySelectorAll(".lead-badge").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const nuevosLeads = cargar(STORAGE_LEADS).map(l =>
        l.id === id ? { ...l, estado: siguienteEstadoLead(l.estado) } : l
      );
      guardar(STORAGE_LEADS, nuevosLeads);
      renderLeads();
    });
  });
}

function siguienteEstadoLead(actual) {
  const secuencia = Object.keys(LEAD_ESTADO_LABEL);
  return secuencia[(secuencia.indexOf(actual) + 1) % secuencia.length];
}

/* ============ FICHA DE LEAD ============ */

let leadActualId = null;

function abrirDetalleLead(id) {
  leadActualId = id;
  renderDetalleLead();
  mostrarVista("view-lead-detalle", "leads");
}

function renderDetalleLead() {
  const lead = cargar(STORAGE_LEADS).find(l => l.id === leadActualId);
  if (!lead) return;

  document.getElementById("detalle-avatar").textContent = inicial(lead.nombre);
  document.getElementById("detalle-nombre").textContent = lead.nombre;
  document.getElementById("detalle-referencia").textContent = lead.referencia || "";
  document.getElementById("detalle-telefono").textContent = lead.telefono || "";

  const btnEstado = document.getElementById("detalle-estado");
  btnEstado.textContent = LEAD_ESTADO_LABEL[lead.estado];
  btnEstado.className = `lead-badge ${lead.estado}`;

  const historial = (lead.historial || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  const contenedor = document.getElementById("detalle-historial");
  contenedor.innerHTML = "";

  if (historial.length === 0) {
    contenedor.innerHTML = `<div class="vacio">Sin observaciones todavía</div>`;
  } else {
    historial.forEach(obs => {
      const div = document.createElement("div");
      div.className = "observacion";
      div.innerHTML = `
        <div class="observacion-fecha">${formatearFechaCorta(obs.fecha)}</div>
        <div class="observacion-texto">${escapeHtml(obs.texto)}</div>
        ${obs.volverContactar ? `<div class="observacion-seguimiento">Volver a contactar: ${formatearFechaCorta(obs.volverContactar)}</div>` : ""}
      `;
      contenedor.appendChild(div);
    });
  }
}

document.getElementById("btn-volver-leads").addEventListener("click", () => {
  mostrarVista("view-leads", "leads");
  renderLeads();
});

document.getElementById("detalle-estado").addEventListener("click", () => {
  const nuevosLeads = cargar(STORAGE_LEADS).map(l =>
    l.id === leadActualId ? { ...l, estado: siguienteEstadoLead(l.estado) } : l
  );
  guardar(STORAGE_LEADS, nuevosLeads);
  renderDetalleLead();
});

document.getElementById("form-observacion").addEventListener("submit", (e) => {
  e.preventDefault();

  const marcarSeguimiento = document.getElementById("obs-marcar-seguimiento").checked;
  const fechaSeguimiento = document.getElementById("obs-fecha-seguimiento").value;

  const nuevaObservacion = {
    id: Date.now().toString(),
    fecha: new Date().toISOString().slice(0, 10),
    texto: document.getElementById("obs-texto").value.trim(),
    volverContactar: marcarSeguimiento && fechaSeguimiento ? fechaSeguimiento : null
  };

  const nuevosLeads = cargar(STORAGE_LEADS).map(l => {
    if (l.id !== leadActualId) return l;
    const historial = l.historial || [];
    return { ...l, historial: [...historial, nuevaObservacion] };
  });
  guardar(STORAGE_LEADS, nuevosLeads);

  e.target.reset();
  renderDetalleLead();
});

document.getElementById("buscador-leads").addEventListener("input", (e) => {
  busquedaLead = e.target.value;
  renderLeads();
});

let leadEditandoId = null;

document.getElementById("btn-add-lead").addEventListener("click", () => {
  leadEditandoId = null;
  document.getElementById("modal-lead-titulo").textContent = "Nuevo lead";
  document.getElementById("form-lead").reset();
  abrirModal("modal-lead");
});

document.getElementById("btn-editar-lead").addEventListener("click", () => {
  const lead = cargar(STORAGE_LEADS).find(l => l.id === leadActualId);
  if (!lead) return;
  leadEditandoId = lead.id;
  document.getElementById("modal-lead-titulo").textContent = "Editar lead";
  document.getElementById("lead-nombre").value = lead.nombre;
  document.getElementById("lead-referencia").value = lead.referencia || "";
  document.getElementById("lead-telefono").value = lead.telefono || "";
  document.getElementById("lead-estado").value = lead.estado;
  abrirModal("modal-lead");
});

document.getElementById("form-lead").addEventListener("submit", (e) => {
  e.preventDefault();

  const datos = {
    nombre: document.getElementById("lead-nombre").value.trim(),
    referencia: document.getElementById("lead-referencia").value.trim(),
    telefono: document.getElementById("lead-telefono").value.trim(),
    estado: document.getElementById("lead-estado").value
  };

  const leads = cargar(STORAGE_LEADS);

  if (leadEditandoId) {
    guardar(STORAGE_LEADS, leads.map(l => l.id === leadEditandoId ? { ...l, ...datos } : l));
    cerrarModal("modal-lead");
    renderDetalleLead();
  } else {
    leads.push({ id: Date.now().toString(), historial: [], ...datos });
    guardar(STORAGE_LEADS, leads);
    cerrarModal("modal-lead");
    renderLeads();
  }
});

/* ============ EXPEDIENTES ============ */

const STORAGE_EXPEDIENTES = "greenhome_expedientes";
let filtroExpediente = null;
let busquedaExpediente = "";
let expedienteEditandoId = null;

const EXPEDIENTE_ESTADO_LABEL = {
  en_curso: "En Curso",
  devuelto: "Devuelto",
  vendido: "Vendido"
};

const CHECKLIST_POR_DEFECTO = [
  "IBI", "Certificado Energético", "Inspección Técnica Edificio", "Nota Simple",
  "Tasa de basuras", "DNI", "Certificado de Cuenta", "Escrituras",
  "Llaves Recibidas", "Permiso de Comercialización"
];

function checklistDe(exp) {
  return exp.checklist || CHECKLIST_POR_DEFECTO.map(nombre => ({ nombre, hecho: false }));
}

function progresoExpediente(exp) {
  const checklist = checklistDe(exp);
  const hechos = checklist.filter(c => c.hecho).length;
  return Math.round((hechos / checklist.length) * 100);
}

function renderFiltrosExpedientes(expedientes) {
  const contenedor = document.getElementById("filtros-expedientes");
  contenedor.innerHTML = "";

  Object.keys(EXPEDIENTE_ESTADO_LABEL).forEach(estado => {
    const cantidad = expedientes.filter(x => x.estado === estado).length;
    const pill = document.createElement("button");
    pill.className = `filtro-pill ${estado}${filtroExpediente === estado ? " activo" : ""}`;
    pill.textContent = `${cantidad} ${EXPEDIENTE_ESTADO_LABEL[estado]}`;
    pill.addEventListener("click", () => {
      filtroExpediente = filtroExpediente === estado ? null : estado;
      renderExpedientes();
    });
    contenedor.appendChild(pill);
  });
}

function siguienteEstadoExpediente(actual) {
  const secuencia = Object.keys(EXPEDIENTE_ESTADO_LABEL);
  return secuencia[(secuencia.indexOf(actual) + 1) % secuencia.length];
}

function renderExpedientes() {
  const expedientes = cargar(STORAGE_EXPEDIENTES);
  document.getElementById("expedientes-en-gestion").textContent =
    expedientes.filter(x => x.estado !== "vendido").length;

  renderFiltrosExpedientes(expedientes);

  const contenedor = document.getElementById("lista-expedientes");
  contenedor.innerHTML = "";

  const texto = busquedaExpediente.trim().toLowerCase();
  const visibles = expedientes.filter(x => {
    if (filtroExpediente && x.estado !== filtroExpediente) return false;
    if (!texto) return true;
    return x.direccion.toLowerCase().includes(texto) || (x.cliente || "").toLowerCase().includes(texto);
  });

  if (visibles.length === 0) {
    contenedor.innerHTML = `<div class="vacio">No hay expedientes para mostrar</div>`;
    return;
  }

  visibles.forEach(exp => {
    const div = document.createElement("div");
    div.className = "expediente-card";
    div.setAttribute("data-id", exp.id);
    const progreso = progresoExpediente(exp);
    div.innerHTML = `
      <div class="expediente-top">
        <div class="expediente-direccion">${escapeHtml(exp.direccion)}</div>
        <button class="expediente-badge ${exp.estado}" data-id="${exp.id}">${EXPEDIENTE_ESTADO_LABEL[exp.estado]}</button>
      </div>
      <div class="expediente-cliente">${exp.cliente ? "Cliente: " + escapeHtml(exp.cliente) : ""}</div>
      <div class="progreso-barra"><div class="progreso-fill" style="width:${progreso}%"></div></div>
      <div class="progreso-texto">${progreso}% completo</div>
    `;
    contenedor.appendChild(div);
  });

  contenedor.querySelectorAll(".expediente-card").forEach(card => {
    card.addEventListener("click", () => abrirDetalleExpediente(card.getAttribute("data-id")));
  });

  contenedor.querySelectorAll(".expediente-badge").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const nuevosExpedientes = cargar(STORAGE_EXPEDIENTES).map(x =>
        x.id === id ? { ...x, estado: siguienteEstadoExpediente(x.estado) } : x
      );
      guardar(STORAGE_EXPEDIENTES, nuevosExpedientes);
      renderExpedientes();
    });
  });
}

document.getElementById("buscador-expedientes").addEventListener("input", (e) => {
  busquedaExpediente = e.target.value;
  renderExpedientes();
});

document.getElementById("btn-add-expediente").addEventListener("click", () => {
  expedienteEditandoId = null;
  document.getElementById("modal-expediente-titulo").textContent = "Nuevo expediente";
  document.getElementById("form-expediente").reset();
  abrirModal("modal-expediente");
});

function abrirEditarExpediente(id) {
  const exp = cargar(STORAGE_EXPEDIENTES).find(x => x.id === id);
  if (!exp) return;
  expedienteEditandoId = exp.id;
  document.getElementById("modal-expediente-titulo").textContent = "Editar expediente";
  document.getElementById("expediente-direccion").value = exp.direccion;
  document.getElementById("expediente-cliente").value = exp.cliente || "";
  document.getElementById("expediente-estado").value = exp.estado;
  abrirModal("modal-expediente");
}

document.getElementById("form-expediente").addEventListener("submit", (e) => {
  e.preventDefault();

  const datos = {
    direccion: document.getElementById("expediente-direccion").value.trim(),
    cliente: document.getElementById("expediente-cliente").value.trim(),
    estado: document.getElementById("expediente-estado").value
  };

  const expedientes = cargar(STORAGE_EXPEDIENTES);

  if (expedienteEditandoId) {
    guardar(STORAGE_EXPEDIENTES, expedientes.map(x => x.id === expedienteEditandoId ? { ...x, ...datos } : x));
  } else {
    const checklist = CHECKLIST_POR_DEFECTO.map(nombre => ({ nombre, hecho: false }));
    expedientes.push({ id: Date.now().toString(), checklist, ...datos });
    guardar(STORAGE_EXPEDIENTES, expedientes);
  }

  cerrarModal("modal-expediente");
  if (document.getElementById("view-expediente-detalle").classList.contains("active")) {
    renderDetalleExpediente();
  } else {
    renderExpedientes();
  }
});

/* ============ FICHA DE EXPEDIENTE ============ */

let expedienteActualId = null;

function abrirDetalleExpediente(id) {
  expedienteActualId = id;
  renderDetalleExpediente();
  mostrarVista("view-expediente-detalle", "expedientes");
}

function renderDetalleExpediente() {
  const exp = cargar(STORAGE_EXPEDIENTES).find(x => x.id === expedienteActualId);
  if (!exp) return;

  document.getElementById("det-exp-direccion").textContent = exp.direccion;
  document.getElementById("det-exp-cliente").textContent = exp.cliente ? "Cliente: " + exp.cliente : "";

  const btnEstado = document.getElementById("det-exp-estado");
  btnEstado.textContent = EXPEDIENTE_ESTADO_LABEL[exp.estado];
  btnEstado.className = `expediente-badge ${exp.estado}`;

  const checklist = checklistDe(exp);
  const progreso = progresoExpediente(exp);
  const faltan = checklist.filter(c => !c.hecho).length;

  document.getElementById("det-exp-progreso-fill").style.width = progreso + "%";
  document.getElementById("det-exp-progreso-texto").textContent =
    faltan === 0 ? "100% completo" : `${progreso}% completo — faltan ${faltan} elementos`;

  const contenedor = document.getElementById("det-exp-checklist");
  contenedor.innerHTML = "";

  checklist.forEach((item, indice) => {
    const div = document.createElement("div");
    div.className = `checklist-item ${item.hecho ? "hecho" : ""}`;
    div.innerHTML = `
      <div class="check-icono ${item.hecho ? "hecho" : "pendiente"}">${item.hecho ? "✓" : "!"}</div>
      <div class="check-nombre">${escapeHtml(item.nombre)}</div>
    `;
    div.addEventListener("click", () => {
      const nuevosExpedientes = cargar(STORAGE_EXPEDIENTES).map(x => {
        if (x.id !== expedienteActualId) return x;
        const nuevoChecklist = checklistDe(x).map((c, i) => i === indice ? { ...c, hecho: !c.hecho } : c);
        return { ...x, checklist: nuevoChecklist };
      });
      guardar(STORAGE_EXPEDIENTES, nuevosExpedientes);
      renderDetalleExpediente();
    });
    contenedor.appendChild(div);
  });
}

document.getElementById("btn-volver-expedientes").addEventListener("click", () => {
  mostrarVista("view-expedientes", "expedientes");
  renderExpedientes();
});

document.getElementById("det-exp-estado").addEventListener("click", () => {
  const nuevosExpedientes = cargar(STORAGE_EXPEDIENTES).map(x =>
    x.id === expedienteActualId ? { ...x, estado: siguienteEstadoExpediente(x.estado) } : x
  );
  guardar(STORAGE_EXPEDIENTES, nuevosExpedientes);
  renderDetalleExpediente();
});

document.getElementById("btn-editar-expediente").addEventListener("click", () => {
  abrirEditarExpediente(expedienteActualId);
});

/* ============ FINANZAS ============ */

const STORAGE_FINANZAS = "greenhome_finanzas";
let finanzaEditandoId = null;
let filtroFinanza = null; // null | "gastos" | "ingresos"

const FINANZA_CATEGORIA_LABEL = {
  gastos_fijos: "Gastos Fijos",
  gastos_variables: "Gastos Variables",
  ingresos: "Ingresos"
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function formatearImporte(numero) {
  return numero.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + "€";
}

function renderFinanzas() {
  const hoy = new Date();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, "0");
  const anioActual = String(hoy.getFullYear());

  document.getElementById("finanzas-mes").textContent = `${MESES[hoy.getMonth()]} ${anioActual}`;

  const movimientos = cargar(STORAGE_FINANZAS);
  const delMes = movimientos.filter(m => m.fecha.slice(0, 4) === anioActual && m.fecha.slice(5, 7) === mesActual);

  const gastos = delMes.filter(m => m.categoria !== "ingresos").reduce((s, m) => s + m.importe, 0);
  const ingresos = delMes.filter(m => m.categoria === "ingresos").reduce((s, m) => s + m.importe, 0);
  const balance = ingresos - gastos;

  document.getElementById("finanzas-gastos").textContent = formatearImporte(gastos);
  document.getElementById("finanzas-ingresos").textContent = formatearImporte(ingresos);
  document.getElementById("finanzas-balance").textContent = formatearImporte(balance);

  document.querySelector(".stat-card.gasto").classList.toggle("activo", filtroFinanza === "gastos");
  document.querySelector(".stat-card.ingreso").classList.toggle("activo", filtroFinanza === "ingresos");

  const contenedor = document.getElementById("lista-finanzas");
  contenedor.innerHTML = "";

  const filtrados = delMes.filter(m => {
    if (filtroFinanza === "gastos") return m.categoria !== "ingresos";
    if (filtroFinanza === "ingresos") return m.categoria === "ingresos";
    return true;
  });

  const ordenados = filtrados.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (ordenados.length === 0) {
    contenedor.innerHTML = `<div class="vacio">No hay movimientos este mes</div>`;
    return;
  }

  ordenados.forEach(mov => {
    const esIngreso = mov.categoria === "ingresos";
    const div = document.createElement("div");
    div.className = "finanza-item";
    div.setAttribute("data-id", mov.id);
    div.innerHTML = `
      <div class="finanza-info">
        <div class="finanza-categoria">${FINANZA_CATEGORIA_LABEL[mov.categoria]}</div>
        <div class="finanza-concepto">${escapeHtml(mov.concepto)}</div>
      </div>
      <div class="finanza-importe ${esIngreso ? "ingreso" : "gasto"}">${esIngreso ? "+" : "-"}${formatearImporte(mov.importe)}</div>
    `;
    contenedor.appendChild(div);
  });

  contenedor.querySelectorAll(".finanza-item").forEach(item => {
    item.addEventListener("click", () => abrirEditarFinanza(item.getAttribute("data-id")));
  });
}

document.querySelector(".stat-card.gasto").addEventListener("click", () => {
  filtroFinanza = filtroFinanza === "gastos" ? null : "gastos";
  renderFinanzas();
});

document.querySelector(".stat-card.ingreso").addEventListener("click", () => {
  filtroFinanza = filtroFinanza === "ingresos" ? null : "ingresos";
  renderFinanzas();
});

document.querySelector(".stat-card.balance").addEventListener("click", () => {
  filtroFinanza = null;
  renderFinanzas();
});

document.getElementById("btn-add-finanza").addEventListener("click", () => {
  finanzaEditandoId = null;
  document.getElementById("modal-finanza-titulo").textContent = "Nuevo movimiento";
  document.getElementById("form-finanza").reset();
  document.getElementById("finanza-fecha").value = new Date().toISOString().slice(0, 10);
  abrirModal("modal-finanza");
});

function abrirEditarFinanza(id) {
  const mov = cargar(STORAGE_FINANZAS).find(m => m.id === id);
  if (!mov) return;
  finanzaEditandoId = mov.id;
  document.getElementById("modal-finanza-titulo").textContent = "Editar movimiento";
  document.getElementById("finanza-concepto").value = mov.concepto;
  document.getElementById("finanza-categoria").value = mov.categoria;
  document.getElementById("finanza-importe").value = mov.importe;
  document.getElementById("finanza-fecha").value = mov.fecha;
  abrirModal("modal-finanza");
}

document.getElementById("form-finanza").addEventListener("submit", (e) => {
  e.preventDefault();

  const datos = {
    concepto: document.getElementById("finanza-concepto").value.trim(),
    categoria: document.getElementById("finanza-categoria").value,
    importe: Number(document.getElementById("finanza-importe").value) || 0,
    fecha: document.getElementById("finanza-fecha").value
  };

  const movimientos = cargar(STORAGE_FINANZAS);

  if (finanzaEditandoId) {
    guardar(STORAGE_FINANZAS, movimientos.map(m => m.id === finanzaEditandoId ? { ...m, ...datos } : m));
  } else {
    movimientos.push({ id: Date.now().toString(), ...datos });
    guardar(STORAGE_FINANZAS, movimientos);
  }

  cerrarModal("modal-finanza");
  renderFinanzas();
});

/* ============ DASHBOARD ============ */

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function renderDashboard() {
  const hoy = new Date();
  const hoyStr = hoy.toISOString().slice(0, 10);
  document.getElementById("dash-fecha").textContent =
    `${DIAS_SEMANA[hoy.getDay()]}, ${hoy.getDate()} de ${MESES[hoy.getMonth()]}`;

  const citas = cargar(STORAGE_CITAS);
  const citasHoy = citas.filter(c => c.fecha === hoyStr).sort((a, b) => a.hora.localeCompare(b.hora));

  const leads = cargar(STORAGE_LEADS);
  const expedientes = cargar(STORAGE_EXPEDIENTES);

  const leadsVencidos = leads.filter(l => {
    const ultimo = (l.historial || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    return ultimo && ultimo.volverContactar && ultimo.volverContactar <= hoyStr;
  });

  const itemsPendientes = [];
  expedientes.filter(x => x.estado === "en_curso").forEach(x => {
    checklistDe(x).filter(c => !c.hecho).forEach(c => itemsPendientes.push({ expediente: x, item: c }));
  });

  const prioridades = [];

  leadsVencidos.forEach(l => {
    prioridades.push({
      urgente: true,
      texto: `Llamar a ${l.nombre} — seguimiento vencido`,
      accion: () => abrirDetalleLead(l.id)
    });
  });

  itemsPendientes.slice(0, 3).forEach(({ expediente, item }) => {
    prioridades.push({
      urgente: false,
      texto: `Solicitar ${item.nombre} — ${expediente.direccion}`,
      accion: () => abrirDetalleExpediente(expediente.id)
    });
  });

  citasHoy.forEach(c => {
    prioridades.push({
      urgente: false,
      texto: c.hora
        ? `Cita ${c.hora} — ${c.titulo}${c.direccion ? " · " + c.direccion : ""}`
        : `Acción — ${c.titulo}`,
      accion: () => mostrarVista("view-agenda", "agenda")
    });
  });

  const partes = [];
  if (citasHoy.length) partes.push(`hoy tienes ${citasHoy.length} cita${citasHoy.length === 1 ? "" : "s"}`);
  if (leadsVencidos.length) partes.push(`${leadsVencidos.length} seguimiento${leadsVencidos.length === 1 ? "" : "s"} vencido${leadsVencidos.length === 1 ? "" : "s"}`);
  document.getElementById("dash-resumen").textContent =
    partes.length ? partes.join(" y ") + "." : "Sin pendientes urgentes por ahora.";

  const contPrior = document.getElementById("dash-prioridades");
  contPrior.innerHTML = "";
  if (prioridades.length === 0) {
    contPrior.innerHTML = `<div class="vacio">Todo al día</div>`;
  } else {
    prioridades.forEach(p => {
      const div = document.createElement("div");
      div.className = "dash-item";
      div.innerHTML = `
        <div class="dash-item-icono ${p.urgente ? "urgente" : "pendiente"}">${p.urgente ? "!" : "•"}</div>
        <div class="dash-item-texto">${escapeHtml(p.texto)}</div>
      `;
      div.addEventListener("click", p.accion);
      contPrior.appendChild(div);
    });
  }

  document.getElementById("dash-pendientes").textContent = prioridades.length;
  document.getElementById("dash-reuniones").textContent = citasHoy.length;

  const enCurso = expedientes.filter(x => x.estado === "en_curso");
  const cumplimiento = enCurso.length
    ? Math.round(enCurso.reduce((s, x) => s + progresoExpediente(x), 0) / enCurso.length)
    : 0;
  document.getElementById("dash-cumplimiento").textContent = cumplimiento + "%";

  const nuevos = leads.filter(l => l.estado === "nuevo" && (!l.historial || l.historial.length === 0));
  const alerta = document.getElementById("dash-alerta");
  if (nuevos.length > 0) {
    alerta.style.display = "flex";
    alerta.innerHTML = `<span>${nuevos.length} lead${nuevos.length === 1 ? "" : "s"} nuevo${nuevos.length === 1 ? "" : "s"} sin contactar</span><span>›</span>`;
    alerta.onclick = () => mostrarVista("view-leads", "leads");
  } else {
    alerta.style.display = "none";
  }

  const contUrg = document.getElementById("dash-urgentes");
  contUrg.innerHTML = "";
  const urgentes = leads.filter(l => l.estado === "urgente");
  if (urgentes.length === 0) {
    contUrg.innerHTML = `<div class="vacio">Sin leads urgentes</div>`;
  } else {
    urgentes.forEach(lead => {
      const div = document.createElement("div");
      div.className = "lead-card";
      div.innerHTML = `
        <div class="lead-avatar">${inicial(lead.nombre)}</div>
        <div class="lead-info">
          <div class="lead-nombre">${escapeHtml(lead.nombre)}</div>
          <div class="lead-referencia">${escapeHtml(lead.referencia || "")}</div>
          <div class="lead-telefono">${escapeHtml(lead.telefono || "")}</div>
        </div>
        <button class="lead-badge urgente">Urgente</button>
      `;
      div.addEventListener("click", () => abrirDetalleLead(lead.id));
      contUrg.appendChild(div);
    });
  }
}

/* ============ COPIA DE SEGURIDAD ============ */

const CLAVES_DATOS = [STORAGE_CITAS, STORAGE_LEADS, STORAGE_EXPEDIENTES, STORAGE_FINANZAS];

document.getElementById("btn-exportar-datos").addEventListener("click", () => {
  const copia = {};
  CLAVES_DATOS.forEach(clave => { copia[clave] = cargar(clave); });

  const blob = new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  const fecha = new Date().toISOString().slice(0, 10);
  enlace.href = url;
  enlace.download = `greenhome-backup-${fecha}.json`;
  enlace.click();
  URL.revokeObjectURL(url);
});

document.getElementById("btn-importar-datos").addEventListener("click", () => {
  document.getElementById("input-importar-datos").click();
});

document.getElementById("input-importar-datos").addEventListener("change", (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const confirmar = confirm("Esto reemplazará los datos actuales por los de la copia de seguridad. ¿Continuar?");
  if (!confirmar) {
    e.target.value = "";
    return;
  }

  const lector = new FileReader();
  lector.onload = () => {
    try {
      const copia = JSON.parse(lector.result);
      CLAVES_DATOS.forEach(clave => {
        if (copia[clave] !== undefined) guardar(clave, copia[clave]);
      });
      renderAgenda();
      renderLeads();
      renderExpedientes();
      renderFinanzas();
      renderDashboard();
      alert("Datos restaurados correctamente.");
    } catch (err) {
      alert("El archivo no es una copia de seguridad válida.");
    }
    e.target.value = "";
  };
  lector.readAsText(archivo);
});

/* ============ INICIO ============ */

renderAgenda();
renderLeads();
renderExpedientes();
renderFinanzas();
renderDashboard();
