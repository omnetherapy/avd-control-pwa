const { DefaultAzureCredential } = require("@azure/identity");
const { ComputeManagementClient } = require("@azure/arm-compute");

module.exports = async function (context, req) {
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    const resourceGroupName = process.env.AVD_RESOURCE_GROUP;
    const vmName = process.env.AVD_VM_NAME;

    try {
        const credential = new DefaultAzureCredential();
        const client = new ComputeManagementClient(credential, subscriptionId);
        await client.virtualMachines.beginStartAndWait(resourceGroupName, vmName);
        
        context.res = { body: { message: "AVD started successfully" } };
    } catch (err) {
        context.res = { status: 500, body: { error: err.message } };
    }
};
