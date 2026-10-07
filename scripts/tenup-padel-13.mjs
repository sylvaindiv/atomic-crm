/* global DOMParser, document, location */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Papa from "papaparse";
import { chromium } from "playwright";

const ORIGIN = "https://tenup.fft.fr";
const SEARCH_URL = `${ORIGIN}/back/public/v1/tournois`;
const SEARCH_PAGE = `${ORIGIN}/recherche/tournois`;
const OUTPUT_ROOT = path.resolve(".context/tenup-padel-13");
const SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2_000, 5_000, 15_000];
const REQUEST_TIMEOUT = 30_000;
const QUEUE_TIMEOUT = 120_000;
const START_INTERVAL = 500;
const CSV_FIELDS = {
  clubs: [
    "club_id",
    "nom",
    "adresse",
    "code_postal",
    "ville",
    "telephone",
    "url_source",
    "collecte_le",
  ],
  judges: [
    "juge_id",
    "id_tenup",
    "prenom",
    "nom",
    "email",
    "telephone",
    "url_source",
    "collecte_le",
  ],
  associations: [
    "club_id",
    "juge_id",
    "role",
    "tournoi_id",
    "tournoi_nom",
    "date_debut",
    "date_fin",
    "url_source",
    "collecte_le",
  ],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) =>
  value == null ? "" : String(value).replace(/\s+/gu, " ").trim();
const normalize = (value) =>
  clean(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");
const sha = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);
const validTournamentId = (id) =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/u.test(id);
const validClubCode = (code) =>
  typeof code === "string" && /^\d{1,20}$/u.test(code);

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} n'est pas un objet Nuxt valide`);
  return value;
}

export function resolveNuxtValue(table, ref) {
  if (!Number.isInteger(ref) || ref < 0 || ref >= table.length)
    throw new Error(`Référence Nuxt invalide: ${ref}`);
  let value = table[ref];
  let depth = 0;
  while (
    Array.isArray(value) &&
    ["ShallowReactive", "Reactive"].includes(value[0])
  ) {
    if (++depth > 8) throw new Error("Enveloppes Nuxt récursives");
    const next = value[1];
    if (!Number.isInteger(next) || next < 0 || next >= table.length)
      throw new Error(`Référence Nuxt invalide: ${next}`);
    value = table[next];
  }
  return value;
}

function nuxtData(table) {
  if (!Array.isArray(table) || table.length < 4)
    throw new Error("Table Nuxt absente ou invalide");
  const root = object(resolveNuxtValue(table, 0), "Racine");
  const data = object(resolveNuxtValue(table, root.data), "Données");
  return data;
}

function referencedField(table, source, key, label, { optional = false } = {}) {
  if (!Object.hasOwn(source, key)) {
    if (optional) return undefined;
    throw new Error(`Champ Nuxt absent: ${label}.${key}`);
  }
  const ref = source[key];
  if (!Number.isInteger(ref))
    throw new Error(`Référence Nuxt invalide: ${label}.${key}`);
  return resolveNuxtValue(table, ref);
}

function textField(table, source, key, label, { optional = false } = {}) {
  const value = referencedField(table, source, key, label, { optional });
  if (value == null && optional) return "";
  if (typeof value !== "string")
    throw new Error(`Champ Nuxt non textuel: ${label}.${key}`);
  return clean(value);
}

function personFromNuxt(table, value, label) {
  const person = object(value, label);
  const id = Object.hasOwn(person, "idCrm")
    ? referencedField(table, person, "idCrm", label)
    : null;
  if (id != null && !["string", "number"].includes(typeof id))
    throw new Error(`Identifiant Nuxt invalide: ${label}.idCrm`);
  const result = {
    idCrm: id == null || clean(id) === "" || Number(id) === 0 ? "" : clean(id),
    prenom: textField(table, person, "prenom", label, { optional: true }),
    nom: textField(table, person, "nom", label, { optional: true }),
    email: textField(table, person, "email", label, { optional: true }),
    telephone: textField(table, person, "tel", label, { optional: true }),
  };
  if (!Object.values(result).some(Boolean))
    throw new Error(`${label} sans identité ni coordonnées`);
  return result;
}

export function extractTournament(table, expectedId) {
  if (!validTournamentId(expectedId))
    throw new Error(`Identifiant de tournoi invalide: ${expectedId}`);
  const data = nuxtData(table);
  const pathKey = Object.keys(data).find((key) =>
    key.endsWith(`/tournois/${expectedId}/fiche-tournoi`),
  );
  if (!pathKey)
    throw new Error(`Réponse Nuxt de tournoi absente pour ${expectedId}`);
  const payload = object(
    resolveNuxtValue(table, data[pathKey]),
    "Fiche tournoi",
  );
  const entete = object(
    referencedField(table, payload, "entete", "Fiche tournoi"),
    "Entête tournoi",
  );
  const tournoi = object(
    referencedField(table, payload, "tournoi", "Fiche tournoi"),
    "Tournoi",
  );
  const club = object(
    referencedField(table, tournoi, "club", "Tournoi"),
    "Club du tournoi",
  );
  const clubCode = textField(table, club, "code", "Club du tournoi");
  if (!validClubCode(clubCode))
    throw new Error(`Code club invalide: ${clubCode}`);
  const judgeValue = referencedField(table, tournoi, "jugeArbitre", "Tournoi");
  const assistantValues =
    referencedField(table, tournoi, "jugesArbitresAdjoints", "Tournoi") ?? [];
  if (judgeValue != null && typeof judgeValue !== "object")
    throw new Error("Juge-arbitre principal de type inattendu");
  if (!Array.isArray(assistantValues))
    throw new Error("Liste des juges-arbitres adjoints de type inattendu");
  return {
    id: expectedId,
    nom: textField(table, entete, "libelle", "Entête tournoi"),
    dateDebut: textField(table, entete, "dateDebut", "Entête tournoi"),
    dateFin: textField(table, entete, "dateFin", "Entête tournoi"),
    club: {
      code: clubCode,
      nom: textField(table, club, "nom", "Club du tournoi", { optional: true }),
    },
    jugeArbitre:
      judgeValue == null
        ? null
        : personFromNuxt(table, judgeValue, "Juge-arbitre principal"),
    jugesArbitresAdjoints: assistantValues.map((ref, index) =>
      personFromNuxt(
        table,
        resolveNuxtValue(table, ref),
        `Juge-arbitre adjoint ${index + 1}`,
      ),
    ),
    url: `${ORIGIN}/tournoi/${expectedId}`,
  };
}

