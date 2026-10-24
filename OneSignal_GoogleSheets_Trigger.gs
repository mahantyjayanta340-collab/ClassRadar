/**
 * ==============================================================================
 * CLASSRADAR V16 - ONESIGNAL GOOGLE SHEETS AUTOMATED PUSH NOTIFICATION ENGINE
 * ==============================================================================
 * Connects your Google Sheets Control Panel directly to OneSignal API v2
 * to deliver instant mobile and web push notifications to students even when
 * their phones are locked or browser tabs are closed.
 */

// ==========================================
// 1. CONFIGURATION (REPLACE WITH YOUR KEYS)
// ==========================================
const ONESIGNAL_APP_ID = "YOUR_ONESIGNAL_APP_ID"; // From OneSignal: Settings > Keys & IDs
const ONESIGNAL_REST_API_KEY = "YOUR_ONESIGNAL_REST_API_KEY"; // From OneSignal: Settings > Keys & IDs (os_v2_app_...)
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
 * Core OneSignal API v2 Dispatcher (Supports both os_v2_app_ keys and legacy keys)
 * @param {string} title Headline of the notification
 * @param {string} message Body text of the notification
 * @param {string} sectionFilter Optional: "E", "SEC_E", "D", "A", or "ALL"
 * @param {string} targetUrl Optional: URL to open when clicked
 */
function sendOneSignalPush(title, message, sectionFilter = "ALL", targetUrl = CLASSRADAR_URL) {
  const cleanAppId = String(ONESIGNAL_APP_ID || "").trim();
  const cleanApiKey = String(ONESIGNAL_REST_API_KEY || "").trim();

  if (!cleanAppId || cleanAppId === "YOUR_ONESIGNAL_APP_ID" || !cleanApiKey || cleanApiKey === "YOUR_ONESIGNAL_REST_API_KEY") {
    throw new Error("Please paste your ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY at the top of the script first!");
  }

  const endpoint = "https://api.onesignal.com/notifications";

  // Normalize Authorization header for OneSignal v2 keys (os_v2_...) vs legacy keys
  const authHeader = cleanApiKey.startsWith("os_v2_")
    ? ("Key " + cleanApiKey)
    : ("Basic " + cleanApiKey);

  const basePayload = {
    app_id: cleanAppId,
    target_channel: "push",
    headings: { en: String(title || "ClassRadar Alert") },
    contents: { en: String(message || "New campus update available.") },
    priority: 10
  };

  // Only attach URL/Icon if user replaced the placeholder URL
  if (targetUrl && !targetUrl.includes("your-username.github.io")) {
    basePayload.url = targetUrl;
  }
  if (CLASSRADAR_ICON && !CLASSRADAR_ICON.includes("your-username.github.io")) {
    basePayload.chrome_web_icon = CLASSRADAR_ICON;
    basePayload.chrome_web_badge = CLASSRADAR_ICON;
  }

  const cleanSec = String(sectionFilter || "ALL").trim().toUpperCase();

  // Target specific section or all subscribed users
  if (cleanSec && cleanSec !== "ALL" && cleanSec !== "ALL SECTIONS") {
    const shortSec = cleanSec.replace(/^SEC_/, "").replace(/^SECTION\s*/, "").trim();
    const fullSec = "SEC_" + shortSec;
    basePayload.filters = [
      { field: "tag", key: "section", relation: "=", value: fullSec },
      { operator: "OR" },
      { field: "tag", key: "section", relation: "=", value: shortSec },
      { operator: "OR" },
      { field: "tag", key: "section_code", relation: "=", value: shortSec }
    ];
  } else {
    // Default segment in OneSignal v2 is "Total Subscriptions"
    basePayload.included_segments = ["Total Subscriptions", "Subscribed Users"];
  }

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: authHeader,
      Accept: "application/json"
    },
    payload: JSON.stringify(basePayload),
    muteHttpExceptions: true
  };

  let response = UrlFetchApp.fetch(endpoint, options);
  let responseCode = response.getResponseCode();
  let responseBody = response.getContentText();

  Logger.log("OneSignal Primary Response (" + responseCode + "): " + responseBody);

  // Fallback: if segment name mismatch occurs on custom OneSignal setup, use universal session filter
  if ((responseCode >= 400 || responseBody.includes("Segment")) && basePayload.included_segments) {
    delete basePayload.included_segments;
    basePayload.filters = [
      { field: "last_session", relation: ">", value: "0" }
    ];
    options.payload = JSON.stringify(basePayload);
    response = UrlFetchApp.fetch(endpoint, options);
    responseCode = response.getResponseCode();
    responseBody = response.getContentText();
    Logger.log("OneSignal Fallback Filter Response (" + responseCode + "): " + responseBody);
  }

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
    ui.alert("Success!", "Push notification dispatched! ID: " + (res.id || "Sent"), ui.ButtonSet.OK);
  } catch (err) {
    ui.alert("Push Failed", err.message, ui.ButtonSet.OK);
  }
}

