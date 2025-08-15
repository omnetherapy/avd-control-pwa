const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");

function getClientPrincipal(req) {
  const hdr = req.headers["x-ms-client-principal"];
  if (!hdr) return null;
  try {
    const json = Buffer.from(hdr, "base64").toString("utf8");
    const p = JSON.parse(json);
    p.userRoles = p.userRoles || [];
    return p;
  } catch {
    return null;
  }
}

module.exports = async function (context, req) {
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
