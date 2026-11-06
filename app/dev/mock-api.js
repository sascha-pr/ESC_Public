/* Testversion: ersetzt den Worker durch einen Nachbau im Browser (gleiche Regeln wie worker/src/domain.ts + api.ts).
   Nur erfundene Daten, nichts wird gespeichert – Neuladen setzt alles zurück. Nicht in der echten App verwenden. */
(function(){
  var MAX = 3, SHOW_PLAYABLE_DAYS = 14;
  var offset = 0, mode = 'ok', offline = false, user = 'jan', nextId = 100;

  function iso(d){ return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(d); }
  function today(){ return iso(new Date(Date.now() + offset*86400000)); }
  var REAL_TODAY = iso(new Date());
  function ago(n){ var d = new Date(REAL_TODAY+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); }
  function days(a,b){ return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000); }

  var USERS = {
    jan:     {email:'jan@beispiel-verein.de', teams:['F1','F2']},
    kathrin: {email:'kathrin@beispiel-verein.de', teams:['E1']}
  };
  var TEAMS = {
    F1:{id:'F1', name:'F1-Jugend', ageClass:'F-Jugend', trainer:'Jan'},
    F2:{id:'F2', name:'F2-Jugend', ageClass:'F-Jugend', trainer:'Jan'},
    E1:{id:'E1', name:'E1-Jugend', ageClass:'E-Jugend', trainer:'Kathrin'}
  };
  var kids, undo;
  function seed(){
    function k(id,team,name,jg,count,last,status,parent,phone,since,paper){ return {id:id,team:team,name:name,jg:jg,count:count,first:ago(30),last:last,status:status,parent:parent,phone:phone,since:since||null,paper:!!paper}; }
    kids = [
      k('k1','F1','Max Beispiel',2018,1,ago(4),'probetraining','Anna Beispiel','0171 0000001'),
      k('k2','F1','Mia Schulz',2019,2,ago(4),'probetraining','Jörg Schulz','0160 0000002',null,true),
      k('k3','F1','Noah Wagner',2018,3,ago(2),'antrag_verschickt','Sevgi Wagner','0152 0000003'),
      (function(){ var x = k('k4','F1','Ella Hoffmann',2018,2,ago(7),'antrag_verschickt','Tim Hoffmann','0176 0000004'); x.email = 'tim.hoffmann@gmx.dee'; x.bounced = true; return x; })(),
      k('k5','F1','Emil Test',2018,2,ago(21),'antrag_eingegangen','Petra Test','0175 0000005'),
      k('k6','F1','Lukas Becker',2019,2,ago(35),'dfbnet_erfasst','Nina Becker','0157 0000006'),
      k('k7','F1','Lina Spiel',2018,3,ago(20),'spielberechtigt','Ole Spiel','0157 0000007',ago(3)),
      k('k8','F1','Ben Alt',2018,3,ago(40),'spielberechtigt','X','0',ago(30)),
      k('k9','F1','Abgesagtes Kind',2018,1,ago(40),'abgesagt','X','0'),
      k('k10','F2','Paul Klein',2019,1,ago(3),'probetraining','Sandra Klein','0170 0000010'),
      k('k11','E1','Lena Muster',2016,2,ago(3),'probetraining','Tom Muster','0163 0000011'),
      k('k12','E1','Ida Krüger',2016,3,ago(6),'antrag_verschickt','Marco Krüger','0151 0000012')
    ];
    undo = {};
  }
  seed();

  var APP = {probetraining:'probe', antrag_verschickt:'probe', antrag_eingegangen:'antrag', dfbnet_erfasst:'mitglied', spielberechtigt:'spielberechtigt', abgesagt:null};
  function visible(k){ var s = APP[k.status]; if (!s) return false; if (s==='spielberechtigt' && k.since) return days(k.since,today()) <= SHOW_PLAYABLE_DAYS; return true; }
  function dto(k){
    var s = APP[k.status] || 'probe', d = {id:k.id, name:k.name, jg:k.jg, count:k.count, last:k.last, status:s, attendedToday:k.last===today()};
    if (s==='probe' && k.count>=MAX) d.contact = {parent:k.parent, phone:k.phone};
    if (s==='probe' && k.paper) d.paperApplication = true;
    if (s==='probe' && k.bounced && !k.paper) d.emailProblem = {email: k.email || null};
    return d;
  }
  var MSG = {
    unknown_trainer:'Diese E-Mail-Adresse ist keiner Mannschaft zugeordnet. Bitte bei der Jugendleitung melden.',
    forbidden_team:'Diese Mannschaft gehört nicht zu deinem Zugang.', not_found:'Kind nicht gefunden.',
    not_in_trial:'Das Kind ist nicht mehr im Probetraining – es ist bereits angemeldet.',
    already_today:'Das Kind ist für heute schon eingetragen.',
    limit_reached:'Alle '+MAX+' Probetrainings sind genutzt. Weiter nur mit Mitgliedsantrag.',
    nothing_to_undo:'Es gibt heute nichts rückgängig zu machen.',
    changed:'Der Eintrag wurde inzwischen geändert und kann nicht mehr rückgängig gemacht werden.',
    upstream:'Die Vereinsdatenbank ist gerade nicht erreichbar. Bitte gleich nochmal versuchen.'
  };
  function json(status, body){ return new Response(JSON.stringify(body), {status:status, headers:{'Content-Type':'application/json'}}); }
  function err(status, code, extra){ var b = {error:code, message:MSG[code]}; for (var x in extra||{}) b[x]=extra[x]; return json(status,b); }

  function handle(method, url, body){
    if (mode==='expired') return json(401, {error:'unauthenticated'});
    if (mode==='denied') return err(403,'unknown_trainer');
    if (mode==='down') return err(502,'upstream');
    var u = USERS[user], t = today(), m;
    if (method==='GET' && url.pathname==='/api/me')
      return json(200, {email:u.email, max:MAX, today:t, teams:u.teams.map(function(id){ return TEAMS[id]; })});
    if (method==='GET' && url.pathname==='/api/kids'){
      var team = url.searchParams.get('team') || u.teams[0];
      if (u.teams.indexOf(team)<0) return err(403,'forbidden_team');
      return json(200, {team:team, today:t, kids:kids.filter(function(k){ return k.team===team && visible(k); }).map(dto)
        .sort(function(a,b){ return a.name.localeCompare(b.name,'de'); })});
    }
    if (method==='POST' && (m = url.pathname.match(/^\/api\/kids\/([^/]+)\/email$/))){
      var kk = kids.filter(function(x){ return x.id===decodeURIComponent(m[1]); })[0];
      if (!kk || u.teams.indexOf(kk.team)<0) return err(404,'not_found');
      if (!kk.bounced) return json(409, {error:'no_email_problem', message:'Für dieses Kind ist keine unzustellbare E-Mail gemeldet.'});
      var b = JSON.parse(body || '{}');
      if (b.paper){ kk.email = null; kk.paper = true; }
      else {
        var e = String(b.email||'').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return json(422, {error:'invalid_email', message:'Bitte eine gültige E-Mail-Adresse eintragen.'});
        if (e === (kk.email||'').toLowerCase()) return json(422, {error:'same_email', message:'Das ist dieselbe Adresse, die nicht zugestellt werden konnte. Bitte bei den Eltern nachfragen.'});
        kk.email = e;
      }
      kk.bounced = false; if (kk.status==='antrag_verschickt') kk.status='probetraining';
      return json(200, {kid:dto(kk)});
    }
    if (method==='POST' && (m = url.pathname.match(/^\/api\/kids\/([^/]+)\/(attend|undo)$/))){
      var k = kids.filter(function(x){ return x.id===decodeURIComponent(m[1]); })[0];
      if (!k || u.teams.indexOf(k.team)<0) return err(404,'not_found');
      if (m[2]==='attend'){
        if (APP[k.status]!=='probe') return err(409,'not_in_trial',{kid:dto(k)});
        if (k.last===t) return err(409,'already_today',{kid:dto(k)});
        if (k.count>=MAX) return err(409,'limit_reached',{kid:dto(k)});
        undo[k.id] = {day:t, count:k.count, last:k.last, first:k.first};
        k.count++; k.last=t; k.first=k.first||t;
        if (k.count===2 && k.status==='probetraining' && !k.paper) k.status='antrag_verschickt'; /* wie Automation 1 (nur mit E-Mail) */
        return json(200, {kid:dto(k)});
      }
      var e = undo[k.id];
      if (!e || e.day!==t) return err(409,'nothing_to_undo',{kid:dto(k)});
      if (k.count!==e.count+1 || k.last!==t){ delete undo[k.id]; return err(409,'changed',{kid:dto(k)}); }
      k.count=e.count; k.last=e.last; k.first=e.first; delete undo[k.id];
      return json(200, {kid:dto(k)});
    }
    return json(404, {error:'no_route', message:'Unbekannte Adresse.'});
  }

  var realFetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    var url = new URL(typeof input==='string' ? input : input.url, location.href);
    if (url.pathname.indexOf('/api/')!==0) return realFetch(input, init);
    if (offline) return new Promise(function(_,rej){ setTimeout(function(){ rej(new TypeError('Failed to fetch')); }, 300); });
    var method = (init && init.method) || 'GET';
    return new Promise(function(res){ setTimeout(function(){ res(handle(method, url, init && init.body)); }, 250); });
  };

  /* ---------- Testhelfer ---------- */
  function reload(){ if (window.__appReload) window.__appReload(); }
  function info(){ return 'Test-Tag: '+new Date(today()+'T12:00:00').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})+' · angemeldet als '+(user==='jan'?'Jan (2 Mannschaften)':'Kathrin (1 Mannschaft)'); }
  window.addEventListener('DOMContentLoaded', function(){
    var css = document.createElement('style');
    css.textContent = '.tp{margin:28px auto 0;max-width:480px;border:2px dashed var(--line-strong);border-radius:var(--radius);padding:14px 16px;display:grid;gap:10px;background:var(--surface)}'+
      '.tp h2{margin:0;font-family:var(--display);font-size:20px;text-transform:uppercase;letter-spacing:.04em}'+
      '.tp p{font-size:14px;color:var(--muted)}.tp .chips{display:flex;flex-wrap:wrap;gap:8px}'+
      '.tp button{background:var(--bg);border:1px solid var(--line-strong);border-radius:999px;padding:8px 13px;font-size:14px;color:var(--fg)}'+
      '.tp button[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);font-weight:600}';
    document.head.appendChild(css);
    var box = document.createElement('section');
    box.className = 'tp'; box.setAttribute('aria-label','Testhelfer');
    document.querySelector('main').appendChild(box);
    function draw(){
      box.innerHTML = '<h2>Testhelfer</h2><p>Nur in dieser Testversion: erfundene Daten im Browser, nichts geht an den Verein. Neuladen setzt alles zurück.</p>'+
        '<p><strong>'+info()+'</strong></p>'+
        '<div class="chips">'+
          '<button type="button" data-t="day">Nächster Trainingstag</button>'+
          '<button type="button" data-t="form">Neues Kind wie per Formular</button>'+
          '<button type="button" data-t="user">Trainer wechseln</button>'+
          '<button type="button" data-t="reset">Daten zurücksetzen</button>'+
        '</div><p>Zustände ausprobieren:</p><div class="chips">'+
          ['ok:Normal','expired:Sitzung abgelaufen','denied:Kein Zugang','down:Datenbank weg'].map(function(x){ var p=x.split(':'); return '<button type="button" data-m="'+p[0]+'" aria-pressed="'+(mode===p[0])+'">'+p[1]+'</button>'; }).join('')+
          '<button type="button" data-t="offline" aria-pressed="'+offline+'">Kein Netz</button>'+
        '</div>';
    }
    draw();
    box.addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.m){ mode = b.dataset.m; draw(); reload(); return; }
      switch (b.dataset.t){
        case 'day': offset++; draw(); reload(); break;
        case 'form': {
          var team = USERS[user].teams[0], names = ['Leo Neumann','Clara Vogel','Jonas Fuchs','Mila Wolf','Tom Berg'];
          kids.push({id:'k'+(nextId++), team:team, name:names[nextId%names.length], jg:2018, count:1, first:today(), last:today(), status:'probetraining', parent:'Elternteil Neu', phone:'0170 0000099', since:null});
          reload(); break;
        }
        case 'user': user = user==='jan' ? 'kathrin' : 'jan'; try{ localStorage.removeItem('pt-team'); }catch(_){} draw(); reload(); break;
        case 'reset': seed(); offset=0; mode='ok'; offline=false; draw(); reload(); break;
        case 'offline': offline = !offline; draw(); break;
      }
    });
  });
})();
