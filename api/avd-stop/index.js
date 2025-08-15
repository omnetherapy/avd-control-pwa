// /api/avd-stop/index.js
const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");
const { requireRole } = require("../utils");

module.exports = async function (context, req) {
  try {
    // Only AVD Administrators can stop the VM
    await requireRole(req, ["AVD_Administrators"]);

    const {
      TENANT_ID, CLIENT_ID, CLIENT_SECRET,
      SUBSCRIPTION_ID, RESOURCE_GROUP, VM_NAME
    } = process.env;

    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !SUBSCRIPTION_ID || !RESOURCE_GROUP || !VM_NAME) {
      throw new Error("Missing required environment variables.");
    }

    // Get Azure access token
    const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
    const tokenResp = await credential.getToken("https://management.azure.com/.default");
    if (!tokenResp || !tokenResp.token) throw new Error("Failed to acquire Azure access token.");

    // Send stop (deallocate) request to Azure
    const url = `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${VM_NAME}/deallocate?api-version=2023-09-01`;
    const r = await axios.post(url, null, {
      headers: { Authorization: `Bearer ${tokenResp.token}` },
      timeout: 30000
    });

    context.log(`Stop request sent for VM '${VM_NAME}', status: ${r.status}`);

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { success: true, message: `VM '${VM_NAME}' stop request sent.`, statusCode: r.status }
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
