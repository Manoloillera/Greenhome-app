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

const RENDER_POR_PAGINA = {
  home: () => renderDashboard(),
  agenda: () => renderAgenda(),
  leads: () => renderLeads(),
  expedientes: () => renderExpedientes(),
  finanzas: () => renderFinanzas()
};

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    const pagina = btn.getAttribute("data-page");
    if (RENDER_POR_PAGINA[pagina]) RENDER_POR_PAGINA[pagina]();
    mostrarVista(`view-${pagina}`, pagina);
  });
});

/* ============ AGENDA ============ */

const STORAGE_CITAS = "greenhome_citas";
let vista = "dia"; // "dia" | "semana" | "mes"
let mesActual = new Date().getMonth();
let anioActual = new Date().getFullYear();
let diaSeleccionadoMes = null;

const ESTADOS_CITA = ["pendiente", "completada", "cancelada"];
const ESTADO_CITA_LABEL = {
  pendiente: "Pendiente",
  completada: "Completada",
  cancelada: "Cancelada"
};

function estadoCitaNormalizado(cita) {
  const estado = cita.estado || "pendiente";
  return estado === "confirmada" ? "completada" : estado;
}

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

function renderCitaEnLista(cita, contenedorPadre) {
  const estado = estadoCitaNormalizado(cita);
  const citaDiv = document.createElement("div");
  citaDiv.className = `cita estado-${estado}`;
  citaDiv.setAttribute("data-id", cita.id);
  const detalles = [cita.direccion, cita.telefono].filter(Boolean).join(" · ");
  citaDiv.innerHTML = `
    <div class="cita-hora">${cita.hora || ""}</div>
    <div class="cita-info">
      <div class="cita-titulo">${escapeHtml(cita.titulo)}</div>
      <div class="cita-direccion">${escapeHtml(detalles)}</div>
    </div>
    <button class="estado-pill estado-${estado}" data-id="${cita.id}">${ESTADO_CITA_LABEL[estado]}</button>
    <button class="cita-borrar" data-id="${cita.id}">✕</button>
  `;
  citaDiv.addEventListener("click", () => abrirEditarCita(cita.id));
  contenedorPadre.appendChild(citaDiv);
}

function activarBotonesCita(contenedor, alTerminar) {
  contenedor.querySelectorAll(".cita-borrar").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      guardar(STORAGE_CITAS, cargar(STORAGE_CITAS).filter(c => c.id !== id));
      alTerminar();
    });
  });

  contenedor.querySelectorAll(".estado-pill").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const cita = cargar(STORAGE_CITAS).find(c => c.id === id);
      if (!cita) return;
      const actual = estadoCitaNormalizado(cita);
      if (actual === "pendiente") {
        abrirRegistroVisita(id);
        return;
      }
      const siguiente = ESTADOS_CITA[(ESTADOS_CITA.indexOf(actual) + 1) % ESTADOS_CITA.length];
      guardar(STORAGE_CITAS, cargar(STORAGE_CITAS).map(c => c.id === id ? { ...c, estado: siguiente } : c));
      alTerminar();
    });
  });
}

function renderAgenda() {
  const listaCitas = document.getElementById("lista-citas");
  const mensual = document.getElementById("agenda-mensual");

  if (vista === "mes") {
    listaCitas.hidden = true;
    mensual.hidden = false;
    renderAgendaMensual();
    return;
  }
  listaCitas.hidden = false;
  mensual.hidden = true;

  const contenedor = listaCitas;
  const citas = cargar(STORAGE_CITAS);
  const visibles = citasVisibles(citas).sort((a, b) =>
    (a.fecha + (a.hora || "")).localeCompare(b.fecha + (b.hora || ""))
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

    grupos[fecha].forEach(cita => renderCitaEnLista(cita, grupoDiv));

    contenedor.appendChild(grupoDiv);
  });

  activarBotonesCita(contenedor, renderAgenda);
}

