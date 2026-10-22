import { config } from '../config.js';

// DRAFT privacy notice written from how the software actually behaves. It needs review by a lawyer
// before real users sign up (India's DPDP Act; GDPR if anyone in the EU/UK uses it). Fill in the contact details.
export const privacyHtml = () => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacy notice - Shared Living</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:16px;color:#1e2420;background:#f6f5f1}h1,h2{line-height:1.25}code{background:#e8f2ec;padding:1px 5px;border-radius:5px}.note{border-left:4px solid #b4531c;padding:8px 12px;background:#fbefe6}@media(prefers-color-scheme:dark){body{background:#121614;color:#e9eeea}.note{background:#2a1d14}code{background:#1f2e25}}</style></head><body>
<h1>Privacy notice</h1>
<p class="note"><b>Draft.</b> This notice describes what the software does today. It has not been reviewed by a lawyer.</p>
<h2>What we save</h2>
<ul><li>Your WhatsApp number and the name on your WhatsApp profile (or the name you give).</li>
<li>Messages you send to the assistant (text, and the transcript of voice notes; the audio itself is not stored).</li>
<li>Your household's records: groceries, expenses, contributions, meal plans, tasks, pantry, price entries.</li>
<li>Your personal meal log. It is <b>private</b> unless you choose to share a summary (only counts, never meal names).</li>
<li>Technical logs: message ids, what the assistant understood, time stamps, errors.</li></ul>
<h2>Why</h2><p>Only to run the service: plan meals, keep the shopping list, track the shared food budget and send reminders you asked for. We do not sell your data and do not show ads.</p>
<h2>Who processes it</h2><ul><li>Meta (WhatsApp Business Platform) to send and receive messages.</li><li>An AI provider (Anthropic or OpenAI, when enabled) to understand messages the simple rules cannot, and to transcribe voice notes. Only the message text and your household members' first names are sent.</li><li>Our hosting and database provider.</li></ul>
<h2>Your choices</h2>
<ul><li>Send <code>STOP</code> to stop all messages. Send <code>START</code> to resume.</li><li>Send <code>export my data</code> (or use the dashboard) to download your data.</li><li>Send <code>delete my data</code> (or use the dashboard) to erase your personal data. Shared expense records stay with an anonymised name so the household's balances remain correct. A household admin can delete the whole household.</li></ul>
<h2>Money</h2><p>The assistant only records who paid and who owes whom. It never holds or moves money.</p>
<h2>Health</h2><p>Food feedback is general guidance, not medical advice.</p>
<h2>Retention</h2><p>Records are kept until you or your household delete them. Login links expire in ${config.loginLinkTtlMin} minutes and work once.</p>
<h2>Contact</h2><p>${process.env.PRIVACY_CONTACT ?? '[add contact email]'}</p>
</body></html>`;