export function extractClub(table, expectedCode) {
  if (!validClubCode(expectedCode))
    throw new Error(`Code club invalide: ${expectedCode}`);
  const data = nuxtData(table);
  const key = Object.keys(data).find(
    (item) => item === `club-header-${expectedCode}`,
  );
  if (!key)
    throw new Error(`Réponse Nuxt de club absente pour ${expectedCode}`);
  const source = object(resolveNuxtValue(table, data[key]), "Fiche club");
  if (
    !["nomClub", "adresse", "contacts"].some((field) =>
      Object.hasOwn(source, field),
    )
  )
    throw new Error("Structure de fiche club inconnue");
  const name = textField(table, source, "nomClub", "Fiche club", {
    optional: true,
  });
  const addressValue = referencedField(table, source, "adresse", "Fiche club", {
    optional: true,
  });
  const address =
    addressValue == null ? {} : object(addressValue, "Adresse du club");
  const address1 = textField(table, address, "adresse1", "Adresse du club", {
    optional: true,
  });
  const address2 = textField(table, address, "adresse2", "Adresse du club", {
    optional: true,
  });
  const postalCode = textField(
    table,
    address,
    "codePostal",
    "Adresse du club",
    { optional: true },
  );
  const city = textField(table, address, "ville", "Adresse du club", {
    optional: true,
  });
  const contactValues =
    referencedField(table, source, "contacts", "Fiche club", {
      optional: true,
    }) ?? [];
  if (!Array.isArray(contactValues))
    throw new Error("Contacts du club de type inattendu");
  let telephone = "";
  for (const ref of contactValues) {
    const contact = object(resolveNuxtValue(table, ref), "Contact du club");
    if (
      textField(table, contact, "code", "Contact du club", {
        optional: true,
      }) === "TELEPHONE"
    ) {
      telephone = textField(table, contact, "libelle", "Contact du club", {
        optional: true,
      });
      break;
    }
  }
  return {
    code: expectedCode,
    nom: name,
    adresse: [address1, address2].filter(Boolean).join("\n"),
    code_postal: postalCode,
    ville: city,
    telephone,
    url: `${ORIGIN}/club/${expectedCode}`,
  };
}

export function checkSearchPages(pages, total) {
  const issues = [];
  const seenPages = new Set();
  const ids = new Set();
  let received = 0;
  for (const page of pages) {
    if (!Array.isArray(page.cards)) {
      issues.push("réponse sans tableau cards");
      continue;
    }
    const pageIds = page.cards
      .map((card) => card.idHomologation)
      .filter((id) => validTournamentId(id));
    const signature = JSON.stringify(pageIds);
    if (pageIds.length && seenPages.has(signature)) issues.push("page répétée");
    seenPages.add(signature);
    received += page.cards.length;
    for (const id of pageIds) ids.add(id);
  }
  if (ids.size !== total)
    issues.push(
      `décompte incohérent: ${ids.size} identifiants uniques pour ${total} annoncés`,
    );
  if (received < total)
    issues.push(
      `pages incomplètes: ${received} résultats reçus pour ${total} annoncés`,
    );
  if (received > total)
    issues.push(`trop de résultats reçus: ${received} pour ${total} annoncés`);
  return { issues, ids: [...ids], complete: issues.length === 0 };
}

export function stablePasses(first, second) {
  const signature = (pass) => `${pass.total}|${[...pass.ids].sort().join("|")}`;
  return Boolean(first && second && signature(first) === signature(second));
}

function personKey(person, tournamentId, role, index) {
  const id = clean(person.idCrm);
  if (id) return `tenup:${id}`;
  const name = `${normalize(person.prenom)}\u0000${normalize(person.nom)}`;
  const email = clean(person.email).toLocaleLowerCase("fr");
  const telephone = clean(person.telephone).replace(/[^\d+]/gu, "");
  if (email || telephone)
    return `local:${sha(`${name}\u0000${email}\u0000${telephone}`)}`;
  return `local:${tournamentId}:${role}:${index + 1}`;
}

export function dedupeTournaments(tournaments) {
  const unique = new Map();
  for (const tournament of tournaments)
    if (!unique.has(tournament.id)) unique.set(tournament.id, tournament);
  return [...unique.values()];
}

