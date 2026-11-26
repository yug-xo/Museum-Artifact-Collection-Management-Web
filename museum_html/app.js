const conditions = ["Excellent", "Good", "Fair", "Poor", "Under Conservation"];
const fields = ["accession_no", "name", "category", "origin", "period", "condition", "location", "owner", "description"];

let artifacts = JSON.parse(localStorage.getItem("artifacts")) || sampleArtifacts;
let exhibitions = JSON.parse(localStorage.getItem("exhibitions")) || sampleExhibitions;
let editingId = null;
let viewingId = null;

function $(id) {
  return document.getElementById(id);
}

function save() {
  localStorage.setItem("artifacts", JSON.stringify(artifacts));
  localStorage.setItem("exhibitions", JSON.stringify(exhibitions));
}

function nextId(list) {
  return list.length ? Math.max(...list.map(item => item.id)) + 1 : 1;
}

function findArtifact(id) {
  return artifacts.find(a => a.id === id);
}

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function contains(text, part) {
  return text.toLowerCase().includes(part.trim().toLowerCase());
}

function showMessage(text, isError) {
  const box = $("message");
  box.textContent = text;
  box.className = isError ? "error" : "success";
  box.hidden = false;
}

function search() {
  const filters = Object.fromEntries(new FormData($("searchForm")));
  return artifacts.filter(a => {
    const text = [a.accession_no, a.name, a.period, a.owner, a.description].join(" ");
    const titles = exhibitions.filter(e => e.artifact_id === a.id).map(e => e.title).join(" ");
    return contains(text, filters.keyword)
      && contains(a.category, filters.category)
      && contains(a.origin, filters.origin)
      && (filters.condition === "" || a.condition === filters.condition)
      && contains(a.location, filters.location)
      && contains(titles, filters.exhibition);
  });
}

function showTable() {
  const found = search();
  $("count").textContent = found.length + " of " + artifacts.length + " artifacts";
  $("empty").hidden = found.length > 0;
  $("rows").innerHTML = found.map(a => `
    <tr>
      <td>${escapeHtml(a.accession_no)}</td>
      <td>${escapeHtml(a.name)}</td>
      <td>${escapeHtml(a.category)}</td>
      <td>${escapeHtml(a.origin)}</td>
      <td><span class="badge ${a.condition.toLowerCase().replace(" ", "-")}">${escapeHtml(a.condition)}</span></td>
      <td>${escapeHtml(a.location)}</td>
      <td>
        <button onclick="viewArtifact(${a.id})">View</button>
        <button onclick="openForm(${a.id})">Edit</button>
        <button class="danger" onclick="deleteArtifact(${a.id})">Delete</button>
      </td>
    </tr>`).join("");
}

function openForm(id) {
  const form = $("artifactForm");
  editingId = id || null;
  form.reset();
  $("formError").textContent = "";
  $("formTitle").textContent = id ? "Edit artifact" : "Add artifact";
  if (id) {
    const a = findArtifact(id);
    fields.forEach(field => form.elements[field].value = a[field]);
  }
  $("formDialog").showModal();
}

function saveArtifact(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData($("artifactForm")));
  fields.forEach(field => data[field] = data[field].trim());

  const duplicate = artifacts.some(a => a.id !== editingId && a.accession_no.toLowerCase() === data.accession_no.toLowerCase());

  if (data.accession_no === "" || data.name === "") {
    $("formError").textContent = "Accession number and name are required.";
  } else if (!conditions.includes(data.condition)) {
    $("formError").textContent = "Choose a valid condition.";
  } else if (duplicate) {
    $("formError").textContent = "This accession number already exists.";
  } else {
    if (editingId) {
      Object.assign(findArtifact(editingId), data);
    } else {
      artifacts.push({ id: nextId(artifacts), ...data });
    }
    save();
    $("formDialog").close();
    showTable();
    showMessage(editingId ? "Artifact updated." : "Artifact added.");
  }
}

function deleteArtifact(id) {
  if (!confirm("Delete this artifact and its exhibition history?")) return;
  artifacts = artifacts.filter(a => a.id !== id);
  exhibitions = exhibitions.filter(e => e.artifact_id !== id);
  save();
  showTable();
  showMessage("Artifact deleted.");
}

