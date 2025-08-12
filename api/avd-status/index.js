const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");

module.exports = async function (context, req) {
  try {
    const tenantId = process.env.TENANT_ID;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const subscriptionId = process.env.SUBSCRIPTION_ID;
    const resourceGroup = process.env.RESOURCE_GROUP;
    const vmName = process.env.VM_NAME;

    if (!tenantId || !clientId || !clientSecret || !subscriptionId || !resourceGroup || !vmName) {
      throw new Error("Missing required environment variables.");
    }

    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const tokenResponse = await credential.getToken("https://management.azure.com/.default");

    const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vmName}/instanceView?api-version=2023-09-01`;

    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${tokenResponse.token}` }
    });

    // Debug: log full Azure response
    context.log("Full Azure VM response:", JSON.stringify(res.data, null, 2));

    // Try both possible paths for statuses
    const statuses =
      res.data.statuses ||
      res.data.instanceView?.statuses ||
      [];

    context.log("Statuses array:", statuses);

    let state = "Unknown";
    if (Array.isArray(statuses)) {
      const powerState = statuses.find(s => s.code && s.code.startsWith("PowerState/"));
      if (powerState && powerState.displayStatus) {
        state = powerState.displayStatus;
      }
    }

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { success: true, message: `VM is currently: ${state}`, state }
    };

  } catch (err) {
    context.log("Error in avd-status:", err.message || err);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { success: false, error: err.message || "Failed to retrieve VM status" }
    };
  }
};
