/**
 * FITNOVA verification-mail relay (Google Apps Script web app).
 *
 * Setup: script.google.com -> project -> paste this file -> Project Settings -> Script properties:
 *   FITNOVA_SECRET = same value as GOOGLE_APPS_SCRIPT_SECRET on the API server.
 * Deploy -> Manage deployments -> edit (pencil) -> Version: "New version" -> Deploy.
 *   Execute as: Me   /   Who has access: Anyone
 * The deployment URL stays the same when you deploy a NEW VERSION of the existing deployment.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('FITNOVA_SECRET');
    if (!secret || data.secret !== secret) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    if (!data.to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.to)) {
      return json_({ ok: false, error: 'bad recipient' });
    }
    MailApp.sendEmail({
      to: data.to,
      subject: data.subject || 'FITNOVA 인증 코드',
      body: data.body || ('인증 코드: ' + data.code),   // plain-text fallback
      htmlBody: data.htmlBody || undefined,              // the branded HTML design sent by the API
      name: 'FITNOVA'
    });
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
