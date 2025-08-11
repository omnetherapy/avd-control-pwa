const fetch = require("node-fetch");

async function getAccessToken() {
    const res = await fetch(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            scope: "https://management.azure.com/.default",
            grant_type: "client_credentials"
        })
    });
    const data = await res.json();
    return data.access_token;
}

module.exports = async function (context, req) {
    try {
        const token = await getAccessToken();
        const url = `https://management.azure.com/subscriptions/${process.env.SUBSCRIPTION_ID}/resourceGroups/${process.env.RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${process.env.VM_NAME}/instanceView?api-version=2023-03-01`;
        
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        const status = data.statuses.find(s => s.code.includes("PowerState")).displayStatus;

        context.res = { status: 200, body: { status } };
    } catch (err) {
        context.res = { status: 500, body: { error: err.message } };
    }
};