function viewArtifact(id) {
  const a = findArtifact(id);
  viewingId = id;
  $("viewTitle").textContent = a.name;
  $("viewDetails").innerHTML = fields.map(field =>
    `<dt>${field.replace("_", " ")}</dt><dd>${escapeHtml(a[field])}</dd>`).join("");
  $("exhibitionForm").reset();
  $("exhibitionError").textContent = "";
  showExhibitions();
  $("viewDialog").showModal();
}

function showExhibitions() {
  const list = exhibitions.filter(e => e.artifact_id === viewingId);
  if (list.length === 0) {
    $("exhibitionRows").innerHTML = "<tr><td colspan='5'>Not exhibited yet.</td></tr>";
    return;
  }
  $("exhibitionRows").innerHTML = list.map(e => `
    <tr>
      <td>${escapeHtml(e.title)}</td>
      <td>${escapeHtml(e.venue)}</td>
      <td>${e.start_date}</td>
      <td>${e.end_date}</td>
      <td><button class="danger" onclick="deleteExhibition(${e.id})">Remove</button></td>
    </tr>`).join("");
}

function addExhibition(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData($("exhibitionForm")));
  if (data.end_date < data.start_date) {
    $("exhibitionError").textContent = "End date must not be before the start date.";
    return;
  }
  exhibitions.push({ id: nextId(exhibitions), artifact_id: viewingId, title: data.title.trim(), venue: data.venue.trim(), start_date: data.start_date, end_date: data.end_date });
  save();
  $("exhibitionForm").reset();
  $("exhibitionError").textContent = "";
  showExhibitions();
  showTable();
}

function deleteExhibition(id) {
  if (!confirm("Remove this exhibition?")) return;
  exhibitions = exhibitions.filter(e => e.id !== id);
  save();
  showExhibitions();
  showTable();
}

function csvSafe(value) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function csvClean(value) {
  return value.trim().replace(/^[=+\-@]+/, "");
}

function exportCsv() {
  const lines = [fields.join(",")];
  search().forEach(a => lines.push(fields.map(field => csvSafe(a[field])).join(",")));
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  link.download = "artifacts.csv";
  link.click();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        value += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(value);
      value = "";
    } else if (c === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (c !== "\r") {
      value += c;
    }
  }
  if (value !== "" || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

async function importCsv(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showMessage("The file is larger than 2 MB.", true);
    return;
  }

  const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
  const header = rows.length ? rows.shift().map(h => h.trim().toLowerCase()) : [];
  if (!header.includes("accession_no") || !header.includes("name")) {
    showMessage("The file needs accession_no and name columns.", true);
    return;
  }

  let added = 0;
  const skipped = [];
  rows.forEach((row, index) => {
    if (row.join("").trim() === "") return;
    const item = {};
    fields.forEach(field => {
      const position = header.indexOf(field);
      item[field] = position >= 0 && row[position] ? csvClean(row[position]) : "";
    });
    if (item.condition === "") item.condition = "Good";
    const line = index + 2;
    const exists = artifacts.some(a => a.accession_no.toLowerCase() === item.accession_no.toLowerCase());

    if (item.accession_no === "" || item.name === "") {
      skipped.push("Row " + line + ": accession number or name is missing.");
    } else if (!conditions.includes(item.condition)) {
      skipped.push("Row " + line + ": '" + item.condition + "' is not a valid condition.");
    } else if (exists) {
      skipped.push("Row " + line + ": " + item.accession_no + " already exists.");
    } else {
      artifacts.push({ id: nextId(artifacts), ...item });
      added++;
    }
  });

  save();
  showTable();
  showMessage(added + " artifacts imported, " + skipped.length + " rows skipped.", skipped.length > 0 && added === 0);
  $("report").innerHTML = skipped.map(text => "<li>" + escapeHtml(text) + "</li>").join("");
  $("report").hidden = skipped.length === 0;
}

conditions.forEach(c => {
  $("conditionFilter").innerHTML += `<option>${c}</option>`;
  $("conditionField").innerHTML += `<option>${c}</option>`;
});

$("searchForm").oninput = showTable;
$("searchForm").onchange = showTable;
$("clearButton").onclick = () => {
  $("searchForm").reset();
  showTable();
};
$("addButton").onclick = () => openForm();
$("exportButton").onclick = exportCsv;
$("importFile").onchange = importCsv;
$("artifactForm").onsubmit = saveArtifact;
$("exhibitionForm").onsubmit = addExhibition;
document.querySelectorAll(".closeButton").forEach(b => b.onclick = () => b.closest("dialog").close());

showTable();
