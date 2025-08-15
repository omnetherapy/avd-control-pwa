const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");
const { requireRole } = require("../utils"); // Import the shared role helper

module.exports = async function (context, req) {
  const principal = requireRole(context, req, ["avd-operator", "avd-admin"]);
  if (!principal) return;
  
  try {
    const principal = getClientPrincipal(req);
    if (!principal || !principal.userRoles.some(r => r === "starter" || r === "admin")) {
      context.res = {
        status: 403,
        headers: { "Content-Type": "application/json" },
        body: { success: false, error: "Forbidden: requires role 'starter' or 'admin'." }
      };
      return;
    }

    const { TENANT_ID, CLIENT_ID, CLIENT_SECRET, SUBSCRIPTION_ID, RESOURCE_GROUP, VM_NAME } = process.env;
    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !SUBSCRIPTION_ID || !RESOURCE_GROUP || !VM_NAME) {
      throw new Error("Missing required environment variables.");
    }

    const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
    const tokenResponse = await credential.getToken("https://management.azure.com/.default");

    const url = `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${VM_NAME}/start?api-version=2023-09-01`;

    await axios.post(url, null, { headers: { Authorization: `Bearer ${tokenResponse.token}` } });

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { success: true, message: "VM start initiated successfully." }
    };

  } catch (err) {
    context.log("Error in avd-start:", err.message || err);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { success: false, error: err.message || "Failed to start VM" }
    };
  }
};
