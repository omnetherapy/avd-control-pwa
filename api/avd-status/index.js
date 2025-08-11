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

    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const tokenResponse = await credential.getToken("https://management.azure.com/.default");

    const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vmName}/instanceView?api-version=2023-09-01`;

    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${tokenResponse.token}` }
    });

    const statuses = res.data.statuses || [];
    const powerState = statuses.find(s => s.code && s.code.startsWith("PowerState/"));
    const state = powerState ? powerState.displayStatus : "Unknown";

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        success: true,
        message: `VM is currently: ${state}`,
        state
      }
    };
  } catch (err) {
    context.log("Error fetching VM status:", err);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: {
        success: false,
        error: err.message || "Failed to retrieve VM status"
      }
    };
  }
};