function renderAgendaMensual() {
  document.getElementById("mes-titulo").textContent = `${MESES[mesActual]} ${anioActual}`;

  const citas = cargar(STORAGE_CITAS);
  const hoyStr = new Date().toISOString().slice(0, 10);

  const primerDiaMes = new Date(anioActual, mesActual, 1);
  const diasEnMes = new Date(anioActual, mesActual + 1, 0).getDate();
  let diaSemanaInicio = primerDiaMes.getDay();
  diaSemanaInicio = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1;

  const grid = document.getElementById("mes-grid");
  grid.innerHTML = "";

  for (let i = 0; i < diaSemanaInicio; i++) {
    const vacio = document.createElement("div");
    vacio.className = "mes-dia vacio";
    grid.appendChild(vacio);
  }

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaStr = `${anioActual}-${String(mesActual + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const citasDelDia = citas.filter(c => c.fecha === fechaStr);

    let clase = "mes-dia";
    if (citasDelDia.length > 0) {
      const hayPendiente = citasDelDia.some(c => estadoCitaNormalizado(c) === "pendiente");
      clase += hayPendiente ? " pendiente-alerta" : " completado";
    }
    if (fechaStr === hoyStr) clase += " hoy";
    if (fechaStr === diaSeleccionadoMes) clase += " seleccionado";

    const celda = document.createElement("div");
    celda.className = clase;
    celda.textContent = dia;
    celda.addEventListener("click", () => {
      diaSeleccionadoMes = fechaStr;
      renderAgendaMensual();
    });
    grid.appendChild(celda);
  }

  const contDetalle = document.getElementById("mes-detalle-dia");
  contDetalle.innerHTML = "";
  if (!diaSeleccionadoMes) return;

  const citasDia = citas
    .filter(c => c.fecha === diaSeleccionadoMes)
    .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

  if (citasDia.length === 0) {
    contDetalle.innerHTML = `<div class="vacio">Sin citas ese día</div>`;
    return;
  }

  citasDia.forEach(cita => renderCitaEnLista(cita, contDetalle));
  activarBotonesCita(contDetalle, renderAgendaMensual);
}

document.getElementById("btn-mes-anterior").addEventListener("click", () => {
  mesActual--;
  if (mesActual < 0) { mesActual = 11; anioActual--; }
  diaSeleccionadoMes = null;
  renderAgendaMensual();
});

document.getElementById("btn-mes-siguiente").addEventListener("click", () => {
  mesActual++;
  if (mesActual > 11) { mesActual = 0; anioActual++; }
  diaSeleccionadoMes = null;
  renderAgendaMensual();
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    vista = tab.getAttribute("data-view");
    renderAgenda();
  });
});

function poblarSelectoresRelacion() {
  const selectLead = document.getElementById("input-lead-relacionado");
  const selectExp = document.getElementById("input-expediente-relacionado");
  const leads = cargar(STORAGE_LEADS);
  const expedientes = cargar(STORAGE_EXPEDIENTES);

  selectLead.innerHTML = '<option value="">Sin vincular</option>' +
    leads.map(l => `<option value="${l.id}">${escapeHtml(l.nombre)}</option>`).join("");
  selectExp.innerHTML = '<option value="">Sin vincular</option>' +
    expedientes.map(x => `<option value="${x.id}">${escapeHtml(x.direccion)}</option>`).join("");
}

let citaEditandoId = null;

document.getElementById("btn-add-cita").addEventListener("click", () => {
  citaEditandoId = null;
  document.getElementById("modal-cita-titulo").textContent = "Nueva visita";
  document.getElementById("form-cita").reset();
  document.getElementById("input-fecha").value = new Date().toISOString().slice(0, 10);
  poblarSelectoresRelacion();
  abrirModal("modal-cita");
});

function abrirEditarCita(id) {
  const cita = cargar(STORAGE_CITAS).find(c => c.id === id);
  if (!cita) return;
  citaEditandoId = cita.id;
  document.getElementById("modal-cita-titulo").textContent = "Editar visita";
  document.getElementById("input-titulo").value = cita.titulo;
  document.getElementById("input-direccion").value = cita.direccion || "";
  document.getElementById("input-fecha").value = cita.fecha;
  document.getElementById("input-hora").value = cita.hora || "";
  document.getElementById("input-telefono").value = cita.telefono || "";
  poblarSelectoresRelacion();
  document.getElementById("input-lead-relacionado").value = cita.leadId || "";
  document.getElementById("input-expediente-relacionado").value = cita.expedienteId || "";
  abrirModal("modal-cita");
}

document.getElementById("form-cita").addEventListener("submit", (e) => {
  e.preventDefault();

  const datos = {
    titulo: document.getElementById("input-titulo").value.trim(),
    direccion: document.getElementById("input-direccion").value.trim(),
    fecha: document.getElementById("input-fecha").value,
    hora: document.getElementById("input-hora").value,
    telefono: document.getElementById("input-telefono").value.trim(),
    leadId: document.getElementById("input-lead-relacionado").value || null,
    expedienteId: document.getElementById("input-expediente-relacionado").value || null
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

/* ============ REGISTRO DE VISITA COMPLETADA ============ */

let citaParaRegistrar = null;

function abrirRegistroVisita(citaId) {
  citaParaRegistrar = citaId;
  document.getElementById("form-registro-visita").reset();
  abrirModal("modal-registro-visita");
}

document.getElementById("form-registro-visita").addEventListener("submit", (e) => {
  e.preventDefault();

  const sePresento = document.getElementById("registro-presento").value;
  const interes = document.getElementById("registro-interes").value;
  const observaciones = document.getElementById("registro-observaciones").value.trim();
  const proximaTexto = document.getElementById("registro-proxima-texto").value.trim();
  const proximaFecha = document.getElementById("registro-proxima-fecha").value;
  const proximaHora = document.getElementById("registro-proxima-hora").value;

  const citas = cargar(STORAGE_CITAS);
  const cita = citas.find(c => c.id === citaParaRegistrar);
  if (!cita) { cerrarModal("modal-registro-visita"); return; }

  const hoyStr = new Date().toISOString().slice(0, 10);
  const registro = {
    sePresento,
    interes,
    observaciones,
    proximaAccion: { texto: proximaTexto, fecha: proximaFecha || null, hora: proximaHora || null },
    fecha: hoyStr
  };

  guardar(STORAGE_CITAS, citas.map(c =>
    c.id === citaParaRegistrar ? { ...c, estado: "completada", registroVisita: registro } : c
  ));

  const etiquetaInteres = interes === "si" ? "Sí" : interes === "no" ? "No" : "Duda";
  const resumenTexto = `Visita ${formatearFechaCorta(cita.fecha)}${cita.hora ? " " + cita.hora : ""} — ` +
    `Se presentó: ${sePresento === "si" ? "Sí" : "No"}. Interés: ${etiquetaInteres}.` +
    (observaciones ? ` ${observaciones}` : "");

  const entradaHistorial = {
    id: Date.now().toString(),
    fecha: hoyStr,
    texto: resumenTexto,
    volverContactar: proximaFecha || null,
    volverContactarHora: proximaHora || null
  };

  if (cita.leadId) {
    const leads = cargar(STORAGE_LEADS);
    guardar(STORAGE_LEADS, leads.map(l =>
      l.id === cita.leadId ? { ...l, historial: [...(l.historial || []), entradaHistorial] } : l
    ));
  } else if (interes === "si" && proximaTexto) {
    const leads = cargar(STORAGE_LEADS);
    leads.push({
      id: Date.now().toString() + "l",
      nombre: cita.titulo,
      referencia: cita.direccion || "",
      telefono: cita.telefono || "",
      estado: "seguimiento",
      historial: [{
        id: Date.now().toString(),
        fecha: hoyStr,
        texto: `Creado automáticamente tras la visita. ${proximaTexto}`,
        volverContactar: proximaFecha || null,
        volverContactarHora: proximaHora || null
      }]
    });
    guardar(STORAGE_LEADS, leads);
  }

  if (cita.expedienteId) {
    const expedientes = cargar(STORAGE_EXPEDIENTES);
    guardar(STORAGE_EXPEDIENTES, expedientes.map(x =>
      x.id === cita.expedienteId ? { ...x, historial: [...(x.historial || []), entradaHistorial] } : x
    ));
  }

  cerrarModal("modal-registro-visita");
  citaParaRegistrar = null;
  renderAgenda();
  renderDashboard();
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

function proximoSeguimientoDe(lead) {
  const ultimo = (lead.historial || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return ultimo && ultimo.volverContactar ? ultimo.volverContactar : null;
}

function formatearFechaCortaMes(fechaStr) {
  const [anio, mes, dia] = fechaStr.split("-");
  const nombresCortos = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(dia)} ${nombresCortos[Number(mes) - 1]}`;
}

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

  visibles.sort((a, b) => {
    const fechaA = proximoSeguimientoDe(a);
    const fechaB = proximoSeguimientoDe(b);
    if (fechaA && fechaB) return fechaA.localeCompare(fechaB);
    if (fechaA) return -1;
    if (fechaB) return 1;
    return 0;
  });

  if (visibles.length === 0) {
    contenedor.innerHTML = `<div class="vacio">No hay leads para mostrar</div>`;
    return;
  }

  visibles.forEach(lead => {
    const div = document.createElement("div");
    div.className = "lead-card";
    div.setAttribute("data-id", lead.id);
    const proximaFecha = proximoSeguimientoDe(lead);
    div.innerHTML = `
      <div class="lead-avatar">${inicial(lead.nombre)}</div>
      <div class="lead-info">
        <div class="lead-nombre">${escapeHtml(lead.nombre)}</div>
        <div class="lead-referencia">${escapeHtml(lead.referencia || "")}</div>
        <div class="lead-telefono">${escapeHtml(lead.telefono || "")}</div>
        ${proximaFecha ? `<div class="lead-seguimiento-fecha">Seguimiento: ${formatearFechaCortaMes(proximaFecha)}</div>` : ""}
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
        ${obs.volverContactar ? `<div class="observacion-seguimiento">Volver a contactar: ${formatearFechaCorta(obs.volverContactar)}${obs.volverContactarHora ? " " + obs.volverContactarHora : ""}</div>` : ""}
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
  const horaSeguimiento = document.getElementById("obs-hora-seguimiento").value;

  const nuevaObservacion = {
    id: Date.now().toString(),
    fecha: new Date().toISOString().slice(0, 10),
    texto: document.getElementById("obs-texto").value.trim(),
    volverContactar: marcarSeguimiento && fechaSeguimiento ? fechaSeguimiento : null,
    volverContactarHora: marcarSeguimiento && fechaSeguimiento ? (horaSeguimiento || null) : null
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

function costesDe(exp) {
  return exp.costes || {
    comunidadMensual: 0,
    ibiAnual: 0,
    tasaBasurasAnual: 0,
    tieneDerramas: false,
    derramaImporte: 0,
    derramaDescripcion: ""
  };
}

function datosPisoDe(exp) {
  return exp.datosPiso || {
    fotoPrincipal: "",
    ciudad: "",
    codigoPostal: "",
    precio: 0,
    superficie: 0,
    dormitorios: 0,
    banos: 0,
    terraza: 0,
    planta: "",
    orientacion: "",
    ascensor: false,
    equipado: false,
    amueblado: false,
    garaje: false,
    trastero: false
  };
}

const ENTORNO_CLAVES = ["colegio", "farmacia", "supermercado", "salud", "parque", "deporte", "metro", "autobus"];

function entornoDe(exp) {
  if (exp.entorno) return exp.entorno;
  const vacio = { resumen: "" };
  ENTORNO_CLAVES.forEach(clave => {
    vacio[clave] = { nombre: "", metros: 0, minutos: 0 };
  });
  return vacio;
}

function historialExpedienteDe(exp) {
  return exp.historial || [];
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
let fotoPrincipalActual = "";

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

  const costes = costesDe(exp);
  document.getElementById("costes-comunidad").value = costes.comunidadMensual || "";
  document.getElementById("costes-ibi").value = costes.ibiAnual || "";
  document.getElementById("costes-basuras").value = costes.tasaBasurasAnual || "";
  document.getElementById("costes-tiene-derramas").checked = !!costes.tieneDerramas;
  document.getElementById("costes-derrama-importe").value = costes.derramaImporte || "";
  document.getElementById("costes-derrama-descripcion").value = costes.derramaDescripcion || "";
  document.getElementById("costes-derrama-campos").hidden = !costes.tieneDerramas;

  const piso = datosPisoDe(exp);
  document.getElementById("piso-ciudad").value = piso.ciudad || "";
  document.getElementById("piso-cp").value = piso.codigoPostal || "";
  document.getElementById("piso-precio").value = piso.precio || "";
  document.getElementById("piso-superficie").value = piso.superficie || "";
  document.getElementById("piso-dormitorios").value = piso.dormitorios || "";
  document.getElementById("piso-banos").value = piso.banos || "";
  document.getElementById("piso-terraza").value = piso.terraza || "";
  document.getElementById("piso-planta").value = piso.planta || "";
  document.getElementById("piso-orientacion").value = piso.orientacion || "";
  document.getElementById("piso-ascensor").checked = !!piso.ascensor;
  document.getElementById("piso-equipado").checked = !!piso.equipado;
  document.getElementById("piso-amueblado").checked = !!piso.amueblado;
  document.getElementById("piso-garaje").checked = !!piso.garaje;
  document.getElementById("piso-trastero").checked = !!piso.trastero;

  const previewFoto = document.getElementById("piso-foto-preview");
  const btnQuitarFoto = document.getElementById("btn-quitar-foto");
  document.getElementById("piso-foto").value = "";
  fotoPrincipalActual = piso.fotoPrincipal || "";
  if (fotoPrincipalActual) {
    previewFoto.src = fotoPrincipalActual;
    previewFoto.hidden = false;
    btnQuitarFoto.hidden = false;
  } else {
    previewFoto.hidden = true;
    btnQuitarFoto.hidden = true;
  }

  const entorno = entornoDe(exp);
  ENTORNO_CLAVES.forEach(clave => {
    const item = entorno[clave] || { nombre: "", metros: 0, minutos: 0 };
    document.getElementById(`entorno-${clave}-nombre`).value = item.nombre || "";
    document.getElementById(`entorno-${clave}-metros`).value = item.metros || "";
    document.getElementById(`entorno-${clave}-minutos`).value = item.minutos || "";
  });
  document.getElementById("entorno-resumen").value = entorno.resumen || "";

  const historialExp = historialExpedienteDe(exp).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  const contHistorialExp = document.getElementById("det-exp-historial");
  contHistorialExp.innerHTML = "";
  if (historialExp.length === 0) {
    contHistorialExp.innerHTML = `<div class="vacio">Sin historial todavía</div>`;
  } else {
    historialExp.forEach(obs => {
      const div = document.createElement("div");
      div.className = "observacion";
      div.innerHTML = `
        <div class="observacion-fecha">${formatearFechaCorta(obs.fecha)}</div>
        <div class="observacion-texto">${escapeHtml(obs.texto)}</div>
        ${obs.volverContactar ? `<div class="observacion-seguimiento">Volver a contactar: ${formatearFechaCorta(obs.volverContactar)}${obs.volverContactarHora ? " " + obs.volverContactarHora : ""}</div>` : ""}
      `;
      contHistorialExp.appendChild(div);
    });
  }

  const memoriaEstado = document.getElementById("memoria-estado");
  const btnAbrirMemoria = document.getElementById("btn-abrir-memoria");
  if (exp.memoriaVisita) {
    const fecha = new Date(exp.memoriaVisita.generadaEl);
    memoriaEstado.textContent = `Última memoria: ${fecha.toLocaleDateString("es-ES")} ${fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
    btnAbrirMemoria.hidden = false;
  } else {
    memoriaEstado.textContent = "Aún no se ha generado";
    btnAbrirMemoria.hidden = true;
  }
}

document.getElementById("costes-tiene-derramas").addEventListener("change", (e) => {
  document.getElementById("costes-derrama-campos").hidden = !e.target.checked;
});

document.getElementById("form-costes").addEventListener("submit", (e) => {
  e.preventDefault();

  const tieneDerramas = document.getElementById("costes-tiene-derramas").checked;
  const nuevosCostes = {
    comunidadMensual: Number(document.getElementById("costes-comunidad").value) || 0,
    ibiAnual: Number(document.getElementById("costes-ibi").value) || 0,
    tasaBasurasAnual: Number(document.getElementById("costes-basuras").value) || 0,
    tieneDerramas,
    derramaImporte: tieneDerramas ? (Number(document.getElementById("costes-derrama-importe").value) || 0) : 0,
    derramaDescripcion: tieneDerramas ? document.getElementById("costes-derrama-descripcion").value.trim() : ""
  };

  const nuevosExpedientes = cargar(STORAGE_EXPEDIENTES).map(x =>
    x.id === expedienteActualId ? { ...x, costes: nuevosCostes } : x
  );
  guardar(STORAGE_EXPEDIENTES, nuevosExpedientes);
  alert("Costes guardados.");
});

document.getElementById("piso-foto").addEventListener("change", (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = () => {
    fotoPrincipalActual = lector.result;
    document.getElementById("piso-foto-preview").src = fotoPrincipalActual;
    document.getElementById("piso-foto-preview").hidden = false;
    document.getElementById("btn-quitar-foto").hidden = false;
  };
  lector.readAsDataURL(archivo);
});

document.getElementById("btn-quitar-foto").addEventListener("click", () => {
  fotoPrincipalActual = "";
  document.getElementById("piso-foto").value = "";
  document.getElementById("piso-foto-preview").hidden = true;
  document.getElementById("btn-quitar-foto").hidden = true;
});

document.getElementById("form-piso").addEventListener("submit", (e) => {
  e.preventDefault();

  const nuevoPiso = {
    fotoPrincipal: fotoPrincipalActual,
    ciudad: document.getElementById("piso-ciudad").value.trim(),
    codigoPostal: document.getElementById("piso-cp").value.trim(),
    precio: Number(document.getElementById("piso-precio").value) || 0,
    superficie: Number(document.getElementById("piso-superficie").value) || 0,
    dormitorios: Number(document.getElementById("piso-dormitorios").value) || 0,
    banos: Number(document.getElementById("piso-banos").value) || 0,
    terraza: Number(document.getElementById("piso-terraza").value) || 0,
    planta: document.getElementById("piso-planta").value.trim(),
    orientacion: document.getElementById("piso-orientacion").value,
    ascensor: document.getElementById("piso-ascensor").checked,
    equipado: document.getElementById("piso-equipado").checked,
    amueblado: document.getElementById("piso-amueblado").checked,
    garaje: document.getElementById("piso-garaje").checked,
    trastero: document.getElementById("piso-trastero").checked
  };

  const nuevosExpedientes = cargar(STORAGE_EXPEDIENTES).map(x =>
    x.id === expedienteActualId ? { ...x, datosPiso: nuevoPiso } : x
  );
  guardar(STORAGE_EXPEDIENTES, nuevosExpedientes);
  alert("Datos del piso guardados.");
});

document.getElementById("form-entorno").addEventListener("submit", (e) => {
  e.preventDefault();

  const nuevoEntorno = { resumen: document.getElementById("entorno-resumen").value.trim() };
  ENTORNO_CLAVES.forEach(clave => {
    nuevoEntorno[clave] = {
      nombre: document.getElementById(`entorno-${clave}-nombre`).value.trim(),
      metros: Number(document.getElementById(`entorno-${clave}-metros`).value) || 0,
      minutos: Number(document.getElementById(`entorno-${clave}-minutos`).value) || 0
    };
  });

  const nuevosExpedientes = cargar(STORAGE_EXPEDIENTES).map(x =>
    x.id === expedienteActualId ? { ...x, entorno: nuevoEntorno } : x
  );
  guardar(STORAGE_EXPEDIENTES, nuevosExpedientes);
  alert("Entorno guardado.");
});

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

/* ============ MEMORIA DE LA VISITA (PDF) ============ */

const ENTORNO_ETIQUETAS = {
  colegio: "Colegio", farmacia: "Farmacia", supermercado: "Supermercado",
  salud: "Centro de salud", parque: "Parque", deporte: "Deporte",
  metro: "Metro", autobus: "Autobús"
};

const VERDE_MARCA = [46, 125, 50];
const LOGO_BASE64 = "data:image/png;base64,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";
const GRIS_TEXTO = [60, 60, 60];
const NOMBRE_AGENTE = "Manuel Lacera Illera";
const TELEFONO_AGENTE = "641 997 089";

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function recortarImagenCover(img, anchoMm, altoMm) {
  const escala = 4;
  const anchoPx = anchoMm * escala;
  const altoPx = altoMm * escala;
  const canvas = document.createElement("canvas");
  canvas.width = anchoPx;
  canvas.height = altoPx;
  const ctx = canvas.getContext("2d");
  const escalaImg = Math.max(anchoPx / img.width, altoPx / img.height);
  const wDestino = img.width * escalaImg;
  const hDestino = img.height * escalaImg;
  ctx.drawImage(img, (anchoPx - wDestino) / 2, (altoPx - hDestino) / 2, wDestino, hDestino);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function seccionPDF(doc, titulo, margen, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(26, 26, 26);
  doc.text(titulo.toUpperCase(), margen, y);
  return y + 7;
}

function filaEntornoPDF(doc, item, margen, ancho, y) {
  const anchoEtiqueta = 34;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(140, 140, 140);
  doc.text(item.etiqueta.toUpperCase(), margen, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(26, 26, 26);
  doc.text(item.nombre, margen + anchoEtiqueta, y);

  let distancia = "";
  if (item.metros) distancia += `${item.metros} m`;
  if (item.minutos) distancia += (distancia ? " · " : "") + `${item.minutos} min andando`;
  if (distancia) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(140, 140, 140);
    doc.text(distancia, margen + ancho, y, { align: "right" });
  }

  return y + 6.5;
}

function filaCostePDF(doc, etiqueta, valor, margen, ancho, y) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRIS_TEXTO);
  doc.text(etiqueta, margen, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 26);
  doc.text(valor, margen + ancho, y, { align: "right" });

  return y + 6.5;
}

