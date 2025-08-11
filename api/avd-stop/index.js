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

    const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vmName}/deallocate?api-version=2023-09-01`;

    await axios.post(url, null, {
      headers: { Authorization: `Bearer ${tokenResponse.token}` }
    });

    context.res = {
      status: 200,
      body: { message: "VM stopped successfully" }
    };
  } catch (err) {
    context.log("Error:", err.message || err);
    context.res = {
      status: 500,
      body: { error: "Failed to stop VM", details: err.message || err }
    };
  }
};
