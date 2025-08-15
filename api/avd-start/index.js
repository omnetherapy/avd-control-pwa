// /api/avd-start/index.js
const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");
const { requireGroup, getConfiguredGroupIds } = require("../utils");

module.exports = async function (context, req) {
  try {
    const { users, admins } = getConfiguredGroupIds();
    // Users + Admins can start
    await requireGroup(req, [users, admins].filter(Boolean));

    const {
      TENANT_ID, CLIENT_ID, CLIENT_SECRET,
      SUBSCRIPTION_ID, RESOURCE_GROUP, VM_NAME,
    } = process.env;

    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !SUBSCRIPTION_ID || !RESOURCE_GROUP || !VM_NAME) {
      throw new Error("Missing required environment variables.");
    }

    const cred = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
    const token = (await cred.getToken("https://management.azure.com/.default"))?.token;
    if (!token) throw new Error("Failed to acquire Azure access token.");

    const url = `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${VM_NAME}/start?api-version=2023-09-01`;
    const r = await axios.post(url, null, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000
    });

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { success: true, message: `VM '${VM_NAME}' start request sent.`, statusCode: r.status }
    };
  } catch (err) {
    context.log.error("Error in avd-start:", err?.message || err);
    context.res = {
      status: err.status || err?.response?.status || 500,
      headers: { "Content-Type": "application/json" },
      body: { success: false, error: err.message || "Failed to start VM", details: err.response?.data || null }
    };
  }
};