async function generarMemoriaPDF(exp) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const margen = 15;
  const ancho = 210 - margen * 2;
  let y = margen;

  const piso = datosPisoDe(exp);
  const costes = costesDe(exp);
  const entorno = entornoDe(exp);

  const logoAncho = 26;
  const logoAlto = logoAncho * (250 / 484);
  try {
    doc.addImage(LOGO_BASE64, "PNG", margen, y, logoAncho, logoAlto);
  } catch (err) {
    // si el logo falla, seguimos sin él
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...VERDE_MARCA);
  doc.text("GREEN HOME MADRID · MEMORIA DE LA VISITA", margen + ancho, margen + logoAlto / 2 + 1.5, { align: "right" });

  y += logoAlto + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(26, 26, 26);
  doc.text(exp.direccion || "", margen, y);
  y += 7;

  const ubicacion = [piso.ciudad, piso.codigoPostal].filter(Boolean).join(" · ");
  if (ubicacion) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(140, 140, 140);
    doc.text(ubicacion, margen, y);
    y += 8;
  } else {
    y += 3;
  }

  if (piso.fotoPrincipal) {
    try {
      const img = await cargarImagen(piso.fotoPrincipal);
      const altoFoto = 65;
      const fotoRecortada = recortarImagenCover(img, ancho, altoFoto);
      doc.addImage(fotoRecortada, "JPEG", margen, y, ancho, altoFoto);
      y += altoFoto + 9;
    } catch (err) {
      // si la foto no se puede leer, seguimos sin ella
    }
  }

  if (piso.precio) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...VERDE_MARCA);
    doc.text(formatearImporte(piso.precio), margen, y);
    y += 8;
  }

  const datosClave = [];
  if (piso.superficie) datosClave.push(`${piso.superficie} m²`);
  if (piso.dormitorios) datosClave.push(`${piso.dormitorios} hab.`);
  if (piso.banos) datosClave.push(`${piso.banos} baños`);
  if (piso.planta) datosClave.push(`Planta ${piso.planta}`);
  datosClave.push(piso.ascensor ? "Con ascensor" : "Sin ascensor");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...GRIS_TEXTO);
  if (datosClave.length) {
    const lineas = doc.splitTextToSize(datosClave.join("  ·  "), ancho);
    doc.text(lineas, margen, y);
    y += lineas.length * 5.5 + 1;
  }

  const extras = [];
  if (piso.terraza) extras.push(`Terraza ${piso.terraza} m²`);
  if (piso.orientacion) extras.push(`Orientación ${piso.orientacion}`);
  if (piso.equipado) extras.push("Equipado");
  if (piso.amueblado) extras.push("Amueblado");
  if (piso.garaje) extras.push("Garaje");
  if (piso.trastero) extras.push("Trastero");

  if (extras.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...GRIS_TEXTO);
    const lineasExtra = doc.splitTextToSize(extras.join("  ·  "), ancho);
    doc.text(lineasExtra, margen, y);
    y += lineasExtra.length * 5.5 + 1;
  }

  y += 4;
  doc.setDrawColor(225, 225, 225);
  doc.line(margen, y, margen + ancho, y);
  y += 9;

  const itemsEntorno = ["colegio", "farmacia", "supermercado", "salud", "parque", "deporte"]
    .map(clave => ({ etiqueta: ENTORNO_ETIQUETAS[clave], ...entorno[clave] }))
    .filter(item => item.nombre);

  if (itemsEntorno.length) {
    y = seccionPDF(doc, "A tu alrededor", margen, y);
    itemsEntorno.forEach(item => { y = filaEntornoPDF(doc, item, margen, ancho, y); });
    y += 5;
  }

  const itemsTransporte = ["metro", "autobus"]
    .map(clave => ({ etiqueta: ENTORNO_ETIQUETAS[clave], ...entorno[clave] }))
    .filter(item => item.nombre);

  if (itemsTransporte.length) {
    y = seccionPDF(doc, "Cómo moverte", margen, y);
    itemsTransporte.forEach(item => { y = filaEntornoPDF(doc, item, margen, ancho, y); });
    y += 5;
  }

  const hayCostes = costes.comunidadMensual || costes.ibiAnual || costes.tasaBasurasAnual || costes.tieneDerramas;
  if (hayCostes) {
    y = seccionPDF(doc, "Costes", margen, y);
    if (costes.comunidadMensual) y = filaCostePDF(doc, "Comunidad", `${formatearImporte(costes.comunidadMensual)}/mes`, margen, ancho, y);
    if (costes.ibiAnual) y = filaCostePDF(doc, "IBI", `${formatearImporte(costes.ibiAnual)}/año`, margen, ancho, y);
    if (costes.tasaBasurasAnual) y = filaCostePDF(doc, "Tasa de basuras", `${formatearImporte(costes.tasaBasurasAnual)}/año`, margen, ancho, y);
    y = filaCostePDF(doc, "Derramas activas", costes.tieneDerramas ? "Sí" : "No", margen, ancho, y);
    if (costes.tieneDerramas) {
      const detalleDerrama = [formatearImporte(costes.derramaImporte), costes.derramaDescripcion].filter(Boolean).join(" — ");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(140, 140, 140);
      const lineasDerrama = doc.splitTextToSize(detalleDerrama, ancho);
      doc.text(lineasDerrama, margen, y);
      y += lineasDerrama.length * 5;
    }
    y += 5;
  }

  if (entorno.resumen) {
    y = seccionPDF(doc, "Resumen", margen, y);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...GRIS_TEXTO);
    const lineasResumen = doc.splitTextToSize(entorno.resumen, ancho);
    doc.text(lineasResumen, margen, y);
    y += lineasResumen.length * 5.5;
  }

  const centroX = 210 / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 26);
  doc.text(NOMBRE_AGENTE, centroX, 281, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(140, 140, 140);
  doc.text(TELEFONO_AGENTE, centroX, 286, { align: "center" });

  return doc;
}

