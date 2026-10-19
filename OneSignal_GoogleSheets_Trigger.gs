/**
 * ==============================================================================
 * CLASSRADAR - ONESIGNAL GOOGLE SHEETS AUTOMATED PUSH NOTIFICATION ENGINE
 * ==============================================================================
 * Connects your Google Sheets Master Database / Control Panel directly to
 * OneSignal REST API to deliver instant mobile and web push notifications
 * to students even when their phones are locked or browser tabs are closed.
 */

// ==========================================
// 1. CONFIGURATION (REPLACE WITH YOUR KEYS)
// ==========================================
const ONESIGNAL_APP_ID = "YOUR_ONESIGNAL_APP_ID"; // From OneSignal: Settings > Keys & IDs
const ONESIGNAL_REST_API_KEY = "YOUR_ONESIGNAL_REST_API_KEY"; // From OneSignal: Settings > Keys & IDs
const CLASSRADAR_URL = "https://your-username.github.io/ClassRadar/"; // Your deployed ClassRadar URL
const CLASSRADAR_ICON = "https://your-username.github.io/ClassRadar/icon-192.png";

/**
 * Creates custom ClassRadar menu in Google Sheets on sheet open
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🔔 ClassRadar Push")
    .addItem("📢 Broadcast Notice to All Students", "menuBroadcastNotice")
    .addItem("🎯 Send Alert to Specific Section", "menuSectionNotice")
    .addItem("🧪 Send Test Push Notification", "sendTestNotification")
    .addSeparator()
    .addItem("⚙️ Setup Automated onEdit Trigger", "installSheetTrigger")
    .addToUi();
}

/**
 * Core OneSignal REST API Dispatcher
 * @param {string} title Headline of the notification
 * @param {string} message Body text of the notification
 * @param {string} sectionFilter Optional: "E", "D", "A", or "ALL"
 * @param {string} targetUrl Optional: URL to open when clicked
 */
function sendOneSignalPush(title, message, sectionFilter = "ALL", targetUrl = CLASSRADAR_URL) {
  if (!ONESIGNAL_APP_ID || ONESIGNAL_APP_ID === "YOUR_ONESIGNAL_APP_ID") {
    throw new Error("Please set your ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in the script first!");
  }

  const endpoint = "https://onesignal.com/api/v1/notifications";

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: title },
    contents: { en: message },
    url: targetUrl,
    chrome_web_icon: CLASSRADAR_ICON,
    chrome_web_badge: CLASSRADAR_ICON,
    priority: 10 // High priority for instant delivery
  };

  // Target specific section or all students
  if (sectionFilter && sectionFilter !== "ALL") {
    payload.filters = [
      { field: "tag", key: "section", relation: "=", value: String(sectionFilter).trim().toUpperCase() }
    ];
  } else {
    payload.included_segments = ["Subscribed Users"];
  }

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Basic " + ONESIGNAL_REST_API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(endpoint, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  Logger.log("OneSignal Response: " + responseCode + " - " + responseBody);

  if (responseCode >= 200 && responseCode < 300) {
    return JSON.parse(responseBody);
  } else {
    throw new Error("OneSignal API Error (" + responseCode + "): " + responseBody);
  }
}

/**
 * Menu Action: Broadcast to All Students
 */
function menuBroadcastNotice() {
  const ui = SpreadsheetApp.getUi();
  const titlePrompt = ui.prompt("📢 Campus Broadcast", "Enter Notification Title (e.g. Durga Puja Holiday):", ui.ButtonSet.OK_CANCEL);
  if (titlePrompt.getSelectedButton() !== ui.Button.OK) return;
  const title = titlePrompt.getResponseText();

  const msgPrompt = ui.prompt("📢 Campus Broadcast", "Enter Notification Message / Reason:", ui.ButtonSet.OK_CANCEL);
  if (msgPrompt.getSelectedButton() !== ui.Button.OK) return;
  const message = msgPrompt.getResponseText();

  try {
    const res = sendOneSignalPush(title, message, "ALL");
    ui.alert("Success!", "Push notification sent to " + (res.recipients || "all") + " subscribed students.", ui.ButtonSet.OK);
  } catch (err) {
    ui.alert("Push Failed", err.message, ui.ButtonSet.OK);
  }
}

