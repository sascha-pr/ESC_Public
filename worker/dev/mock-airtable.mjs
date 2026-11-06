// Lokaler Airtable-Nachbau mit erfundenen Beispieldaten – für `npm run dev:mock`, ganz ohne Token und echte Daten.
// Versteht nur das, was der Worker braucht: Liste (mit offset), Einzelabruf, PATCH.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8788);
const EMAIL = (process.env.DEV_USER_EMAIL ?? "trainer.f1@example.org").toLowerCase();
const T = { table: "tbl6pyFB5M2UoFmCF", name: "fldb4pIWaZQt2lYJ0", klasse: "fldFVQv8zJ7bZV23K", trainer: "fld8WnvL4lrRnfJ9P", email: "fldW5d0dO3sGbvsQG" };
const K = {
  table: "tblyfT5TCWF76fZ44", name: "fldWH5f8NuyKSZAAm", geb: "fldz5RqCREzQb8Gew", team: "fldqEXZu0N4WNJMjt",
  status: "fldgXAjpTkk8tCSj8", count: "fldDwB2Cl9qswdjEg", first: "fldeUlh3Si9dcj33X", last: "fldvP82QxQlHDLy77", paper: "fldlyupDUsoOK2Dp5", email: "fldcLIrtbOMJTLAQ3", bounced: "fldByGoeoWiEw9qVs",
  parent: "fldDgCoupcrJnrXsz", phone: "fld6qcqlKJLk3QZxq", since: "fldYRU9DWyxvP1Jp1",
};

const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const team = (id, name, klasse, trainer, email) => ({ id, fields: { [T.name]: name, [T.klasse]: klasse, [T.trainer]: trainer, [T.email]: email } });
const kid = (id, teamId, name, geb, count, last, status, parent, phone, since) => ({
  id, fields: {
    [K.name]: name, [K.geb]: geb, [K.team]: [teamId], [K.status]: status, [K.count]: count,
    [K.first]: ago(30), [K.last]: last, [K.parent]: parent, [K.phone]: phone, ...(since ? { [K.since]: since } : {}),
  },
});

const tables = {
  [T.table]: [
    team("recMockTeamF1xxxx", "F1-Jugend", "F-Jugend", "Jan", EMAIL),
    team("recMockTeamF2xxxx", "F2-Jugend", "F-Jugend", "Jan", EMAIL),
    team("recMockTeamE1xxxx", "E1-Jugend", "E-Jugend", "Kathrin", "trainer.e1@example.org"),
  ],
  [K.table]: [
    kid("recMockKid0000001", "recMockTeamF1xxxx", "Max Beispiel", "2018-03-01", 1, ago(4), "Probetraining", "Anna Beispiel", "0171 0000001"),
    (() => { const r = kid("recMockKid0000002", "recMockTeamF1xxxx", "Mia Schulz", "2019-06-12", 2, ago(4), "Probetraining", "Jörg Schulz", "0160 0000002"); r.fields[K.paper] = true; return r; })(),
    kid("recMockKid0000003", "recMockTeamF1xxxx", "Noah Wagner", "2018-01-20", 3, ago(2), "Antrag ausgehändigt/verschickt", "Sevgi Wagner", "0152 0000003"),
    (() => { const r = kid("recMockKid0000004", "recMockTeamF1xxxx", "Ella Hoffmann", "2018-09-09", 2, ago(7), "Antrag ausgehändigt/verschickt", "Tim Hoffmann", "0176 0000004"); r.fields[K.email] = "tim.hoffmann@gmx.dee"; r.fields[K.bounced] = true; return r; })(),
    kid("recMockKid0000005", "recMockTeamF1xxxx", "Emil Test", "2018-02-02", 2, ago(21), "Antrag eingegangen", "Petra Test", "0175 0000005"),
    kid("recMockKid0000006", "recMockTeamF1xxxx", "Lukas Becker", "2019-04-04", 2, ago(35), "In DFBnet erfasst", "Nina Becker", "0157 0000006"),
    kid("recMockKid0000007", "recMockTeamF1xxxx", "Lina Spiel", "2018-05-05", 3, ago(20), "Spielberechtigt", "Ole Spiel", "0157 0000007", ago(3)),
    kid("recMockKid0000008", "recMockTeamF1xxxx", "Alt Spielberechtigt", "2018-05-05", 3, ago(40), "Spielberechtigt", "X", "0", ago(30)),
    kid("recMockKid0000009", "recMockTeamF1xxxx", "Abgesagt Kind", "2018-05-05", 1, ago(40), "Kein Interesse / abgesagt", "X", "0"),
    kid("recMockKid0000010", "recMockTeamF2xxxx", "Paul Klein", "2019-02-02", 1, ago(3), "Probetraining", "Sandra Klein", "0170 0000010"),
    kid("recMockKid0000011", "recMockTeamE1xxxx", "Lena Muster", "2016-02-02", 2, ago(3), "Probetraining", "Tom Muster", "0163 0000011"),
  ],
};

const send = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
const pick = (rec, fields) => (fields.length ? { id: rec.id, fields: Object.fromEntries(Object.entries(rec.fields).filter(([k]) => fields.includes(k))) } : rec);

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const [, , , table, id] = url.pathname.split("/"); // /v0/<base>/<table>/<id>
  const rows = tables[table];
  if (!rows) return send(res, 404, { error: "NOT_FOUND" });
  if (req.method === "GET" && !id) {
    const offset = Number(url.searchParams.get("offset") ?? 0), size = 5; // klein, damit das Blättern mitgetestet wird
    const page = rows.slice(offset, offset + size).map((r) => pick(r, url.searchParams.getAll("fields[]")));
    return send(res, 200, { records: page, ...(offset + size < rows.length ? { offset: String(offset + size) } : {}) });
  }
  if (req.method === "POST" && !id) {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const created = JSON.parse(raw).records.map((r) => {
        const fields = { ...r.fields };
        for (const k of Object.keys(fields)) if (fields[k] === null) delete fields[k];
        const rec = { id: "recMockNew" + String(rows.length).padStart(7, "0"), fields };
        rows.push(rec);
        return rec;
      });
      send(res, 200, { records: created });
    });
    return;
  }
  const rec = rows.find((r) => r.id === id);
  if (!rec) return send(res, 404, { error: "NOT_FOUND" });
  if (req.method === "GET") return send(res, 200, rec);
  if (req.method === "PATCH") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      for (const [k, v] of Object.entries(JSON.parse(raw).fields)) { if (v === null) delete rec.fields[k]; else rec.fields[k] = v; }
      send(res, 200, rec);
    });
    return;
  }
  send(res, 405, {});
}).listen(PORT, () => console.log(`Airtable-Nachbau auf http://localhost:${PORT} (Trainer-Login: ${EMAIL})`));