function abrirPDFGuardado(dataUriString) {
  const partes = dataUriString.split(",");
  const binario = atob(partes[1]);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

document.getElementById("btn-exportar-memoria").addEventListener("click", async () => {
  const exp = cargar(STORAGE_EXPEDIENTES).find(x => x.id === expedienteActualId);
  if (!exp) return;

  const boton = document.getElementById("btn-exportar-memoria");
  boton.disabled = true;
  boton.textContent = "Generando...";

  try {
    const doc = await generarMemoriaPDF(exp);
    const pdfBase64 = doc.output("datauristring");

    const nuevosExpedientes = cargar(STORAGE_EXPEDIENTES).map(x =>
      x.id === expedienteActualId
        ? { ...x, memoriaVisita: { pdfBase64, generadaEl: new Date().toISOString() } }
        : x
    );

    try {
      guardar(STORAGE_EXPEDIENTES, nuevosExpedientes);
      alert("Memoria generada y guardada.");
      renderDetalleExpediente();
    } catch (errorGuardado) {
      alert("El PDF se generó pero no se pudo guardar: se ha llenado la memoria del navegador. Borra alguna foto o memoria antigua e inténtalo de nuevo.");
      abrirPDFGuardado(pdfBase64);
    }
  } catch (err) {
    alert("No se pudo generar el PDF. Revisa que todos los datos estén guardados e inténtalo de nuevo.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Exportar memoria (PDF)";
  }
});

document.getElementById("btn-abrir-memoria").addEventListener("click", () => {
  const exp = cargar(STORAGE_EXPEDIENTES).find(x => x.id === expedienteActualId);
  if (exp && exp.memoriaVisita) abrirPDFGuardado(exp.memoriaVisita.pdfBase64);
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
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const ayerStr = ayer.toISOString().slice(0, 10);

  document.getElementById("dash-fecha").textContent =
    `${DIAS_SEMANA[hoy.getDay()]}, ${hoy.getDate()} de ${MESES[hoy.getMonth()]}`;

  const citas = cargar(STORAGE_CITAS);
  const leads = cargar(STORAGE_LEADS);
  const expedientes = cargar(STORAGE_EXPEDIENTES);

  const citasHoy = citas.filter(c => c.fecha === hoyStr).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
  const citasAyerPendientes = citas.filter(c => c.fecha === ayerStr && estadoCitaNormalizado(c) === "pendiente");

  const leadsSeguimientoHoy = leads
    .map(l => ({ lead: l, ultimo: (l.historial || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha))[0] }))
    .filter(({ ultimo }) => ultimo && ultimo.volverContactar && ultimo.volverContactar <= hoyStr);

  document.getElementById("dash-resumen").textContent =
    `${citasHoy.length} visita${citasHoy.length === 1 ? "" : "s"} · ` +
    `${leadsSeguimientoHoy.length} seguimiento${leadsSeguimientoHoy.length === 1 ? "" : "s"} · ` +
    `${citasAyerPendientes.length} pendiente${citasAyerPendientes.length === 1 ? "" : "s"} de ayer`;

  const contAlertaAyer = document.getElementById("dash-alerta-ayer");
  contAlertaAyer.innerHTML = "";
  if (citasAyerPendientes.length > 0) {
    contAlertaAyer.hidden = false;
    citasAyerPendientes.forEach(cita => {
      const item = document.createElement("div");
      item.className = "dash-alerta-ayer-item";
      item.innerHTML = `
        <div class="dash-alerta-ayer-texto">Ayer: ${escapeHtml(cita.titulo)} — sin resolver</div>
        <div class="dash-alerta-ayer-acciones">
          <button class="reagendar" data-id="${cita.id}">Reagendar</button>
          <button class="cancelar" data-id="${cita.id}">Cancelar</button>
          <button class="hecho" data-id="${cita.id}">Marcar como hecho</button>
        </div>
      `;
      contAlertaAyer.appendChild(item);
    });

    contAlertaAyer.querySelectorAll(".reagendar").forEach(btn => {
      btn.addEventListener("click", () => abrirEditarCita(btn.getAttribute("data-id")));
    });
    contAlertaAyer.querySelectorAll(".cancelar").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        guardar(STORAGE_CITAS, cargar(STORAGE_CITAS).map(c => c.id === id ? { ...c, estado: "cancelada" } : c));
        renderDashboard();
      });
    });
    contAlertaAyer.querySelectorAll(".hecho").forEach(btn => {
      btn.addEventListener("click", () => abrirRegistroVisita(btn.getAttribute("data-id")));
    });
  } else {
    contAlertaAyer.hidden = true;
  }

  const prioridades = [];
  const hayActividadHoy = citasHoy.length > 0 || leadsSeguimientoHoy.length > 0;

  if (hayActividadHoy) {
    const itemsHoy = [];

    citasHoy.forEach(c => {
      itemsHoy.push({
        hora: c.hora || "",
        urgente: false,
        texto: `Visita ${c.hora} — ${c.titulo}${c.direccion ? " · " + c.direccion : ""}`,
        accion: () => mostrarVista("view-agenda", "agenda")
      });
    });
    leadsSeguimientoHoy.forEach(({ lead: l, ultimo }) => {
      itemsHoy.push({
        hora: ultimo.volverContactarHora || "",
        urgente: true,
        texto: `Seguimiento: ${l.nombre}${ultimo.volverContactarHora ? " — " + ultimo.volverContactarHora : ""}`,
        accion: () => abrirDetalleLead(l.id)
      });
    });

    itemsHoy
      .sort((a, b) => (a.hora || "99:99").localeCompare(b.hora || "99:99"))
      .forEach(item => prioridades.push(item));
  } else {
    const itemsPendientes = [];
    expedientes.filter(x => x.estado === "en_curso").forEach(x => {
      checklistDe(x).filter(c => !c.hecho).forEach(c => itemsPendientes.push({ expediente: x, item: c }));
    });
    itemsPendientes.slice(0, 5).forEach(({ expediente, item }) => {
      prioridades.push({
        urgente: false,
        texto: `Solicitar ${item.nombre} — ${expediente.direccion}`,
        accion: () => abrirDetalleExpediente(expediente.id)
      });
    });
  }

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
