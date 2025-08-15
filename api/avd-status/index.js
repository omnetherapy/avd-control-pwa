// /api/avd-status/index.js
const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");
const { requireGroup } = require("../utils");

module.exports = async function (context, req) {
  try {
    // Allow AVD Users OR AVD Administrators
    await requireGroup(req, [
      process.env.AVD_USERS_GROUP_ID,
      process.env.AVD_ADMINISTRATORS_GROUP_ID
    ]);

    const {
      TENANT_ID, CLIENT_ID, CLIENT_SECRET,
      SUBSCRIPTION_ID, RESOURCE_GROUP, VM_NAME
    } = process.env;

    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !SUBSCRIPTION_ID || !RESOURCE_GROUP || !VM_NAME) {
      throw new Error("Missing required environment variables.");
    }

    const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
    const token = await credential.getToken("https://management.azure.com/.default");
    if (!token?.token) throw new Error("Failed to acquire Azure access token.");

    const url = `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${VM_NAME}/instanceView?api-version=2023-09-01`;
    const r = await axios.get(url, {
      headers: { Authorization: `Bearer ${token.token}` },
      timeout: 30000
    });

    const statuses = r.data?.statuses || [];
    const powerState = statuses.find(s => s.code?.startsWith("PowerState/"))?.displayStatus || "Unknown";

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { success: true, vmName: VM_NAME, powerState }
    };
  } catch (err) {
    context.log.error("avd-status error:", err?.message || err);
    context.res = {
      status: err?.status || err?.response?.status || 500,
      headers: { "Content-Type": "application/json" },
      body: { success: false, error: err.message || "Failed to retrieve VM status", details: err.response?.data || null }
    };
  }
};
