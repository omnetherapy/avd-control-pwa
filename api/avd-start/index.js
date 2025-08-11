const fetch = require("node-fetch");
const getAccessToken = require("../shared/getToken"); // if you reuse

module.exports = async function (context) {
    const token = await getAccessToken();
    const url = `https://management.azure.com/subscriptions/${process.env.SUBSCRIPTION_ID}/resourceGroups/${process.env.RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${process.env.VM_NAME}/start?api-version=2023-03-01`;

    const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
    });

    context.res = { status: res.status, body: { message: "VM start requested" } };
};
