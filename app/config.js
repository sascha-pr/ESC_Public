/* Einstellungen der Trainer-App – hier zentral ändern. */
window.ESC_CONFIG = {
  /* Adresse des Elternformulars (ohne Login) für den QR-Code einer Mannschaft.
     Läuft die App unter probetraining.<APP-DOMAIN>, liegt das Formular unter anmeldung.<APP-DOMAIN>;
     lokal (wrangler dev) unter /anmeldung/ auf derselben Adresse. */
  formUrlFor: function (team) {
    var h = location.hostname;
    var base = /^probetraining\./.test(h)
      ? 'https://' + h.replace(/^probetraining\./, 'anmeldung.') + '/'
      : location.origin + '/anmeldung/';
    return base + '?m=' + encodeURIComponent(team.id);
  }
};
