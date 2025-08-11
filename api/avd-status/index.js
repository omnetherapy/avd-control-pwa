const { DefaultAzureCredential, ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");

module.exports = async function (context, req) {
    const tenantId = process.env.TENANT_ID;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const subscriptionId = process.env.SUBSCRIPTION_ID;
    const resourceGroup = process.env.RESOURCE_GROUP;
    const vmName = process.env.VM_NAME;

    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

    // Get token
    const tokenResponse = await credential.getToken("https://management.azure.com/.default");

    // Call Azure API
    const statusUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vmName}/instanceView?api-version=2022-08-01`;

    try {
        const response = await axios.get(statusUrl, {
            headers: {
                Authorization: `Bearer ${tokenResponse.token}`
            }
        });

        const statuses = response.data.statuses;
        const powerState = statuses.find(s => s.code.startsWith("PowerState/")).displayStatus;

        context.res = {
            status: 200,
            body: { status: powerState }
        };
    } catch (error) {
        context.res = {
            status: 500,
            body: { error: error.message }
        };
    }
};
