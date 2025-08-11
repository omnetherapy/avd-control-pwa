const { DefaultAzureCredential } = require("@azure/identity");
const axios = require("axios");

module.exports = async function (context, req) {
  try {
    // Log all environment variables (except secrets)
    context.log("TENANT_ID:", process.env.TENANT_ID);
    context.log("CLIENT_ID:", process.env.CLIENT_ID);
    context.log("SUBSCRIPTION_ID:", process.env.SUBSCRIPTION_ID);
    context.log("RESOURCE_GROUP:", process.env.RESOURCE_GROUP);
    context.log("VM_NAME:", process.env.VM_NAME);

    // Check for missing variables
    const requiredVars = [
      "TENANT_ID",
      "CLIENT_ID",
      "CLIENT_SECRET",
      "SUBSCRIPTION_ID",
      "RESOURCE_GROUP",
      "VM_NAME",
    ];

    for (let v of requiredVars) {
      if (!process.env[v]) {
        throw new Error(`Missing environment variable: ${v}`);
      }
    }

    // Get Azure token
    const credential = new DefaultAzureCredential();
    const tokenResponse = await credential.getToken(
      "https://management.azure.com/.default"
    );

    if (!tokenResponse || !tokenResponse.token) {
      throw new Error("Failed to acquire Azure token");
    }

    // Call Azure API to get VM status
    const url = `https://management.azure.com/subscriptions/${process.env.SUBSCRIPTION_ID}/resourceGroups/${process.env.RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${process.env.VM_NAME}/instanceView?api-version=2022-03-01`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${tokenResponse.token}` },
    });

    // Return status
    const statuses = response.data.statuses || [];
    const powerStatus = statuses.find((s) => s.code && s.code.startsWith("PowerState/"));
    context.res = {
      status: 200,
      body: `VM Status: ${powerStatus ? powerStatus.displayStatus : "Unknown"}`,
    };

  } catch (err) {
    // Log and return error
    context.log.error("Error in avd-status function:", err.message);
    context.res = {
      status: 500,
      body: `Error: ${err.message}`,
    };
  }
};