export function buildDataset(tournaments, clubSources, collectedAt) {
  const clubMap = new Map();
  for (const source of clubSources) {
    if (source?.code && !clubMap.has(source.code))
      clubMap.set(source.code, source);
  }
  const judges = new Map();
  const associations = new Map();
  const missing = new Map();
  const reportMissing = (entity, field, id) => {
    const key = `${entity}\u0000${field}`;
    const group = missing.get(key) ?? {
      entite: entity,
      champ: field,
      nombre: 0,
      exemples: [],
    };
    group.nombre += 1;
    if (group.exemples.length < 5) group.exemples.push(id);
    missing.set(key, group);
  };
  for (const club of clubMap.values()) {
    for (const [field, value] of Object.entries({
      nom: club.nom,
      adresse: club.adresse,
      code_postal: club.code_postal,
      ville: club.ville,
      telephone: club.telephone,
    })) {
      if (!clean(value)) reportMissing("club", field, club.code);
    }
  }
  const addJudge = (person, tournament, role, index) => {
    const id = personKey(person, tournament.id, role, index);
    const prior = judges.get(id);
    const record = prior ?? {
      id,
      id_tenup: clean(person.idCrm),
      prenom: clean(person.prenom),
      nom: clean(person.nom),
      emails: new Map(),
      telephones: new Map(),
      sources: new Set(),
    };
    if (!record.prenom && clean(person.prenom))
      record.prenom = clean(person.prenom);
    if (!record.nom && clean(person.nom)) record.nom = clean(person.nom);
    if (clean(person.email))
      record.emails.set(
        clean(person.email).toLocaleLowerCase("fr"),
        clean(person.email),
      );
    if (clean(person.telephone))
      record.telephones.set(
        clean(person.telephone).replace(/[^\d+]/gu, ""),
        clean(person.telephone),
      );
    record.sources.add(tournament.url);
    judges.set(id, record);
    const association = {
      club_id: tournament.club.code,
      juge_id: id,
      role,
      tournoi_id: tournament.id,
      tournoi_nom: tournament.nom,
      date_debut: tournament.dateDebut,
      date_fin: tournament.dateFin,
      url_source: tournament.url,
      collecte_le: collectedAt,
    };
    const key = `${association.club_id}\u0000${id}\u0000${association.tournoi_id}\u0000${role}`;
    associations.set(key, association);
  };

  const eligible = [...tournaments].sort((a, b) => a.id.localeCompare(b.id));
  for (const tournament of eligible) {
    for (const [role, people] of [
      ["principal", tournament.jugeArbitre ? [tournament.jugeArbitre] : []],
      ["adjoint", tournament.jugesArbitresAdjoints],
    ]) {
      people.forEach((person, index) =>
        addJudge(person, tournament, role, index),
      );
    }
  }
  const clubRows = [...clubMap.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((club) => ({
      club_id: club.code,
      nom: clean(club.nom),
      adresse: clean(club.adresse).replace(/\n/gu, "\r\n"),
      code_postal: clean(club.code_postal),
      ville: clean(club.ville),
      telephone: clean(club.telephone),
      url_source: club.url ?? `${ORIGIN}/club/${club.code}`,
      collecte_le: collectedAt,
    }));
  const conflicts = [];
  const judgeRecords = [...judges.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const judge of judgeRecords) {
    for (const [field, value] of Object.entries({
      prenom: judge.prenom,
      nom: judge.nom,
      email: judge.emails.size,
      telephone: judge.telephones.size,
    })) {
      if (!value) reportMissing("juge", field, judge.id);
    }
  }
  const judgeRows = judgeRecords.map((judge) => {
    const emails = [...judge.emails.values()].sort((a, b) =>
      a.localeCompare(b, "fr"),
    );
    const telephones = [...judge.telephones.values()].sort((a, b) =>
      a.localeCompare(b, "fr"),
    );
    if (emails.length > 1 || telephones.length > 1)
      conflicts.push({ juge_id: judge.id, emails, telephones });
    return {
      juge_id: judge.id,
      id_tenup: judge.id_tenup,
      prenom: judge.prenom,
      nom: judge.nom,
      email: emails.join(" | "),
      telephone: telephones.join(" | "),
      url_source: [...judge.sources].sort().join(" | "),
      collecte_le: collectedAt,
    };
  });
  const associationRows = [...associations.values()].sort(
    (a, b) =>
      a.club_id.localeCompare(b.club_id) ||
      a.date_debut.localeCompare(b.date_debut) ||
      a.tournoi_id.localeCompare(b.tournoi_id) ||
      a.role.localeCompare(b.role) ||
      a.juge_id.localeCompare(b.juge_id),
  );
  return {
    clubRows,
    judgeRows,
    associationRows,
    missing: [...missing.values()],
    conflicts,
  };
}

export function csvContent(fields, rows) {
  return `\uFEFF${Papa.unparse(
    {
      fields,
      data: rows.map((row) => fields.map((field) => row[field] ?? "")),
    },
    {
      delimiter: ";",
      newline: "\r\n",
      quotes: true,
      escapeFormulae: true,
    },
  )}`;
}

function localDateParis(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function timestampForFolder(date = new Date()) {
  return date.toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function atomicWrite(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temp, content);
  await rename(temp, file);
}

async function atomicJson(file, value) {
  await atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`);
}

function searchBody(dateDebut, from) {
  return {
    pratique: "PADEL",
    from,
    size: SIZE,
    lat: null,
    lng: null,
    distance: 30,
    type: [],
    codeClub: null,
    ligues: [],
    comites: ["6213"],
    dateDebut,
    dateFin: "9999-12-31",
    utiliserMesDonnees: false,
    naturesEpreuves: [],
    typesEpreuves: [],
    naturesTerrains: [],
    categoriesJeu: [],
    categoriesAge: [],
    familles: [],
    tournoiInterne: false,
    classements: [],
    inscriptionEnLigne: null,
    paiementEnLigne: null,
    filtres: false,
    sort: "DISTANCE",
  };
}

function retryAfterMs(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

async function requestWithRetry(page, url, body) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    await rateLimitStart();
    let result;
    try {
      result = await page.evaluate(
        async ({ url: target, body: payload, timeout }) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeout);
          try {
            const response = await fetch(target, {
              method: payload == null ? "GET" : "POST",
              credentials: "include",
              headers: {
                Accept: "application/json, text/html, */*",
                ...(payload == null
                  ? {}
                  : { "Content-Type": "application/json" }),
              },
              body: payload == null ? undefined : JSON.stringify(payload),
              signal: controller.signal,
            });
            return {
              status: response.status,
              retryAfter: response.headers.get("retry-after"),
              text: await response.text(),
            };
          } finally {
            clearTimeout(timer);
          }
        },
        { url, body, timeout: REQUEST_TIMEOUT },
      );
    } catch (error) {
      if (attempt === MAX_RETRIES)
        throw new Error(
          `Erreur réseau après ${MAX_RETRIES} reprises: ${error.message}`,
        );
      await sleep(RETRY_DELAYS[attempt]);
      continue;
    }
    if (
      (result.status === 429 || result.status >= 500) &&
      attempt < MAX_RETRIES
    ) {
      await sleep(
        Math.max(RETRY_DELAYS[attempt], retryAfterMs(result.retryAfter)),
      );
      continue;
    }
    if (result.status < 200 || result.status >= 300)
      throw new Error(`HTTP ${result.status} pour ${url}`);
    return result;
  }
  throw new Error(`Reprises épuisées pour ${url}`);
}

async function domNuxtTable(page, html) {
  return page.evaluate((source) => {
    const documentFromHtml = new DOMParser().parseFromString(
      source,
      "text/html",
    );
    const script = documentFromHtml.querySelector("#__NUXT_DATA__");
    if (!script?.textContent) throw new Error("Script __NUXT_DATA__ absent");
    return JSON.parse(script.textContent);
  }, html);
}

async function navigateNuxtTable(context, url, parse) {
  const page = await context.newPage();
  try {
    await rateLimitStart();
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: REQUEST_TIMEOUT,
    });
    await page.waitForFunction(
      () => Boolean(document.querySelector("#__NUXT_DATA__")?.textContent),
      null,
      { timeout: REQUEST_TIMEOUT },
    );
    const html = await page.content();
    const table = await domNuxtTable(page, html);
    try {
      return { table, value: parse(table) };
    } catch (error) {
      const text = await page
        .locator("body")
        .innerText()
        .catch(() => "");
      throw new Error(
        `${error.message}; texte affiché: ${clean(text).slice(0, 240)}`,
      );
    }
  } finally {
    await page.close();
  }
}

async function fetchNuxtTable(page, context, url, parse) {
  const response = await requestWithRetry(page, url);
  try {
    const table = await domNuxtTable(page, response.text);
    return { table, value: parse(table) };
  } catch (fetchError) {
    try {
      return await navigateNuxtTable(context, url, parse);
    } catch (navigationError) {
      throw new Error(
        `Données structurées absentes après chargement (${fetchError.message}; navigation: ${navigationError.message})`,
      );
    }
  }
}

let nextRequestStart = 0;
async function rateLimitStart() {
  const now = Date.now();
  const start = Math.max(now, nextRequestStart);
  nextRequestStart = start + START_INTERVAL;
  if (start > now) await sleep(start - now);
}

async function mapLimited(items, limit, callback) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await callback(items[index], index);
      }
    }),
  );
  return results;
}

async function waitForSite(page, runDir) {
  const deadline = Date.now() + QUEUE_TIMEOUT;
  await page.goto(SEARCH_PAGE, {
    waitUntil: "domcontentloaded",
    timeout: REQUEST_TIMEOUT,
  });
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      text: document.body?.innerText?.slice(0, 800) ?? "",
      hasNuxt: Boolean(document.querySelector("#__NUXT_DATA__")?.textContent),
    }));
    const queued =
      !state.url.startsWith(ORIGIN) ||
      /queue|waiting room|file d.attente|veuillez patienter/iu.test(
        `${state.title} ${state.text}`,
      );
    if (!queued && state.hasNuxt) return true;
    await sleep(1_000);
  }
  await mkdir(path.join(runDir, "diagnostic"), { recursive: true });
  await page
    .screenshot({
      path: path.join(runDir, "diagnostic", "queue-timeout.png"),
      fullPage: true,
    })
    .catch(() => {});
  const state = await page
    .evaluate(() => ({
      url: location.href,
      title: document.title,
      text: document.body?.innerText ?? "",
    }))
    .catch(() => ({}));
  await atomicJson(
    path.join(runDir, "diagnostic", "queue-timeout.json"),
    state,
  );
  return false;
}

function validateCard(card) {
  if (!card || typeof card !== "object" || Array.isArray(card))
    return "carte tournoi invalide";
  if (!validTournamentId(card.idHomologation))
    return "identifiant tournoi invalide";
  if (
    !card.club ||
    typeof card.club !== "object" ||
    !validClubCode(card.club.code)
  )
    return "code club absent ou invalide";
  if (
    typeof card.dateDebut !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(card.dateDebut)
  )
    return "date de début absente ou invalide";
  return "";
}

async function collectSearchPass(
  page,
  runDir,
  passNumber,
  dateDebut,
  sendRequest = requestWithRetry,
) {
  const pages = [];
  const issues = [];
  let offset = 0;
  let total = null;
  while (total == null || offset < total) {
    const request = searchBody(dateDebut, offset);
    let response;
    try {
      response = await sendRequest(page, SEARCH_URL, request);
    } catch (error) {
      issues.push(error.message);
      break;
    }
    let payload;
    try {
      payload = JSON.parse(response.text);
    } catch {
      issues.push(`Réponse de recherche non JSON (HTTP ${response.status})`);
      break;
    }
    if (
      !Number.isInteger(payload.nbResultats) ||
      payload.nbResultats < 0 ||
      !Array.isArray(payload.cards)
    ) {
      issues.push("Réponse de recherche sans nbResultats/cards valides");
      break;
    }
    if (total == null) total = payload.nbResultats;
    const changedTotal = total !== payload.nbResultats;
    if (changedTotal)
      payload._issues = [
        ...(payload._issues ?? []),
        `Total de recherche modifié pendant la passe (${total} → ${payload.nbResultats})`,
      ];
    for (const card of payload.cards) {
      const error = validateCard(card);
      if (error)
        payload._issues = [
          ...(payload._issues ?? []),
          `${error}: ${String(card?.idHomologation ?? "sans identifiant")}`,
        ];
    }
    pages.push(payload);
    await atomicJson(
      path.join(runDir, "cache", `recherche-${passNumber}-${offset}.json`),
      { request, response: payload },
    );
    if (changedTotal) break;
    if (payload.cards.length === 0) {
      if (offset < total)
        payload._issues = [
          ...(payload._issues ?? []),
          `page vide prématurée à ${offset}/${total}`,
        ];
      break;
    }
    offset += payload.cards.length;
  }
  const result = checkSearchPages(pages, total ?? 0);
  result.issues.push(...issues, ...pages.flatMap((item) => item._issues ?? []));
  return {
    total: total ?? 0,
    pages,
    cards: pages.flatMap((item) => item.cards),
    ids: result.ids,
    issues: [...new Set(result.issues)],
    complete: result.issues.length === 0,
  };
}

function samePass(first, second) {
  return stablePasses(first, second);
}

function hasUsableSearchPass(passes) {
  if (passes.some((pass) => pass.cards.length > 0)) return true;
  return passes.some(
    (pass, index) =>
      index > 0 &&
      pass.total === 0 &&
      pass.complete &&
      passes[index - 1].complete &&
      samePass(passes[index - 1], pass),
  );
}

async function loadRunDirectory(resumePath) {
  if (!resumePath) {
    const runDir = path.join(OUTPUT_ROOT, timestampForFolder());
    await mkdir(path.join(runDir, "cache", "tournois"), { recursive: true });
    await mkdir(path.join(runDir, "cache", "clubs"), { recursive: true });
    const createdAt = new Date().toISOString();
    const params = {
      createdAt,
      dateDebut: localDateParis(new Date(createdAt)),
      filters: searchBody(localDateParis(new Date(createdAt)), 0),
    };
    await atomicJson(path.join(runDir, "params.json"), params);
    return { runDir, params };
  }
  const runDir = path.resolve(resumePath);
  const allowedRoot = `${OUTPUT_ROOT}${path.sep}`;
  if (!runDir.startsWith(allowedRoot))
    throw new Error("--resume doit pointer dans .context/tenup-padel-13/");
  const params = JSON.parse(
    await readFile(path.join(runDir, "params.json"), "utf8"),
  );
  if (!params.createdAt || !/^\d{4}-\d{2}-\d{2}$/u.test(params.dateDebut))
    throw new Error("params.json de reprise invalide");
  await mkdir(path.join(runDir, "cache", "tournois"), { recursive: true });
  await mkdir(path.join(runDir, "cache", "clubs"), { recursive: true });
  return { runDir, params };
}

async function cachedTable(file, parse) {
  try {
    const cached = JSON.parse(await readFile(file, "utf8"));
    if (!Array.isArray(cached.table)) return null;
    return { table: cached.table, value: parse(cached.table) };
  } catch {
    return null;
  }
}

async function saveCsvs(runDir, data) {
  await Promise.all([
    atomicWrite(
      path.join(runDir, "clubs.csv"),
      csvContent(CSV_FIELDS.clubs, data.clubRows),
    ),
    atomicWrite(
      path.join(runDir, "juges_arbitres.csv"),
      csvContent(CSV_FIELDS.judges, data.judgeRows),
    ),
    atomicWrite(
      path.join(runDir, "club_juge_tournois.csv"),
      csvContent(CSV_FIELDS.associations, data.associationRows),
    ),
  ]);
}

async function saveEmptyCsvsUnlessResuming(runDir, collectedAt, isResume) {
  if (isResume) {
    const outputs = await Promise.all(
      ["clubs.csv", "juges_arbitres.csv", "club_juge_tournois.csv"].map(
        (file) => stat(path.join(runDir, file)).catch(() => null),
      ),
    );
    if (outputs.some((output) => output?.isFile())) return true;
  }
  await saveCsvs(runDir, buildDataset([], [], collectedAt));
  return false;
}

async function execute(resumePath) {
  const { runDir, params } = await loadRunDirectory(resumePath);
  const errors = [];
  let browser;
  const searchPasses = [];
  let selectedPass = null;
  let queueTimeout = false;
  let blockingError = "";
  const tournamentDetails = new Map();
  const clubDetails = new Map();
  let excluded = 0;
  let processedTournois = 0;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    if (!(await waitForSite(page, runDir))) {
      queueTimeout = true;
      errors.push({
        url: page.url(),
        cause: `Accès Ten’Up bloqué plus de ${QUEUE_TIMEOUT / 1000} secondes par la file d’attente`,
      });
    } else {
      try {
        for (let passNumber = 1; passNumber <= 3; passNumber += 1) {
          const pass = await collectSearchPass(
            page,
            runDir,
            passNumber,
            params.dateDebut,
          );
          searchPasses.push(pass);
          selectedPass = pass;
          if (searchPasses.length >= 2 && samePass(searchPasses.at(-2), pass))
            break;
        }
        const stable = searchPasses.some(
          (pass, index) => index > 0 && samePass(searchPasses[index - 1], pass),
        );
        if (!stable)
          errors.push({
            url: SEARCH_URL,
            cause: "Pagination non stable après trois passes maximum",
          });
        for (const issue of [
          ...new Set(searchPasses.flatMap((pass) => pass.issues)),
        ])
          errors.push({ url: SEARCH_URL, cause: issue });
      } catch (error) {
        blockingError = error.message;
        errors.push({ url: SEARCH_URL, cause: error.message });
      }

      if (hasUsableSearchPass(searchPasses)) {
        const uniqueCards = new Map();
        for (const pass of searchPasses) {
          for (const card of pass.cards)
            if (validTournamentId(card.idHomologation))
              uniqueCards.set(card.idHomologation, card);
        }
        const cards = [...uniqueCards.values()].sort((a, b) =>
          a.idHomologation.localeCompare(b.idHomologation),
        );
        await mapLimited(cards, 2, async (card) => {
          const id = card.idHomologation;
          const url = `${ORIGIN}/tournoi/${id}`;
          const file = path.join(runDir, "cache", "tournois", `${id}.json`);
          const cached = await cachedTable(file, (table) =>
            extractTournament(table, id),
          );
          if (cached) {
            tournamentDetails.set(id, cached.value);
            processedTournois += 1;
            if (processedTournois % 50 === 0)
              process.stdout.write(
                `Fiches tournoi traitées : ${processedTournois}/${cards.length}\n`,
              );
            return;
          }
          try {
            const { table, value } = await fetchNuxtTable(
              page,
              context,
              url,
              (data) => extractTournament(data, id),
            );
            await atomicJson(file, { url, table });
            tournamentDetails.set(id, value);
          } catch (error) {
            errors.push({ url, cause: error.message });
          } finally {
            processedTournois += 1;
            if (processedTournois % 50 === 0)
              process.stdout.write(
                `Fiches tournoi traitées : ${processedTournois}/${cards.length}\n`,
              );
          }
        });

        const eligible = [];
        const clubFallbacks = new Map();
        for (const card of cards) {
          const id = card.idHomologation;
          const detail = tournamentDetails.get(id);
          if (detail) {
            if (!/^\d{4}-\d{2}-\d{2}$/u.test(detail.dateDebut)) {
              errors.push({
                url: detail.url,
                cause: `Date de début de fiche invalide: ${detail.dateDebut}`,
              });
              continue;
            }
            if (detail.dateDebut < params.dateDebut) {
              excluded += 1;
              continue;
            }
            eligible.push(detail);
            if (!clubFallbacks.has(detail.club.code))
              clubFallbacks.set(detail.club.code, {
                code: detail.club.code,
                nom: detail.club.nom,
              });
          } else if (
            card.dateDebut >= params.dateDebut &&
            validClubCode(card.club?.code)
          ) {
            if (!clubFallbacks.has(card.club.code))
              clubFallbacks.set(card.club.code, {
                code: card.club.code,
                nom: clean(card.club.libelle),
              });
          }
        }

        const clubCodes = [...clubFallbacks.keys()].sort();
        await mapLimited(clubCodes, 2, async (code) => {
          const url = `${ORIGIN}/club/${code}`;
          const file = path.join(runDir, "cache", "clubs", `${code}.json`);
          const cached = await cachedTable(file, (table) =>
            extractClub(table, code),
          );
          if (cached) {
            clubDetails.set(code, cached.value);
            return;
          }
          try {
            const { table, value } = await fetchNuxtTable(
              page,
              context,
              url,
              (data) => extractClub(data, code),
            );
            await atomicJson(file, { url, table });
            clubDetails.set(code, value);
          } catch (error) {
            errors.push({ url, cause: error.message });
            const fallback = clubFallbacks.get(code);
            clubDetails.set(code, {
              code,
              nom: fallback.nom ?? "",
              adresse: "",
              code_postal: "",
              ville: "",
              telephone: "",
              url,
            });
          }
        });

        const clubSources = clubCodes.map((code) => {
          const detail = clubDetails.get(code);
          return (
            detail ?? {
              ...clubFallbacks.get(code),
              adresse: "",
              code_postal: "",
              ville: "",
              telephone: "",
              url: `${ORIGIN}/club/${code}`,
            }
          );
        });
        const dataset = buildDataset(
          dedupeTournaments(eligible),
          clubSources,
          params.createdAt,
        );
        await saveCsvs(runDir, dataset);
        const allCardsUnique = uniqueCards.size;
        const detailsFailed = allCardsUnique - tournamentDetails.size;
        const clubsFailed = clubCodes.filter((code) =>
          errors.some((error) => error.url === `${ORIGIN}/club/${code}`),
        ).length;
        const total = selectedPass.total;
        const stable = searchPasses.some(
          (pass, index) => index > 0 && samePass(searchPasses[index - 1], pass),
        );
        const complete =
          !queueTimeout &&
          !blockingError &&
          stable &&
          selectedPass.complete &&
          allCardsUnique === total &&
          detailsFailed === 0 &&
          clubsFailed === 0 &&
          errors.length === 0;
        const bilan = {
          statut: complete ? "complet" : "incomplet",
          dateDebutCollecte: params.createdAt,
          dateFinCollecte: new Date().toISOString(),
          dateDebutTournois: params.dateDebut,
          filtres: params.filters,
          totalAnnonce: total,
          tournoisUniquesRecenses: allCardsUnique,
          fichesTournoisTraitees: tournamentDetails.size,
          tournoisExclusDejaCommences: excluded,
          tournoisRetenus: eligible.length,
          fichesTournoisEnErreur: detailsFailed,
          fichesClubsTraitees: clubCodes.length - clubsFailed,
          fichesClubsEnErreur: clubsFailed,
          clubs: dataset.clubRows.length,
          jugesArbitres: dataset.judgeRows.length,
          associations: dataset.associationRows.length,
          champsManquants: dataset.missing,
          conflitsCoordonnees: dataset.conflicts,
          pagination: {
            passes: searchPasses.length,
            stable,
            idsUniquesParPasse: searchPasses.map(
              (pass) => new Set(pass.ids).size,
            ),
            idsUniquesUnion: allCardsUnique,
            issues: [...new Set(searchPasses.flatMap((pass) => pass.issues))],
          },
          erreurs: errors,
        };
        await atomicJson(path.join(runDir, "bilan.json"), bilan);
        process.stdout.write(
          `${JSON.stringify({ dossier: runDir, statut: bilan.statut, totalAnnonce: total, tournois: allCardsUnique, clubs: bilan.clubs, juges: bilan.jugesArbitres, associations: bilan.associations })}\n`,
        );
        return { exitCode: complete ? 0 : 2, runDir, bilan };
      }
    }
  } catch (error) {
    blockingError ||= error.message;
    errors.push({ url: SEARCH_PAGE, cause: error.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  const previousOutputsPreserved = await saveEmptyCsvsUnlessResuming(
    runDir,
    params.createdAt,
    Boolean(resumePath),
  );
  const bilan = {
    statut: "incomplet",
    dateDebutCollecte: params.createdAt,
    dateFinCollecte: new Date().toISOString(),
    dateDebutTournois: params.dateDebut,
    filtres: params.filters,
    totalAnnonce: selectedPass?.total ?? null,
    tournoisUniquesRecenses: selectedPass
      ? new Set(
          selectedPass.cards
            .map((card) => card.idHomologation)
            .filter(validTournamentId),
        ).size
      : 0,
    fichesTournoisTraitees: tournamentDetails.size,
    tournoisExclusDejaCommences: excluded,
    tournoisRetenus: 0,
    fichesTournoisEnErreur: errors.filter((error) =>
      /tournoi\//u.test(error.url),
    ).length,
    fichesClubsTraitees: clubDetails.size,
    fichesClubsEnErreur: errors.filter((error) => /club\//u.test(error.url))
      .length,
    clubs: 0,
    jugesArbitres: 0,
    associations: 0,
    champsManquants: [],
    conflitsCoordonnees: [],
    sortiesExistantesPreservees: previousOutputsPreserved,
    pagination: {
      passes: searchPasses.length,
      stable: false,
      issues: [...new Set(searchPasses.flatMap((pass) => pass.issues))],
    },
    erreurs: errors,
  };
  await atomicJson(path.join(runDir, "bilan.json"), bilan);
  process.stdout.write(
    `${JSON.stringify({ dossier: runDir, statut: bilan.statut, erreur: blockingError || errors[0]?.cause || "Accès indisponible" })}\n`,
  );
  return { exitCode: queueTimeout ? 2 : 1, runDir, bilan };
}

function fixtureTournament({
  idCrm = 7,
  adjoints = true,
  omitEmail = false,
  nullEmail = false,
} = {}) {
  const table = [
    ["ShallowReactive", 1],
    { data: 2 },
    ["ShallowReactive", 3],
    {},
  ];
  const add = (value) => {
    table.push(value);
    return table.length - 1;
  };
  const person = (id, first, last, email, telephone) => ({
    idCrm: add(id),
    prenom: add(first),
    nom: add(last),
    ...(omitEmail && id === idCrm
      ? {}
      : { email: add(nullEmail && id === idCrm ? null : email) }),
    tel: add(telephone),
  });
  const assistants = adjoints
    ? [
        add(person(8, "Ariane", "Adjointe", "a@example.test", "0600000001")),
        add(person(9, "Basile", "Adjoint", "b@example.test", "0600000002")),
      ]
    : [];
  const club = add({ code: add("62138033"), nom: add("Club test") });
  const tournament = add({
    club,
    jugeArbitre: add(
      person(idCrm, "Léa", "Juge", "lea@example.test", "0612345678"),
    ),
    jugesArbitresAdjoints: add(assistants),
  });
  const header = add({
    dateDebut: add("2026-12-01"),
    dateFin: add("2026-12-02"),
    libelle: add("Test padel"),
  });
  const fiche = add({ entete: header, tournoi: tournament });
  table[3]["public/v1/tournois/MOJA_TEST/fiche-tournoi"] = fiche;
  return table;
}

function fixtureClub(value) {
  const table = [
    ["ShallowReactive", 1],
    { data: 2 },
    ["ShallowReactive", 3],
    {},
  ];
  table[3]["club-header-62138033"] = table.push(value) - 1;
  return table;
}

async function selfTest() {
  const tournament = extractTournament(fixtureTournament(), "MOJA_TEST");
  assert.equal(
    tournament.jugeArbitre.idCrm,
    "7",
    "idCrm numeric is terminal, not a table reference",
  );
  assert.equal(
    tournament.jugesArbitresAdjoints.length,
    2,
    "two assistants are extracted",
  );
  assert.equal(tournament.jugeArbitre.prenom, "Léa");
  const invalidIdTable = fixtureTournament();
  const invalidIdData = nuxtData(invalidIdTable);
  const invalidIdFiche = resolveNuxtValue(
    invalidIdTable,
    invalidIdData["public/v1/tournois/MOJA_TEST/fiche-tournoi"],
  );
  const invalidIdTournament = resolveNuxtValue(
    invalidIdTable,
    invalidIdFiche.tournoi,
  );
  const invalidIdJudge = resolveNuxtValue(
    invalidIdTable,
    invalidIdTournament.jugeArbitre,
  );
  invalidIdJudge.idCrm = invalidIdTable.length + 1000;
  assert.throws(
    () => extractTournament(invalidIdTable, "MOJA_TEST"),
    /Référence Nuxt invalide/u,
    "out-of-range idCrm is an invalid Nuxt reference",
  );
  assert.throws(
    () => extractClub(fixtureClub({}), "62138033"),
    /Structure de fiche club inconnue/u,
    "empty club structures are rejected",
  );
  const emptyJudgeTable = fixtureTournament();
  const emptyJudgeData = nuxtData(emptyJudgeTable);
  const emptyJudgeFiche = resolveNuxtValue(
    emptyJudgeTable,
    emptyJudgeData["public/v1/tournois/MOJA_TEST/fiche-tournoi"],
  );
  const emptyJudgeTournament = resolveNuxtValue(
    emptyJudgeTable,
    emptyJudgeFiche.tournoi,
  );
  emptyJudgeTournament.jugeArbitre = emptyJudgeTable.push({}) - 1;
  assert.throws(
    () => extractTournament(emptyJudgeTable, "MOJA_TEST"),
    /sans identité ni coordonnées/u,
    "empty judge structures are rejected",
  );
  assert.equal(
    extractTournament(fixtureTournament({ omitEmail: true }), "MOJA_TEST")
      .jugeArbitre.email,
    "",
    "optional field is empty",
  );
  assert.equal(
    extractTournament(fixtureTournament({ nullEmail: true }), "MOJA_TEST")
      .jugeArbitre.email,
    "",
    "Nuxt null value is empty",
  );
  assert.throws(
    () =>
      extractTournament(
        [["ShallowReactive", 1], { data: 2 }, ["ShallowReactive", 3], {}],
        "MOJA_TEST",
      ),
    /Réponse Nuxt/u,
    "unknown shape is explicit",
  );

  const shared = {
    idCrm: "10",
    prenom: "Zoé",
    nom: "Juge",
    email: "z@example.test",
    telephone: "0611223344",
  };
  const rows = buildDataset(
    [
      {
        id: "MOJA_A",
        nom: "Tournoi A",
        dateDebut: "2026-12-01",
        dateFin: "2026-12-02",
        club: { code: "62138033", nom: "Club A" },
        jugeArbitre: shared,
        jugesArbitresAdjoints: [],
        url: `${ORIGIN}/tournoi/MOJA_A`,
      },
      {
        id: "MOJA_B",
        nom: "Tournoi B",
        dateDebut: "2026-12-03",
        dateFin: "2026-12-04",
        club: { code: "62138034", nom: "Club B" },
        jugeArbitre: shared,
        jugesArbitresAdjoints: [],
        url: `${ORIGIN}/tournoi/MOJA_B`,
      },
    ],
    [
      {
        code: "62138033",
        nom: "Club A",
        adresse: "",
        code_postal: "",
        ville: "",
        telephone: "",
        url: `${ORIGIN}/club/62138033`,
      },
      {
        code: "62138034",
        nom: "Club B",
        adresse: "",
        code_postal: "",
        ville: "",
        telephone: "",
        url: `${ORIGIN}/club/62138034`,
      },
    ],
    "2026-10-07",
  );
  assert.equal(
    rows.judgeRows.length,
    1,
    "same judge is one person across clubs",
  );
  assert.equal(
    rows.associationRows.length,
    2,
    "same judge has a separate association for each club",
  );
  const homonyms = buildDataset(
    [
      {
        id: "MOJA_C",
        nom: "Tournoi C",
        dateDebut: "2026-12-01",
        dateFin: "2026-12-02",
        club: { code: "62138033" },
        jugeArbitre: {
          prenom: "Sam",
          nom: "Lee",
          email: "one@example.test",
          telephone: "",
        },
        jugesArbitresAdjoints: [],
        url: `${ORIGIN}/tournoi/MOJA_C`,
      },
      {
        id: "MOJA_D",
        nom: "Tournoi D",
        dateDebut: "2026-12-03",
        dateFin: "2026-12-04",
        club: { code: "62138033" },
        jugeArbitre: {
          prenom: "Sam",
          nom: "Lee",
          email: "two@example.test",
          telephone: "",
        },
        jugesArbitresAdjoints: [],
        url: `${ORIGIN}/tournoi/MOJA_D`,
      },
    ],
    [],
    "2026-10-07",
  );
  assert.equal(
    homonyms.judgeRows.length,
    2,
    "homonyms with different coordinates do not merge",
  );

  const pages = [
    { cards: [{ idHomologation: "MOJA_A" }, { idHomologation: "MOJA_B" }] },
    { cards: [{ idHomologation: "MOJA_A" }, { idHomologation: "MOJA_B" }] },
  ];
  assert.ok(checkSearchPages(pages, 4).issues.includes("page répétée"));
  assert.ok(
    checkSearchPages(pages, 4).issues.some((issue) =>
      issue.startsWith("décompte incohérent"),
    ),
  );
  assert.ok(
    stablePasses(
      { total: 4, ids: ["MOJA_A", "MOJA_B"], complete: false },
      { total: 4, ids: ["MOJA_B", "MOJA_A"], complete: false },
    ),
    "stable identifiers are distinct from count completeness",
  );
  assert.equal(
    hasUsableSearchPass([
      { total: 0, ids: [], cards: [], complete: true },
      { total: 0, ids: [], cards: [], complete: true },
    ]),
    true,
    "two stable empty searches are still a successful result",
  );
  assert.equal(
    hasUsableSearchPass([
      { total: 0, ids: [], cards: [], complete: true },
      { total: 0, ids: [], cards: [], complete: false },
    ]),
    false,
    "an empty failed search must not replace prior exports",
  );
  assert.equal(
    hasUsableSearchPass([
      {
        total: 150,
        ids: ["MOJA_A"],
        cards: [{ id: "MOJA_A" }],
        complete: false,
      },
    ]),
    true,
    "partial non-empty results remain available for recovery",
  );
  const tempDir = await mkdtemp(path.join(tmpdir(), "tenup-padel-self-test-"));
  try {
    await mkdir(path.join(tempDir, "cache"), { recursive: true });
    const offsets = [];
    const pageCards = Array.from({ length: 150 }, (_, index) => ({
      idHomologation: `MOJA_${String(index).padStart(3, "0")}`,
      dateDebut: "2026-12-01",
      club: { code: "62138033" },
    }));
    const paged = await collectSearchPass(
      null,
      tempDir,
      1,
      "2026-10-07",
      async (_page, _url, request) => {
        offsets.push(request.from);
        return {
          status: 200,
          text: JSON.stringify({
            nbResultats: 150,
            cards: pageCards.slice(request.from, request.from + 50),
          }),
        };
      },
    );
    assert.deepEqual(offsets, [0, 50, 100]);
    assert.equal(paged.complete, true);
    const changedTotal = await collectSearchPass(
      null,
      tempDir,
      2,
      "2026-10-07",
      async (_page, _url, request) => ({
        status: 200,
        text: JSON.stringify({
          nbResultats: request.from ? 151 : 150,
          cards: pageCards.slice(request.from, request.from + 100),
        }),
      }),
    );
    assert.equal(changedTotal.cards.length, 150);
    assert.ok(
      changedTotal.issues.some((issue) =>
        issue.includes("Total de recherche modifié"),
      ),
    );
    const failedPass = await collectSearchPass(
      null,
      tempDir,
      3,
      "2026-10-07",
      async () => {
        throw new Error("recherche indisponible");
      },
    );
    assert.equal(failedPass.cards.length, 0);
    assert.equal(failedPass.complete, false);
    const tournamentCache = path.join(
      tempDir,
      "cache",
      "tournois",
      "MOJA_TEST.json",
    );
    await mkdir(path.dirname(tournamentCache), { recursive: true });
    await atomicJson(tournamentCache, {
      url: `${ORIGIN}/tournoi/MOJA_TEST`,
      table: fixtureTournament(),
    });
    assert.ok(
      await cachedTable(tournamentCache, (table) =>
        extractTournament(table, "MOJA_TEST"),
      ),
      "valid cached tournament survives a failed search",
    );
    const outputFiles = [
      "clubs.csv",
      "juges_arbitres.csv",
      "club_juge_tournois.csv",
    ];
    const priorOutputs = await Promise.all(
      outputFiles.map(async (file) => {
        const contents = `previous-${file}`;
        await writeFile(path.join(tempDir, file), contents);
        return contents;
      }),
    );
    assert.equal(
      await saveEmptyCsvsUnlessResuming(tempDir, "2026-10-07", true),
      true,
    );
    assert.deepEqual(
      await Promise.all(
        outputFiles.map((file) => readFile(path.join(tempDir, file), "utf8")),
      ),
      priorOutputs,
      "a failed resume does not replace prior CSVs with empty exports",
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  assert.equal(
    dedupeTournaments([{ id: "MOJA_A" }, { id: "MOJA_A" }]).length,
    1,
    "cache/search duplicates are collapsed",
  );

  const csv = csvContent(
    ["telephone", "nom", "note"],
    [{ telephone: "0612345678", nom: 'Élodie "Ligne\nDeux"', note: "=2+3" }],
  );
  assert.ok(csv.startsWith("\uFEFF"));
  const parsed = Papa.parse(csv.slice(1), {
    delimiter: ";",
    header: true,
    skipEmptyLines: true,
  }).data[0];
  assert.equal(parsed.telephone, "0612345678");
  assert.equal(parsed.nom, 'Élodie "Ligne\nDeux"');
  assert.equal(parsed.note, "'=2+3", "formula-leading cell is escaped");
  process.stdout.write(
    "Self-test OK: Nuxt, juges, associations, identités, pagination, reprise et CSV\n",
  );
}

async function main(args) {
  if (args.length === 1 && args[0] === "--self-test") {
    await selfTest();
    return 0;
  }
  let resumePath = null;
  if (args.length === 2 && args[0] === "--resume") resumePath = args[1];
  else if (args.length)
    throw new Error(
      "Usage: node scripts/tenup-padel-13.mjs [--self-test | --resume <dossier>]",
    );
  const result = await execute(resumePath);
  return result.exitCode;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error.stack ?? error);
      process.exitCode = 1;
    });
}