/**
 * Menu Action: Target Specific Section (E, D, A...)
 */
function menuSectionNotice() {
  const ui = SpreadsheetApp.getUi();
  const secPrompt = ui.prompt("🎯 Section Alert", "Enter Target Section ID (e.g. E, D, A):", ui.ButtonSet.OK_CANCEL);
  if (secPrompt.getSelectedButton() !== ui.Button.OK) return;
  const section = secPrompt.getResponseText();

  const titlePrompt = ui.prompt("🎯 Section Alert", "Enter Notification Title:", ui.ButtonSet.OK_CANCEL);
  if (titlePrompt.getSelectedButton() !== ui.Button.OK) return;
  const title = titlePrompt.getResponseText();

  const msgPrompt = ui.prompt("🎯 Section Alert", "Enter Message (e.g. Room changed to 327):", ui.ButtonSet.OK_CANCEL);
  if (msgPrompt.getSelectedButton() !== ui.Button.OK) return;
  const message = msgPrompt.getResponseText();

  try {
    const res = sendOneSignalPush(title, message, section);
    ui.alert("Success!", "Push notification sent to Section " + section + " students.", ui.ButtonSet.OK);
  } catch (err) {
    ui.alert("Push Failed", err.message, ui.ButtonSet.OK);
  }
}

/**
 * Test Push Notification
 */
function sendTestNotification() {
  try {
    const res = sendOneSignalPush("🔔 ClassRadar Push Test", "Your mobile & web notification pipeline is working perfectly!", "ALL");
    SpreadsheetApp.getUi().alert("Test Successful", "Test notification dispatched successfully.", SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (err) {
    SpreadsheetApp.getUi().alert("Test Failed", err.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Automated Trigger: Fired when edits occur in Google Sheets
 * When you change status to 'Active', it automatically pushes to students!
 */
function autoPushOnEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName().toLowerCase();

  // Match sheets containing 'notice', 'control', or 'offday'
  if (!sheetName.includes("notice") && !sheetName.includes("control") && !sheetName.includes("offday")) {
    return;
  }

  const row = e.range.getRow();
  if (row <= 1) return; // Skip headers

  const rowValues = sheet.getRange(row, 1, 1, 10).getValues()[0];
  
  // Find Status, Title, and Message
  // Example Row: [Type, Date, Section, Title_Or_Reason, Message, Status, ...]
  let type = String(rowValues[0] || "");
  let section = String(rowValues[2] || "ALL");
  let title = String(rowValues[3] || "");
  let message = String(rowValues[4] || "");
  let status = String(rowValues[5] || "");

  // Fallback checks if columns are shifted
  for (let i = 0; i < rowValues.length; i++) {
    const val = String(rowValues[i]).trim();
    if (val.toUpperCase() === "ACTIVE" || val.toUpperCase() === "YES") {
      status = "ACTIVE";
    }
  }

  if (status.toUpperCase() === "ACTIVE" && title) {
    const pushTitle = (type.toUpperCase() === "HOLIDAY" ? "🌴 Holiday Notice: " : "📢 Campus Alert: ") + title;
    sendOneSignalPush(pushTitle, message || "Check your ClassRadar schedule for details.", section);
  }
}

/**
 * Installs persistent onChange / onEdit triggers with permissions
 */
function installSheetTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "autoPushOnEdit") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("autoPushOnEdit")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert("Automated Trigger Installed", "Google Sheets will now automatically send OneSignal push notifications whenever an active notice or holiday row is edited.", SpreadsheetApp.getUi().ButtonSet.OK);
}
