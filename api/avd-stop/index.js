const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");

module.exports = async function (context, req) {
  try {
    const {
      TENANT_ID, CLIENT_ID, CLIENT_SECRET,
      SUBSCRIPTION_ID, RESOURCE_GROUP, VM_NAME
    } = process.env;

    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !SUBSCRIPTION_ID || !RESOURCE_GROUP || !VM_NAME) {
      throw new Error("Missing environment variables (TENANT_ID/CLIENT_ID/CLIENT_SECRET/SUBSCRIPTION_ID/RESOURCE_GROUP/VM_NAME).");
    }

    const cred = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
    const tokenResp = await cred.getToken("https://management.azure.com/.default");
    if (!tokenResp || !tokenResp.token) throw new Error("Failed to acquire access token.");

    // Recommended: deallocate frees the VM (release compute). If you prefer a soft power off use "powerOff".
    const url = `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${VM_NAME}/deallocate?api-version=2023-09-01`;
    // alt: .../powerOff?api-version=...

    const r = await axios.post(url, null, {
      headers: { Authorization: `Bearer ${tokenResp.token}` },
      timeout: 30000
    });

    context.log(`Stop (deallocate) request status: ${r.status}`);
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { success: true, message: `Stop (deallocate) request sent for VM '${VM_NAME}'.`, statusCode: r.status }
    };
  } catch (err) {
    context.log.error("Error in avd-stop:", err?.message || err);
    context.res = {
      status: err?.response?.status || 500,
      headers: { "Content-Type": "application/json" },
      body: { success: false, error: err.message || "Failed to stop VM", details: err.response?.data || null }
    };
  }
};
