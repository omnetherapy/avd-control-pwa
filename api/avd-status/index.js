const { DefaultAzureCredential } = require("@azure/identity");
const { ComputeManagementClient } = require("@azure/arm-compute");

module.exports = async function (context, req) {
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    const resourceGroupName = process.env.AVD_RESOURCE_GROUP;
    const vmName = process.env.AVD_VM_NAME;

    try {
        const credential = new DefaultAzureCredential();
        const client = new ComputeManagementClient(credential, subscriptionId);
        const vm = await client.virtualMachines.instanceView(resourceGroupName, vmName);
        const powerState = vm.statuses.find(s => s.code.startsWith("PowerState/")).displayStatus;
        
        context.res = {
            body: { status: powerState }
        };
    } catch (err) {
        context.res = { status: 500, body: { error: err.message } };
    }
};