/**
 * Menu Action: Target Specific Section (E, D, A...)
 */
function menuSectionNotice() {
  const ui = SpreadsheetApp.getUi();
  const secPrompt = ui.prompt("🎯 Section Alert", "Enter Target Section (e.g. E, D, A, FG):", ui.ButtonSet.OK_CANCEL);
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
    const res = sendOneSignalPush(
      "🔔 ClassRadar Live Test",
      "Your mobile & web push notification system is connected and working!",
      "ALL"
    );
    SpreadsheetApp.getUi().alert("Test Successful!", "Notification dispatched (ID: " + (res.id || "OK") + "). Check your phone or browser!", SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (err) {
    SpreadsheetApp.getUi().alert("Test Failed", err.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Automated Trigger: Fired when edits occur in your Control Panel Google Sheet.
 * Works on Sheet1, Control_Panel, Notices, or any tab (except Timetable_Master).
 */
function autoPushOnEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName().toLowerCase();

  // Only skip if editing the 245-row Timetable_Master tab
  if (sheetName.includes("timetable_master") || sheetName.includes("master_routine")) {
    return;
  }

  const row = e.range.getRow();
  if (row <= 1) return; // Skip header row

  const lastCol = Math.max(sheet.getLastColumn(), 8);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  const rowValues = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

  function getCol(aliases, defaultIdx) {
    for (let a of aliases) {
      const cleanA = a.toLowerCase().replace(/[^a-z0-9]/g, "");
      const idx = headers.indexOf(cleanA);
      if (idx !== -1 && rowValues[idx] !== undefined && String(rowValues[idx]).trim() !== "") {
        return String(rowValues[idx]).trim();
      }
    }
    if (defaultIdx !== undefined && rowValues[defaultIdx] !== undefined) {
      return String(rowValues[defaultIdx]).trim();
    }
    return "";
  }

  // Standard Control Panel Columns:
  // Col A (0): Type | Col B (1): Date | Col C (2): Title_Or_Reason | Col D (3): Message
  // Col E (4): TargetSection | Col F (5): Priority_Or_Category | Col G (6): DisableReminders | Col H (7): Status
  const type = getCol(["type"], 0).toUpperCase();
  const dateVal = getCol(["date"], 1);
  const title = getCol(["titleorreason", "title", "reason"], 2);
  const message = getCol(["message", "displaymessage", "details"], 3);
  const section = getCol(["targetsection", "affectedsection", "section"], 4) || "ALL";
  let status = getCol(["status", "isactive"], 7);

  // Also scan row if "Active" or "YES" was placed in another column
  if (!status) {
    for (let i = 0; i < rowValues.length; i++) {
      const v = String(rowValues[i] || "").trim().toUpperCase();
      if (v === "ACTIVE" || v === "INACTIVE") {
        status = v;
        break;
      }
    }
  }

  // Only push when the row has a Title and its Status is Active (or default active)
  if (!title) return;
  if (status && status.toUpperCase() !== "ACTIVE" && status.toUpperCase() !== "YES") return;

  // Prevent duplicate pushes for the exact same unedited row content within 60 seconds
  const cache = CacheService.getScriptCache();
  const fingerprint = "push_" + row + "_" + type + "_" + title + "_" + message + "_" + section + "_" + status;
  if (cache.get(fingerprint)) {
    return;
  }
  cache.put(fingerprint, "sent", 60);

  const prefix = (type === "HOLIDAY" || type === "OFF")
    ? "🌴 Holiday Notice: "
    : (type === "EXAM" ? "📝 Exam Alert: " : "📢 Campus Notice: ");

  const pushTitle = prefix + title;
  const pushBody = message || (dateVal ? ("Scheduled for " + dateVal) : "Open ClassRadar for full details.");

  sendOneSignalPush(pushTitle, pushBody, section);
}

/**
 * Installs persistent onEdit trigger with full UrlFetchApp permissions
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

  SpreadsheetApp.getUi().alert(
    "✅ Automated Trigger Active!",
    "Your Control Panel sheet is now linked to OneSignal. Whenever you add or edit an Active row (Holiday or Notice), a push notification will automatically be sent to students!",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
